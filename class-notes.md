# Week 5: Delivery, Caching, and What the User Actually Experiences — class notes

These notes contain the student-visible teaching material and examples. Complete the exercises individually. Instructor delivery notes and answer keys are not included.

## Weekly session — Delivery, Caching, and What the User Actually Experiences

Review, preparation, logistics, teaching, individual practice, and the end-of-class brief

## Short review

### Your HW4 site lives in one place. Your users do not

#### What HW4 gave you

- Your own domain, live, over **HTTPS**
- A pipeline that deploys and can roll back
- A container answering `/healthz` — in **one** region

#### What today adds

- A layer of **copies** between your users and that one container
- Those copies live in hundreds of buildings, near people
- Deciding *what* may be copied is a design job — and a security one

## Prelecture review

### Prep debrief: what the readings should have left you with

- **Q1:** a CDN is a fleet of caching servers in many cities; a **PoP** is one of those sites
- **Q2:** Netflix's Open Connect places its own servers **inside ISP networks** — free to the ISP
- **Q3 — hands up first:** does `no-cache` mean "do not cache"? No. It means *check before reuse*
- **Q4:** the three Core Web Vitals are LCP, INP, CLS — **INP replaced FID** in March 2024

> **Key idea**
>
> The prep gave you vocabulary. Class time gives you the map: where copies live, who
> owns them, and what goes wrong when the wrong thing is copied.

## Weekly logistics

### How today runs, and what you need on hand

#### The 180 minutes

- Block A (30) → checkpoint (10)
- Block B (30) → checkpoint (10)
- **Break (10)** — hard stop
- Block C (25) → checkpoint (10)
- Guided lab (35), then the HW5 brief and exit ticket

#### Have ready, right now

- A browser — the first demo is in about eight minutes
- **Node 24** and this week's `samples/` for Block B and the lab
- Your **HW4 deployment** and a free CDN account for the homework

## Block A — CDNs and streaming

### Two problems no amount of server tuning fixes

> **Key idea**
>
> Fix both: **keep copies of popular bytes close to the people asking.** That is a CDN.

#### Distance

- Light in fiber: about **200,000 km/s**
- Sydney ↔ Virginia: **≥ 160 ms** per round trip
- A page load needs several round trips

#### Crowds

- 8 p.m. premiere: millions press play at once
- One origin has one set of network links
- Repeat requests for the same bytes waste work

### A CDN puts a copy one short hop from each user

![Two panels. Left, without a CDN: users in Sydney, São Paulo, and Frankfurt each send every request to one origin server in Virginia, with round trips of about 160 to 200 milliseconds. Right, with a CDN: each user talks to a nearby point of presence in their own city in about 5 to 15 milliseconds, and only cache misses travel on to the origin in Virginia.](../../assets/class-notes/week05-session-s6-1.svg)

*Without a CDN every request crosses the ocean. With one, only cache misses do*

### How your request finds the nearest PoP

- A **point of presence (PoP)** is a rack of servers in a building where many networks meet
- Big CDNs run hundreds of PoPs; Cloudflare lists data centers in **330+ cities**
- **Anycast:** every PoP announces the *same* IP address; internet routing delivers you to a nearby one
- **DNS steering:** the CDN's DNS answers with the address of a PoP chosen for *you*
- Each PoP has **its own** cache — "it's cached" is never a global statement
- On a miss, PoPs often ask a regional **shield** cache first, so the origin sees one request, not hundreds

**Sources**

