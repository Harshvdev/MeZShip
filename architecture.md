# MeZShip — MVP Architecture

## 1. Product

A local random-chat website for spontaneous 1-to-1 conversations with people nearby based on distance proximity.

Core interaction:

```text
Open website
    ↓
Sign up / Sign in
    ↓
Grant location access (or calibrate location)
    ↓
Configure search radius (default: 5 km)
    ↓
Start chatting
    ↓
Wait for compatible nearby match
    ↓
User A ↔ User B
    ↓
Chat
    ↓
Skip / Block / Leave
```

The service is designed around:

* account-based access
* pseudonymous public identities
* proximity-based random matching
* configurable distance radius (1–50 km, default 5 km)
* temporary chat sessions
* no public social graph
* no normal chat history
* user-controlled blocking
* automatic abuse controls
* minimal persistent data

---

## 2. MVP Includes / Does Not Include

The MVP includes:

* permanent user accounts
* email sign-up/sign-in
* Google sign-up/sign-in
* randomly generated display names
* editable display names in settings
* profile settings
* browser/device geolocation with manual coordinate calibration
* distance-based proximity matching
* interactive search radius slider (1–50 km, default 5 km) with quick presets
* temporary 1-to-1 conversations
* skip
* block
* unblock
* reporting
* automatic report-based account bans
* rate limiting

The MVP does not include:

* passwords managed directly by the application
* legal names
* public profiles
* profile pictures
* followers
* friends
* likes
* public posts
* college/campus-restricted geofencing
* public user discovery outside configured distance radius
* voice chat
* video chat
* file sharing
* image sharing
* AI matching
* permanent chat history
* location history
* IP-based identity
* device fingerprinting
* proactive conversation monitoring
* human moderator workflow
* moderation dashboard
* manual review queue

---

## 3. Core Architecture Principle

The system should retain as little information as practical.

The key distinction is:

```text
Data required temporarily
        ≠
Data that must persist
```

Temporary data exists only while required for the service to function.

Persistent storage is reserved for information the application actually needs to remember.

Normal operation uses temporary state for:

* precise current location (latitude, longitude)
* active matching session and radius preference
* active match
* WebSocket connections
* normal messages
* rate-limit counters
* temporary matching state

Persistent storage contains:

* authenticated user records
* display-name/profile settings
* block relationships
* reports and report counters
* active ban state
* other small application configuration

The system does not maintain a permanent database of ordinary conversations or location history.

---

## 4. Deployment Architecture

The application is hosted remotely.

Nothing required for production operation runs on the developer's personal computer.

```text
                                INTERNET
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Cloudflare Worker │
                         │                     │
                         │ HTTP/API            │
                         │ Validation          │
                         │ Auth verification   │
                         │ Session handling    │
                         │ Rate limiting       │
                         │ WebSocket routing   │
                         └──────────┬──────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      │                           │
                      ▼                           ▼
             ┌─────────────────┐        ┌─────────────────────┐
             │ Durable Objects │        │ Supabase             │
             │                 │        │                     │
             │ RadarMatcherDO │        │ Auth                │
             │  (Queues/Match) │        │ Managed PostgreSQL   │
             │        ↓        │        │ Persistent data     │
             │ MatchRoomDO     │        └─────────────────────┘
             │  (Active Chat)  │
             └────────┬────────┘
                      │
                  WebSockets
                   ┌──┴──┐
                   │     │
                 User A User B
```

Supabase provides:

* Authentication
* Managed PostgreSQL (accessed via connection pooler on port 6543)

Cloudflare provides:

* HTTP/API execution via Cloudflare Worker
* WebSocket upgrade and session routing
* Two-tier Durable Objects (`RadarMatcherDO` for matchmaking queues and `MatchRoomDO` for active chats)

---

## 5. Technology Stack

### Frontend

```text
Next.js
TypeScript
```

The frontend provides the UI and maintains a single persistent WebSocket connection through the backend.

### HTTP/API Layer

```text
Cloudflare Worker
```

Responsibilities:

* request validation
* Supabase Auth token verification
* user/session initialization
* cookie handling where applicable
* rate limiting
* location/session initialization
* WebSocket upgrade routing
* account/profile requests
* block/unblock requests
* reporting requests (with context validation)
* ban checks

