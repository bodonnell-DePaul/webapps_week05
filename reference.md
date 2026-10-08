# Week 5 public reference — cache and measurement checklist

Use this lookup alongside the lab and HW5; no extra prep is assigned.
The current HW5 core is 8–10 hours through reuse. Optional collectors, extra
devices and extra optimizations are not required before the midterm.

## What a CDN does

A content delivery network places delivery endpoints, often with shared caches,
in multiple locations. DNS/routing sends a client toward an appropriate edge
location, called a point of presence (PoP). The **origin** is the service holding
or producing the original representation; the **edge** may answer on its behalf.

A fresh cache HIT can avoid an origin request. A MISS goes to the origin, and
revalidation can contact the origin while reusing an existing response body.
Different PoPs/variants can have different cache state. A HIT elsewhere does not
prove this user's edge has the same entry. Edge TLS may also be separate from
edge-to-origin TLS; both paths need deliberate configuration.

A CDN can reduce distance and repeated origin work, but it cannot make slow
uncached application work disappear, fix an inaccessible form, or infer which
responses contain private data. A browser cache and a shared edge cache have
different owners and policies. Read actual response headers and provider rules
instead of assuming all HTML/JSON is cached by default.

## How streaming platforms deliver video

Streaming services split their system by how cacheable the data is. The
**control plane** — sign-in, profiles, search, recommendations, "Continue
watching", DRM licences, and choosing which servers a player should use — is
small, personalized, and runs in a cloud region. The **data plane** is the video:
each title is encoded into a ladder of bitrates, cut into segments of a few
seconds, and listed in an HLS or DASH manifest. The player fetches segments over
ordinary HTTP and switches rungs as bandwidth changes (adaptive bitrate). Segments
are identical for every viewer and never change, so any CDN can cache them.

