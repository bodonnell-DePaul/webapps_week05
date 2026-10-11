# Midterm practice exam — worked answers

Check your work against these answers **after** attempting the
[practice exam](practice-exam.md). Equivalent answers in plain language earn
credit on the real exam; use this to find topics to review in the
[study guide](study-guide.md).

## Section A — multiple choice (1 point each, 20 points)

| Item | Answer | Item | Answer | Item | Answer | Item | Answer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1.1 | b | A2.1 | c | A3.1 | b | A4.1 | b |
| A1.2 | c | A2.2 | b | A3.2 | c | A4.2 | c |
| A1.3 | a | A2.3 | b | A3.3 | a | A4.3 | d |
| A1.4 | d | A2.4 | c | A3.4 | b | A4.4 | a |
| A1.5 | b | A2.5 | a | A3.5 | c | A4.5 | b |

## Section B — scenarios (5 points per part)

### B1 — Share a local demo and move its public address

**B1a.**
- A server bound to `127.0.0.1` (loopback) only accepts connections from the same machine.
- Safe change: bind the dev server to the LAN address or all interfaces (for example `0.0.0.0:4000`) and allow that one port on the LAN only; keep the firewall on and do not expose it publicly.
- Address: `http://172.16.5.30:4000`.
- Check: the teammate loads the page (or a status endpoint) from their own device.

**B1b.**
- DHCP supplies the address, prefix/mask, gateway and DNS server.
- `/24` means the first 24 bits are the network: other `172.16.5.*` hosts are on the same subnet.
- `172.16.x.x` is a private address, not routable on the public Internet.
- The gateway routes between networks and does NAT; DHCP only hands out configuration.

**B1c.**
- Record the current DNS records (names, types, values, TTLs) and the old host's address.
- Lower the TTL (for example to 300 s) ahead of the move, then wait at least the **old TTL (2 hours)** before changing the address.
- Lowering at the moment of the move does not help: resolvers that already cached the answer keep the old TTL until it expires.
- Retire the old host only after the new one is verified and the old TTL (plus a safety margin) has passed.

**B1d.**
- Normal reason: different resolvers/devices cached the old answer at different times, so it expires at different moments.
- The cached answer lives at the **recursive resolver** (the authoritative server holds the source of truth).
- Check: load the app through the new address/name and confirm expected pages and an API call, and that HTTPS works.

### B2 — Filter, count and load rooms in React

**B2a.**
- Matching IDs: R1, R2, R5 → **3** rooms.
- Total known capacity: 12 + 8 = **20** (R2's blank is not counted).
- Unknown capacity: **1** (R2).
- Page 1: R1 and R2; page 2: R5.
- Order: filter → sort → calculate summary → take the current page. (Summary comes from all matches, before paging.)

**B2b.**
- `score` shows **10**.
- Each call reads the same render snapshot where `score` is 0, so both set it to 10.
- Fix: `setScore(s => s + 10); setScore(s => s + 10);`

**B2c.**
- Version 1: after the first render and again each time `building` changes.
- Version 2: only on the first render; after the user changes the building the page keeps showing the old building's rooms (stale data).
- Version 3: after every render; if `loadRooms` sets state, that causes another render and another call — an endless loop of fetches.
- Use **Version 1**: it reruns exactly when the input it depends on changes.

**B2d.**
- `as Room[]` only tells TypeScript to trust the data; it does no runtime checking, so bad rows still get through.
- Reject or report a row with a blank ID or an invalid status (do not silently count it).
- Blank capacity → unknown (not counted in the total, counted in the "unknown" count); `0` → a known value of zero, counted.
- Test: data with one room capacity `0` and one blank → total includes the `0` room, unknown count is 1.

### B3 — Connect a browser form to an API safely

**B3a.**
- Order: CORS/preflight handling → JSON body parsing → input validation → creating the event → error handler.
- Valid input: status **201**, the created object in the body, and a **Location** header.
- Invalid input: status **400** with a JSON body containing `code`, `message` and the list of field errors.
- Client-side checks can be bypassed (any client, `curl`, an old bundle), so the server is the real gatekeeper.

**B3b.**
- The browser enforces the same-origin/CORS policy; `curl` is not a browser and ignores it.
- `Access-Control-Allow-Origin: https://clubs.example` (exact origin) plus `Access-Control-Allow-Credentials: true`.
- Allow the `POST` method and the `Content-Type` request header (for the JSON preflight).
- Expose `Location` using `Access-Control-Expose-Headers`.
- CORS only says which sites' scripts may read responses; it does not log anyone in or authorize them — the API must still check the session/permissions.

**B3c.**
- Shared client holds: base URL, timeout, default headers, credentials setting, interceptors for common errors (any two).
- 400: show the field errors next to the matching fields.
- Network failure/timeout: show a "could not reach the server, try again" message with a retry option.
- Cancelled request: show nothing (or a neutral note) — the user chose it, so it is not an error and should not be treated like a validation failure.

**B3d.**
- Check: the name matches the site, the dates are valid, and the chain leads to a trusted issuer.
- Safeguard: automatic renewal and/or an expiry alert/monitor.
- After deploy: load the site over HTTPS and confirm the API works (a health or smoke check). Rollback: redeploy the previous version (or switch traffic back).
- Turning off verification removes the protection against impersonation/tampering — the error is a symptom you should fix (correct name, renew the certificate, install the chain).

## Section C — CDN and server-side caching

### C1a — Distance and the edge (5 points)

- Four round trips × 140 ms = 560 ms — answer **(d)**.
- Even uncached, the connection and TLS handshake happen with a nearby PoP (2 × 8 ms = 16 ms versus 2 × 140 ms = 280 ms); the CDN then reuses a warm connection to the origin.
- A request finds a nearby PoP through **DNS steering** or **anycast**.
- A cached copy in one PoP does not exist at other PoPs; each location fetches and caches its own copy on first request (or through a shield).

### C1b — The streaming split (5 points)

- **Control plane:** Resume lecture list, DRM/license key for a user, lecture catalog search.
- **Data plane:** video segment; manifest of a finished lecture (static, cacheable).
- Adaptive bitrate: the player measures throughput and switches to a lower-quality version of the next segment from the ladder, avoiding stalls.
- Live: the **manifest** gets the shorter TTL because it changes as new segments are added; segments are immutable once published and can be cached longer.
- ISP cache (Open Connect style): content is served from inside the viewer's ISP — less transit and lower latency. Several CDNs: resilience if one fails and better coverage/cost.

### C1c — Who else would get this copy? (1 point each)

Answers: **1-c, 2-b, 3-c, 4-a, 5-b**

### C1d — Caching inside the application (1 point each)

Answers: **1-c, 2-d, 3-a, 4-c, 5-a**

## Scoring yourself

| Section | Points available | Your points |
| --- | ---: | ---: |
| A (20 items) | 20 | |
| B1 | 20 | |
| B2 | 20 | |
| B3 | 20 | |
| C1 | 20 | |
| **Total** | **100** | |

Award 5 points per lettered part for covering all its bullets (about 1 point
per bullet). Review the study-guide section for each week where you lost points.
