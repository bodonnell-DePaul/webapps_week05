# CSC 436 — Midterm Practice Exam
## Full-length practice · Weeks 1–5 · same format as the real exam

**Student handout · 100 points · about 108 minutes.**
This practice exam uses the **same structure, question types and point values**
as the real midterm, but with different scenarios and numbers. Take it under
exam conditions: printed/offline notes only, no internet, AI or live commands.
Attempt every part, then compare with the
[worked answers](practice-exam-answer-key.md). All values are synthetic
teaching examples; this practice exam is not on the real exam.

| Section | Points | Suggested minutes |
| --- | ---: | ---: |
| **A — Practical foundations** (4 questions, 20 multiple-choice items) | 20 | 20 |
| **B — Application scenarios** (3 questions, four 5-point parts each) | 60 | 66 |
| **C — CDN and server-side caching architecture** (1 question) | 20 | 22 |
| **Total** | **100** | **108** |

Aim to start B at minute 20 and C at minute 86. In Sections B and C, bullets,
short explanations and annotated arithmetic are welcome. You do not need to
write a complete program, and memorized header spellings or tool commands are
not graded.

---

# SECTION A — Practical foundations

**20 points · about 20 minutes · 20 multiple-choice items, 1 point each**

Choose the **single best answer** for every item. There is no penalty for a
wrong answer, so do not leave any blank.

### A1 (5 points) — From a URL to a usable page

A student types `https://library.example.edu:8443/rooms` into a browser.

**A1.1** Which step finds the IP address for `library.example.edu`?

- (a) TLS
- (b) DNS
- (c) HTTP
- (d) Browser rendering

**A1.2** Which step checks the server's certificate before page data is exchanged?

- (a) DNS
- (b) The TCP/QUIC transport connection
- (c) TLS
- (d) Browser rendering

**A1.3** What does `:8443` in the URL identify?

- (a) The port, which selects the service on the server machine to talk to
- (b) The subnet mask
- (c) The DNS record type
- (d) The page the user may see

**A1.4** A live video call prefers lower delay and can tolerate an occasional lost packet. Which transport style fits best?

- (a) TCP, because it retransmits every lost packet before delivering later data
- (b) TLS, because it hides the address
- (c) DHCP, because it assigns addresses
- (d) UDP-style delivery (as QUIC and real-time media use), which does not hold everything for one lost packet

**A1.5** A laptop at `10.0.0.12` (private) loads a public website. What does the home or campus gateway do?

- (a) Gives the laptop a public DNS name
- (b) Translates (NAT) the private address to a public one and routes the traffic
- (c) Replaces TLS
- (d) Stores the website's pages permanently

### A2 (5 points) — Connecting a domain to an application

You own `club.example.edu`. The host gives you the IPv4 address `203.0.113.10`.
You also want `www.club.example.edu` to follow whatever `club.example.edu`
points to, and the host asks you to publish the text `site-check=789`.

**A2.1** Which record points `club.example.edu` at the IPv4 address `203.0.113.10`?

- (a) CNAME
- (b) TXT
- (c) A
- (d) MX

**A2.2** Which record makes `www.club.example.edu` an alias of `club.example.edu`?

- (a) A
- (b) CNAME
- (c) NS
- (d) TXT

**A2.3** The A record has a TTL of 3600. What does that mean?

- (a) The record is deleted after 3600 visits
- (b) Resolvers may keep the answer for up to one hour before asking again
- (c) The server is guaranteed to respond in 3600 ms
- (d) The certificate lasts 3600 seconds

**A2.4** Which servers hold the official (authoritative) answer for the zone?

- (a) The visitor's browser
- (b) The visitor's recursive resolver
- (c) The name servers of the DNS host for the domain
- (d) Any CDN edge server

**A2.5** You change the A record, but one student still reaches the old host an hour later. What is the most likely normal reason?

- (a) A resolver or device is still using the old cached answer until its TTL expires
- (b) DNS cannot be changed once published
- (c) TLS blocks new addresses
- (d) The registrar must restart the browser

### A3 (5 points) — React lists and state

A `TodoApp` keeps `const [items, setItems] = useState<Item[]>([])`. It renders a
list of `<TodoRow />` components, an add form, and a footer showing how many items are done.

**A3.1** Which update adds `newItem` correctly?

- (a) `items.push(newItem); setItems(items);`
- (b) `setItems([...items, newItem]);`
- (c) `items = [...items, newItem];`
- (d) `setItems(items.length);`