| Platform | Video delivery | Sources |
| --- | --- | --- |
| Netflix | Its own CDN, Open Connect: appliances embedded inside ISP networks and at internet exchanges, filled with predicted-popular titles off-peak | [Netflix and ISPs](https://about.netflix.com/en/news/how-netflix-works-with-isps-around-the-globe-to-deliver-a-great-viewing-experience), [Open Connect](https://openconnect.netflix.com/en/) |
| Disney+ | Several CDN partners, including on-net caches, chosen by an in-house load balancer scored on playback quality | [Streaming Media](https://www.streamingmedia.com/Articles/ReadArticle.aspx?ArticleID=145721) |
| Max | Four commercial CDNs for resilience | [TechCrunch, 2023](https://techcrunch.com/2023/05/05/warner-bros-discovery-cto-and-cpo-explain-how-they-made-max-less-buggy/) |

The **last mile** is the link from the ISP to the home; nobody caches past it, so
the closest useful copy sits at its start. Live events cannot be pre-filled, so
CDNs rely on request collapsing, shield tiers, short manifest TTLs, and long
segment TTLs.

## Caching layers in a React + Node app

| Layer | Best for | Invalidated by |
| --- | --- | --- |
| React data cache (TanStack Query, SWR) | Avoiding refetches while the user navigates | `staleTime`; `invalidateQueries` after a write |
| Service worker | Offline and instant repeat visits | Your own code; a new worker version |
| Browser HTTP cache | Assets across visits | `Cache-Control` lifetime; a new URL |
| CDN / edge | Public bytes shared across users and cities | TTL, purge, new URL |
| Reverse proxy | Shielding the app on the same host | TTL, purge |
| App cache (Redis, in-memory) | Expensive queries and computed results | Delete on write; TTL |

Pick the layer from **who may see the copy**, the lifetime from **how stale is
acceptable**, and the mechanism from **where you can reach to delete it**. You
can delete a Redis key and purge a CDN; you cannot reach into a browser cache, so
long browser lifetimes belong only on content-addressed (hashed) URLs. A complete
runnable example is
[`samples/react-node-cache/`](samples/react-node-cache/README.md).

## Cache questions, in order

1. Is the response eligible for storage at this edge?
2. Which method/host/path/query/header inputs select the key or variant?
3. Does the edge respect the origin's directives and privacy requirements?
4. What makes the representation fresh, and what validates it when stale?
5. How will you invalidate every affected variant safely?

`no-cache` permits storage but requires validation before reuse. `no-store`
prohibits storage. `private` excludes shared caches. `s-maxage` addresses shared
caches and incorporates proxy-revalidation behavior; do not assume arbitrary
stale extensions override stricter directives. Verify the actual provider.

An ETag identifies a representation for validation; a 304 carries no response
body. `Age` includes age since origin generation/validation, potentially including
upstream cache residency. The local teaching edge simplifies this to local
residency and revalidates synchronously.

A response can change on every origin request yet still be fresh-cacheable.
Its validator will not save payload after expiration if the bytes always change.
Keep complete query strings unless a proven-safe transformation is available;
no paid custom cache key is required.

## stale-while-revalidate and stale-if-error

These extensions answer different questions:

- **`stale-while-revalidate=N`:** after freshness expires, permits serving the
  old response within an additional N-second window while revalidation happens
  asynchronously. It can reduce waiting for the caller, at a bounded staleness cost.
- **`stale-if-error=N`:** permits serving an old response within its additional
  window when an eligible origin/network error occurs. It is a resilience
  policy, not a promise that every failed request can use arbitrarily old data.

For example, `max-age=10, stale-while-revalidate=30, stale-if-error=60` has a
10-second freshness lifetime. Its stale windows are measured **after** that
lifetime: SWR through age 40, and SIE through age 70 on an eligible error.
They are not a 100-second combined TTL. An actual matching stored representation
must exist first, and stricter applicable revalidation/privacy directives and
the provider's behavior must be considered.

The course's local edge intentionally revalidates synchronously: it can show
`REVALIDATED` and error-driven `STALE`, but it does **not** implement asynchronous
SWR/`UPDATING`. Do not claim a local SIE demonstration proved a real CDN's SWR
behavior. State the policy, prime the route, observe its age and response state,
and distinguish reused bytes from an origin request that was avoided.

Reference: [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html) defines these
extensions; [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) supplies the
surrounding HTTP caching rules.

## Reproduce states without external load

Use the loopback origin/edge pair. To observe stale behavior, **prime the exact
route while the origin runs**, wait beyond its freshness lifetime, then stop
the origin. An absent entry cannot become STALE; a fresh one can remain HIT.
After a deliberate privacy failure, correct both origin and edge policy and
purge old entries before claiming recovery. Synthetic sessions only.

## Measurements are not interchangeable

- Lighthouse is a repeatable **lab** measurement, not representative field data.
- The six-session RUM pilot is a small convenience sample, not CrUX.
  Interact to generate INP; deduplicate updates before computing a percentile.
  Report cohorts separately if multiple devices/conditions are used.
- The supplied local `rum-collector.mjs` validates/deduplicates measurements and
  provides results without a cloud account. HW5 explains the development proxy.
- The fixed k6 workload runs only on your authorized staging or loopback target.
  Keep its stages/request mix unchanged; a performance threshold failure is
  evidence to analyze, not permission to lower the workload silently.
- A successful automated accessibility scan is not a successful keyboard journey.
  Test visible focus, labels, operation and validation/error states.

## A small observable system is enough to begin

Correlate a response's request id with its structured backend log. Derive request
count, latency and an SLI table from existing/course telemetry. Origin logs and
spans cannot report cache HIT requests that never reached the origin; collect
edge/client response evidence separately.

A request-based error budget counts bad requests. A time-based budget counts
bad intervals. State which one you mean before converting percentages into
minutes. An alert's configuration is not proof of delivery: trigger it safely,
retain the received notification, restore the setting, and verify recovery.

Use the [HW5 supplied edge-policy draft](../../docs/non-ai-review-artifacts.md#hw5---edge-policy-draft)
instead of requiring an AI service. Your evidence and interpretation remain
individual work.
