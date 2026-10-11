# CSC 436 midterm study guide

The Week 6 midterm covers **Weeks 1–5 only**. It is a 120-minute,
individual, open-notes/offline exam. Bring printed/offline course notes and
your own HW1–HW5 submissions/feedback. No internet, generative AI,
collaboration, live commands or cloud access. Devices are stored unless
approved for an accommodation.

**Study as a web application developer, not a network engineer.** You should
explain how the pieces fit together, make sensible implementation and delivery
choices, recognize common mistakes, and describe checks that show an app works
for its users. You will not reconstruct incidents from DNS traces, packet
captures, TLS dumps or large log bundles. Exact command flags, vendor
statistics and memorized header spelling are not required.

## Format and answer approach

| Section | Points | Suggested minutes | Task |
| --- | ---: | ---: | --- |
| A — Practical foundations | 20 | 20 | Four sets of five multiple-choice items (20 items) on Weeks 1–4 concepts |
| B — Application scenarios | 60 | 66 | Three small web-app scenarios, 20 points each (four 5-point parts) |
| C — CDN and server-side caching architecture | 20 | 22 | One scenario in four parts: edge/PoP delivery, streaming control vs data plane, cache keys and private data, app-layer caching |
| Reading/review | 0 | 10 | Check parts, units and answers |

Section A is multiple choice: pick the single best answer. For Sections B and C, use **choice → reason → expected behavior → check** when a question asks for
a decision. A concept explanation does not need an invented test or citation.
Short code, diagrams and bullets are welcome; no full program is required.
Questions state exactly what to give (a list, a number, a yes/no with a
reason, an ordered sequence); answer each lettered or numbered ask separately.
For arithmetic, show the setup and units. Practice using your notes, not
copying paragraphs that do not address the scenario.

## Week 1 — Getting a web request to the app

Review [Week 1](../weeks/week01/README.md), its
[reference](../weeks/week01/reference.md), [lab](../weeks/week01/lab.md),
[HW1](../weeks/week01/homework.md), and
[web foundations](../docs/web-foundations.md).

### Practical knowledge

- Explain browser/client, server process, IP address and port as different jobs.
- Follow URL → DNS → transport → TLS → HTTP → browser rendering. Cached data
  or reused connections can skip work; a painted page does not prove the API
  and controls work.
- DHCP supplies a lease and settings such as address, prefix, gateway and
  resolver. The gateway routes; NAT can translate addresses/ports. DHCP and
  NAT are not the same service even if one router does both.
- A prefix tells you which addresses are on the local subnet. For
  `192.168.40.20/24`, the first 24 bits are the network portion; another
  ordinary `192.168.40.*` host is in that subnet.
- Loopback (`127.0.0.1`, `::1`) refers to the current machine.
  `0.0.0.0` is a wildcard IPv4 listener, not an address to give a browser.
  Sharing a demo needs an appropriate listener AND permitted network access.
- Private addresses are not directly public destinations. NAT is not
  authentication and does not automatically publish an inbound service.
- TCP provides a reliable ordered stream; raw UDP does not. QUIC adds
  reliability and encryption over UDP.
- Refusal means an active rejection; timeout means the deadline expired;
  reset means an established conversation was aborted. These symptoms alone
  do not identify a unique cause. Ping is not proof a web service works.

**Worked example:** an app listens on `127.0.0.1:5173`. A classmate cannot
reach it through your LAN address. For an authorized same-LAN demo, bind to the
LAN interface or wildcard, permit only the needed LAN access, and have the
classmate load the expected page using your LAN address and port. Do not
disable the firewall or publish an unsecured development server.

**Worked example (URL to page):** for `https://status.example.edu`: DNS gives
an address; TCP/QUIC opens a connection; TLS checks the name and encrypts;
HTTP requests and returns the page; the browser renders it. TCP guarantees
ordered, retransmitted delivery; QUIC provides this over UDP, so HTTP/3 pages
do not arrive with missing data.

**Practice:** explain what each URL-to-page stage contributes; describe a
safe local demo; distinguish DHCP, gateway and NAT without configuring routers.

## Week 2 — Names, DNS changes and HTTP contracts

Review [Week 2](../weeks/week02/README.md), its
[reference](../weeks/week02/reference.md), [lab](../weeks/week02/lab.md)
and [HW2](../weeks/week02/homework.md).

### Practical knowledge