**A3.2** Why give each `<TodoRow />` a stable `key`?

- (a) To make the row clickable
- (b) To style the row
- (c) So React can match rows between renders (for example after a reorder or delete)
- (d) To send the row to the server

**A3.3** The add form and the footer (siblings) both need `items`. Where should the state live?

- (a) In their nearest common parent, passed down as props
- (b) Duplicated in each sibling
- (c) In a global variable outside React
- (d) In the browser URL only

**A3.4** The footer needs the number of done items. What is the simplest correct approach?

- (a) Store `doneCount` in a second state and update it with an effect
- (b) Calculate it during render from `items`
- (c) Fetch it from the server on every keystroke
- (d) Mutate the DOM text directly

**A3.5** An effect starts `setInterval(refresh, 5000)`. What must the effect return so the timer does not keep running after unmount?

- (a) Nothing
- (b) The interval id as a string
- (c) A cleanup function that calls `clearInterval`
- (d) A second `useEffect`

### A4 (5 points) — HTTP, HTTPS, CORS and axios

A browser app at `https://clubs.example` calls an API at `https://api.clubs.example`.

**A4.1** Which status fits a `POST` that successfully created a new resource?

- (a) 200 with no body
- (b) 201 Created
- (c) 301 Moved
- (d) 404 Not Found

**A4.2** Which status means the requested item does not exist?

- (a) 401
- (b) 403
- (c) 404
- (d) 500

**A4.3** Which is **not** part of a normal certificate check?

- (a) The name matches the site
- (b) The dates are valid
- (c) The chain leads to a trusted issuer
- (d) The server's response time is under 100 ms

**A4.4** Who enforces the CORS rule that blocks a cross-origin request?

- (a) The browser
- (b) `curl`
- (c) The DNS server
- (d) The database

**A4.5** An axios request times out and no response arrives. What should the UI do?

- (a) Show a field error from the server's 400 body
- (b) Show a "network problem, try again" style message, not a validation message
- (c) Show nothing and assume success
- (d) Log the user out

---

# SECTION B — Application scenarios

**60 points · about 66 minutes · three scenarios, 20 points each (four parts of 5 points)**

## B1 (20 points) — Share a local demo and move its public address

Your laptop has private address `172.16.5.30/24`, supplied by DHCP.
Your development server listens only on `127.0.0.1:4000`.
A teammate on the same permitted LAN tries `http://172.16.5.30:4000`.
Later, you move your public site to a new host. Its old DNS address record has
a TTL of 7200 seconds.

**B1a (5 points).**

- Explain why the teammate cannot use your loopback-only server.
- Describe a safe change for this authorized LAN demo (do not expose it to the public Internet or disable the firewall).
- State the address the teammate should use.
- Give one check that shows it worked.

**B1b (5 points).**

- Explain what DHCP supplies.
- Explain what `/24` means when deciding whether another address is on the same subnet.
- Explain why a friend outside your network cannot use this private address directly.
- Distinguish the gateway's routing/NAT role from DHCP.

**B1c (5 points).**

- Say what to record before the DNS move so you can roll back.
- Say when to lower the TTL and how long to wait before changing the address.
- Explain why lowering the TTL at the moment of the move cannot immediately update every user's answer.
- Say when it is safe to retire the old host.

**B1d (5 points).**

Two users see different addresses just after the move.

- Give a normal caching reason.
- Say which kind of DNS server (recursive resolver or authoritative) holds the cached answer.
- Describe one practical check before claiming the new application is ready.

## B2 (20 points) — Filter, count and load rooms in React

A React page shows study rooms. Capacity is the number of seats; **blank
capacity means unknown**, while `0` means a known capacity of zero.

| ID | Building | Status | Capacity |
| --- | --- | --- | ---: |
| R1 | Science | available | 12 |
| R2 | Science | available | blank |
| R3 | Arts | available | 0 |
| R4 | Science | booked | 30 |
| R5 | Science | available | 8 |

The user selects building **Science** and status **available**. The page shows
a summary (matching rooms, total known capacity, rooms with unknown capacity)
and a list of the matches, **two rooms per page**, sorted by ID. The summary
counts all matches, not only the rooms on the current page.

**B2a (5 points).**

For the table above and the selection Science + available:

- Give the IDs of the matching rooms and how many there are.
- Give the total known capacity.
- Give the number of matching rooms with unknown capacity.
- Say which room IDs appear on page 1 and which on page 2.
- List, in order, these four steps: filter, sort, calculate summary, take the current page.

**B2b (5 points).**

A button handler runs this code when `score` is 0:

```tsx
setScore(score + 10);
setScore(score + 10);
```

- What value does `score` show after the next render?
- Explain in one sentence why.
- Rewrite the two lines so the score goes up by 20.

**B2c (5 points).**

A page fetches the selected building's rooms inside `useEffect`. Here is the
effect with three possible dependency arrays (`building` is state the user can change):

```tsx
useEffect(() => { loadRooms(building); }, [building]);   // Version 1
useEffect(() => { loadRooms(building); }, []);           // Version 2
useEffect(() => { loadRooms(building); });               // Version 3 (no array)
```

- When does `loadRooms` run in Version 1?
- When does it run in Version 2, and what is wrong with the page after the user changes the building?
- When does it run in Version 3, and what problem happens if `loadRooms` also sets state?
- Which version should the page use, and why?

**B2d (5 points).**

The page reads saved JSON from the server and does `as Room[]`.

- Why does this cast not make the data safe at runtime, even though TypeScript compiles?
- What should the code do with a row that has a blank ID or status `maintenance` (allowed values are `available` and `booked`)?
- What should the code do with blank capacity, and with capacity `0`?
- Give one test that confirms `0` capacity is counted but blank capacity is not.

## B3 (20 points) — Connect a browser form to an API safely

A React form served from `https://clubs.example` sends a **POST** with a JSON
body (`Content-Type: application/json`) and cookies (credentials included) to
`https://api.clubs.example/api/events`. The API contract says: success returns
status **201**, the created object, and a **Location** header; invalid input
returns status **400** and a JSON error body with a `code`, a `message` and a
list of field errors.

**B3a (5 points).**

- Put these Express steps in the correct order: error handler, input validation, CORS/preflight handling, creating the event, JSON body parsing.
- State exactly what the API returns for valid input.
- State exactly what the API returns for invalid input.
- Explain why the server must validate even though the React form already does.

**B3b (5 points).**

The browser blocks the request, but the same request with `curl` works.

- Why does the browser block it when `curl` does not?
- What exact value must `Access-Control-Allow-Origin` have (it cannot be `*` here), and which other header is needed because cookies are sent?
- Which method and which request header must be allowed?
- Which header must be exposed so JavaScript can read `Location`?
- In one sentence, explain why passing CORS does not mean the user is logged in or authorized.

**B3c (5 points).**

- Name two things a shared axios client should hold so each component does not repeat them.
- Say what the UI should show for a 400 response with field errors.
- Say what the UI should show for a network failure or timeout.
- Say what the UI should show for a request the user cancelled on purpose, and why it should differ from the 400 message.

**B3d (5 points).**

Before releasing the API at `https://api.clubs.example`, you check its HTTPS certificate.

- Name the three things to check (name match, dates, chain).
- Name one safeguard so the certificate does not expire unnoticed.
- Name one check after deployment and one rollback step.
- A teammate proposes turning off certificate verification to make an error go away. Give one reason this is not a fix.

---

# SECTION C — CDN and server-side caching architecture

**20 points · about 22 minutes · four parts, 5 points each**

## C1 (20 points) — LectureHub goes global

LectureHub (React frontend, Express API with a Redis cache, MySQL) runs from
one origin in Oregon. The college adds recorded and live-streamed lectures, and
a student in Singapore can now use the site. The team puts the app behind a CDN.
A request from Singapore to the Oregon origin has a minimum **round-trip time
of 140 ms** (light in fibre travels about 200,000 km/s and the distance is about
14,000 km). The pages and endpoints involved are:

- `app-9f2c1.js` — the hashed Vite bundle
- `index.html` — the SPA shell that points to the current bundle
- `/api/schedule` — public, the same for everyone; the registrar has agreed it
  may be up to **30 seconds** old
- `/profile` and `/api/me` — personalized, require sign-in
- The lecture video: encoded **segments** and a **manifest** listing them

**C1a (5 points) — Distance and the edge.**

- A page load needs DNS, TCP, TLS and the HTML request. Using the 140 ms round-trip time, what is the minimum time spent on those round trips? Circle one.
    - (a) 140 ms
    - (b) 280 ms
    - (c) 420 ms
    - (d) 560 ms
