#!/usr/bin/env node
/* ============================================================================
   weeks/week05/samples/origin.mjs — CSC 436 Week 5
   ----------------------------------------------------------------------------
   A deliberately small CampusPulse-shaped origin. No dependencies. Node >= 20.

     node origin.mjs            # listens on 8080
     PORT=9090 node origin.mjs

   Routes, chosen so that each one belongs to a DIFFERENT cache class:

     GET  /                    HTML shell            no-cache  (revalidate always)
     GET  /assets/app.<h>.js   content-addressed     max-age=31536000, immutable
     GET  /assets/app.css      NOT content-addressed max-age=60          <- the trap
     GET  /api/status          public API JSON       s-maxage=10, synchronous revalidation
     GET  /api/now             volatile JSON         s-maxage=10         <- never revalidates
     GET  /account             personalized          private, no-store   <- must never be shared
     GET  /healthz             liveness              no-store
     POST /admin/bump          change the data, so the ETag changes

   /api/status is deliberately STABLE between bumps: its bytes only change when
   you POST /admin/bump. That is what makes REVALIDATED reachable in a 35-minute
   lab. /api/now is deliberately VOLATILE — new bytes on every request — so you
   can see that a validator is worthless when the body never repeats.

   Every response carries an ETag and Last-Modified so conditional requests work,
   and the server honours If-None-Match / If-Modified-Since with a real 304.

   The interesting part is /account. It is personalized by the `sid` cookie. If
   anything in front of this origin caches it under a key that ignores Cookie,
   one user's page is served to the next user. That is the whole of Block A.
   ========================================================================== */

import { createHash } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8080);
const BOOTED = new Date();

/* LEAK=1 simulates a one-line bad deploy: /account is advertised as publicly
   cacheable and loses its `Vary: Cookie`. On its own this is survivable — a
   conservative cache key still saves you. It only becomes an incident when a
   second mistake is present in front of it. See edge.mjs. */
const LEAK = process.env.LEAK === "1";

/* The asset hash is computed from the bytes, exactly as a bundler would do it. */
const jsBody = `console.log("CampusPulse UI booted");\n`;
const jsHash = createHash("sha256").update(jsBody).digest("hex").slice(0, 8);
const JS_PATH = `/assets/app.${jsHash}.js`;

const cssBody = `:root{--ok:#86efac;--bad:#fca5a5}body{font-family:system-ui;margin:0}\n`;

const USERS = {
  "sid-alice": { name: "Alice Nguyen", campusId: "S0198442", balanceUSD: 41.5 },
  "sid-bob": { name: "Bob Ortiz", campusId: "S0207731", balanceUSD: 0 },
};

/* Mutable service state. Only POST /admin/bump changes it, which is what makes
   the ETag on /api/status stable enough to revalidate against. */
let revision = 1;
let nowSequence = 0;
let dataChangedAt = new Date();
const STATES = { sso: "operational", printing: "degraded", shuttle: "outage" };

const etagOf = (body) =>
  `"${createHash("sha256").update(body).digest("base64url").slice(0, 20)}"`;

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/**
 * Send a response, handling conditional requests properly.
 * A 304 carries the validators and the caching headers, and no body — which is
 * the entire point of a validator: you re-confirm freshness without re-sending
 * the payload.
 */