### Realtime Layer

```text
Cloudflare Durable Objects
WebSockets
WebSocket Hibernation API
```

Two-tier architecture:

1. **`RadarMatcherDO`** (Matchmaking queue & proximity engine):
   * waiting queues
   * in-memory Haversine distance proximity matching based on user search radius ($\le \min(\text{Radius}_A, \text{Radius}_B)$)
   * circular fair matching memory and tie-breaking
   * pairing coordination

2. **`MatchRoomDO`** (per active match, keyed by `match_id`):
   * active 1-to-1 conversation sessions
   * WebSocket Hibernation for low-resource active connections
   * message validation and forwarding
   * per-match message rate limiting
   * match termination and skip handoff

### Authentication

```text
Supabase Auth
```

Supported authentication methods:

```text
Email
Google
```

Supabase Auth owns the authentication identity and session/token lifecycle.

Token verification:

* Tokens are signed asymmetrically by Supabase using **ECC (P-256 / ES256)**.
* Cloudflare Workers verify user JWTs via Supabase's public **JWKS endpoint** (`/auth/v1/.well-known/jwks.json`) using the `jose` library with in-memory key caching.
* No shared symmetric secrets (`HS256`) are stored or required.

### Persistent Database

```text
Supabase PostgreSQL
```

Supabase PostgreSQL stores only information that must survive beyond the current temporary runtime.

### Runtime & Package Manager

```text
Bun
```

Bun is used as the JavaScript/TypeScript runtime and package manager for local development, scripts, and executing database migrations.

### Database Access & Schema Source of Truth

```text
Prisma ORM
```

Prisma (`schema.prisma`) serves as the single declarative source of truth for application database schema definitions, model types, and migration history.

Database interaction details:

* Bun is used to run database tooling and migrations (`bunx prisma migrate dev`).
* Prisma Client operates in Cloudflare Workers using standard edge driver adapters (e.g. `@prisma/adapter-pg` or `@neondatabase/serverless`) with `nodejs_compat` enabled.
* Database connections route through Supabase's transaction connection pooler (port 6543 / PgBouncer / Supavisor).
* Authentication remains owned by Supabase Auth.
* PostgreSQL remains hosted remotely by Supabase.

---

## 6. Responsibilities of Each System

### Cloudflare Worker

Handles:

```text
HTTP/API endpoints
Supabase Auth token verification
Account/profile requests
Session initialization & WebSocket upgrades
Global HTTP rate limiting
Block and unblock requests
Context-bound report submissions
Ban enforcement
```

### Durable Objects

Handle:

```text
RadarMatcherDO:
  - Waiting queues
  - In-memory Haversine distance proximity filtering
  - Match formation & handoff

MatchRoomDO:
  - Active conversation lifecycle
  - WebSocket connections (WebSocket Hibernation)
  - In-memory message validation & forwarding
  - Realtime message rate limiting
  - Ephemeral match context for reporting & skips
```

### Supabase Auth

Handles:

```text
Sign-up
Sign-in
Email authentication
Google OAuth
Session/token management
Authentication identity
```

### Supabase PostgreSQL

Handles:

```text
Users/profile data
User blocks
Reports
Ban state
Persistent application configuration
```

It does not handle normal realtime conversation traffic.

---

## 7. Authentication

The website requires an authenticated account.

A visitor cannot start chatting without signing up or signing in.

Authentication is handled by Supabase Auth.

Supported options:

```text
[ Continue with Email ]

[ Continue with Google ]
```

The application does not implement its own password hashing or password storage.

Conceptually:

```text
User
 ↓
Sign up / Sign in
 ↓
Supabase Auth
 ↓
Authenticated user ID
 ↓
Application user profile
 ↓
Access to matching
```

The authenticated Supabase user ID is the internal account identity.

The public chat identity is the user's display name.

---

## 8. Account Identity

Each authenticated account receives a random display name when its application profile is first created.

Example:

```text
BlueFox482
QuietMoon731
SilverPanda204
```

The user may change the display name later from Settings.

The display name:

