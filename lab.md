# Week 5 Lab — Watch the edge lie to you

**35 minutes.** Individual — one student, two terminals, two synthetic accounts. Runs on
Windows, macOS, and Linux with **Node 24 LTS** and **curl**.
Nothing here needs a CDN account, a domain, or a network connection after step 0.

> **Where this fits.** Block A showed the global picture — PoPs, shields, Netflix's
> appliances inside ISPs. `edge.mjs` is one of those PoPs shrunk onto your laptop, so you
> can watch exactly what it stores and for whom. Block B's React/Node app cache is the
> take-home step at the end.

> **What you will have at the end:** four real cache states in a header dump, a reproduced
> "logged-in page served to a stranger" incident, an `axe` report next to a list of defects
> `axe` could not see, and one SLO with an alert rule. Five of these are HW5 evidence.

**The budget.** Steps 0, 2, 4, 5 and 6 are the **core lab: 30 minutes**, leaving five
minutes of recovery margin for the thing that always goes wrong. **Steps 1 and 3 are
optional** — do them if you are moving fast, otherwise do them at home. They are
marked ⏩.

| Step | Min | Core? |
| --- | ---: | --- |
| 0 — Setup | 3 | core |
| ⏩ 1 — Real CDN, cold vs warm | 4 | optional |
| 2 — All four cache states | 8 | **core** |
| ⏩ 3 — Purge vs hashing | 3 | optional |
| 4 — Serve Alice's page to Bob | 7 | **core — never skip** |
| 5 — `axe`, then the keyboard | 7 | **core** |
| 6 — One SLI, SLO, alert | 5 | **core** |

---

## 0. Setup — 3 minutes

Everything runs from the course sample directory.

```bash
cd weeks/week05/samples
node --version          # course baseline v24 LTS
curl --version | head -1
```

Open **two terminals** in that directory. Terminal 1 runs the origin; terminal 2 runs the
edge. A third terminal (or your existing one) issues the requests.

**Terminal 1 — the origin:**

```bash
node origin.mjs
```

```
origin  listening on http://127.0.0.1:8080
        hashed asset is /assets/app.c4c61eeb.js
```

**Terminal 2 — the edge:**

```bash
node edge.mjs
```

```
edge    listening on http://127.0.0.1:8788  -> origin 127.0.0.1:8080
        cache key mode: conservative
```

> **Windows note.** Use `curl.exe`, not `curl`. In PowerShell, bare `curl` is an alias for
> `Invoke-WebRequest`, which takes different flags and will confuse you for ten minutes.
> Every command below is written with `curl`; on PowerShell type `curl.exe`.

Smoke test:

```bash
curl -sS http://127.0.0.1:8080/healthz
```

```json
{"status":"ok","uptimeSec":3}
```

---

## ⏩ 1. Cold edge, warm edge, origin — 4 minutes *(optional)*

First against a **real CDN**, so you have seen it happen on the internet and not only on
your laptop. This is the only step that needs the network. **Skip it if you are short on
time** — the core lab does not depend on it, and it is a two-minute job at home.

```bash
curl -sS -o /dev/null -D - -A "Mozilla/5.0" \
  -w "\ntiming ttfb=%{time_starttransfer}s total=%{time_total}s\n" \
  "https://www.w3.org/WAI/WCAG22/quickref/?csc436=$RANDOM" \
  | grep -Ei 'HTTP/|cf-cache-status|^age|cf-ray|timing'
```

PowerShell equivalent — and the same thing the capture script does:

```powershell
.\capture-cache-evidence.ps1 -Url "https://www.w3.org/WAI/WCAG22/quickref/"
```

**Possible result.** If this CDN includes the query parameter in its key, a new
value can miss and a repeat can hit. Inspect the headers; neither result is guaranteed.

```
cf-cache-status: MISS
timing  ttfb=0.261s total=0.279s

cf-cache-status: HIT
Age: 2
timing  ttfb=0.136s total=0.152s
```

**Record for HW5:** your own MISS and HIT with timings, and the `CF-RAY` suffix — the
three letters after the dash name the PoP that answered (`-SEA`, `-ORD`, `-FRA`…).

> **Why the query string?** It may create a different key, depending on policy.
> Do not repeatedly cache-bust external sites; the loopback fixture or authorized
> course staging is the place to force cache states.

**If the numbers do not separate:** you are probably very close to a PoP, or the origin is
also fast. Compare `time_starttransfer` and not `time_total`, and try a second site.

---

## 2. All four cache states — 8 minutes

Now the local edge, where you can see the implementation.

`/api/status` is served with `public, max-age=0, s-maxage=10`, and its bytes only change
when someone changes the data. Watch the status header:

```bash
curl -sS -o /dev/null -D - http://127.0.0.1:8788/api/status | grep -Ei 'x-cache-status|^age|^etag'
```

