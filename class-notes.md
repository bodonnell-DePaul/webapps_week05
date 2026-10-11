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

## Block B — Caching in practice

### Caching without the code tour

Choose what to cache, see what the browser did, and test whether a copy is safe and fresh

A cache is a reusable copy. The design question is not “how do I write the cache code?” It is “which copy can safely answer this request, and how will I know it is still useful?”

### One request may meet several copies before the source

- A request may stop at the browser, a nearby shared edge, or an application service
- Each copy must be safe for its audience and fresh enough for the feature
- Use browser evidence to tell whether reuse happened and whether it helped

> **Key idea**
>
> Caching trades repeated work for a temporary promise about sameness.

### The path a page request can take

![A request flows from a viewer](../../assets/class-notes/week05-session-s22-1.svg)

*A request stops at the first safe, sufficiently fresh copy*

### Choose the copy by asking who it is for

| Example | Audience | Typical choice | The question to debate |
| --- | --- | --- | --- |
| Movie poster | Everyone | Shared edge copy | How quickly must a correction appear? |
| Signed-in watch list | One account | Personal browser or account-aware service | Could another account ever receive it? |
| Public service status | Everyone | Short-lived shared copy | How stale is acceptable during an outage? |
| Profile page shell | Everyone | Shared, versioned files | How does a new release replace old files? |
| Available seats | Everyone, but changing quickly | Very brief or no shared copy | Could a stale answer cause a bad booking? |

### Browser test 1: did the page reuse its own files?

- Open the browser's **Network** panel and reload a page
- Reload again; compare images, styles, and scripts with the first visit
- Look for “memory cache,” “disk cache,” “not modified,” or a much smaller transfer
- Select a resource and inspect its response headers for its freshness policy

> **Key idea**
>
> The evidence is a changed source of the response or fewer bytes—not just a page that feels fast.

### Browser test 2: compare a first visit with a repeat visit

#### First visit

- Open a page in a fresh private window
- Keep the Network panel open and reload
- Note which large images and files cross the network
- Record the response size and time

#### Repeat visit

- Reload the same page in the same window
- Compare the same files and headers
- Repeat after clearing only that site's stored data
- Explain which copy answered each request

### Browser test 3: look for shared-edge evidence

- Select a large public image, poster, or media segment in the Network panel
- Inspect response headers for cache age, cache status, and the declared lifetime
- Refresh several times; compare response time and transfer size
- If available, compare the same public resource from another network or region
- Treat a missing cache header as “unknown,” not proof that no cache exists

**Sources**

