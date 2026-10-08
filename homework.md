# HW5 — Own the Edge

**Put a CDN in front of the system you already run, decide what it may and may not store,
and prove — with headers, timings, and one alert that actually fired — that you were right.**

| | |
| --- | --- |
| **Assigned** | Week 5, in class |
| **Due** | Start of Week 6 class, before the midterm |
| **Points** | 100 |
| **Weight** | HW5 of 9; homework is 35% of the course grade |
| **Work mode** | Individual. Your name on the document; you must be able to defend any part of it |
| **Time** | **~8–10 hours core**, including integration/evidence; optional depth is not required before the midterm. See §9 |

---

## 1. The point of this assignment, in one sentence

A cache is an access-control decision wearing a performance costume, and you cannot tell
whether you got it right by looking at the configuration — only by looking at the headers.

---

## 2. Where this fits

This is **Gate 3 — Delivered and observable**, a graded final-project milestone. Everything
you produce here is part of your final submission; nothing is thrown away.

| Depends on | Feeds |
| --- | --- |
| **HW2** — you own a domain with a delegated zone | **Week 6 midterm** — cases 3, 10, 12, 14 are cache forensics |
| **HW4** — your container is live on that domain over HTTPS, through a pipeline | **HW6/HW7** — the MCP server you build sits behind this edge |
| | **HW9 / Week 10 Game Day** — you detect the injected fault **through the alert you build here** |

> **Do not build a new app for this.** Reuse HW4 and the lab. If HW4 is blocked,
> request the course recovery deployment; label local analysis versus public
> deployment evidence. The same artifacts satisfy HW5, Gate 3 and the final.

The k6 load profile you use here — `weeks/week05/samples/campuspulse-load-profile.js` — is
**reused unchanged in Week 10's HW9**. Do not fork it.