Run that command **now**, then again after **2 seconds**, then again after **11 seconds**:

| When | `x-cache-status` | Why |
| --- | --- | --- |
| first request | `MISS` | nothing stored under this key |
| +2 s | `HIT` | inside `s-maxage`, served from the store |
| +11 s | `REVALIDATED` | stale, but the origin answered `304` — bytes reused |

Now change the data at the origin, bypassing the edge entirely:

```bash
curl -sS -X POST http://127.0.0.1:8080/admin/bump
```

```json
{"revision":2,"printing":"operational"}
```

Wait 11 seconds and request again:

```
x-cache-status: EXPIRED
etag: "zUQqKum0QXlB_rwULvjj"     <- a different ETag
```

**The thing to notice:** `REVALIDATED` and `EXPIRED` are both "the entry went stale". The
difference is entirely whether the **ETag still matched**. Only one of them cost a payload.

Now the endpoint where a validator cannot help. `/api/now` returns a fresh timestamp on
every request:

```bash
curl -sS -o /dev/null -D - http://127.0.0.1:8788/api/now | grep -Ei 'x-cache-status|^etag'
sleep 11
curl -sS -o /dev/null -D - http://127.0.0.1:8788/api/now | grep -Ei 'x-cache-status|^etag'
```

It goes `MISS` → `EXPIRED`, with a **different ETag each time**, and it will do that
forever. Every expiry costs a full payload because `If-None-Match` can never match.

> **Answer these before moving on, one sentence each:** why can `/api/now` never be
> `REVALIDATED`, despite being fresh-cacheable, and what would make its bytes stable enough
> to revalidate? Write it down — it is HW5
> evidence.

> **Bonus, thirty seconds, and it is a real gotcha.** `/api/status` carries `s-maxage`
> and **no** stale directives. That is deliberate. RFC 9111 §5.2.2.10 says `s-maxage`
> "incorporates the semantics of the proxy-revalidate response directive", and §4.2.4
> forbids serving stale when that applies — so `s-maxage=10, stale-while-revalidate=30`
> is **self-cancelling** and the stale window is unreachable. `/api/feed` serves the same
> data with `public, max-age=10, stale-while-revalidate=30, stale-if-error=600` — one TTL
> for everybody, no `s-maxage`, so the stale extensions actually apply.
> **First request both `/api/feed` and `/api/status` while the origin is running
> to populate both cache entries. Wait at least 11 seconds so both are stale.**
> Then stop the origin (`Ctrl+C` in terminal 1) and request each one:
>
> ```bash
> curl -sS -o /dev/null -D - http://127.0.0.1:8788/api/feed   | grep -i x-cache-status
> curl -sS -o /dev/null -D - http://127.0.0.1:8788/api/status | grep -iE 'HTTP/|x-cache-status'
> ```
>
> A primed, stale `/api/feed` answers `STALE`; an unprimed one would return 502,
> and a still-fresh one HIT. `/api/status` answers **504** — its `stale-if-error` would
> have been ignored even if it had one. Restart the origin before step 4.

A reference transcript of this entire sequence is in
[`samples/cache-state-machine.txt`](samples/cache-state-machine.txt). Use it if you fall
behind; do **not** submit it as your own capture.

---

## ⏩ 3. Purge, and why hashing beats it — 3 minutes *(optional)*

The edge accepts a `PURGE` (real CDNs authenticate this; this one does not):

```bash
curl -sS -o /dev/null -D - http://127.0.0.1:8788/assets/app.css   # MISS
curl -sS -o /dev/null -D - http://127.0.0.1:8788/assets/app.css   # HIT
curl -sS -X PURGE http://127.0.0.1:8788/assets/app.css
curl -sS -o /dev/null -D - http://127.0.0.1:8788/assets/app.css   # MISS again
```

```
purged 1 entry for /assets/app.css
```

Now do the same for the **content-addressed** asset and notice you never need to:

```bash
curl -sS -o /dev/null -D - http://127.0.0.1:8788/assets/app.c4c61eeb.js | grep -i 'cache-control\|x-cache'
```

```
cache-control: public, max-age=31536000, immutable
x-cache-status: MISS
```

Change `jsBody` in `origin.mjs` (add a character), restart the origin, and read the new
path it prints. **The URL changed, so the key changed, so there is nothing to invalidate.**
That is the whole argument, demonstrated.

---

## 4. Serve Alice's account page to Bob — 7 minutes

**This is the centrepiece.** Stop both servers (`Ctrl+C` in each terminal).

### 4a. Confirm the safe baseline

```bash
# terminal 1
node origin.mjs
# terminal 2
node edge.mjs
```

```bash
curl -sS -D - -H 'Cookie: sid=sid-alice' http://127.0.0.1:8788/account | grep -Ei 'x-cache-status|x-served-to|Signed in'
curl -sS -D - -H 'Cookie: sid=sid-bob'   http://127.0.0.1:8788/account | grep -Ei 'x-cache-status|x-served-to|Signed in'
```