- A stub asks a recursive resolver; the resolver caches and, when needed,
  follows root → TLD → authoritative referrals. Authoritative servers serve
  the zone data. Not every lookup visits every server.
- Distinguish registrant, registrar, registry, DNS host and application host.
  Record edits belong at the DNS host; parent delegation changes belong at
  the registrar/parent administrator. They can be different companies.
- Choose A/AAAA for addresses, CNAME for a hostname alias, TXT for non-secret
  verification, MX for mail, NS for authority/delegation, and CAA for CA
  issuance restrictions. Recognize SOA as zone metadata. SRV and DNSSEC are
  recognition-level only.
- A record is not a URL: it does not carry `https://`, an app route or an
  arbitrary port. An ordinary CNAME cannot be placed at an apex that needs
  NS/SOA; provider flattening is a separate feature.
- TTL permits cached reuse. Two people can legitimately get different
  answers during a move, with deliberate geo steering, or with split DNS.
  Neither different answers nor SOA serials alone proves a fault.
- Plan a move: record old target/rollback; lower TTL ahead of time; wait out
  the previous TTL; change target; check DNS and app behavior; retain the old
  service through cache overlap. Negative results can also be cached.
- Explain method, path, headers, body, status and content type. GET reads;
  POST commonly creates; PUT replaces; PATCH partially updates; DELETE
  removes. Know safe versus idempotent at a practical level.
- Recognize 2xx success, 3xx redirect, 4xx request/client problem, 5xx
  server/upstream problem. Creation can require 201 + Location; invalid
  input 400; missing resource 404. 307/308 preserve method/body across a
  redirect; 301/302 may change a POST to GET.
- Host selects a virtual host. Only trust forwarded scheme/address headers
  through a configured trusted proxy that overwrites untrusted values.

**Worked example (connecting a domain):** the host says to point
`status.example.edu` at `app.host.example` and publish `verify=abc123`: use a
CNAME and a TXT record, edited at whoever manages the DNS zone. The registrar
separately registers the domain and delegates it to name servers. A record
cannot hold `https://app.host.example:3000/dashboard` because DNS stores
hosts/addresses/text, not scheme, port or path.

**Worked example:** old TTL is one hour. Changing it to one minute at noon
does not shorten a one-hour entry already cached at 11:59. Lower it early,
wait the old lifetime before the move, and keep the old host available for
overlap and rollback.

**Practice:** choose records for a host's deployment instructions; identify
who can change them; outline a safe move; choose a method and response for an
API action. No delegation-trace reconstruction is required.

## Week 3 — React and TypeScript correctness

Review [Week 3](../weeks/week03/README.md), its
[reference](../weeks/week03/reference.md), [lab](../weeks/week03/lab.md),
[HW3](../weeks/week03/homework.md) and [samples](../weeks/week03/samples).

### Practical knowledge

- Render from props/state/context snapshots. Props are read-only; children
  request changes through callbacks. Context distributes a provider's value.
- Recognize TSX expressions, typed props, stable list keys and event handlers
  passed as functions. Avoid index keys for editable/reordered records.
- Controlled inputs take their value from state and update it through events.
  Keep state at the common owner that needs it.
- When next state depends on previous state, use a functional updater.
  Update arrays/objects immutably. Reducers organize related transitions;
  custom hooks reuse behavior, not automatically shared state.
- A dependency array controls when an effect runs: `[zone]` after the first render and whenever `zone` changes; `[]` only once after the first render; no array after every render (a state-setting effect then loops).
- Effects synchronize with external systems, not ordinary derived values.
  Dependencies describe when to synchronize again. Clean up timers/listeners
  and abort or ignore obsolete fetches. An effect that starts a timer
  (`setInterval`) must **return a cleanup function** that stops it
  (`return () => clearInterval(id)`); React runs it before the next run of the
  effect and on unmount, so timers do not pile up or keep running after the
  component is gone. Show loading/error/empty states
  deliberately; an old response must not overwrite newer selections.
- TypeScript checks source contracts, not imported CSV/JSON bytes. `as`
  does not validate; decode/narrow before accepting external records.
  Required fields, allowed statuses and numeric conversions need runtime checks.
- Apply every filter, calculate summaries over **all matches**, copy and sort,
  then page. `useMemo` can cache pure derived work; it does not make bad
  dependencies or wrong input arrays correct.