- MDN — [Web caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- Cloudflare — [Understanding cache responses](https://developers.cloudflare.com/cache/how-to/understanding-cache-status/)

### Test that a copy is fresh enough—and belongs to the right person

| Test | What students do | What a good result means |
| --- | --- | --- |
| Freshness | Change a public title or image, then reload | The new version appears within the promised window |
| Personalization | Sign in as account A, then account B in a separate profile | Neither account sees the other's name, list, or history |
| Shared-device safety | Sign out, then revisit the previous account's page | Private data is not left visible to the next person |
| Offline behavior | Disconnect after opening a page, then revisit it | The app clearly distinguishes saved content from current data |
| Cache reset | Clear that site's stored data, then repeat | The team can reproduce a true first visit |

### Real product examples: same idea, different copy

#### Streaming catalog

- Posters, artwork, and public title details are reused by many viewers
- Nearby shared copies reduce delay and origin traffic
- A corrected rating or artwork must eventually replace the old copy
- Each account's watch progress stays personal

#### Collaboration app

- App files, help pages, and public profile images are reusable
- Meeting membership and a participant's private messages are not public
- Live audio and video must arrive now, not from an old saved copy
- A brief interruption is different from stale playback

### Diagnose a slow page without reading its code

- **Large transfer, first visit:** investigate image size, resolution, and delivery distance
- **Repeated download on every visit:** ask whether the file has a reusable lifetime
- **Fast but outdated result:** shorten the freshness window or improve version replacement
- **One account sees another's data:** remove shared reuse and investigate account boundaries
- **A warm edge still loads slowly:** look beyond caching; the server, page, or connection may be the bottleneck

> **Key idea**
>
> A cache is one part of the path. It cannot make every kind of delay disappear.

### Choose the cache plan for three features

1. **New-release posters:** shared by viewers; may be corrected by the studio
2. **My continue-watching row:** unique to the signed-in account; changes during viewing
3. **A live event schedule:** public; organizers may revise it shortly before the event

For each, choose **where a copy may live**, **how quickly it must update**, and **one browser observation** that would help you verify the experience.

### The practical rule

- Cache **shared, repeatable** content close to viewers
- Keep **personal** content isolated to the correct account
- Give changing content a freshness promise the product can keep
- Use browser evidence to test reuse, freshness, and privacy

> **Key idea**
>
> Next: two products with video—and why their architectures need different answers.

## Block C — Video architectures

### Two kinds of video, two caching architectures

How streaming libraries scale—and why live meetings cannot reuse yesterday's media

Netflix, Disney+, Zoom, and Teams all show video. Their delivery architectures solve different problems.

### Start with the experience, not the vendor

> **Key idea**
>
> A useful cache holds a reusable copy. A live participant's next sentence does not exist yet.

#### A movie or episode

- Prepared before playback begins
- The same media serves many viewers
- Delivery can favor reuse

#### A live meeting

- Participants create media as they speak
- Each voice and camera stream is unique
- Delivery must minimize delay

### A streaming library has a control path and a media path

![High-level video-on-demand architecture. A viewer](../../assets/class-notes/week05-session-s34-1.svg)

*Video-on-demand separates the catalog and account control path from the large shared media path*

**Sources**

- Course — [Editable streaming architecture diagram](diagrams/video-on-demand.drawio)

### What belongs in the shared streaming cache?

- **Strong candidates:** title artwork, public catalog details, and prepared video segments
- **Usually short-lived:** a playback plan or title availability that may change
- **Account-specific:** watch history, recommendations, and continue-watching position
- **Not a cache policy:** treating every response as public because most titles are public

> **Key idea**
>
> The media may be shared; the viewer's identity and viewing history are not.

### Netflix and Disney+: a shared pattern, different delivery choices

#### Netflix

- Publishes the Open Connect program for placing content close to viewers
- Can pre-position popular titles ahead of expected demand
- A local copy absorbs repeated requests for the same prepared media
- Product services still handle identity, discovery, and playback decisions

#### Disney+

- Uses large-scale streaming delivery and multiple content delivery partners
- Can steer delivery among providers and regions as conditions change
- Shared media copies reduce repeated long-distance transfers
- Catalog and account services remain distinct from media delivery

**Sources**

- Netflix — [Open Connect content delivery](https://openconnect.netflix.com/)
- Streaming Media — [Disney Streaming on multi-CDN load balancing](https://www.streamingmedia.com/Articles/ReadArticle.aspx?ArticleID=145721)

### A meeting has a different path for every live conversation

![High-level real-time meeting architecture. Two participants use a meeting application. Sign-in and meeting coordination services establish the meeting and select a media region. Each participant sends live audio and video to a nearby regional media relay, which forwards current streams to the other participants. Shared content delivery network copies are used for application files and help content, not as a store for live participant media.](../../assets/class-notes/week05-session-s37-1.svg)

*Real-time meetings use shared application assets, but live participant media travels through low-latency relays*

**Sources**

- Course — [Editable meeting architecture diagram](diagrams/real-time-meeting.drawio)

### Why Zoom and Teams cannot treat a meeting like a movie

| Design question | Netflix or Disney+ library | Zoom or Microsoft Teams meeting |
| --- | --- | --- |
| Is the media available before playback? | Usually yes; prepared before a viewer presses play | No; participants create it as they speak |
| Can many people reuse the same media bytes? | Often yes; the title is shared | No; each participant's stream is unique to the meeting |
| What is the delivery priority? | Smooth playback, startup, and picture quality | Low delay, stable conversation, and clear speech |
| What can a shared edge cache well? | Artwork and prepared media segments | Application files and public resources |
| What carries live media? | A nearby copy can serve the prepared segment | A live relay forwards current participant streams |
| What happens when a copy is stale? | An older frame or title version may appear | Delayed speech makes conversation confusing |

### The middle ground: a live event broadcast

> **Key idea**
>
> A live broadcast uses shared distribution, but its freshness window is measured in moments—not hours.

#### Like a streaming library

- One event feed reaches many viewers
- Regional edges distribute shared media
- Viewers can reuse recent segments

#### Unlike a movie library

- New media is created continuously
- The newest segment must arrive quickly
- Long-lived copies show the past

### Place caches where they help without changing the experience

- **Shared edge:** prepared media, posters, and public application resources
- **Account services:** personal lists and viewing history, partitioned by account
- **Meeting control:** membership and room details, kept current for participants
- **Real-time media relays:** forward live streams; do not replay an old shared copy
- **Recording archive:** once a meeting ends, its recording becomes a stored asset with a different freshness policy

## Individual practice

### Sketch the right delivery for a championship final

A service offers a recorded replay, a live broadcast, and a private watch party with voice chat.

1. Which pieces can use a shared edge copy?
2. Which requests must be personal or permission-checked?
3. Which traffic must be routed live rather than served from a saved copy?
4. What changes after the event ends?

## Homework brief

### A high-level architecture sketch for your own app

- Choose a feature that serves the same content to many people
- Draw the viewer, shared edge, application services, and source data
- Mark one personal-data path that must not become a shared copy
- State one freshness promise and what product risk it protects against

## Closing logistics

### One product can contain several delivery architectures

- **Library playback:** cache prepared media close to many viewers
- **Live broadcast:** distribute shared media with a short freshness window
- **Meeting conversation:** route unique, current streams through low-delay relays
- **Account experience:** keep personal data separate from all shared media copies

> **Key idea**
>
> Ask what can be reused, by whom, and for how long. Those answers shape the architecture.