function send(req, res, { status = 200, body = "", type, cacheControl, vary, lastModified, extra = {} }) {
  const buf = Buffer.from(body);
  const etag = etagOf(buf);
  // Last-Modified must track the RESOURCE, not process start. Using BOOTED for
  // everything would let a client that only sends If-Modified-Since receive a
  // 304 for bytes that had actually changed.
  const lastMod = (lastModified ?? BOOTED).toUTCString();

  const headers = {
    "content-type": type,
    "cache-control": cacheControl,
    etag,
    "last-modified": lastMod,
    "x-origin-hit": "1",
    ...extra,
  };
  if (vary) headers.vary = vary;

  const inm = req.headers["if-none-match"];
  const ims = req.headers["if-modified-since"];
  // HTTP dates lose milliseconds. Prefer a safe 200 to a false 304 when an
  // update and the client's previous response fall within the same second.
  const modifiedTime = (lastModified ?? BOOTED).getTime();
  const matches =
    (inm && inm.split(",").some((t) => t.trim() === "*" || t.trim().replace(/^W\//, "") === etag)) ||
    (!inm && ims && new Date(ims).getTime() >= modifiedTime);

  if (status === 200 && ["GET", "HEAD"].includes(req.method) && matches) {
    res.writeHead(304, headers);
    return res.end();
  }

  headers["content-length"] = String(buf.length);
  res.writeHead(status, headers);
  if (req.method === "HEAD") return res.end();
  res.end(buf);
}

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CampusPulse — service status</title>
<link rel="stylesheet" href="/assets/app.css">
</head>
<body>
<header><h1>CampusPulse</h1></header>
<main>
  <h2>Current status</h2>
  <p id="status">Loading&hellip;</p>
  <img src="/assets/hero.svg" width="640" height="240"
       alt="Campus map with three service markers">
  <p><a href="/account">Your account</a></p>
</main>
<script src="${JS_PATH}"></script>
</body>
</html>
`;

const HERO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 240" role="img" aria-label="Campus map with three service markers"><rect width="640" height="240" fill="#17364E"/><circle cx="120" cy="120" r="26" fill="#86EFAC"/><circle cx="320" cy="120" r="26" fill="#FCD34D"/><circle cx="520" cy="120" r="26" fill="#FCA5A5"/></svg>`;

/* --------------------------------------------------------------- a11y ----- */
/* A page with a DELIBERATE, curated set of accessibility defects, split into
   two groups: ones an automated scanner reliably reports, and ones it cannot.
   The second group is the point of the exercise.

   VERIFIED against axe-core 4.12.1 on 2026-08-15. axe reported exactly three
   rules / five occurrences: color-contrast (3), image-alt (1), tabindex (1).
   Everything labelled "SCANNER MISSES" below was confirmed absent from both
   `violations` and `incomplete`. Documented in lab.md §5.
   Re-verify if you upgrade axe — the labels below are an answer key. */
const A11Y = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CampusPulse — report an outage</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background:#fff; color:#1a1a1a; }
  main { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem; }
  .muted   { color: #9aa4ad; }                 /* CAUGHT: 2.3:1 contrast */
  .fakebtn { display:inline-block; padding:.6rem 1rem; background:#0b5; color:#fff;
             border-radius:6px; cursor:pointer; }   /* CAUGHT: contrast on this too */
  :focus   { outline: none; }                  /* MISSED: focus invisible */
  .err     { color:#e11; }                     /* CAUGHT for contrast, MISSED as an error pattern */
  dialog   { padding:1.5rem; border:1px solid #888; }
</style>
</head>
<body>
<main>
  <h1>Report an outage</h1>

  <!-- (1) CAUGHT — rule "image-alt": image with no alt text -->
  <img src="/assets/hero.svg" width="640" height="240">

  <!-- (2) CAUGHT — rule "color-contrast": 2.3:1, below the 4.5:1 floor -->
  <p class="muted">Outages are triaged within one business day.</p>

  <form>
    <!-- (3) MISSED — axe's "label" rule PASSES here. A placeholder satisfies
             the accessible-name computation, so the scanner considers this
             input labelled. It is not: the name disappears the moment the user
             types, which is exactly when they need it. This is the most
             valuable single finding on the page. -->
    <p><input type="text" name="building" placeholder="Building code"></p>

    <label for="detail">What happened?</label>
    <p><textarea id="detail" name="detail" rows="3"></textarea></p>

    <!-- (4) MISSED as an error pattern: not associated with the field via
             aria-describedby, not in a live region, and carries no non-colour
             indicator. (Its low contrast IS caught, which is a different
             finding about a different problem.) -->
    <p class="err">Building code is required.</p>

    <!-- (5) MISSED — a div that behaves like a button. It is focusable and it
             has a role, so the scanner is satisfied — but there is no keydown
             handler, so Enter and Space do nothing. -->
    <div class="fakebtn" role="button" tabindex="0" onclick="openHelp()">Submit report</div>

    <!-- (6) CAUGHT — rule "tabindex" (a best-practice rule, enabled by
             default in the axe CLI): positive tabindex drags this control to
             the front of the tab order. -->
    <p><a href="/" tabindex="3">Back to status</a></p>
  </form>

  <!-- (7) MISSED: a dialog that never receives focus, does not trap focus, and
           cannot be dismissed with Escape -->
  <dialog id="help"><p>Reports go to Facilities.</p>
    <div class="fakebtn" role="button" tabindex="0" onclick="closeHelp()">Close</div>
  </dialog>
</main>
<script>
  function openHelp(){ document.getElementById('help').show(); }
  function closeHelp(){ document.getElementById('help').close(); }
</script>
</body>
</html>
`;

/* ------------------------------------------------------- perf demo pages -- */
/* /slow and /fast render the SAME content. The difference is entirely delivery:
   render-blocking CSS on a slow response, an unsized hero, and a synchronous
   long task — versus inlined critical CSS, a sized and preloaded hero, and the
   same work moved off the critical path. Used for the before/after Lighthouse
   worked example in homework.md. */

const HERO_BIG = (() => {
  // ~180 KB of real SVG. Not padding: 1,400 individually placed markers, which
  // is roughly what an unoptimised campus map export looks like.
  const dots = [];
  for (let i = 0; i < 1400; i += 1) {
    const x = ((i * 37) % 1180) + 10;
    const y = ((i * 61) % 460) + 10;
    const c = ["#86EFAC", "#FCD34D", "#FCA5A5", "#93C5FD"][i % 4];
    dots.push(`<circle cx="${x}" cy="${y}" r="${6 + (i % 5)}" fill="${c}" opacity="0.${70 + (i % 3)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480" role="img" aria-label="Campus map showing service markers across all buildings">${dots.join("")}</svg>`;
})();

const SLOW_CSS = `body{font-family:system-ui;margin:0;background:#fff;color:#111}
main{max-width:60rem;margin:0 auto;padding:2rem 1rem}
h1{font-size:2.5rem;margin:0 0 1rem}
.card{border:1px solid #ccc;border-radius:8px;padding:1rem;margin:1rem 0}
`;

const perfPage = (mode) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CampusPulse — ${mode === "fast" ? "status (optimized)" : "status"}</title>
${
  mode === "fast"
    ? `<style>${SLOW_CSS}</style>
<link rel="preload" as="image" href="/assets/hero-big.svg">`
    : `<link rel="stylesheet" href="/assets/slow.css">`
}
</head>
<body>
<main>
  <h1>Campus service status</h1>
  <img src="/assets/hero-big.svg" ${mode === "fast" ? 'width="1200" height="480" fetchpriority="high"' : ""}
       alt="Campus map showing service markers across all buildings">
  <div class="card"><h2>Single sign-on</h2><p>Operational</p></div>
  <div class="card"><h2>Printing</h2><p>Degraded</p></div>
  <div class="card"><h2>Shuttle tracker</h2><p>Outage</p></div>
</main>
<script ${mode === "fast" ? "defer" : ""} src="/assets/boot-${mode}.js"></script>
</body>
</html>
`;

const bootJs = (mode) =>
  mode === "fast"
    ? `requestIdleCallback(()=>{let n=0;for(let i=0;i<3e6;i++)n+=i;window.__t=n});\n`
    : `let n=0;const end=Date.now()+700;while(Date.now()<end){n++}window.__t=n;\n`;

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (p === "/" || p === "/index.html") {
    // HTML is the riskiest thing to cache: it is the document that carries
    // identity. no-cache means "you may store it, but revalidate every time".
    return send(req, res, {
      body: HTML,
      type: "text/html; charset=utf-8",
      cacheControl: "no-cache",
      vary: "Accept-Encoding",
    });
  }

  if (p === JS_PATH) {
    // Content-addressed. The name changes when the bytes change, so this can be
    // cached forever and never needs a purge.
    return send(req, res, {
      body: jsBody,
      type: "application/javascript; charset=utf-8",
      cacheControl: "public, max-age=31536000, immutable",
      vary: "Accept-Encoding",
    });
  }

  if (p === "/assets/app.css") {
    // NOT content-addressed. The 60s max-age is the tell: someone knew this
    // would need to change and traded correctness for a shorter window.
    return send(req, res, {
      body: cssBody,
      type: "text/css; charset=utf-8",
      cacheControl: "public, max-age=60",
      vary: "Accept-Encoding",
    });
  }

  if (p === "/assets/hero.svg") {
    return send(req, res, {
      body: HERO,
      type: "image/svg+xml",
      cacheControl: "public, max-age=31536000, immutable",
    });
  }

  if (p === "/admin/bump" && req.method === "POST") {
    revision += 1;
    dataChangedAt = new Date();
    STATES.printing = STATES.printing === "degraded" ? "operational" : "degraded";
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(JSON.stringify({ revision, printing: STATES.printing }) + "\n");
  }

  if (p === "/api/status") {
    // Stable bytes between bumps -> the ETag is stable -> a stale shared cache
    // can revalidate and get a 304 instead of a fresh payload.
    const body = JSON.stringify({
      revision,
      services: [
        { id: "sso", state: STATES.sso },
        { id: "printing", state: STATES.printing },
        { id: "shuttle", state: STATES.shuttle },
      ],
    });
    // NOTE the directives here, and what is deliberately ABSENT.
    //
    // `s-maxage=10` gives the shared cache a 10-second freshness lifetime and
    // `max-age=0` stops the browser reusing its own copy without checking.
    //
    // There is no `stale-while-revalidate` on this route, and that is not an
    // oversight. RFC 9111 §5.2.2.10: "The s-maxage directive incorporates the
    // semantics of the proxy-revalidate response directive for a shared cache."
    // §4.2.4 then forbids generating a stale response when proxy-revalidate
    // applies. So `s-maxage` + `stale-while-revalidate` is self-cancelling at a
    // shared cache: the stale window is unreachable. See /api/feed for the
    // version that actually gets stale behaviour.
    return send(req, res, {
      body,
      type: "application/json; charset=utf-8",
      cacheControl: "public, max-age=0, s-maxage=10",
      vary: "Accept-Encoding",
      lastModified: dataChangedAt,
    });
  }

  if (p === "/api/feed") {
    // The same data, with a policy that DOES get stale behaviour: one TTL for
    // everybody (no s-maxage), so nothing implies proxy-revalidate and the
    // RFC 5861 extensions apply.
    const body = JSON.stringify({ revision, services: STATES });
    return send(req, res, {
      body,
      type: "application/json; charset=utf-8",
      cacheControl:
        "public, max-age=10, stale-while-revalidate=30, stale-if-error=600",
      vary: "Accept-Encoding",
      lastModified: dataChangedAt,
    });
  }

  if (p === "/api/now") {
    // Volatile on purpose: the body changes every request, so the ETag changes
    // every request, so a conditional request can NEVER return 304.
    return send(req, res, {
      body: JSON.stringify({ now: new Date().toISOString(), sequence: ++nowSequence }),
      type: "application/json; charset=utf-8",
      cacheControl: "public, max-age=0, s-maxage=10",
      vary: "Accept-Encoding",
      lastModified: new Date(),
    });
  }

  if (p === "/account") {
    const sid = readCookie(req, "sid");
    const user = USERS[sid];
    if (!user) {
      return send(req, res, {
        status: 401,
        body: `<!doctype html><meta charset="utf-8"><title>Sign in</title><p>No session. Send Cookie: sid=sid-alice or sid=sid-bob.`,
        type: "text/html; charset=utf-8",
        cacheControl: "no-store",
        vary: "Cookie",
      });
    }
    const body = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Account — ${user.name}</title>
<h1>Account</h1>
<p>Signed in as <strong>${user.name}</strong> (${user.campusId})</p>
<p>Meal-plan balance: $${user.balanceUSD.toFixed(2)}</p>`;

    if (LEAK) {
      // THE BAD DEPLOY. Two characters of copy-paste from the asset handler:
      // the page is now advertised as publicly cacheable, and the `Vary: Cookie`
      // that told shared caches to key on identity is gone.
      return send(req, res, {
        body,
        type: "text/html; charset=utf-8",
        cacheControl: "public, max-age=60",
        extra: { "x-served-to": user.campusId },
      });
    }

    // private + no-store: only the end user's own cache may keep this, and
    // really, nobody should. Vary: Cookie is the belt to no-store's braces.
    return send(req, res, {
      body,
      type: "text/html; charset=utf-8",
      cacheControl: "private, no-store",
      vary: "Cookie",
      extra: { "x-served-to": user.campusId },
    });
  }

  if (p === "/slow" || p === "/fast") {
    return send(req, res, {
      body: perfPage(p.slice(1)),
      type: "text/html; charset=utf-8",
      cacheControl: "no-cache",
      vary: "Accept-Encoding",
    });
  }

  if (p === "/assets/hero-big.svg") {
    return send(req, res, {
      body: HERO_BIG,
      type: "image/svg+xml",
      cacheControl: "public, max-age=31536000, immutable",
    });
  }

  if (p === "/assets/boot-slow.js" || p === "/assets/boot-fast.js") {
    return send(req, res, {
      body: bootJs(p.includes("fast") ? "fast" : "slow"),
      type: "application/javascript; charset=utf-8",
      cacheControl: "public, max-age=60",
    });
  }

  if (p === "/assets/slow.css") {
    // A render-blocking stylesheet on a slow origin. 600 ms of nothing on screen.
    return setTimeout(
      () =>
        send(req, res, {
          body: SLOW_CSS,
          type: "text/css; charset=utf-8",
          cacheControl: "public, max-age=60",
        }),
      600
    );
  }

  if (p === "/a11y") {
    return send(req, res, {
      body: A11Y,
      type: "text/html; charset=utf-8",
      cacheControl: "no-cache",
      vary: "Accept-Encoding",
    });
  }

  if (p === "/healthz") {
    return send(req, res, {
      body: JSON.stringify({ status: "ok", uptimeSec: Math.round(process.uptime()) }),
      type: "application/json; charset=utf-8",
      cacheControl: "no-store",
    });
  }

  send(req, res, {
    status: 404,
    body: "not found\n",
    type: "text/plain; charset=utf-8",
    cacheControl: "no-store",
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`origin  listening on http://127.0.0.1:${PORT}`);
  console.log(`        hashed asset is ${JS_PATH}`);
  if (LEAK) console.log(`        LEAK=1  /account is public, max-age=60, no Vary  <-- BAD DEPLOY`);
});
