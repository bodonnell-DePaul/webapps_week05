# Week 5 — Pre-class prep

**Time: ~50 minutes.** Do this *before* class. The 180-minute session assumes it.

The readiness check at the top of class is 5 questions and takes 5 minutes. It is
participation-graded, not correctness-graded — but Block A starts from the assumption that
you have read items 6 and 11.

---

## Core set (~50 min) — items 1, 2, 6, 8, 9, 11

| # | Title | Publisher | Type | Time |
| --- | --- | --- | --- | ---: |
| 1 | [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) — read *Types of caches* and *Heuristic caching* closely; skim the rest | MDN | Article | 15 min |
| 2 | [Core Web Vitals](https://web.dev/articles/vitals) | web.dev (Google) | Article | 5 min |
| 6 | [What is a CDN?](https://www.cloudflare.com/learning/cdn/what-is-a-cdn/) | Cloudflare Learning Center | Article | 8 min |
| 8 | [OpenTelemetry Concepts: Signals](https://opentelemetry.io/docs/concepts/signals/) | OpenTelemetry (CNCF) | Article | 5 min |
| 9 | [Traces and spans](https://opentelemetry.io/docs/concepts/signals/traces/) | OpenTelemetry | Article | 6 min |
| 11 | [How Netflix works with ISPs around the globe](https://about.netflix.com/en/news/how-netflix-works-with-isps-around-the-globe-to-deliver-a-great-viewing-experience) | Netflix | Article | 6 min |

## Optional depth — read these if a topic is new to you

| # | Title | Publisher | Type | Time |
| --- | --- | --- | --- | ---: |
| 3 | [Largest Contentful Paint (LCP)](https://web.dev/articles/lcp) | web.dev | Article | 8 min |
| 4 | [Interaction to Next Paint (INP)](https://web.dev/articles/inp) | web.dev | Article | 8 min |
| 5 | [Cumulative Layout Shift (CLS)](https://web.dev/articles/cls) | web.dev | Article | 5 min |
| 7 | [How to Meet WCAG 2.2 (Quick Reference)](https://www.w3.org/WAI/WCAG22/quickref/) | W3C WAI | Interactive | 5 min skim |
| 10 | [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/) | OpenTelemetry | Article | 5 min |

> **Accessible alternative for item 6:** if Cloudflare's CDN page does not load,
> use [the course CDN overview](reference.md#what-a-cdn-does) and the shared-cache
> discussion in MDN item 1. This replaces item 6 within its eight-minute budget
> and earns the same credit. HTTP 403 from an automated fetch is not proof that
> the page is dead; you do not need to troubleshoot it to finish prep.

> **⚠️ INP replaced FID.** If you have previously learned **First Input Delay**, note that
> it was replaced as a Core Web Vital by **Interaction to Next Paint in March 2024**. Any
> tutorial, course, or AI assistant still teaching FID is out of date. We will cover this
> explicitly in Block C — see [the announcement](https://web.dev/blog/inp-cwv-launch).

---

## What to pay attention to while you read

**In the CDN article (item 6) and the Netflix article (item 11)**, read for the *map*,
not the vocabulary:

1. What a **point of presence (PoP)** is, and why a copy 20 ms away beats an origin 150 ms
   away even when the origin is fast.
2. Where Netflix physically puts its servers, and **why an ISP would agree** to host them.
   Block A starts from this question.
3. What stays centralized (accounts, recommendations, the "play" decision) versus what is
   pushed out to the edge (the video bytes themselves).

**In the MDN caching guide (item 1)**, focus on *where* copies live — the browser's private
cache versus shared caches such as CDNs and proxies — and on one fact you will be asked:
`no-cache` does **not** mean "do not cache". You do not need to memorize directive values;
Block B shows them in a working React/Node app and keeps a reference table.

**In the CWV article (item 2)**, note that the thresholds are stated at the **75th
percentile**, not the mean. This is the single most common misreading.

**In the OpenTelemetry articles (8 and 9)**, you only need the vocabulary: *signal*, *span*,
*trace*, *attribute*, *context propagation*. Do not try to learn the SDK before class — you
will wire it in the homework.

---

## Before you arrive

- [ ] **Node 24 LTS** and `curl` installed and on your PATH. Run `node --version`.
- [ ] Check your **HW4 deployment**. If blocked, request the course recovery baseline;
      the local lab runs without public hosting. Do not spend the prep hour repairing cloud infrastructure.
- [ ] A **CDN account created**. Cloudflare's free tier is the reference path and takes
      about five minutes to sign up for. Creating the account is the slow part; do it now,
      not in class.
- [ ] Chrome or Edge installed (the lab runs `axe` and Lighthouse through it).

Optional but recommended, because installation is the most common lab delay:

- [ ] `k6` — <https://grafana.com/docs/k6/latest/set-up/install-k6/>

---

## Readiness check — 5 questions

Answer before class. Five minutes. Bring your answers; we debrief in the first ten minutes.

1. What is a CDN, and what is a **PoP**? Why does a nearby copy make a page faster even when
   your origin server is quick?

2. Where does Netflix place its Open Connect servers, and why would an internet service
   provider agree to host them?

3. A response carries `Cache-Control: no-cache`. May a cache store it? What must it do
   before serving it again?

4. Name the three Core Web Vitals. Which one replaced First Input Delay, and roughly when?

5. In OpenTelemetry, what is a **trace** made of, and what is **context propagation** for?

---