* is not the user's real name
* does not contain an IP address
* does not contain precise location
* can be changed by the user
* is what other users see during a chat

The internal authenticated user ID is never shown to other users.

---

## 9. User Profile

The persistent application user profile:

```text
UserProfile
├── user_id
├── display_name
├── created_at
└── updated_at
```

Authentication data such as email address and OAuth identity remains managed by Supabase Auth rather than duplicated unnecessarily in the application profile.

The initial MVP profile remains minimal.

---

## 10. Settings & Location Controls

The user can access Settings and Location controls from the top navigation dropdown menu after signing in.

### Account Settings Modal
```text
Display name editing
Random name generator
Blocked users list & unblock actions
Account sign-out
```

### Location & Distance Modal
```text
Matchmaking search radius slider (1–50 km, default 5 km)
Radius quick preset chips (1 km, 5 km, 10 km, 25 km, 50 km)
GPS / Network coordinate detection status
Custom coordinate calibration tool (for desktop/VPN corrections)
Reset to auto-detected GPS
```

---

## 11. Location Acquisition & Proximity Model

Proximity is a core product feature.

The browser requests location through its normal geolocation mechanism.

Conceptually:

```text
User
 ↓
Browser location permission (or calibrated coordinates)
 ↓
Temporary current coordinates (lat, lng) + Max Radius (default 5 km)
 ↓
Cloudflare Worker / RadarMatcherDO
 ↓
Distance calculation (Haversine formula in-memory)
 ↓
Matching decision: distance(A, B) ≤ min(radiusA, radiusB)
```

The service does not claim that a website can guarantee a particular physical precision on every device.

Actual accuracy depends on the device, browser, operating system, permissions, and available location sources. Users can calibrate custom coordinates in the Location modal if their desktop network reports an inaccurate IP location.

---

## 12. Pure Distance-Based Matchmaking

Discovery is purely distance-based.

A user selects their desired matchmaking radius (1–50 km, defaulting to 5 km).

Users A and B are eligible to match when:

$$\text{HaversineDistance}(A, B) \le \min(\text{radius}_A, \text{radius}_B)$$

Conceptually:

```text
User A (latA, lngA, radiusA = 5 km)
User B (latB, lngB, radiusB = 10 km)
       ↓
HaversineDistance(A, B) = 1.8 km
       ↓
1.8 km ≤ min(5 km, 10 km) = 5 km → MATCH ELIGIBLE
```

If neither user has coordinates set (e.g. location unavailable on desktop), fallback matching is permitted so users are never permanently blocked from connecting.

---

## 13. Radius Selection UI

The user can adjust their search radius directly from the home screen before starting a chat or via the Location modal.

Example UI:

```text
Search Radius: [ 5 km ]
───●─────────────────── (1 km to 50 km slider)
[ 1 km ] [ 5 km ] [ 10 km ] [ 25 km ] [ 50 km ]
```

The selected radius is stored in component state and passed directly to the WebSocket queue on match start.

---

## 14. Matching Queue

Users waiting for a match exist in temporary `RadarMatcherDO` state.

Conceptually:

```text
Waiting User
├── user_id
├── temporary current location (lat, lng)
├── maxRadiusMeters (default 5000)
├── enqueuedAt timestamp
└── temporary session state
```

The matcher checks:

1. User is authenticated.
2. Account is not currently banned.
3. User is connected.
4. User is currently waiting.
5. Proximity requirement is satisfied: $\text{distance}(A, B) \le \min(\text{radius}_A, \text{radius}_B)$.
6. Circular fair matching memory check (avoids immediate re-pairing with the same recent partner).
7. Users are not blocking each other.
8. Neither user is already matched.

---

## 15. Pair Matching & Handoff

Example:

```text
User A (lat: 26.891, lng: 81.071, radius: 5000m)
User B (lat: 26.893, lng: 81.074, radius: 5000m)

distance(A, B) = 380 m ≤ 5000 m
```

If all other conditions are satisfied:

```text
A ↔ B
```

The `RadarMatcherDO` pairs the two users, generates a `match_id`, and hands the active session off to a dedicated `MatchRoomDO`.