- Unknown hours (`null` after normalization) differ from known numeric zero.
  In HW3, reset clears filters but preserves sort, and export includes all
  matching normalized rows, not just the current page.

**Worked examples:**

```tsx
setCount(c => c + 1); // next value depends on the previous value

const matches = tickets.filter(matchesControls);
const metrics = summarize(matches);
const page = [...matches].sort(compare).slice(0, pageSize);
```

With matching open estimates `4`, blank and `0`: known total is **4**, known
count **2**, unknown count **1**. A one-row page does not change these totals. Three calls of
`setCount(count + 1)` from `count = 0` show **1**; three functional updates
show **3**. For a CSV row: blank ID or unsupported status → reject/report;
blank hours → unknown; `0` → known zero.

**Worked example (reusable filter):** the parent owns `query` and passes
`value={query}` and `onChange={setQuery}` to the input; typing fires the event,
the handler calls `setQuery`, the parent re-renders. Compute matches during
render; do not store them in a second state. Two components calling the same
custom hook each get their own state unless it is lifted or put in context.

**Practice:** compute a tiny filtered summary; explain three updates from one
snapshot; describe fetch race handling; design invalid-import feedback. A green
build alone does not demonstrate correct interactions.

## Week 4 — Browser/API integration and trusted delivery

Review [Week 4](../weeks/week04/README.md), its
[reference](../weeks/week04/reference.md), [lab](../weeks/week04/lab.md),
[HW4](../weeks/week04/homework.md) and the
[deployment runbook](../docs/deployment-runbook.md).

### Practical knowledge

- HTTP/1.1 commonly uses multiple connections for concurrency; HTTP/2
  multiplexes over TCP; HTTP/3 uses QUIC and independent stream delivery.
  HTTP meanings stay the same. Advertisement of h3 is not proof it was used,
  and newer versions are not automatic performance fixes.
- HTTPS protects transit and validates the server's name/trust; it does not
  authorize a user or prove the site is honest. Certificates are public;
  private keys remain secret. Know the client checks hostname/SAN, validity
  and chain to a trusted root; the server normally supplies intermediates.
- Repair wrong-name, expired or incomplete-chain configurations rather than
  turning off validation. Identify renewal ownership and expiry monitoring.
- Centralize axios base URL, timeout, endpoint functions and consistent error
  handling. HTTP errors have responses; network failures lack one; timeouts
  and cancellations need different user treatment from invalid fields.
- Express middleware order matters: CORS/preflight, JSON parsing, routes
  with validation before writes, consistent error handling after routes.
  Validate server inputs even if a controlled form already validates.
- CORS is enforced by the browser, not curl: a request that works from curl or Postman can still be blocked in the browser, because only browsers apply the rule; curl never asks permission. Origin includes scheme, host
  and port. Preflight checks method and requested headers. Credentialed
  requests need an exact allowed origin and credential permission, not `*`.
  Expose a non-safelisted response header such as Location when JS needs it.
  CORS is not authentication/authorization.
- Release checks include ordinary trusted HTTPS, functional API/page behavior,
  exact release identity, health and a known-good rollback. Do not treat a
  running process as proof the desired release works.

**Worked example (HTTPS and versions):** “HTTP/3 means new status codes” is
false (methods and statuses are unchanged; only transport framing differs).
“The padlock means the user is authorized” is false (it shows server identity
and protected transit only).

**Worked example:** for a credentialed JSON POST from
`https://workbench.example` to `https://api.example/api/incidents`, send:

```text
Access-Control-Allow-Origin: https://workbench.example   (not *)
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Content-Type
Access-Control-Expose-Headers: Location
```

Express order: CORS/preflight → JSON parsing → validation → create → error
handler. Success is 201 + created object + Location; invalid input is 400 with
a code, message and field errors. The API must still authorize the request.
Certificate pre-release checks: name match, valid dates, chain to a trusted
root; plus renewal monitoring and a rollback step.

**Practice:** explain a browser/curl difference without analyzing a capture;
design success/validation/error responses; describe a TLS renewal and release
safeguard. No certificate-dump interpretation is required.

## Week 5 — Global delivery, caching and user experience

Review the reworked [Week 5](../weeks/week05/README.md),
[reference](../weeks/week05/reference.md), [lab](../weeks/week05/lab.md),
[HW5](../weeks/week05/homework.md) and the
[React/Node caching sample](../weeks/week05/samples/react-node-cache/README.md).