- Explain why a CDN helps even for responses that are **never** cached. Compare a TLS handshake of 2 round trips to an origin 140 ms away with one to a point of presence (PoP) 8 ms away.
- Name the two ways a request finds a nearby PoP.
- A teammate says “it's cached in Tokyo, so Mumbai will be fast too.” Correct them in one sentence.

**C1b (5 points) — The streaming split.**

- Sort each of these into **control plane** or **data plane**:
    - the “Resume lecture” list
    - a video segment
    - the license/DRM key for a user
    - the lecture catalog search
    - the manifest of a *finished* lecture
- Explain how adaptive bitrate uses the ladder of segment versions when a viewer's network slows down.
- For the *live* stream, say which gets the shorter TTL, the manifest or the segments, and why.
- Name one benefit of a cache placed inside an ISP (Open Connect style) and one reason to use several CDNs.

**C1c (5 points) — Who else would get this copy?**

A “cache everything” rule is added at the edge. It stores each response under
its **cache key**, which is roughly the host, path and query. Priya loads
`/profile` while signed in. Fifteen seconds later Tom requests `/profile` and
sees Priya's page. Choose the single best answer for each item (1 point each).

- What is the cache key for the two `/profile` requests, and why did Tom get Priya's copy?
  - (a) The key includes the cookie, so Tom's cookie matched Priya's
  - (b) The key is the time of the request, which fell within 15 seconds
  - (c) The key is roughly host + path + query, which is the same for both users, so the stored copy matched Tom's request
  - (d) The key is the user's IP address, which happened to match
- Which pair of mistakes, by different people, combined to cause this?
  - (a) The database returned the wrong row, and Redis was down
  - (b) The origin allowed the personalized page to be shared, and an edge “cache everything” rule ignored who was asking
  - (c) The browser ignored the cookie, and TLS expired
  - (d) The CDN had no PoP in the region, and DNS TTL was too long
- A shared CDN cache may store which of these?
  - (a) `/profile` and `/api/schedule`, but not video segments
  - (b) Only `/profile`
  - (c) A video segment and `/api/schedule`, but not `/profile`
  - (d) None of them
- Which automated check would best detect this problem?
  - (a) A synthetic signed-in request that raises an alert if it ever gets a cache HIT
  - (b) A ping to the origin every minute
  - (c) A check that the TLS certificate has not expired
  - (d) A check that the CDN has at least 300 PoPs
- A teammate suggests adding the user-agent to the cache key to be safe. Why is that a poor choice?
  - (a) It makes the cache key too short
  - (b) It makes many variants, destroys the hit rate, and still does not identify the user
  - (c) It would stop video segments from being cached at all
  - (d) It forces every request to go to the shield

**C1d (5 points) — Caching inside the application.**

LectureHub's Express API uses a `cached()` helper: it looks in Redis; on a miss
it runs the database query, stores the result with a **TTL**, and returns it.
Choose the single best answer for each item (1 point each).

- What is this pattern called?
  - (a) Write-through
  - (b) Service worker
  - (c) Cache-aside
  - (d) Anycast
- Which layer of the caching stack is this helper?
  - (a) Browser HTTP cache
  - (b) CDN / edge
  - (c) Database cache
  - (d) App cache (Redis or in-memory)
- Thirty requests miss at the same moment. What does the `inflight` map do?
  - (a) It lets one request run the query while the others wait and share the result
  - (b) It makes all thirty run the query in parallel
  - (c) It deletes the cached value
  - (d) It sends the requests to different PoPs
- The hot `/api/schedule` key expires and 3,000 requests arrive in the same second. Besides coalescing, which is a standard defence against this stampede?
  - (a) Purging the entire cache at the same time every day
  - (b) Turning off the TTL permanently
  - (c) Serving stale data while one request refreshes, or adding jitter to TTLs
  - (d) Adding more browser tabs
- An instructor posts a schedule change with `POST /api/schedule`. What should the server do so users see fresh data?
  - (a) Delete the affected cache keys, so the next read is a MISS and loads fresh data
  - (b) Nothing; wait for every cache to expire
  - (c) Restart the CDN
  - (d) Disable TLS

---

**END OF PRACTICE EXAM** — score yourself with the
[worked answers](practice-exam-answer-key.md), then review the matching
[study guide](study-guide.md) sections for anything you missed.