```text
WAITING (RadarMatcherDO)
   ↓
MATCHED
   ↓
ACTIVE (MatchRoomDO)
```

---

## 16. Durable Object State

An active match is managed by an ephemeral `MatchRoomDO`:

```text
MatchRoomDO (keyed by match_id)
├── match_id
├── User A WebSocket connection
├── User B WebSocket connection
├── User A user_id
├── User B user_id
├── connection state (WebSocket Hibernation)
├── message rate counters
└── temporary match context (for skips and context-bound reporting)
```

This is runtime state.

It does not become a PostgreSQL conversation row. When the match ends, the `MatchRoomDO` ephemeral state is cleared.

---

## 17. WebSocket Communication

Once matched:

```text
User A
   │
   │ WebSocket
   ▼
MatchRoomDO
   │
   │ WebSocket
   ▼
User B
```

The database is not placed between the two users.

Normal conversation traffic stays inside the realtime layer. WebSocket Hibernation is utilized so the `MatchRoomDO` sleeps during idle periods and wakes instantly upon incoming messages.

---

## 18. Normal Messages Are Never Persisted

Normal messages are not written to PostgreSQL.

Message flow:

```text
User A
   ↓
WebSocket
   ↓
Durable Object
   ↓
Validate
   ↓
Rate-limit
   ↓
Forward
   ↓
User B
```

After delivery, the message does not become permanent application data.

There is:

```text
No normal chat database
No normal message history
No message-retention table
```

---

## 19. Message Validation

Before forwarding a message, the Durable Object checks:

```text
valid connection
valid active match
valid sender
valid message format
non-empty payload
maximum payload size
maximum message length (500 chars)
rate limit
```

Invalid messages are rejected.

Security-sensitive decisions are made server-side.

---

## 20. Message Rate Limiting

The server enforces rate limits.

Example:

```text
20 messages/minute/user
```

The rate limit is maintained in temporary Durable Object state.

The browser cannot disable the server-side limit.

---

## 21. Skip

The interface contains:

```text
[ Skip ] (Esc)
```

When selected:

```text
User clicks Skip
      ↓
MatchRoomDO terminates active match
      ↓
Notify partner (partner_skipped event)
      ↓
Existing WebSocket remains connected (no reconnect/TLS overhead)
      ↓
Current user returned to RadarMatcherDO waiting queue
      ↓
Find another nearby user
```

Key lifecycle rules for skips:

* **Persistent WebSocket**: The client keeps its single WebSocket connection alive. The server transitions session state from `ACTIVE` (in `MatchRoomDO`) back to `WAITING` (in `RadarMatcherDO`).
* **Partner UX**: The skipped partner is notified immediately and presented with options to either re-queue automatically or return home.
* No page reload or WebSocket reconnect is required.

---

## 22. Block and Unblock

The main user-controlled account action is:

```text
Block User
```

Blocking is account-to-account.

If:

```text
A blocks B
```

then future matching between A and B is rejected.

The user can later undo this:

```text
Unblock User
```

Unblocking removes the block relationship and makes future matching possible again.

Conceptually:

```text
User A
   ↓
Blocks User B
   ↓
Persistent block relationship
   ↓
Matcher rejects A ↔ B
```

Blocks are accessible from Account Settings so users can manage their block list.

---

## 23. Report and Block UI

Reporting and blocking are deliberate safety actions placed inside a three-dots partner menu during active chats.

Menu options:

```text
Report User...
Block User
Leave Chat
```

---

## 24. Reporting

Selecting `Report` opens a report dialog.

The dialog presents report categories along with an optional text field for additional context.

Example dialog:

```text
Why are you reporting this user?

○ Harassment or abuse
○ Spam
○ Sexual or inappropriate behavior
○ Threatening behavior
○ Impersonation
○ Other

[ Details / Reason (Optional - max 300 characters) ]
┌────────────────────────────────────────────────────────┐
│                                                        │
└────────────────────────────────────────────────────────┘
```

The report is associated with:

```text
reporter_user_id
reported_user_id
match_id (context verification)
reason (category enum)
details (optional text string, max 300 chars)
created_at
```

Normal chat messages are never stored when a report is submitted.

The report itself is persistent application data because it drives automatic account actions.

