# React + Node caching, configured end to end

The worked example from Week 5 Block B, runnable. One Express server serves a
Vite/React build and a small CampusPulse API, and configures **four caching
layers** on purpose:

| Layer | What it holds here | How it is configured | How it is invalidated |
| --- | --- | --- | --- |
| Browser cache | hashed JS/CSS, the HTML shell | `Cache-Control` from `express.static` and `res.set` | new filename on every build; shell revalidates |
| CDN / edge | hashed assets, `/api/status` | the same `Cache-Control` (`public`) plus your CDN's cache rule | TTL expiry; hashed names never need a purge |
| App cache (memory or Redis) | `/api/status`, `/api/incidents` | cache-aside in `server.mjs`, `X-Cache: HIT/MISS` | TTL plus `del` on every write |
| Database | the source of truth | `fake-db.mjs`, deliberately 300 ms per query | — |

`/api/me` is personalized and is marked `private, no-store`: no shared layer may
keep it.

## Run it

Node 24 LTS. From this directory:

```bash
npm install
npm test     # 8 tests: headers, HIT/MISS, coalescing, invalidation, TTL
npm start    # http://127.0.0.1:3000, in-memory app cache
```

Watch the app cache work (use `curl.exe` in PowerShell):

```bash
curl -sS -D - -o /dev/null http://127.0.0.1:3000/api/status   # X-Cache: MISS (~300 ms)
curl -sS -D - -o /dev/null http://127.0.0.1:3000/api/status   # X-Cache: HIT  (~1 ms)
```

To try invalidation, start with local practice writes enabled
(`ALLOW_WRITES=1 npm start`, or `$env:ALLOW_WRITES='1'; npm start` in
PowerShell), read `/api/incidents` twice, `POST` a new incident, then read it
again: the next read is a `MISS` containing the new row.

```bash
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"title":"Wi-Fi down in the library","service":"wifi"}' \
  http://127.0.0.1:3000/api/incidents
```

Writes are refused unless `ALLOW_WRITES=1` **and** the server is bound to
loopback. This is a teaching switch, not authorization.

### With Redis

Any Redis 7+ works — a local install, a container, or a managed free tier.

```bash
docker run --rm -p 6379:6379 redis:7          # one option
REDIS_URL=redis://127.0.0.1:6379 npm start    # app cache: redis
```

The route code does not change: `store.mjs` exposes the same `get`, `setEx` and
`del` calls for both stores. The difference matters once you run **more than one
copy** of the server: with the in-memory store each replica has a private cache
and a write on one replica cannot invalidate the others; with Redis every replica
shares one cache and one `del`.

## Use it with your own React app

1. Build with Vite. `npm run build` already writes fingerprinted files such as
   `dist/assets/index-C4c61eeb.js`; no configuration is needed. (If you
   overrode `entryFileNames` to a fixed name such as `app.js`, as the course's
   `samples/first-web-app/react` bridge does, the file is **not** fingerprinted and must not get a
   one-year lifetime.)
2. Point this server at the build: `DIST_DIR=../my-app/dist npm start`. Without
   a `dist/index.html` it serves the stand-in in `demo-dist/`.
3. In React, let the client reuse data briefly instead of refetching per
   component — for example TanStack Query's `staleTime`. That is a fifth,
   in-memory cache in the tab (`npm install @tanstack/react-query` in the
   React app, not here):

```jsx
// main.jsx — one client for the whole app
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}><App /></QueryClientProvider>,
);

// StatusBanner.jsx — every component that asks for ["status"] shares one copy
const { data, isPending } = useQuery({
  queryKey: ["status"],
  queryFn: () => fetch("/api/status").then((r) => r.json()),
  staleTime: 10_000, // matches the server's max-age=10
});

// after a successful POST /api/incidents — invalidate on write, client side
queryClient.invalidateQueries({ queryKey: ["status"] });
```

## What this sample is not

It is a single-process teaching server with a fake database. It has no
authentication (Week 8), no rate limiting, and its CDN behaviour depends on the
cache rule you configure at your provider. `X-Cache` here reports the **app**
cache only; your CDN reports its own status in a vendor header such as
`cf-cache-status`.