- Cloudflare — [Global network](https://www.cloudflare.com/network/)
- Amazon — [What is Amazon CloudFront?](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)

### Demo: which PoP is serving you right now?

#### Steps

1. Open `https://www.cloudflare.com/cdn-cgi/trace` in any browser
2. Find the `colo=` line — an airport code (`ORD` is Chicago O'Hare)
3. Try it on your phone with Wi-Fi **off**, then compare with a neighbor

#### Expected observations

- Laptops on campus Wi-Fi show the same code; a phone on cellular may differ
- `ip=` shows the address the PoP saw; `http=` shows the HTTP version used

#### Fallback

Read the captured trace in the speaker notes aloud and point at `colo=`.

**Sources**

- Cloudflare — [Global network](https://www.cloudflare.com/network/)

### A modern edge does far more than store files

| Edge service | What it does for you | Where you meet it |
| --- | --- | --- |
| **Static caching** | Serves JS, CSS, images, video segments from the PoP | Every CDN |
| **API micro-caching** | Shares a public JSON answer for a few seconds | Block B's `/api/status` |
| **TLS termination** | Finishes the HTTPS handshake near the user | HW4's certificate, now at the edge |
| **Compression and images** | Brotli/gzip, resizing, modern image formats | Block B, HW5 Task 4 |
| **Security** | DDoS absorption, WAF rules, bot filtering | Week 8 |
| **Edge functions** | Small programs that run in the PoP | Cloudflare Workers, Lambda@Edge |

### How streaming reaches the world

### Two systems: the app you browse, and the pipe that plays

![Netflix architecture split in two. The control plane, in Amazon Web Services, handles sign-in, browsing, search, recommendations, billing, transcoding, and deciding which server should stream to you. Pressing play hands off to the data plane, Open Connect, whose appliances stream the actual video segments to the device.](../../assets/class-notes/week05-session-s11-1.svg)

*Netflix — everything before you press play runs in the cloud; everything after comes from Open Connect*

**Sources**

- Netflix — [How Netflix works with ISPs around the globe](https://about.netflix.com/en/news/how-netflix-works-with-isps-around-the-globe-to-deliver-a-great-viewing-experience)
- Netflix — [Open Connect overview (PDF)](https://openconnect.netflix.com/Open-Connect-Overview.pdf)

### A movie is thousands of small, cacheable files

> **Key idea**
>
> Video becomes ordinary HTTP requests for files that never change.

#### Encode once, many ways

- A **ladder** of versions: 240p up to 4K
- Each cut into **segments** of a few seconds
- A **manifest** (HLS or DASH) lists the URLs

#### Play adaptively

- Player reads the manifest, then fetches segments
- **Adaptive bitrate:** slow network → lower rung
- Segments never change: **static, shareable files**

**Sources**

- Apple Developer — [HTTP Live Streaming](https://developer.apple.com/documentation/http-live-streaming)

### Netflix Open Connect: the "last mile" is the point

![Netflix Open Connect tiers from left to right. Netflix origin storage fills appliances overnight during off-peak hours. Appliances at internet exchange points serve many ISPs. Embedded appliances sit inside an individual ISP](../../assets/class-notes/week05-session-s13-1.svg)

*Open Connect fills appliances off-peak, so the evening rush is served from inside your ISP*

**Sources**

- Netflix — [Open Connect appliances](https://openconnect.netflix.com/en/appliances/)
- Netflix — [Open Connect peering](https://openconnect.netflix.com/en/peering/)

### Why Netflix built its own CDN instead of renting one

- **Scale:** Open Connect has carried **100%** of Netflix video since it launched (built 2011, announced 2012)
- **Placement:** close to **90%** of that traffic flows over direct connections to residential ISPs
- **Free boxes:** qualifying ISPs get appliances at no charge — and stop paying to haul Netflix over transit links
- **Predictability:** a known catalog can be pushed off-peak; a general CDN can only react to requests
- **Specialization:** per-server throughput grew from **8 Gbps** (2012) to **over 90 Gbps** (2016)

> **Key idea**
>
> Netflix's CDN is a partnership with ISPs, not just hardware. Both sides save money,
> and viewers get a stream that starts one hop from home.

**Sources**

- Netflix — [How Netflix works with ISPs around the globe](https://about.netflix.com/en/news/how-netflix-works-with-isps-around-the-globe-to-deliver-a-great-viewing-experience)
- Netflix — [Open Connect](https://openconnect.netflix.com/en/)

### Three platforms, three delivery strategies

| | Netflix | Disney+ | Max (Warner Bros. Discovery) |
| --- | --- | --- | --- |
| **Video delivery** | Own CDN: Open Connect | Several CDN partners, incl. on-net caches in ISPs | Four commercial CDNs |
| **Build or buy** | Builds its own appliances | Rents several; builds its own load balancer | Rents: CloudFront, Google Cloud CDN, Akamai, Fastly |
| **How a CDN is picked** | Netflix steers to its own servers | Partners scored on rebuffering, start time, failures, bitrate | Multi-CDN for resilience at more than an exabyte a month |
| **Control plane** | AWS | Streaming platform built from BAMTech | AWS as primary cloud |

**Sources**

- Streaming Media — [Disney Streaming on multi-CDN load balancing](https://www.streamingmedia.com/Articles/ReadArticle.aspx?ArticleID=145721)
- Streaming Media — [Disney Streaming on QoE metrics](https://www.streamingmedia.com/Articles/ReadArticle.aspx?ArticleID=150246)
- TechCrunch — [How WBD made Max less buggy (2023)](https://techcrunch.com/2023/05/05/warner-bros-discovery-cto-and-cpo-explain-how-they-made-max-less-buggy/)

### Live events break the "copy it in advance" trick

#### Why live is hard

- Segments for a live game **did not exist** a few seconds ago — nothing to pre-fill
- Every viewer wants the **same** new segment within the same second
- A miss at 300 PoPs at once could become 300 requests to the origin

#### What the industry does

- **Request collapsing:** a PoP sends one origin fetch per segment, the rest wait for it
- **Shield tiers:** PoPs ask a regional cache, not the origin
- **Short manifest TTLs, long segment TTLs**
- **Multi-CDN failover** and capacity booked in advance

### Fictional CampusPulse case: what must never be shared

> **Key idea**
>
> Share a video segment everywhere; never share a "continue watching" row.

#### The incident

- Luis opens `/account`, signed in
- The edge stores it under **host + path**
- Maya requests `/account`: gets **Luis's page**

#### The rule

- A cache stores under a **key**: host + path + query
- Depends on anything **not in the key**? Sharing leaks
- Personalized → **private**: browser only

### Where should each of these be answered — and is it safe to share?

1. A 4-second segment of episode 3 in 1080p, requested by 40,000 viewers tonight
2. CampusPulse's `/assets/index-C4c61eeb.js`, built by Vite
3. CampusPulse's `/api/status`, identical for everyone, changes every few seconds
4. A streaming app's "Continue watching" row for the signed-in viewer

### What Block B does with this

- You now know **where** copies live and **what** may be shared
- Block B opens the stack: browser, service worker, React data cache, CDN, reverse proxy, Redis, database
- For each layer: what it is good at, a real product that implements it, and how it is invalidated
- Then one **complete React + Node example**: Vite build, Express headers, a Redis cache-aside, and invalidation on write
- HW5 asks you to design that stack for your own CampusPulse and prove it works

## Block B — Caching layers

### Caching technologies, layer by layer

Browser, service worker, React data cache, CDN, reverse proxy, Redis, and the database — and one React + Node app that configures four of them

Every fast app is a stack of caches. Today you see the whole stack, then configure four layers of it in one React + Node app.

### The cache stack, from the tab to the database

![Seven caching layers in a row from user to data. Browser HTTP cache and service worker, both inside the user](../../assets/class-notes/week05-session-s21-1.svg)

*Each layer is closer to the user, faster, and knows less about whether its copy is still true*

### What each layer is good at, and who uses it

| Layer | Best for | Real-world example |
| --- | --- | --- |
| **React data cache** | Not refetching the same API data on every render or route change | TanStack Query in a React dashboard |
| **Service worker** | Offline and instant repeat loads; app-shell caching | Offline-capable progressive web apps |
| **Browser HTTP cache** | JS, CSS, images, fonts with long lifetimes | Every site: hashed bundle files |
| **CDN edge** | Static files and public responses near users | Video segments, product images, `/api/status` |
| **Reverse proxy** | Caching whole responses in front of slow app servers | Nginx `proxy_cache`, Varnish on news sites |
| **App cache (Redis)** | Expensive query results, sessions, rate-limit counters | Facebook's memcache tier — billions of requests a second |

**Sources**

- MDN — [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- Varnish — [Introduction](https://varnish-cache.org/intro/) · Nginx — [`proxy_cache`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- USENIX NSDI '13 — [Scaling Memcache at Facebook](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala)
- AWS — [Caching overview](https://aws.amazon.com/caching/)

### Four questions pick the layer for you

- **Who may see this copy?** One user → device layers only. Everyone → any layer
- **How stale may it be?** Never → don't cache, or revalidate every time. Seconds → short TTL. Forever → hashed name
- **How expensive is a miss?** A 300 ms query hit 1,000 times a minute is worth caching; a 2 ms lookup may not be
- **How will you throw it away?** Expire on a timer, delete on write, or change the name — decide **before** caching

> **Key idea**
>
> If you cannot answer the fourth question, you are not ready to add the cache.
> Stale data that you cannot remove is a bug you shipped on purpose.

### CampusPulse in React + Node, cached end to end

### Four kinds of response, four caching decisions

![The CampusPulse sample architecture. A browser talks through a CDN to one Express server. Express serves four kinds of response. Hashed assets: cached by browser and CDN for one year. The index.html shell: no-cache, revalidated every load. API status: public for 10 seconds at browser and CDN, plus Redis for 10 seconds. API incidents: no-cache for browsers and CDN, Redis for 30 seconds with delete on write. API me: private, no-store, never cached. Redis or in-memory cache sits beside Express, and a slow database sits behind it.](../../assets/class-notes/week05-session-s25-1.svg)

*One Express server serves the React build and the API, and makes a different caching decision for each route*

**Sources**

- Course — [`react-node-cache` sample](samples/react-node-cache/README.md)

### Step 1 — Vite already fingerprints your build

```text title="npm run build — what Vite writes to dist/"
dist/
├── index.html                ← small; names the current bundle
└── assets/
    ├── index-C4c61eeb.js     ← the hash changes when the bytes change
    └── index-9b73e0aa.css

# index.html after the build:
<script type="module" src="/assets/index-C4c61eeb.js"></script>
```

> **Key idea**
>
> New code → new filename → a URL no cache has ever seen. That is why the files
> can be cached for a year with nothing to purge, and why `index.html` cannot.

**Sources**

- Vite — [Building for production](https://vite.dev/guide/build)

### Step 2 — Express: long-lived assets, a shell that always checks

```js title="server.mjs — static files and the SPA shell"
// Hashed build output: new bytes get a new URL, so browsers and
// CDNs may keep these for a year. A missing asset is a 404.
app.use("/assets", express.static(resolve(distDir, "assets"), {
  immutable: true, maxAge: "1y", index: false, fallthrough: false,
}));
// → Cache-Control: public, max-age=31536000, immutable

// The shell names the current hashes, so every load checks for a
// newer deploy — a cheap 304 Not Modified when nothing changed.
app.get("/{*splat}", (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.sendFile("index.html", { root: distDir });
});
```

**Sources**

- Express 5 — [`express.static` and `res.sendFile`](https://expressjs.com/en/5x/api.html)

### Step 3 — one Cache-Control decision per API route

```js title="server.mjs — the API routes"
app.get("/api/status", async (req, res) => {        // same for everyone
  const { value, state } = await cached("status:v1", 10, () => db.status());
  res.set({ "Cache-Control": "public, max-age=10", "X-Cache": state });
  res.json(value);
});

app.get("/api/incidents", async (req, res) => {     // changes on writes
  const { value, state } = await cached("incidents:open:v1", 30,
    () => db.openIncidents());
  res.set({ "Cache-Control": "no-cache", "X-Cache": state });
  res.json({ incidents: value });
});

app.get("/api/me", (req, res) => {                  // one user only
  res.set("Cache-Control", "private, no-store");
  // … read the session cookie and respond …
});
```

### Step 4 — cache-aside, with a stampede guard

```js title="server.mjs — the cached() helper"
async function cached(key, ttlSeconds, load) {
  const hit = await store.get(key);
  if (hit !== null) return { value: JSON.parse(hit), state: "HIT" };
  if (!inflight.has(key)) {                      // first miss does the work
    inflight.set(key, (async () => {
      try {
        const value = await load();
        await store.setEx(key, ttlSeconds, JSON.stringify(value));
        return value;
      } finally {
        inflight.delete(key);
      }
    })());
  }
  return { value: await inflight.get(key), state: "MISS" };
}
```

**Sources**

- Redis — [Caching](https://redis.io/solutions/caching/) · [Node.js client](https://redis.io/docs/latest/develop/clients/nodejs/)

### Step 5 — every write deletes the keys it changed

```js title="server.mjs — POST /api/incidents (validation trimmed)"
app.post("/api/incidents", jsonBody, async (req, res) => {
  // … refuse unless writes are enabled; validate title and service …
  const created = await db.createIncident({ title: title.trim(), service });
  await Promise.all([store.del("incidents:open:v1"), store.del("status:v1")]);
  res.status(201).location(`/api/incidents/${created.id}`).json(created);
});
```

> **Key idea**
>
> The next read is a `MISS` and loads fresh data. A new incident changes the
> status summary too — forgetting a **dependent key** is the classic bug.

### Step 6 — React keeps one shared copy in the tab

```jsx title="StatusBanner.jsx — TanStack Query as the client cache"
import { useQuery } from "@tanstack/react-query";

export function StatusBanner() {
  const { data, isPending } = useQuery({
    queryKey: ["status"],
    queryFn: () => fetch("/api/status").then((r) => r.json()),
    staleTime: 10_000,   // every component shares one copy for 10 s
  });
  if (isPending) return <p>Checking services…</p>;
  const down = data.services.filter((s) => s.state !== "operational");
  return <p>{down.length ? `${down.length} degraded` : "All clear"}</p>;
}
```

**Sources**

- TanStack Query — [Caching examples](https://tanstack.com/query/latest/docs/framework/react/guides/caching)

### Demo: watch the app cache absorb the load

#### Steps

1. In `weeks/week05/samples/react-node-cache`: `npm install`, then `npm start`
2. Open `http://127.0.0.1:3000/` with DevTools → Network, then reload
3. Open `/api/status` and reload twice; read `X-Cache` and the time column

#### Expected observations

- Asset: `200 (memory cache)` on reload; shell: `304` or a quick revalidated `200`
- `/api/status`: `MISS` near 300 ms, then `HIT` in a few ms

#### Fallback

Run `npm test` in the sample and read the eight passing test names aloud.

**Sources**

- Course — [`react-node-cache` README](samples/react-node-cache/README.md)

### Service workers: you write the caching strategy yourself

| Strategy | What it does | Use it for |
| --- | --- | --- |
| **Cache first** | Answer from Cache Storage; network only on a miss | Hashed assets, fonts, the app shell |
| **Network first** | Try the network; fall back to the cache when offline | Pages and API data that should be current |
| **Stale-while-revalidate** | Answer from cache now, refresh it in the background | Avatars, non-critical lists, news feeds |
| **Network only** | Never cache | Sign-in, payments, anything personal and live |
| **Cache only** | Never touch the network | Files pre-cached at install time |

**Sources**

- Chrome for Developers — [Workbox caching strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview)

### The two hard problems: stale data and stampedes

#### Throwing copies away

- **TTL:** simplest; accept staleness up to N seconds
- **Delete on write:** exact, but only where you can reach (Redis, not browsers)
- **New name:** hashed files and versioned keys like `status:v1` → `v2`
- **Purge:** ask the CDN to forget a URL — slow, and never reaches browsers

#### Surviving a cold cache

- A popular key expires and 1,000 requests miss at once: a **stampede**
- **Coalesce:** one loader per key (the `inflight` map)
- **Serve stale while refreshing:** answer with the old copy, update behind it
- **Jitter TTLs** so a thousand keys do not expire in the same second

### The header vocabulary, as reference — what each one is for

| You want… | Header / directive | Layer it talks to |
| --- | --- | --- |
| Keep a hashed file for a year | `public, max-age=31536000, immutable` | Browser + CDN |
| Cache, but check before each reuse | `no-cache` + an `ETag` (answer: `304`) | Browser + CDN |
| Never store it anywhere | `no-store` (`private` = this user's browser only) | Every layer |
| Different lifetime for shared caches | `s-maxage=N` (overrides `max-age` at the CDN) | CDN, proxies |
| Serve stale while refreshing or during an outage | `stale-while-revalidate`, `stale-if-error` | Browser + CDN |
| Add a request header to the cache key | `Vary: Accept-Encoding` (or a CDN key rule) | Browser + CDN |

**Sources**

- MDN — [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- IETF — [RFC 9111, HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- Course — [Week 5 reference](reference.md)

### The edge also shrinks the bytes it serves

- **Compression:** Brotli or gzip on text (HTML, JS, CSS, JSON) — often 60–80% smaller
- The browser says what it accepts (`Accept-Encoding`); the server or CDN picks one
- **Images** are usually the heaviest bytes: AVIF or WebP, sized with `srcset`, with `width` and `height` set
- Many CDNs compress and resize images for you at the PoP — it is a setting, not code
- HW5 Task 4 asks you to **measure** this on your deployment, not assume it

**Sources**

- MDN — [Compression in HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Compression)
- MDN — [Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images)

### Design the cache for two CampusPulse features

1. **Building hours** (`/api/buildings/hours`): same for everyone, edited by staff about once a week, read on every page load
2. **"My reports"** (`/api/me/reports`): a signed-in student's own outage reports, updated when they file one

For each, name the **layer(s)**, the **key**, **how it is invalidated**, and **one line of config** (header or code).

**Sources**

- Course — [`react-node-cache` sample](samples/react-node-cache/README.md)

### What Block C does with this

- Caching is a performance claim. Block C asks: **did it actually help a person?**
- Core Web Vitals (LCP, INP, CLS) and the rendering choice behind them
- Accessibility checks that tools catch and the ones they miss
- Logs, metrics, traces, and an SLO — so you know when the cache hides a failure
- Then the lab: reproduce the Luis/Maya leak on your laptop, fix it, and measure

## Block C — Measure and observe

### Measuring the human experience — and knowing when it breaks

Core Web Vitals, accessibility as a release gate, and the smallest observability that would have told you

Everything so far was about bytes. This block is about whether a person noticed.

### Fictional CampusPulse case: fast page, failed experience

#### The dashboard is green

- LCP is `1.4 s`, INP is `110 ms`, and CLS is `0.02`
- Every report request in the logs returns **200**
- The release is declared healthy

#### Maya cannot submit

- Keyboard focus never reaches **Report outage**
- The automated scanner reports no critical violation
- A useful SLI is completed reports, split by input path, not page loads

### Three vitals, and one of them replaced the one you learned

- **LCP** — time to the largest visible element. Good is **≤ 2.5 s** at p75. Bad means slow origin, render-blocking CSS, or an unoptimized hero
- **INP** — worst interaction to next paint. Good is **≤ 200 ms** at p75. Bad means long tasks on the main thread
- **CLS** — unexpected layout movement. Good is **≤ 0.1**. Bad means unsized images, late banners, or a font swap

> **Failure to avoid**
>
> **INP replaced FID in March 2024.** If you learned First Input Delay, unlearn it.
> FID timed only the *delay before* the first handler ran — a page could score a
> perfect FID and still freeze for two seconds after every click.

**Sources**

- web.dev — [Core Web Vitals](https://web.dev/articles/vitals) · [INP](https://web.dev/articles/inp) · Google — [INP becomes a Core Web Vital](https://web.dev/blog/inp-cwv-launch)

### Lab and field answer different questions

- **Lab** — Lighthouse, WebPageTest, your CI. One device, one network, **reproducible**, so you can A/B a change
- **Field** — `web-vitals` in your own app. Every device and network, **not reproducible**: you cannot re-run Tuesday
- Lab gives you a **diagnosis** — which element, which script. Field gives you a **verdict** — is it bad, and for whom

> **Caution**
>
> **You will have no CrUX data, and that is correct.** Chrome's public field
> dataset only covers origins above a popularity threshold. A project three people
> have visited will never qualify — the absence of data is a property of the
> dataset, not a defect in your site.

**Sources**

- Chrome — [CrUX methodology: eligibility](https://developer.chrome.com/docs/crux/methodology#eligibility)

### A budget is a number you agreed to fail

```console title="the same page, two delivery strategies — Lighthouse 13.4.1, mobile preset, 2026-08-15"
                        /slow      /fast    budget   verdict
  Performance score        59        100         —
  First Contentful Paint  0.8 s     0.6 s     1.8 s   pass / pass
  Largest Contentful Pt   3.7 s     0.8 s     2.5 s   FAIL / pass
  Total Blocking Time    2750 ms      0 ms    200 ms  FAIL / pass
  Cumulative Layout Shift    0          0       0.1   pass / pass

  Same HTML. Same image. Three delivery changes:
    render-blocking CSS on a slow response -> critical CSS inlined
    unsized <img>                          -> width/height + fetchpriority
    700 ms synchronous script              -> deferred, off critical path
```

> **Key idea**
>
> Same user-visible content. Only the resource scheduling and script execution
> changed. **Delivery is a first-class engineering decision, not a deployment
> detail.**

### Windows: put both pages on screen and measure

```powershell title="PowerShell - repository root; Node 20+, no network needed"
Set-Location .\weeks\week05\samples ; node origin.mjs  # Terminal A
$o = 'http://127.0.0.1:8080'                          # Terminal B
curl.exe -sS --noproxy '*' -o NUL -w '%{http_code} ' "$o/slow"
curl.exe -sS --noproxy '*' -o NUL -w "%{http_code}`n" "$o/fast"
# Expect: 200 200
Start-Process "$o/slow"
# Then F12 > Lighthouse > Navigation + Mobile > Analyze.
# Repeat on /fast. Cleanup: Ctrl+C Terminal A when done.
```

**Sources**

- Course — [`/slow` and `/fast` handlers](samples/origin.mjs)

### macOS: put both pages on screen and measure

```bash title="macOS Terminal (zsh or bash) - Node 20+, no network"
cd weeks/week05/samples && node origin.mjs   # Terminal A
o='http://127.0.0.1:8080'                    # Terminal B
curl -sS --noproxy '*' -o /dev/null -w '%{http_code} ' "$o/slow"
curl -sS --noproxy '*' -o /dev/null -w '%{http_code}\n' "$o/fast"
# Expect: 200 200
open "$o/slow"
# Then Cmd+Opt+I > Lighthouse > Navigation + Mobile > Analyze.
# Repeat on /fast. Cleanup: Ctrl-C Terminal A when done.
```

**Sources**

- Course — [`/slow` and `/fast` handlers](samples/origin.mjs)

### Rendering strategy is a delivery decision, not a framework preference

- **CSR** — cheapest origin; content waits on JS. The shell and assets still cache well, the *data* does not
- **SSR** — content in the first response; costs origin work per request, **and it is dynamic: mind the cache key**
- **SSG** — no origin work, fully edge-cacheable, and stale until you rebuild
- **ISR** — SSG's economics with a bounded staleness window
- Ask "how fresh must this be, is it the same for everyone, and who pays for it?" — that picks the strategy

> **Key idea**
>
> ISR is `stale-while-revalidate` implemented in your framework instead of your
> CDN. You already know the semantics; only the vendor changed.

### Accessibility

### The scanner is clean-ish. The page is not usable

```console title="axe-core 4.12.1 against samples/origin.mjs /a11y — real output, 2026-08-15"
$ npx @axe-core/cli http://127.0.0.1:8080/a11y

  Violation of "color-contrast" with 3 occurrences!
  Violation of "image-alt"      with 1 occurrences!
  Violation of "tabindex"       with 1 occurrences!

  5 Accessibility issues detected.

  Please note that only 20% to 50% of all accessibility issues can
  automatically be detected. Manual testing is always required.
```

> **Caution**
>
> That last paragraph is printed by the axe CLI itself, unprompted. **Deque ships
> their scanner with a disclaimer about their scanner.** Read it as an
> instruction, not a footnote.

**Sources**

- Deque — [axe-core rule descriptions](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- W3C WAI — [How to Meet WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/)

### Demo: the scanner, then your hands off the mouse

#### Steps

1. Origin running? `node origin.mjs` in `weeks/week05/samples`
2. Run the scanner. Read its own disclaimer aloud
3. Click once into the page, then **Tab, Enter, Escape** only

#### Expected observations

- 3 rules found; Enter does nothing; focus invisible

#### Fallback

No Chrome? Do step 3 alone. See `lab.md` §5b.

**Sources**

- Course — [the planted defects](samples/origin.mjs) · [lab §5](lab.md)

### Windows: run the scanner, then open the page

```powershell title="PowerShell - repo root; origin on 8080; Chrome at shown path"
$a = 'http://127.0.0.1:8080/a11y'
$chrome = Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'
curl.exe -sS --noproxy '*' -o NUL -w "a11y=%{http_code}`n" $a
# First npx use needs internet; adjust the browser path if necessary.
npx --yes @axe-core/cli --version
npx --yes @axe-core/cli $a --chrome-path $chrome
Start-Process -FilePath $chrome -ArgumentList $a
```

**Sources**

- Deque — [axe-core CLI](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/cli)

### macOS: run the scanner, then open the page

```bash title="macOS Terminal - repo root; origin on 8080; Chrome installed"
a='http://127.0.0.1:8080/a11y'
chrome_dir='/Applications/Google Chrome.app/Contents/MacOS'
chrome="$chrome_dir/Google Chrome"
curl -sS --noproxy '*' -o /dev/null -w 'a11y=%{http_code}\n' "$a"
# First npx use needs internet; adjust the browser path if necessary.
npx --yes @axe-core/cli --version
npx --yes @axe-core/cli "$a" --chrome-path "$chrome"
open -a "Google Chrome" "$a"
```

**Sources**

- Deque — [axe-core CLI](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/cli)

### The same page, keyboard only

#### What axe reported

- 3 low-contrast elements
- 1 image with no `alt`
- 1 positive `tabindex`

Lighthouse accessibility: **80 / 100**

The `label` rule **passed**, 2 nodes.

#### What Tab and Enter found

- Focus is **invisible** — `:focus { outline: none }`
- The Submit "button" is a `div` — **Enter does nothing**
- The dialog ignores Escape and strands focus
- The "label" is a **placeholder**; it vanishes as you type

### The exact keystrokes, and what to watch for

| Press | On | Watch for |
| --- | --- | --- |
| `Tab` ×1 | from the address bar | Focus lands on "Back to status" — **last** visually |
| `Tab` ×2 | to Building code | The placeholder is the only label |
| any key | in Building code | The label is gone while you type |
| `Enter` | on **Submit report** | Nothing happens — it is a `div` |
| mouse, then `Escape` | the help dialog | It stays open; focus never entered |

**Sources**

- W3C WAI — [Keyboard accessibility](https://www.w3.org/WAI/perspective-videos/keyboard/)

### What this page proves, and what it does not

- **Real:** every defect above is a pattern that ships in production code, and the keyboard finds all of them
- **Real:** the scanner's own printed disclaimer is its vendor's position, not ours
- **Fixture:** the defect list is curated and documented — a real page has no answer key
- **Pinned:** 3 rules / 5 occurrences is **axe-core 4.12.1**; a newer build may catch more, or fewer
- **Not a score:** Lighthouse gave this page **80 / 100**, and a keyboard user cannot submit the form

> **Caution**
>
> "The scanner found nothing" is not a result on your own app until you have
> also done the five-minute keyboard pass. The scan and the pass answer different
> questions.

### The five-minute keyboard pass, before every release

1. **Tab from the top.** Can you reach every control? Does the order match the visual order?
2. **Can you see where you are?** If the focus ring is invisible, stop. Everything after this is guesswork
3. **Enter and Space** on everything focusable. Does it do what clicking does?
4. **Open a dialog.** Does focus move in, stay in, leave on Escape, and return where it started?
5. **Cause an error.** Is it announced, associated with the field, and readable without colour?

> **Tip**
>
> Five minutes, no tools, no install. It finds more real defects than any scanner
> you can buy, and you can run it on the pull request.

### Windows: the fallbacks, and stopping the origin

```powershell title="PowerShell - repository root"
Get-Content .\weeks\week05\samples\k6-baseline-summary.txt
Get-Content .\weeks\week05\samples\campuspulse-load-profile.js
# Cleanup: Ctrl+C the origin in Terminal A, and close the tabs
# on /a11y, /slow and /fast. That is the whole cleanup.
# If 8080 looks busy, LOOK - never end what you did not start:
Get-NetTCPConnection -LocalPort 8080 -State Listen -EA Ignore |
  ForEach-Object { Get-Process -Id $_.OwningProcess }
# Busy port? Use the saved captures; leave other processes alone.
```

**Sources**

- Course — [captured k6 baseline](samples/k6-baseline-summary.txt) · [load profile](samples/campuspulse-load-profile.js)

### macOS: the fallbacks, and stopping the origin

```bash title="macOS Terminal (zsh or bash) - repository root"
less weeks/week05/samples/k6-baseline-summary.txt      # q quits
less weeks/week05/samples/campuspulse-load-profile.js
# Cleanup: Ctrl-C the origin in Terminal A, and close the tabs
# on /a11y, /slow and /fast. That is the whole cleanup.
# If 8080 looks busy, LOOK - never end what you did not start:
lsof -nP -iTCP:8080 -sTCP:LISTEN
# Busy port? Use the saved captures; leave other processes alone.
```

**Sources**

- Course — [captured k6 baseline](samples/k6-baseline-summary.txt) · [load profile](samples/campuspulse-load-profile.js)

### Observability

### Three telemetry signals

- **Logs** — what happened once, as structured JSON
- **Metrics** — how often, how slow
- **Traces** — where the time went
- Logs and traces join on `trace_id`
- Metrics link to traces through exemplars — never put trace ids in metric labels

> **Key idea**
>
> The useful log field here is `"cache":"MISS"`: it turns "the API was slow" into "the edge missed."

### An SLO is a sentence about users. A dashboard is not

- **SLI** — the measurement. *"Proportion of `/api/status` requests served in under 500 ms"*
- **SLO** — the target over a window. *"99% of those, over 28 days"*
- **Error budget** — what the SLO permits you to lose: **1% of eligible requests**
- Time-based instead? *"99% of one-minute windows are good"* — 1% of 28 days is **6 h 43 m**
- **Alert on the SLI burning the budget** — not on CPU, not on a single 500

> **Failure to avoid**
>
> An alert that fires when nothing is wrong trains people to ignore it. The next
> one is real, and by then nobody looks. **Alert fatigue is a design failure, not
> a discipline failure.**

**Sources**

- Google SRE — [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) · [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)

### Your status page renders in 900 ms but nobody can submit a report. What tells you?

1. Lighthouse in CI — scored 98 this morning
2. An `axe` run in the pipeline — zero violations
3. A metric: `http_requests_total{route="/incidents",status="2xx"}`
4. An uptime check hitting `/healthz` every 60 s

**Sources**

- Google SRE — [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)

## Individual practice

### Individual lab: cache and experience

**Core: 30 min + 5 min recovery. Parts 1 and 3 are optional.**

| Part | Focus | Min |
| --- | --- | ---: |
| 0 | Two terminals, two synthetic accounts | 3 |
| 2 | Observe all four cache states | 8 |
| 4 | Test account-page isolation | 7 |
| 5 | `axe` plus keyboard access | 7 |
| 6 | One SLI, SLO, and alert | 5 |

**Sources**

- Course — [Week 5 lab: full commands, expected output, and troubleshooting](lab.md)

## Homework brief

### HW5 — Own the Edge

- Put a CDN in front of your domain and build a **cache-policy matrix**: at least
  **six content classes**, each with its layer, key, invalidation, and rationale
- Implement **one app-layer cache** (cache-aside, Redis or memory) with HIT/MISS evidence
- Prove all four cache states, and reproduce **and revert** a cache-poisoning near-miss
- Measure against a stated performance budget and pilot your own **RUM** with `web-vitals`
- Run `axe` **and** record a keyboard-only walkthrough that finds **≥ 1 defect the scan missed**
- Stand up one SLI, one SLO, and one alert that has **actually fired**

> **Key idea**
>
> 100 points · individual · due at the start of Week 6, before the midterm. This is
> Gate 3 — Delivered and observable. Full handout: [`homework.md`](homework.md).

## Closing logistics

### Before you leave

#### Released today

- The [midterm blueprint](../../midterm/blueprint.md) and a
  [practice forensic case](../../midterm/practice-case.md)
- **The midterm is Week 6.** Sit the practice case **this week**, closed-book and
  timed, while Weeks 1–5 are still warm
- Also complete the [Week 6 prep](../week06/prep.md) before class

#### Exit ticket — one line

- Write one SLO for a feature on your own project, in the form: *"X% of \<action\>
  complete in under Y, measured over Z days."*
