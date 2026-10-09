# Final web application — requirements checklist

**Individual · public on the internet · uses every unit of the course.**

You build and operate **one** full web application. CampusPulse (a synthetic
campus service-status and incident tracker; see [README.md](README.md)) is the
default domain. You may propose a different domain in your
[charter](project-charter-template.md) if it meets every requirement below.

Each requirement is pass/fail and must be **proven with evidence**, not just
described. Features beyond this list earn no extra credit. The detailed
reference is [requirements.md](requirements.md), with checks in
[acceptance.md](acceptance.md) and grading in [rubric.md](rubric.md).

---

## 1. Hard gates (any one caps your grade)

- No live secret anywhere: repo, image, logs, screenshots, or the client bundle.
- No fabricated or altered evidence.
- The deployment can be reproduced from your instructions.
- No write action or MCP tool is reachable without authorization.
- Synthetic data only, with no real personal or institutional data.

## 2. Functional requirements

| # | Requirement | Proof |
| --- | --- | --- |
| F1 | **React + TypeScript frontend** with a public page, plus search and filter. It builds under `strict` with no unjustified `any` or `@ts-ignore`. | Clean `tsc --strict` output |
| F2 | Visible **loading, empty and error states** for every remote call. | Screenshots plus forced-failure test |
| F3 | **REST API** (any backend language) with correct methods, status codes (`200/201+Location/204/400/401/403/404/409`), one JSON error shape, and server-side validation. | `curl -i` transcript per route, including failures |
| F4 | **Persistent storage** in a real database (relational recommended). Data survives restarts and redeploys. Schema has primary keys, foreign keys and at least one index you justify. | Schema/ER diagram; restart test |
| F5 | **Versioned schema migrations**, at least one of which is reversible and tested. | Migration files; up/down log |
| F6 | **Append-only audit trail**: who, what, when, and before/after. The actor comes from the validated token. | Query output |
| F7 | **OAuth 2.0 / OIDC login** with a real provider (course tenant, GitHub, Google or Entra ID). Uses Authorization Code + PKCE, `state` and `nonce`. No home-made password auth. | Redacted login flow (HAR) |
| F8 | **Server-side token validation**: signature (JWKS), issuer, audience, expiry and scope. | One failing test per check |
| F9 | **At least two roles** (e.g. viewer, operator), taken from validated claims and enforced on the server. | 401 for anonymous and 403 for viewer on a write |
| F10 | **At least one third-party API integration** called from your server. It must have: the key in a secret store, a timeout, bounded retry, a cache that respects the provider's limits, a runtime-validated response, and graceful degradation when the provider is down. | Test with the provider stubbed down |
| F11 | **Live updates** over SSE or WebSockets, with the choice justified. Reconnects without losing or duplicating events. | Kill-and-recover demo |
| F12 | **MCP server** with at least 3 read tools and 1 write tool that requires confirmation. OAuth-protected with per-tool scopes. Tool calls are audited. | Read token refused on the write tool |
| F13 | **Interactive MCP App** (React/TS) that respects the same authorization. | Host recording |

## 3. Deployment and delivery requirements

| # | Requirement | Proof |
| --- | --- | --- |
| D1 | **Publicly addressable** on your own domain or the course subdomain, with documented DNS records and a TTL rationale for each. | `dig +trace`; zone export |
| D2 | **HTTPS only**, with automated renewal, a CAA record, HTTP→HTTPS redirect, and expiry monitoring that has actually fired. | Certificate chain inspection; alert evidence |
| D3 | **Staging and production** are separate, with separate data and separate secrets. Changes reach production through staging. | Two URLs; a change stopped at staging |
| D4 | **CI/CD** that builds, tests and deploys, gated on `/healthz`, with a demonstrated rollback. Records the commit SHA and the image digest or build ID. | Pipeline logs |
| D5 | **Reproducible build**: IaC or exported configuration, plus a README that works on a clean machine. | Clean-clone run |
| D6 | **CDN in front**, with a cache policy for each content class (HTML, hashed assets, public API, authenticated responses). No personalized response is ever shared-cached. | Headers showing MISS, HIT, 304 and an invalidation |
| D7 | **CORS allowlist** of exact origins (no `*` with credentials). Security headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`. | Allowed vs refused preflight |
| D8 | **Performance**: Core Web Vitals measured, and one improvement shown with before/after numbers. | Lighthouse/RUM data |
| D9 | **Accessibility**: no serious or critical axe violations, and the app can be operated with the keyboard alone. | axe report; keyboard walkthrough |
| D10 | **Observability**: OpenTelemetry structured logs, metrics, and one distributed trace across at least 2 components. One SLI, one SLO, and one alert that has fired. | Dashboard; trace ID |
| D11 | **Cost control**: free tier or budget alert, plus a monthly cost estimate at 1×, 10× and 100× traffic showing your arithmetic. | Budget screenshot; table |

## 4. Security, data and operations requirements

| # | Requirement | Proof |
| --- | --- | --- |
| S1 | **Threat model**: assets, actors, trust boundaries and abuse cases, including MCP prompt-injection and tool abuse. | Diagram plus table |
| S2 | **The top vulnerability classes are tested** against your own app: injection, broken access control (IDOR), XSS, SSRF on the third-party integration, and CSRF where cookies are used. Each is fixed or justified. | Attack and retest log |
| S3 | **Supply chain**: lockfile, dependency audit, pinned versions, and secret scanning in CI. | CI output |
| S4 | **Rate limiting** on login, write and third-party-backed endpoints. | 429 evidence |
| S5 | **Data at scale**: load test within the course caps, one query plan before and after an index, and a backup that has been restored. | k6/plan output; restore log |
| S6 | **Runbook** a stranger can follow, plus a **Game Day postmortem** of a failure you caused on purpose. | Documents |

## 5. Engineering-quality requirements

- **Q1 — Tests:** at least one automated test for each of validation, authorization, the third-party integration (stubbed), and one core calculation. Hand-predict the expected result before running the test. All tests run from one documented command.
- **Q2 — Architecture diagrams:** request path (browser → DNS → CDN → app → DB/third party) and trust boundaries.
- **Q3 — Evidence standard:** each claim carries the commit SHA, reproduction commands, raw evidence, your own interpretation, one deliberate failure, an AI-use log, one challenged AI claim, and a redaction attestation. See [`evidence-dossier-template.md`](evidence-dossier-template.md).
- **Q4 — Individual ownership:** you can explain and change any part live in the oral defense.

## 6. Deliverables

1. Production and staging URLs (HTTPS)
2. Tagged release, plus image digest or build ID
3. Repo with README, IaC/config, CI/CD and tests
4. Architecture and trust-boundary diagrams
5. Evidence dossier covering every F, D, S and Q item
6. Load, scaling and cost analysis
7. Runbook and Game Day postmortem
8. AI provenance log
9. Live demo and individual oral defense

## 7. What earns top marks

- **Every requirement is proven**, including the failure case, not just the happy path.
- **Operational quality beats features.** Polish, extra pages and visual design are not graded.
- **Honest limits:** state what you did not finish and show the evidence for what you did.
- **Explain it yourself:** traces, numbers and decisions you can defend without notes.

**Not required:** custom visual design, mobile apps, coverage percentages, email/SMS delivery, or features beyond this list.