Both are `BYPASS`, and each user sees their own page. The origin said `private, no-store`,
so the shared cache refused to store it. **This is what correct looks like.**

### 4b. Mistake 1 — a bad deploy at the origin

Stop the **origin** and restart it with the leak. This simulates one line of copy-paste:
`/account` is now advertised `public, max-age=60` and has lost its `Vary: Cookie`.

```bash
# macOS / Linux
LEAK=1 node origin.mjs
```
```powershell
# PowerShell
$env:LEAK=1; node origin.mjs
```

Repeat the two requests. **Nothing leaks.** Both are `MISS`, both users get their own
page — because the edge is in `conservative` mode and puts the cookie in the key anyway.

> Write down what just happened. A serious production bug shipped, and a defensive cache
> key absorbed it. That is defence in depth, and it is the only reason you are not on a
> call right now.

### 4c. Mistake 2 — a cache-key change at the edge

Leave the leaking origin running. Stop the **edge** and restart it keying only on what
`Vary` names — which is the standards-minimal, entirely reasonable behaviour:

```bash
CACHE_KEY=vary-only node edge.mjs
```
```powershell
$env:CACHE_KEY='vary-only'; node edge.mjs
```

Repeat the two requests:

```
$ curl ... -H 'Cookie: sid=sid-alice' .../account
x-cache-status: MISS
x-served-to: S0198442
   Signed in as Alice Nguyen (S0198442)

$ curl ... -H 'Cookie: sid=sid-bob' .../account
x-cache-status: HIT
x-served-to: S0198442          <- Bob's request. Alice's campus ID.
   Signed in as Alice Nguyen (S0198442)
```

**Bob sent his own valid cookie and was correctly authenticated. He was handed Alice's
account page.** Nothing malfunctioned. No error was logged. The cache did exactly what it
was told.

Try `CACHE_KEY=url-only` too — same result, for a slightly different reason.

### 4d. The question that matters

**In one sentence: what alert would have caught this?**

Do not move on until you have an answer written down. (A good one: *any* response on an
authenticated route carrying a cache-status of `HIT` is, by itself, an incident. That is
five lines of synthetic check, and it is a required part of HW5.)

The full four-scenario transcript is in
[`samples/cache-poisoning.txt`](samples/cache-poisoning.txt).

---

## 5. `axe`, then the same page with your hands off the mouse — 7 minutes

Restart the origin **without** `LEAK` and visit <http://127.0.0.1:8080/a11y>.

### 5a. Run the scanner

```bash
npx @axe-core/cli http://127.0.0.1:8080/a11y
```

```
Violation of "color-contrast" with 3 occurrences!
Violation of "image-alt"      with 1 occurrences!
Violation of "tabindex"       with 1 occurrences!

5 Accessibility issues detected.

Please note that only 20% to 50% of all accessibility issues can
automatically be detected. Manual testing is always required.
```

Read that last paragraph. **The tool ships with a disclaimer about the tool.**

If you also run Lighthouse, this page scores **80 / 100** for accessibility.

### 5b. Now use the keyboard, and nothing else

Put your mouse away. Genuinely. Click into the page once and then do not touch it again.
Work down the five-step pass:

1. **Tab from the top.** Can you reach every control? Does the order match what you see?
2. **Can you see where you are?**
3. **Press Enter and Space** on everything focusable.
4. **Open the help dialog.** Where did focus go? Does Escape close it?
5. **Look at the error message.** Is it connected to the field it refers to?

You should find **at least five defects the scanner did not report**. Write each one as
*symptom → mechanism → who it affects*. For reference, the page contains:

| # | Defect | Scanner? |
| --- | --- | --- |
| 1 | `:focus { outline: none }` — focus is invisible everywhere | **missed** |
| 2 | Submit is a `div` with a role and `tabindex` but no key handler; Enter does nothing | **missed** |
| 3 | The dialog never receives focus, traps nothing, ignores Escape | **missed** |
| 4 | The error is red text, unassociated with the field, announced to nobody | **missed** |
| 5 | The "label" is a `placeholder` — axe's `label` rule **passed**, 2 nodes | **missed** |
| 6 | 2.3:1 contrast on two elements | caught |
| 7 | `<img>` with no `alt` | caught |
| 8 | `tabindex="3"` on a link | caught |

**Number 5 is the one to take away.** axe reported the form as labeled, because a
`placeholder` satisfies the accessible-name computation. It is a name. It is not a label,
and it disappears at exactly the moment the user needs it.

> **HW5 requires this exact exercise on your own app**, recorded, finding at least one
> issue your scanner missed.

---

## 6. One SLI, one SLO, one alert — 5 minutes