---

## 25. Automatic Report-Based Bans

The ban system is fully automatic.

The system counts distinct users who have reported the same account.

The thresholds are:

```text
6 distinct reporters  → 24-hour ban
11 distinct reporters → 7-day ban
20 distinct reporters → permanent ban
```

Key rules for report-based bans:

1. **Distinct Reporters**: The count is strictly based on distinct reporting accounts (`UNIQUE(reporter_user_id, reported_user_id)`).
2. **Non-Resetting Lifetime Counts**: Report counts do **NOT** reset when a ban expires.
3. **Server-Side Enforcement**: The server checks the ban state before allowing the account to enter matching or exchange messages.

---

## 26. Ban State

Ban state is persistent.

Conceptually:

```text
UserBan
├── user_id
├── ban_type
├── banned_at
├── expires_at
└── reason
```

Possible `ban_type` values:

```text
TEMPORARY_24H
TEMPORARY_7D
PERMANENT
```

---

## 27. Duplicate & Context-Bound Reporting

Reporting enforces two critical safeguards against abuse:

### 1. Distinct Reporter Constraint

```text
UNIQUE(reporter_user_id, reported_user_id)
```

### 2. Context-Bound Enforcement

* A user may **only** report another user if they are currently in an active match with that user, or via recent match logs within a grace window (`match_id` verified against `MatchRoomDO` context).
* Direct API submissions attempting to report arbitrary `user_id`s without a verified matching session are rejected server-side.

---

## 28. User Visibility

The matched participant sees the other user's display name and approximate distance.

Example:

```text
BlueFox482 (~150m away)
```

The other user does not receive:

```text
email address
Supabase user ID
IP address
exact coordinates
network information
internal identifiers
```

---

## 29. What the Server Knows During Active Use

During active use, the system temporarily knows:

```text
authenticated user_id
temporary current location (lat, lng)
configured search radius
connection information
current match
rate-limit state
messages currently being transmitted
```

The precise coordinates are matching data, not historical profile data.

The application does not maintain location history.

---

## 30. Session Lifetime

A temporary session contains:

```text
TemporarySession
├── user_id
├── temporary current location
├── search radius
├── connection
├── match_id
└── rate-limit state
```

The session exists only while required.

---

## 31. Closing the Website

When the user disconnects:

```text
WebSocket disconnect
        ↓
Durable Object detects disconnect
        ↓
Remove connection
        ↓
Terminate active match
        ↓
Notify other user if possible
        ↓
Discard temporary session state
```

Normal chat history does not remain.

---

## 32. Failure Handling

If a WebSocket disappears:

```text
WebSocket disconnect
      ↓
Durable Object detects it
      ↓
Remove connection
      ↓
Terminate match
      ↓
Notify other participant
```

If temporary realtime state is lost:

```text
Temporary state lost
      ↓
Clients reconnect
      ↓
Temporary state reconstructed
```

Persistent PostgreSQL data remains available.

---

## 33. PostgreSQL

PostgreSQL is hosted remotely by Supabase.

Production relationship:

```text
Cloudflare Worker
       │
       │ database access (Prisma / PgBouncer pooler port 6543)
       ▼
Supabase Managed PostgreSQL
```

---

## 34. Persistent Database Contents

Conceptually:

```text
Supabase PostgreSQL
│
├── UserProfile
│
├── UserBlock
│
├── Report
│
└── UserBan
```

It does not contain:

```text
Every active session
Every normal message
Chat history
Precise location history
Campus geofences
IP-based identities
Device fingerprints
```

---

## 35. Complete Production Architecture

```text
                                INTERNET
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Cloudflare Worker │
                         │                     │
                         │ HTTP/API            │
                         │ Auth verification   │
                         │ Validation          │
                         │ Session handling    │
                         │ Rate limiting       │
                         │ WebSocket routing   │
                         │ Context-bound report│
                         │ Ban enforcement     │
                         └──────────┬──────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      │                           │
                      ▼                           ▼
             ┌─────────────────┐        ┌─────────────────────┐
             │ Durable Objects │        │ Supabase             │
             │                 │        │                     │
             │ RadarMatcherDO │        │ Auth (Email/Google) │
             │  - Queues       │        │                     │
             │  - Distance     │        │ Managed PostgreSQL  │
             │  - Pairing      │        │  - User profiles    │
             │        ↓        │        │  - Blocks           │
             │ MatchRoomDO     │        │  - Reports & reasons│
             │  - Active chat  │        │  - Bans             │
             │  - Hibernation  │        └─────────────────────┘
             │  - Ephemeral ctx│
             └────────┬────────┘
                      │
                  WebSockets
                   ┌──┴──┐
                   │     │
                 User A User B
```