### Global delivery and streaming

- CDN PoPs put delivery close to users and reduce repeated origin work.
  Anycast or DNS steering selects an appropriate PoP; caches differ by
  location. Shield/tier caches reduce repeated origin fetches. Edge TLS,
  compression, image processing and protection can help even on uncached routes.
- Streaming control plane handles sign-in, profiles, personalized rows,
  server selection, search, resume lists and licence/DRM keys for a specific
  user (all per-user or decision-making, so control plane). Data plane
  delivers encoded video segments listed by manifests. A finished video's
  manifest and segments never change, so they are static and cacheable.
- The **ladder** is the set of versions of each title encoded at different
  bitrates/resolutions. ABR (adaptive bitrate) lets the player measure its
  throughput and pick a lower or higher rung of the ladder for each
  subsequent segment as conditions change, so a slowing network gives lower
  quality instead of stalling.
- Netflix Open Connect puts appliances in ISPs/IXPs and can pre-fill popular
  recorded content off-peak. Disney+/Max illustrate multi-CDN delivery for
  quality and resilience. Know the reasons, not vendor statistics.
- ISP-local copies reduce transit and distance but do not eliminate the last
  mile. Live segments cannot be filled before they exist: use short-lived
  manifests, long-lived immutable segments, shields and request collapsing.
  Personalized rows and per-user licence responses are not shared public data.

### Layered caching and practical policies

| Layer | Useful for | Update mechanism |
| --- | --- | --- |
| React query cache | Avoid repeat fetching during navigation | Invalidate/refetch after writes |
| Service worker | Offline/repeat visits | Explicit strategy and worker version; avoid pinning old shell |
| Browser HTTP cache | Assets across visits | Lifetime, validation, new versioned URL |
| CDN/shared edge | Public bytes across users | TTL, purge, new URL |
| Reverse proxy | Shield app locally | TTL/purge |
| App memory/Redis | Expensive queries/results | Cache-aside, delete on write, TTL |
| Database cache | Internal hot pages/rows | Database manages it; recognition only |

Ask **who may see the copy, how stale it may be, what a miss costs, and how to
discard it**. You cannot directly purge a user's browser.
When copies exist at several layers, account for their combined age; separate
ten-second lifetimes do not automatically guarantee data is at most ten
seconds old end to end.

- Hashed assets: long-lived public immutable, new bytes → new URL.
  Changing unhashed assets need shorter lifetimes/versioning.
- HTML shell: store and revalidate (`no-cache`) so navigation finds new hashes.
- Public status API: short lifetime chosen from a product freshness limit.
- Personalized/account data: bypass shared caches, normally
  `private, no-store` in this course. Transient errors: `no-store`.
- Cache keys select who shares a copy: typically host/path/query, plus configured
  variants. Do not assume cookies/Authorization are automatically part of a
  key. `Vary` selects header variants and can fragment cache reuse.
- `no-cache` = store but validate before reuse; `no-store` = do not store;
  `private` = no shared cache; `max-age` = freshness;
  `s-maxage` = shared-cache freshness with stricter revalidation implications.
  Do not assume stale extensions override a stricter policy.
- ETag/Last-Modified support validation; 304 reuses the stored body but still
  involves an upstream check. HIT avoids origin work; MISS may not.
- SWR permits bounded stale reuse while refreshing; SIE permits it on eligible
  error. For `max-age=10, stale-while-revalidate=30, stale-if-error=60`,
  freshness ends at age 10, SWR permission at 40, SIE at 70 on error.
  Windows are not added together. Verify actual provider behavior; the local
  teaching edge revalidates synchronously, not asynchronous SWR.
- Delete affected app keys AND invalidate React queries after writes.
  Coalescing shares a pending computation among simultaneous misses;
  cached completed results are a different mechanism. Avoid purge-all stampedes.
- Simple origin estimate: **public request rate × miss fraction + uncached
  rate**. At 100 public rps, 90% hits and 5 private rps, estimate 15 origin rps.
  State warm-cache assumptions; this is not a load-test guarantee.

### Performance, accessibility and observability

- LCP: largest visible content timing, good ≤2.5 s. INP: interaction to
  visible response, good ≤200 ms. CLS: unexpected shifts, good ≤0.1.
  Evaluate field “good” thresholds at **p75**, not averages.
- INP replaced FID; a handler that starts quickly but blocks rendering can
  look good under FID and bad to the user. Measure actual interactions.