You do not have time to stand up a full telemetry stack in five minutes, and you are not
going to. You are going to **write the three sentences**, because that is the part a model
cannot do for you. Wiring it up is HW5.

Run the standard course workload against your own edge so you have a number to reason
about:

```bash
k6 run campuspulse-load-profile.js
```

```
CampusPulse standard load profile — summary
==========================================
target            http://127.0.0.1:8788
duration          180s (30s ramp / 120s hold / 30s ramp-down), peak 10 VUs
requests          1326
failed            0.0%

latency (server wait / TTFB)
  html   p95      3 ms
  api    p95      2 ms
  asset  p95      1 ms

edge cache
  hit ratio       98.5%
  HIT             1069
  MISS            4
  REVALIDATED     237
  BYPASS          0
```

> **No k6?** Install from <https://grafana.com/docs/k6/latest/set-up/install-k6/>, or skip
> the run and use the numbers above as the worked example — the writing task below is the
> graded part. The profile takes 3 minutes and **must only ever target your own or
> course-owned infrastructure.**

Now write, on paper:

1. **One SLI** — a proportion, with a threshold. *"Proportion of `/api/status` requests
   served in under 500 ms."*
2. **One SLO** — that SLI, a target, and a window. *"99%, over 28 days."*
3. **One alert** — the condition that pages a human, and why a human can act on it.
   *"Page when the 1-hour burn rate would exhaust the 28-day error budget in under 3 days."*

Then compute your error budget out loud: 1% of 28 days is **6 hours 43 minutes**. Does
that number feel acceptable to you? If not, change the SLO now — not after an incident.

**Hand your SLO in as the exit ticket.**

---

## ⏩ Take-home — the app-layer cache in React + Node *(outside the 35 minutes)*

Block B's walkthrough is a runnable app:
[`samples/react-node-cache/`](samples/react-node-cache/README.md). It needs one
`npm install` (Express; Redis optional), so do it after class, not during the lab.

```bash
cd samples/react-node-cache
npm install
npm test                          # 8 tests: asset, shell, API, cache-aside
ALLOW_WRITES=1 npm start          # http://127.0.0.1:3000
```

PowerShell: `$env:ALLOW_WRITES='1'; npm start`.

Request `/api/status` twice and read `X-Cache` (`MISS`, then `HIT`); POST an incident with
the README's `curl` and confirm the next `/api/incidents` read is a `MISS`. That
`MISS` → `HIT` → (write) → `MISS` sequence, on **your** app, is the app-cache evidence for
HW5 Task 2.

---

## Troubleshooting

**`EADDRINUSE: address already in use :::8080`**
A previous run is still listening. Find and stop it:

```bash
# macOS / Linux
lsof -ti :8080 | xargs kill
```
```powershell
# PowerShell
Get-NetTCPConnection -LocalPort 8080 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
Or run on different ports: `PORT=9080 node origin.mjs` and
`ORIGIN_PORT=9080 PORT=9788 node edge.mjs`.

**`x-cache-status` is always `MISS`, never `HIT`.**
Three usual causes, in order of likelihood: (1) you restarted the edge between requests —
the store is in memory and does not survive a restart; (2) you are requesting a different
URL each time, including a trailing slash difference, which is a different key; (3) the
response is not storable — check `cache-control` in the dump for `no-store` or `private`.

**`edge: origin unreachable — connect ECONNREFUSED`.**
The origin is not running, or it is on a port the edge is not pointed at. Check terminal 1,
then check `ORIGIN_PORT`.

**PowerShell prints an object instead of headers.**
You used `curl` and got `Invoke-WebRequest`. Use `curl.exe`.

**`npx @axe-core/cli` cannot find Chrome.**
Set `CHROME_PATH` to your Chrome or Edge binary, e.g.
`CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"`. If it still fails,
run the axe browser extension against the same URL instead — the findings are the same and
the point of the step is the *comparison*, not the CLI.

**Step 1 shows `cf-cache-status: DYNAMIC` and never caches.**
You picked a site that does not cache HTML at the edge. Use the WCAG quick-reference URL in
the instructions, which is served with `s-maxage=2592001`.

---

## What to keep

| Artifact | Used in |
| --- | --- |
| Your MISS/HIT capture with timings and `CF-RAY` | HW5 evidence 3 |
| Your MISS → HIT → REVALIDATED → EXPIRED transcript | HW5 evidence 3 |
| Your written answer on why `/api/now` cannot revalidate | HW5 evidence 4 |
| Your poisoning reproduction and the alert you would write | HW5 evidence 9 |
| Your five scanner-missed defects | HW5 evidence 7 |
| Your SLI / SLO / alert, on paper | HW5 evidence 10, and the exit ticket |
| ⏩ The `react-node-cache` `X-Cache` sequence | A model for HW5 Task 2's app-cache evidence |