---

## 36. Technology Decisions

| Component | Decision |
| --- | --- |
| Frontend | Next.js + TypeScript |
| Runtime & Package Manager | Bun |
| HTTP/API | Cloudflare Worker |
| Authentication | Supabase Auth (Email + Google) |
| Token Verification | Asymmetric ECC (P-256) via Supabase JWKS using `jose` |
| Modern API Keys | Publishable key (`sb_publishable_...`) + Secret key (`sb_secret_...`) |
| Realtime Architecture | Two-Tier Cloudflare Durable Objects (`RadarMatcherDO` + `MatchRoomDO`) |
| Transport | WebSockets (single persistent connection across skips) |
| WebSocket optimization | WebSocket Hibernation in `MatchRoomDO` |
| Matchmaking Engine | In-memory `RadarMatcherDO` using Haversine distance proximity |
| Search Radius | User-configurable (1–50 km, default 5 km) with preset buttons |
| Location Calibration | Client-side geolocation with custom coordinate calibration option |
| Realtime rate limiting | In-memory sliding window in `MatchRoomDO` (20 msgs/min) |
| Persistent database | Supabase PostgreSQL (via transaction pooler port 6543) |
| Database ORM & Schema | Prisma (`schema.prisma` as single declarative source of truth) |
| Normal message persistence | None |
| Normal chat history | None |
| Location history | None |
| Account identity | Supabase Auth user ID |
| Public identity | Random editable display name |
| Blocking | Persistent user-to-user blocks |
| Reporting | Context-bound flow (requires active `match_id`) with categories & optional text |
| Report thresholds | Automatic server-side bans (6 $\rightarrow$ 24h, 11 $\rightarrow$ 7d, 20 $\rightarrow$ permanent) |
| Skip lifecycle | In-session re-queueing to `RadarMatcherDO` without WebSocket reconnect |
| IP-based identity | None |
| Device fingerprinting | None |
| Proactive human moderation | None |

---

## 37. Core Principle

```text
Cloudflare Worker
    owns API/auth entry points, session routing, and server-side enforcement.

Supabase Auth
    owns account authentication.

RadarMatcherDO
    owns waiting queues and in-memory distance proximity matching.

MatchRoomDO
    owns ephemeral active conversations and message forwarding via WebSocket Hibernation.

Supabase PostgreSQL
    remembers only what genuinely needs to survive.

Normal conversations
    are temporary and never written to disk.

Precise current location
    is temporary and evaluated strictly in-memory.

Account identity
    is authenticated through Supabase.

Public identity
    is a random editable display name.

Distance radius
    determines the maximum proximity within which two users can be matched (default 5 km).

Block
    is a persistent account-to-account action.

Report
    is a context-bound, distinct-reporter enforcement input with categories and optional details.

Report counts
    accumulate permanently without resetting upon ban expiration.

Report thresholds
    automatically produce 24-hour, 7-day, or permanent bans.
```

The target architecture is therefore:

```text
MINIMUM DATA
+
AUTHENTICATED ACCESS
+
PSEUDONYMOUS DISPLAY IDENTITY
+
DISTANCE-BASED PROXIMITY DISCOVERY (DEFAULT 5 KM)
+
TWO-TIER DURABLE OBJECTS
+
CONTEXT-BOUND REPORTING WITH LIFETIME THRESHOLDS
+
AUTOMATIC OPERATION
+
NO NORMAL CHAT HISTORY
+
NO LOCATION HISTORY
+
NO IP-BASED IDENTITY
+
NO DEVICE FINGERPRINTING
+
NO ROUTINE HUMAN MODERATION
```