- Lighthouse lab runs are controlled comparisons; field/RUM shows experiences
  across actual users. A small convenience pilot is not CrUX or representative
  population evidence. Instrument rather than invent missing field data.
- Prioritize/resize hero images, reserve dimensions, avoid hero lazy-loading,
  use compression and measure transfer sizes. Inspect bundles; avoid loading
  unnecessary JS; improve expensive interaction work. Compare like conditions
  and correctness, not just scores.
- Choose CSR/SSR/SSG/ISR for content and freshness: CSR shifts work to client;
  SSR generates HTML per request; SSG builds static pages; ISR regenerates with
  bounded freshness. All can deliver cacheable assets; personalized HTML must
  not enter a shared public cache.
- An automated scan is the floor, not the release gate. Test keyboard reach/
  order, visible focus, Enter/Space activation, persistent labels,
  announced/field-associated errors, and dialog focus in/contain/return/Escape.
- Logs record events, metrics aggregate frequency/latency, traces connect work
  across hops. Propagate correlation context for logs/traces; don't use
  per-request/trace IDs as unbounded metric labels. Never log secrets or
  personal data. Origin logs miss CDN hits that never reach the origin.
- SLI is a measurement; SLO is its target/window; error budget is allowable
  failure. Request-based budgets count bad requests, not downtime minutes.
  Alert on actionable user impact; safely trigger, receive, restore and
  confirm recovery. A configured alert is not proof of delivery.

**Worked example:** “99% of 10,000 feed requests succeed under 500 ms over
28 days” allows **100 bad requests**. With 120 bad, good proportion is 98.8%:
the target is missed by 20 requests. To express downtime, define a time-based
SLI rather than converting that request budget to minutes.

**Worked example (distance):** 16,000 km at 200,000 km/s is 80 ms one way,
so at least a **160 ms** round trip; four round trips (DNS, TCP, TLS, HTML) cost
at least 640 ms. A PoP 10 ms away makes a 2-round-trip TLS handshake 20 ms
instead of 300 ms, even for uncacheable responses.

**Worked example (cache layers and who shares a copy):** a cache stores each
response under a key (roughly host + path + query) and reuses it for anyone
with the same key, so ask “who else would get this copy?” A video segment and
public `/api/status` are the same for everyone and may be shared; `/account` is
personal and must not be. A signed-in-only page returning a cache HIT is an
incident. A good safeguard is a **synthetic check**: a scripted signed-in
request, run on a schedule, that raises an alert if the response ever comes
back as a cache HIT. Adding the user-agent to the cache key does not fix this:
it multiplies variants, ruins the hit rate and still does not identify the user.

**Worked example (app cache):** `cached()` is cache-aside: look in Redis, on a
miss run the query, store with a TTL, return. The `inflight` map coalesces
simultaneous misses so the query runs once (prevents a stampede); other
defences are serving stale while one request refreshes and TTL jitter. After a
write, delete the affected keys so the next read is a fresh MISS. Choose a TTL
for a simple bound, delete on write for data your app changes, and versioned
keys/URLs (`hours-v2`) to turn “wait for expiry” into a rename.

**Practice:** build a per-content cache matrix; explain an incident write's
invalidation; compare streaming content classes; select an improvement using
vitals; describe a keyboard release check and one useful alert.

## Final preparation checklist

- [ ] Take the full [practice exam](practice-exam.md) under timed conditions, then
      check it with the [worked answers](practice-exam-answer-key.md).
- [ ] Attempt the [practice scenario](practice-case.md) before reading its
      [worked answers](practice-case-answer-key.md).
- [ ] Organize notes by week and practical task, not command-output fields.
- [ ] Explain each week's concepts in your own words and give an app example.
- [ ] Calculate small filtered summaries, TTL waits, miss ratios and
      request-based budgets with units.
- [ ] Separate compiler success, HTTP success, cache reuse and usable UI.
- [ ] For each proposed change, name the expected user behavior and a matched check.

**Not assessed:** network-engineer routing/firewall configuration, packet
forensics, detailed delegation/chain incident reconstruction, cryptographic
derivations, exact CLI flags, or Weeks 6–10 data modeling, real-time, MCP,
OAuth/OIDC and later security/data-at-scale work. Practical safe handling
of HTTPS, private data and CORS from Weeks 1–5 remains in scope.