Use the [public reference](reference.md) for cache states and measurement
distinctions. The [HW5 supplied edge-policy draft](../../docs/non-ai-review-artifacts.md#hw5---edge-policy-draft)
provides the no-personal-AI critique: cite it and use your authorized synthetic
session evidence. No private lecture notes, answer key or AI account is required.

---

## 3. Prerequisites

- [ ] A domain you control, with working DNS (HW2)
- [ ] Your containerized backend and React/TS frontend live over HTTPS (HW4)
- [ ] A CDN account. **Cloudflare's free tier is sufficient and is the reference path.**
      Fastly, CloudFront, Azure Front Door, Bunny, and Akamai are all acceptable — but you
      are responsible for translating the reference instructions
- [ ] `curl`, Node **24 LTS**, Chrome or Edge
- [ ] `k6` — <https://grafana.com/docs/k6/latest/set-up/install-k6/>
- [ ] Existing hosting logs/metrics and your HW4 notification channel, or the
      course-provided telemetry view. A new full collector stack is optional.
- [ ] `npm i web-vitals`

---

## 4. Tasks

### Task 1 — Put the CDN in front of your domain *(~1 h, reuse HW4)*

1. Add your domain to your CDN and move DNS or CNAME your hostname to it.
2. Confirm TLS still terminates correctly end to end — this is HW4's grade, do not break it.
3. Confirm requests are reaching the edge:
   ```bash
   curl -sSI https://status.yourdomain.example/ | grep -iE 'server|cf-ray|cf-cache-status|x-cache'
   ```
   Correlate vendor headers with DNS and provider configuration. A missing header
   alone does not prove the request bypassed the CDN.
4. **Make your dynamic routes cache-eligible on purpose.**

   > ⚠️ **Read this or you will lose an hour.** Most CDNs — Cloudflare included — cache
   > only a fixed list of **static file extensions** by default. **Your HTML and your API
   > routes will not be cached at all** until you create a Cache Rule that makes them
   > eligible *and* sets an Edge TTL. Until then you will see `cf-cache-status: DYNAMIC`
   > on everything and conclude, wrongly, that you have broken something.
   >
   > There are **three separate decisions** and students conflate them constantly:
   > **(a) eligibility** — will this be considered for cache at all; **(b) key
   > composition** — what goes into the cache key (by default the full URL, and *not*
   > cookies or `Authorization`); **(c) origin-directive handling** — what happens to
   > `Set-Cookie`, `Vary`, and your TTL. Your matrix in Task 2 must address all three.

5. **Export the configuration.** Terraform, Pulumi, the CDN's own export, or a
   `wrangler.toml` / cache-rules JSON. A screenshot of a settings page is **not** an export.

> **No paid cache-key feature is required.** Keeping the full query string in the
> default key is correct and earns full marks with a hit-rate/cardinality rationale.
> Never ignore a parameter that changes content. A custom Worker/allow-list is
> optional; verify current provider plan limits rather than assume it is free.

### Task 2 — Design the cache-policy matrix, layer by layer, and implement one app cache *(~60 min, reuse the lab and Block B sample)*

Block B's stack — browser, service worker, React data cache, CDN, reverse proxy,
app cache (Redis or in-memory), database — is the design space. For each content
class in **your** app, decide which layers may hold a copy, under what key, and
how the copy is thrown away. Produce a table with **at least six rows**, one per
content class, with these columns:

| Column | What goes in it |
| --- | --- |
| Content class | e.g. HTML shell, hashed asset, unhashed asset, public API, personalized/authenticated, error |
| Example URL | a real path on **your** deployment |
| **Layer(s)** | which caches may hold it: browser, React data cache, CDN, app cache, or "none" |
| Configuration | the exact `Cache-Control` your origin sends, plus the code or CDN rule for any other layer |
| Cache key | what is in it: path, which query parameters, cookie, `Authorization`, user ID for app-cache keys |
| Invalidation | TTL expiry, delete on write, new filename/versioned key, purge, or "never stored" |
| **Rationale** | **2–4 sentences. This column is the assignment.** |

**The rationale must name the number, what you are trading away, and who accepted the
trade.** "Improves performance" is not a rationale — see §11.

Then **implement it** for existing routes and prove the headers match the table.
For a class you do not yet implement (for example authenticated content before
Week 8), write a clearly labeled planned policy and its acceptance test. Do not
build login early merely to create a sixth URL.

**Implement one app-layer cache.** Pick one read route that does real work (a
database or upstream query) and add a cache-aside in your Node server — the
`cached()` helper in
[`samples/react-node-cache/server.mjs`](samples/react-node-cache/server.mjs) is a
fine starting point, and an in-memory store is acceptable; Redis is optional.
Evidence: an `X-Cache` (or equivalent log line) showing `MISS` then `HIT`, and
the first read after a write showing `MISS` again. If the route has no write
path yet, show TTL expiry instead and say so.

### Task 3 — Prove all four cache states *(~30 min)*

Capture, against **your own domain**, header dumps showing:

1. `MISS` — with timing
2. `HIT` — same URL, with `Age`, with timing
3. `304 Not Modified` — a conditional request with `If-None-Match` using an ETag you
   captured, showing the response has no body
4. **A successful invalidation** — either a purge that flips `HIT` back to `MISS`, **or**
   a version rollover where a deploy changes a hashed filename and the new URL is a fresh
   key. Show the before and after.

Each capture needs the full response headers, the exact command, and a UTC timestamp.

### Task 4 — Compression *(~15 min)*

For your largest text asset, measure transfer size under at least three encodings:

```bash
for enc in identity gzip br; do
  printf "%-9s " "$enc"
  curl -sS -o /dev/null -H "Accept-Encoding: $enc" \
       -w "%{size_download} bytes\n" https://status.yourdomain.example/assets/app.js
done
```

Report the sizes, the percentage saved, and **which encoding was actually negotiated**
(`Content-Encoding` in the response). If you asked for something the server does not
support, say so — a silent fallback to `identity` is a real finding.

### Task 5 — Performance budget, Lighthouse, and your own RUM pilot *(~90 min)*

**Read this section carefully. It differs from what you may expect.**

#### 5a. State a performance budget *first*

Before you optimize anything, write down the numbers you are committing to. Five rows
minimum, for example:

| Metric | Budget | Measured how |
| --- | --- | --- |
| LCP | ≤ 2.5 s | Lighthouse mobile preset, and field p75 |
| INP | ≤ 200 ms | field only |
| CLS | ≤ 0.1 | Lighthouse and field |
| Total JS transferred | ≤ 200 KB compressed | bundle analysis |
| `/api/status` p95 | ≤ 500 ms | k6 |

#### 5b. Lighthouse, before and after

Run Lighthouse against your deployed site, make at least **one** delivery improvement,
run it again. Report both JSON reports and a table of the metric deltas.

```bash
npx lighthouse https://status.yourdomain.example/ \
  --output=json --output-path=lh-before.json --only-categories=performance
```

#### 5c. Field data — and why you will not have CrUX

**Runnable no-account collection path:** run
`node weeks/week05/samples/rum-collector.mjs --output ./rum-pilot.json` from the
course content root. In your **development** Vite proxy, add `/api/vitals` →
`http://127.0.0.1:8790` **before** a broader `/api` proxy. Copy
`web-vitals-rum.js` into your app source, install `web-vitals` in that app and
import the module once from the app entry point. Reload/interact, then switch
tabs so metrics finalize. Inspect POST `/api/vitals` for **202**, not merely
that `sendBeacon` returned true. Read <http://127.0.0.1:8790/results> and retain
`rum-pilot.json`. Restarting this collector starts a new pilot; copy evidence
before doing so. The collector is loopback-only, bounded and privacy-minimized.
It is a local pilot, not proof of production instrumentation. You may use a
same-origin hosted endpoint instead, with equivalent validation/rate/size limits.

> **You are not required to produce CrUX data, and you should not go looking for it.**
> Chrome's public field dataset only reports on origins that meet a popularity threshold.
> Your CampusPulse instance will never qualify, and that is not a defect in your work.
> *"We have no CrUX data because we have no users"* is a legitimate professional finding.
> Write that sentence in your submission and then do the correct thing: **instrument now,
> so the data exists later.**

Instead, run a **small instrumented RUM pilot**. Call it that — it is not representative
field data and claiming otherwise will cost you marks:

1. Wire [`samples/web-vitals-rum.js`](samples/web-vitals-rum.js) into your React app. It
   uses `web-vitals/attribution` and beacons LCP, INP, and CLS to your own endpoint.
2. Collect **at least six page-view sessions on one available device**.
   A second device and twenty sessions are optional extension work, not a purchase requirement.
   **Interact with the page on every session**, or INP will
   never be reported: it is only emitted when there was an interaction to measure.
3. **Report desktop and mobile cohorts separately.** Google's own CWV framing segments
   them, and mixing a laptop and a phone into one percentile hides the finding.
4. If you also test under DevTools throttling, report it as a **separate synthetic
   cohort**. Throttled DevTools sessions are lab data, not field data.
5. Deduplicate updates by page view + metric id, retaining the latest reported
   value. Report p75 per cohort next to your budget, and **state your sample size and what it
   does to your confidence.** Six samples is a very small number and a p75 computed from it
   is unstable. Saying so is the graded behaviour; pretending otherwise is not.

#### 5d. The standard workload

Run the course-standard k6 profile against **your own staging environment** and include the
summary:

```bash
k6 run -e BASE=https://status.yourdomain.example \
       -e ASSET=/assets/app.<yourhash>.js \
       weeks/week05/samples/campuspulse-load-profile.js
```

The profile is fixed — 30 s ramp, 120 s hold at 10 VUs, 30 s ramp-down, a defined request
mix. **Do not change the concurrency or duration**; comparability across submissions is the
point, and the modest cap is deliberate.

> **Rules of engagement.** Point load generators only at your own or course-owned staging.
> Never at a classmate's deployment, a university service, or a vendor's site.

### Task 6 — Bundle-size inspection *(~15 min; full visualizer optional)*

Save your existing production build's asset-size report. Name the largest emitted
JavaScript asset, compare its transfer size with your budget, and make one
keep/reduce/defer decision. No new package is required. A visualizer and
three-dependency analysis are optional extensions.

### Task 7 — Accessibility: the scan *and* the keyboard *(~1 h)*

1. Run `axe` against one functional page of your app containing a form or labeled
   filter. Reuse the foundations form if your project form is not ready.
   ```bash
   npx @axe-core/cli https://status.yourdomain.example/report --save axe-report.json
   ```
   **Record the axe version** — the rule set changes between releases.
2. **Scan one stateful view too**, not just the page at rest: open a dialog, trigger a
   validation error, expand a menu, then scan. Most component defects only exist in a
   state a default scan never reaches.
3. Fix what it finds, or justify each thing you did not fix.
4. **Then record a keyboard-only walkthrough** — screen recording, 2–5 minutes, no mouse.
   Narrate what you are doing. Follow the five-step pass from the lab.
5. Write up a real scanner-missed defect as *symptom → mechanism → who → fix*.
   If your own view has none after these checks, document the checks and analyze
   one supplied `/a11y` fixture defect instead, labeling its source. Do not invent
   a flaw or break a working page to satisfy the rubric.

> **The keyboard pass is *one* release gate, not the whole gate.** It does not cover
> screen-reader name/role/state quality, 200% zoom and reflow, forced-colors mode, reduced
> motion, or touch-target size. Naming one dimension you did **not** test, and why, is
> worth marks. Pretending the page is now accessible is not.

### Task 8 — The deliberate cross-user cache disclosure *(~30 min; reuse lab evidence)*

> **Name it accurately.** This is **cache-key confusion causing cross-user disclosure**,
> not cache *poisoning* — nobody is injecting an attacker-controlled response. And it is
> a real disclosure while it is running, not a "near-miss". Both distinctions matter when
> you write it up.

Use the **loopback-only lab pair by default**, with synthetic users only.
An explicitly authorized isolated staging target is an alternative. An unlinked
public hostname is **not** access control:

1. Deliberately create the two-mistake condition from the lab — a personalized route made
   publicly cacheable, plus a cache key that does not separate users.
2. Capture the evidence: two requests with different synthetic session cookies, the second
   returning the first user's content with a cache `HIT`.
3. **Clean up properly, and prove it.** Reverting the configuration is not enough — the
   already-cached personalized responses are still stored. You must:
   - revert the origin header **and** the cache rule;
   - **purge** the affected paths and variants;
   - re-request from at least two different network locations (a phone on cellular
     counts) and show a fresh `MISS`, then correct per-user responses;
   - invalidate the synthetic sessions you used.
4. Write it up as a risk: what would have to be true for this to happen accidentally in
   your system, what the blast radius would be, and **the specific detection you have now
   added** so it cannot happen silently. A good detection is a synthetic check asserting
   that an authenticated route never returns a cache-status of `HIT`.

> Never use a real person's session. Never do this on a hostname a search engine can
> reach. If you are not confident you can clean up, do it against the local
> `origin.mjs` + `edge.mjs` pair from the lab instead and say so — that path is worth
> full marks for the reproduction and the write-up.

### Task 9 — Observability: one SLI, one SLO, one alert that fired *(~75 min)*

> Reuse hosting metrics/logs and the HW4 notification path or the course telemetry
> baseline. A complete OpenTelemetry collector rollout is optional before the
> midterm; the concepts remain part of the teaching.

1. Capture **one** latency metric and structured request logs with a correlation
   identifier from the existing host/course baseline. Include one sample request
   and identify its matching log. If OTel already exists, reuse its trace/span ids.
   The [first-web-app baseline](../../samples/first-web-app/README.md) emits
   `X-Request-Id` plus JSON stdout logs with status/route/duration. A small table
   derived from those logs is sufficient; these are not labeled OTel spans.
2. Record cache status from **edge/client response evidence**. An origin does not
   see cache HIT requests, so it cannot truthfully attach those HITs to origin spans.
   Join edge and origin observations only where a request actually traversed both.
   > **Do not put `trace_id` on a metric.** Metrics are aggregates; a trace id as a metric
   > label is unbounded cardinality and will break your metrics backend. Logs and traces
   > join on the id; metrics link to traces through **exemplars**.
3. Save a **dashboard or small evidence table** showing request count, latency and
   your SLI. Reuse a provider/course view rather than building three new panels.
4. **Frontend-to-backend trace propagation is optional and worth no marks.** If you want
   it, propagate `traceparent` from the browser, or simply send the `pageViewId` from
   `web-vitals-rum.js` on your API calls and log it. Say which you did.
5. Define exactly **one SLI**, **one SLO**, and **one alert**:
   - **SLI** — a proportion with a threshold, e.g. *"proportion of `/api/status` requests
     served in under 500 ms"*
   - **SLO** — a target percentage over a window, **with the error budget in the correct
     units.** A *request-based* SLI spends its budget in **bad requests** (1% of the
     requests you served). Only a *time-based* SLI — "99% of one-minute windows are
     good" — converts to **6 h 43 m over 28 days**. Getting these units backwards is the
     most common mistake here and it is explicitly marked.
   - **Alert** — the condition, the notification channel, and why a human can act on it
   - If your traffic is low, say so: a request-based SLI over a handful of requests is
     extremely noisy, and naming that is worth marks.
6. **Make the alert fire.** Break something on staging on purpose — stop the origin, add
   latency, return 500s. Capture the notification. **A configured-but-never-fired alert
   scores half of this criterion**, because an alert you have not tested is a plan, not a
   control.

---

## 5. Required evidence artifacts

Submit all of these. The itemized list *is* the grade.

1. **Exported CDN configuration or IaC** — file, not screenshot
2. **Cache-policy matrix** — ≥ 6 rows, all columns including **layer(s)**, rationale per row,
   plus the app-cache `MISS` → `HIT` → (write) → `MISS` evidence
3. **Header dumps** — `MISS`, `HIT` with `Age`, `304`, and a successful invalidation, each
   with the command and a UTC timestamp
4. **Cache-state narrative** — your own words on why each state occurred, including your
   answer on why a volatile-body endpoint can never be `REVALIDATED`
5. **Compression table** — sizes per encoding, percentage saved, encoding actually negotiated
6. **Performance budget table**, plus `lh-before.json`, `lh-after.json`, the delta table,
   your RUM p75s with session count and device/network mix, and the k6 summary
7. **Production asset-size report** + one byte-budget decision
8. **`axe` report (JSON)** + the recorded keyboard walkthrough + ≥ 1 scanner-missed defect
   written as symptom → mechanism → who → fix
9. **Cross-user cache disclosure** — reproduction evidence, cleanup-and-purge proof, risk write-up, and
   the detection you added
10. **Dashboard screenshot**, SLI/SLO/error-budget definition, alert rule as code or export,
    and **evidence the alert fired** (the notification itself)

Plus the **eight-part evidence standard**, which applies to every submission in this course:

1. Commit SHA or release tag
2. Reproduction commands and exported config/IaC
3. Raw sanitized evidence — header dumps, HAR, JSON reports, k6 output
4. Annotated interpretation in your own words
5. At least one deliberate failure and its diagnosis *(Task 8 and Task 9's fired alert both
   qualify; you may use them)*
6. AI-use log — generated, accepted, rejected, and how you verified
7. One challenged AI claim, with the evidence you used to reject it
8. Redaction attestation — no live secrets, tokens, cookies, or authorization codes

> **Redaction, specifically for this week.** Your header dumps will contain `Set-Cookie`
> and possibly `Authorization`. **Replace the value, keep the shape:**
> `Cookie: sid=<REDACTED-32-CHAR>`. Do not crop the line out — the presence and shape of the
> header is frequently the evidence.

---

## 6. A worked example — one matrix row, at full depth

This is the depth expected for **every** row. Students consistently under-deliver on the
rationale; this is what a full-mark row looks like.

> ### `/api/status` — public status feed
>
> | | |
> | --- | --- |
> | **Example URL** | `https://status.campuspulse-demo.net/api/status` |
> | **Layer(s)** | Browser and CDN (shared, 10 s); app cache in Redis under `status:v1` for 10 s, so a burst of edge misses reaches the database once; not in a service worker |
> | **`Cache-Control`** | `public, max-age=10, stale-while-revalidate=30, stale-if-error=600` |
> | **Edge policy** | Cache Rule "api-status": eligible for cache, Edge TTL = respect origin, query string allow-list `[building]` (implemented in a Worker — see note in Task 1) |
> | **Cache key** | `path` + the `building` query parameter only. Cookie and `Authorization` excluded because this route is anonymous; a separate Cache Rule bypasses cache entirely if `Authorization` is present |
> | **Invalidation** | Browser/CDN: TTL expiry, no purge path, deliberately. App cache: `del status:v1` on every incident write, so the origin never serves a status older than the last report |
>
> **Rationale.** `max-age=10` is the number we actually argued about: the dashboard polls
> every 5 s, so a 10-second TTL caps origin load at roughly 1 req/s no matter how many
> people are watching — during the 2026-02-14 network outage we had 340 concurrent
> viewers, which would have been ~68 req/s uncached. The cost is that we will show a
> resolved outage as ongoing for up to 10 seconds. We took that to Facilities and they
> confirmed 10 s is acceptable because their own workflow has a 2-minute confirmation
> step anyway. `stale-while-revalidate=30` means a slow origin never blocks a render, and
> `stale-if-error=600` means a 10-minute origin outage shows a stale status page instead
> of nothing — which for a *status page* is the entire point.
>
> **Why not `s-maxage`.** We wanted a shorter shared TTL than browser TTL and started with
> `max-age=0, s-maxage=10, stale-while-revalidate=30`. That is self-cancelling: RFC 9111
> §5.2.2.10 says `s-maxage` "incorporates the semantics of the proxy-revalidate response
> directive", and §4.2.4 forbids serving stale when proxy-revalidate applies — so the
> stale window was unreachable and our `stale-if-error` resilience did not exist. We
> proved it: with the old header, killing the origin returned 504 at the edge; with the
> current header it returns the stale body. One TTL for everybody was the right trade.
>
> **What would make this wrong.** If `/api/status` ever became personalized — "your
> buildings first" is on the roadmap — this policy discloses one user's building list to
> the next caller, because the cache key has no user in it. **Detection added:** a synthetic
> check asserts that `/api/status` returns `Vary` without `Cookie` and that no `Set-Cookie`
> is present; it fails the build if either changes.
>
> **Evidence:** `evidence/03-headers/api-status-miss.txt`, `…-hit.txt` (`Age: 7`),
> `…-304.txt`, `…-post-purge.txt`, `…-stale-if-error.txt`.

Note what makes it worth marks: a **specific number with a reason**, a **named person or
team who accepted the trade**, an **incident that supplied the load figure**, and a stated
**condition under which the decision becomes wrong**, with a detection attached to it.

---

## 7. Rubric — 100 points

Within each row, evaluate 60% domain correctness and 40% reproducible evidence,
as in the syllabus. Optional extensions are not required for full credit.

| # | Criterion | Pts |
| --- | --- | ---: |
| 1 | **CDN live** in front of your domain, TLS intact, vendor headers proven, config exported as a file | 8 |
| 2 | **Cache-policy matrix** — ≥ 6 rows, layer(s) named per row, all columns complete; one app-layer cache implemented with HIT/MISS and invalidation evidence | 8 |
| 3 | **Rationale quality** — names the number, the trade, and who accepted it; states what would make it wrong | 13 |
| 4 | **Four cache states** proven with header dumps: MISS, HIT + `Age`, 304, successful invalidation | 10 |
| 5 | **Compression** — sizes by encoding, % saved, encoding actually negotiated identified | 4 |
| 6 | **Performance budget** stated *before* optimizing; Lighthouse before/after with a delta table | 7 |
| 7 | **RUM pilot** — ≥ 6 sessions, available device identified, cohorts separated if applicable, limitations honestly discussed | 6 |
| 8 | **k6 standard profile** run unmodified against your own staging, summary included | 3 |
| 9 | **Production asset-size report** + one byte-budget decision | 4 |
| 10 | **`axe` report** and fixes (or justified non-fixes), including one scan of a *stateful* view | 4 |
| 11 | **Keyboard walkthrough recorded**, and ≥ 1 scanner-missed defect written as symptom → mechanism → who → fix | 8 |
| 12 | **Cross-user cache disclosure** — reproduced, cleaned up with proof, risk written up, detection added | 5 |
| 13 | **Observability** — latency metric, correlated request log, edge/cache evidence, dashboard or three-measure evidence table | 6 |
| 14 | **SLI + SLO + error budget in the right units + alert that actually fired**, with the notification captured | 7 |
| 15 | **Eight-part evidence standard** complete, including the challenged AI claim and redaction attestation | 5 |
| 16 | Clarity, honesty, and reproducibility of the whole document | 2 |
| | **Total** | **100** |

**Deductions**
- −10 if any evidence is a screenshot where a text artifact was possible
- −15 if load testing targeted anything other than your own or course-owned infrastructure
- **Zero for the artifact, plus mandatory resubmission with rotation evidence**, if a live
  secret, token, cookie value, or authorization code appears anywhere

> A configured-but-never-fired alert scores **half of criterion 14**. That is the only
> penalty for it — there is no additional deduction.

---

## 8. What good looks like vs. what loses points

| What good looks like | What loses points |
| --- | --- |
| "`max-age=10` because the dashboard polls every 5 s; we accept a 10 s stale window and Facilities agreed" | "`s-maxage=10` to improve performance" |
| "We started with `s-maxage` + `stale-while-revalidate` and proved it never served stale — `s-maxage` implies proxy-revalidate" | Copying a directive string from an assistant without testing what it actually does |
| A header dump with the command, the UTC timestamp, and `Age: 7` | A screenshot of the Network tab |
| "Brotli saved 0.3% over gzip here. Our hypothesis is on-the-fly compression at a low quality level; we did not verify the CDN setting" | "Enabled Brotli. It's faster." |
| "The scanner passed the `label` rule because a `placeholder` satisfies the accessible-name computation. It is not a label — it vanishes as you type. Here is the recording of me failing to fill the form" | "axe found 0 violations, so the page is accessible" |
| "The alert fired at 14:22 UTC when we stopped the origin container; here is the notification and the 6-minute recovery" | "Alert configured, see screenshot" |
| "Request-based SLI, so the budget is 1% of requests — ~340 of the 34,000 we served. We are too low-traffic for that to be stable, and here is why" | "99% = 6.7 hours of downtime", applied to a request-based SLI |
| "We have no CrUX data because our origin is below the reporting threshold. Here are 24 sessions from 3 devices: desktop p75 LCP 1.9 s, mobile p75 3.1 s" | Leaving field data blank, presenting Lighthouse as field data, or mixing devices into one percentile |
| "Purging did not help before the fix, which is what told me it was the cache key and not the TTL" | "I made changes and now it works" |

---

## 9. Time estimate

| Task | Hours |
| --- | ---: |
| 1 — CDN in front of the existing HW4 domain | 1.0 |
| 2 — Layered matrix + one app cache, reusing lab and sample | 1.0 |
| 3 — Four cache states | 0.5 |
| 4 — Compression | 0.25 |
| 5 — One improvement, six-session pilot, standard k6 | 1.5 |
| 6 — Existing build's asset-size report | 0.25 |
| 7 — One view, stateful scan, keyboard pass | 1.0 |
| 8 — Reuse loopback lab disclosure/cleanup evidence | 0.5 |
| 9 — Existing/course telemetry, SLO and received alert | 1.25 |
| Write-up and evidence assembly | 0.75 |
| **Core total, before recovery margin** | **8.0** |

> **Plan 8–10 hours, not the previous 20-hour specification.** This reduction
> removes the new collector deployment, full bundle analysis, extra device and
> extra optimization requirements rather than relabeling the same work. The
> optional extensions earn no extra marks. If baseline integration is blocking
> progress after 30 minutes, request course recovery support.
>
> **Elapsed time you cannot compress:**
> - DNS/CDN propagation after Task 1 — up to a few hours
> - Collect the six-session pilot while doing your normal checks. It is a small
>   convenience sample, not representative field performance or CrUX.
>
> **Do Task 1 and the Task 5c beacon first, on the day it is assigned.** Everything
> else can be done in any order. Reserve separate study time for the Week 6
> midterm; do not expand this assignment with optional infrastructure.

---

## 10. Submission format

One PDF or Markdown document, plus an evidence directory, in your repository:

```
hw5-<lastname>/
  README.md                       # the write-up; start with the commit SHA
  evidence/
    01-cdn-config/                # terraform/, wrangler.toml, or exported JSON
    02-matrix.md                  # + app-cache-miss-hit.txt
    03-headers/                   # miss.txt hit.txt 304.txt purge-before.txt purge-after.txt
    04-compression.txt
    05-performance/               # lh-before.json lh-after.json rum-p75.md k6-summary.txt
    06-bundle/                    # report.html + notes.md
    07-accessibility/             # axe-report.json + keyboard-walkthrough.mp4 + missed.md
    08-disclosure/                # repro.txt cleanup.txt risk.md
    09-observability/             # dashboard.png alert-rule.yaml alert-fired.png slo.md
    10-ai-use-log.md
    11-redaction-attestation.md
```

Naming: `hw5-<lastname>.pdf` for the write-up if you submit a PDF.
Recordings: MP4 or WebM, under 100 MB, or a link to an access-controlled upload.

---

## 11. The non-generatable component

**A model can write every `Cache-Control` string in this assignment in about four seconds.
It cannot do any of the following, and those are what you are graded on:**

- **It cannot know your TTL.** That number encodes your poll interval, your traffic,
  and a staleness window you decided to accept. The model has never met
  your users and does not know what Facilities said.
- **It cannot produce your header dumps.** `cf-cache-status: HIT` with `Age: 7` on *your*
  hostname from *your* PoP is a fact about a machine the model has never contacted. This is
  why Task 3 exists.
- **It cannot press Tab.** The keyboard walkthrough is the single most AI-resistant artifact
  in this course. Automated tools detect roughly 20–50% of accessibility issues — a figure
  the axe CLI prints about itself, unprompted — and the rest require a person operating the
  interface. A model can generate a beautiful accessibility statement about a form that
  cannot be submitted.
- **It cannot choose your SLO.** 99% versus 99.9% is a 6-hour-43-minute versus
  40-minute error budget, and which one is right depends on what your users lose when
  CampusPulse is wrong. That is a judgment about consequences, not a technical fact.
- **It cannot make your alert fire.** Breaking staging on purpose, watching the notification
  arrive, and recovering is an act performed on a running system.

Use AI freely for the parts it is good at — Terraform scaffolding, the OTel SDK wiring, the
bundle config, explaining a header you have not seen before. **Log it, verify it, and expect
at least one of its confident suggestions to be wrong.** Evidence item 7 asks you to find
that one and prove it wrong. Likely candidates this week, in order of frequency: telling you
`no-cache` means "do not cache"; generating `s-maxage` alongside `stale-while-revalidate`,
which silently cancels the stale window (RFC 9111 §5.2.2.10); suggesting `Vary: User-Agent`;
recommending a purge where a content hash was the answer; putting a trace id on a metric
label; and generating FID-based performance advice, which has been obsolete since INP
replaced FID in March 2024.

> The `s-maxage` one is worth hunting for deliberately. It is a genuine spec interaction
> that reads correct, appears in a great deal of published advice, and is trivially
> disprovable with two `curl` commands and a stopped origin. That is exactly the shape of
> the challenged claim this course wants.
