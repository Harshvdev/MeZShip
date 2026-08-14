# MeZShip — MVP Architecture

## 1. Product

A local random-chat website for spontaneous 1-to-1 conversations with people who are currently inside selected campuses.

Core interaction:

```text
Open website
    ↓
Sign up / Sign in
    ↓
Grant location access
    ↓
Select campus(es) where you want to find people
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
* campus-scoped discovery
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
* campus selection
* browser/device geolocation
* campus-only matching
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
* public user discovery outside selected campuses
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

* precise current location
* active matching session
* active match
* WebSocket connections
* normal messages
* rate-limit counters
* temporary matching state

Persistent storage contains:

* authenticated user records
* display-name/profile settings
* campus configuration
* user-selected campus preferences
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
            │ CampusMatcherDO │        │ Auth                │
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
* Two-tier Durable Objects (`CampusMatcherDO` for matchmaking queues and `MatchRoomDO` for active chats)

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
* campus/configuration requests
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

1. **`CampusMatcherDO`** (per campus/region):
   * waiting queues
   * campus eligibility validation
   * in-memory proximity matching within selected campuses
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
Campus selection preferences
```

### Durable Objects

Handle:

```text
CampusMatcherDO:
  - Waiting queues per campus
  - Geospatial eligibility & proximity filtering
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
Campus configuration
Campus selections
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
* does not encode the user's campus
* can be changed by the user
* is what other users see during a chat

The internal authenticated user ID is never shown to other users.

---

## 9. User Profile

The persistent application user profile can be conceptually:

```text
UserProfile
├── user_id
├── display_name
├── created_at
└── updated_at
```

Authentication data such as email address and OAuth identity remains managed by Supabase Auth rather than duplicated unnecessarily in the application profile.

The initial MVP profile should remain minimal.

---

## 10. Settings

The user can access Settings after signing in.

At minimum, Settings provides:

```text
Display name
Campus preferences
Blocked users
Account/sign-out controls
```

Display name flow:

```text
Default random name
        ↓
User opens Settings
        ↓
Changes display name
        ↓
New name saved
        ↓
Future chats use new name
```

---

## 11. Location Acquisition

Proximity is a core product feature.

The browser requests location through its normal geolocation mechanism.

Conceptually:

```text
User
 ↓
Browser location permission
 ↓
Temporary current coordinates
 ↓
Cloudflare Worker / CampusMatcherDO
 ↓
Campus eligibility check (In-isolate GeoJSON polygon check)
 ↓
Distance calculation (Haversine formula in-memory)
 ↓
Matching decision
```

The service should not claim that a website can guarantee a particular physical precision on every device.

Actual accuracy depends on the device, browser, operating system, permissions, and available location sources.

---

## 12. Campus-Only Location Model

Discovery is campus-scoped rather than city-wide.

A user chooses which campus locations they want to discover.

Example:

```text
My college campus
Nearby college campus A
Nearby college campus B
```

The user's current coordinates are checked against the configured campus boundaries.

A user is eligible for campus-scoped matching only while their current location is inside an eligible campus.

Conceptually:

```text
Current coordinates
       ↓
Campus geofence lookup (In-memory Point-in-Polygon)
       ↓
Inside selected campus?
   ├── YES → eligible
   └── NO  → not eligible for that campus
```

The product does not intentionally match users who are merely near a campus but physically outside every selected campus.

---

## 13. Campus Configuration

Campuses are persistent configuration data.

Conceptually:

```text
Campus
├── id
├── name
├── type
├── boundary (GeoJSON Polygon)
├── active
└── created_at
```

Possible types:

```text
COLLEGE
UNIVERSITY
CAMPUS
```

A campus boundary is represented by standard GeoJSON polygon data (`Json` column type in Prisma schema).

Example:

```text
Campus A
    └── GeoJSON polygon
Campus B
    └── GeoJSON polygon
```

Active campus boundaries are loaded and cached in Worker / `CampusMatcherDO` memory. Geospatial evaluation (point-in-polygon checks and distance calculations) executes directly within the JavaScript/TypeScript V8 isolate without querying the database per coordinate update.

---

## 14. Campus Selection

The user decides where they want to find people.

Example UI:

```text
Where do you want to find people?

☑ My College
☑ Nearby College A
☐ Nearby College B
```

The selection is a matching preference.

The selected campus list is persisted so it can be reused.

The user can change it at any time from Settings or before starting a match.

---

## 15. Matching Radius Within Campuses

Distance can still be used after campus eligibility is established.

Example:

```text
A is inside Campus A
B is inside Campus A

distance(A, B) = 250 m
```

The matcher can apply a configurable maximum distance.

Possible choices:

```text
0–500 m
0–1 km
0–2 km
```

The exact values are a product decision.

The important rule is:

```text
Inside selected campus
        AND
Within allowed matching distance
```

A user outside the selected campus is not matched merely because they are physically nearby.

---

## 16. Matching Queue

Users waiting for a match exist in temporary `CampusMatcherDO` state.

Conceptually:

```text
Waiting User
├── user_id
├── temporary current location
├── selected campus IDs
├── matching radius
└── temporary session state
```

The matcher checks:

1. User is authenticated.
2. Account is not currently banned.
3. User is connected.
4. User is currently waiting.
5. Current location is available.
6. User is physically inside an eligible selected campus.
7. Candidate is physically inside a campus both users are allowed to use.
8. Proximity requirement is satisfied.
9. Users are not blocking each other.
10. Neither user is already matched.

---

## 17. Pair Matching

Example:

```text
User A
current campus = Campus A

User B
current campus = Campus A

distance(A, B) = 350 m

A selected Campus A
B selected Campus A
```

If all other conditions are satisfied:

```text
A ↔ B
```

The `CampusMatcherDO` pairs the two users, generates a `match_id`, and hands the active session off to a dedicated `MatchRoomDO`.

```text
WAITING (CampusMatcherDO)
   ↓
MATCHED
   ↓
ACTIVE (MatchRoomDO)
```

---

## 18. Durable Object State

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

It does not need to become a PostgreSQL conversation row. When the match ends, the `MatchRoomDO` ephemeral state is cleared.

---

## 19. WebSocket Communication

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

## 20. Normal Messages Are Never Persisted

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

## 21. Message Validation

Before forwarding a message, the Durable Object checks:

```text
valid connection
valid active match
valid sender
valid message format
non-empty payload
maximum payload size
maximum message length
rate limit
```

Invalid messages are rejected.

Security-sensitive decisions are made server-side.

---

## 22. Message Rate Limiting

The server enforces rate limits.

Example:

```text
20 messages/minute/user
```

The exact value is adjustable.

The rate limit is maintained in temporary Durable Object state.

The browser cannot disable the server-side limit.

---

## 23. Skip

The interface contains:

```text
[ Skip ]
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
Current user returned to CampusMatcherDO waiting queue
      ↓
Find another compatible user
```

Key lifecycle rules for skips:

* **Persistent WebSocket**: The client keeps its single WebSocket connection alive. The server simply transitions the session state from `ACTIVE` (in `MatchRoomDO`) back to `WAITING` (in `CampusMatcherDO`).
* **Partner UX**: The skipped partner is notified immediately and presented with options to either re-queue automatically or exit.
* No page reload or WebSocket reconnect is required.

---

## 24. Block and Unblock

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

Blocks should be accessible from Settings so users can manage their block list.

---

## 25. Report and Block UI

Reporting and blocking should not be primary one-click actions.

The chat interface should place them inside a three-dots menu.

Example:

```text
[ ⋮ ]
```

Menu:

```text
Skip
Block
Report
```

The purpose is to make reporting/blocking deliberate actions rather than accidental primary controls.

---

## 26. Reporting

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

The user then confirms:

```text
[ Cancel ]   [ Submit Report ]
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

A normal chat message is not stored merely because a report was submitted.

The report itself is persistent application data because it drives automatic account actions.

---

## 27. Automatic Report-Based Bans

The ban system is fully automatic.

The system counts distinct users who have reported the same account.

The thresholds are:

```text
6 distinct reporters  → 24-hour ban
11 distinct reporters → 7-day ban
20 distinct reporters → permanent ban
```

This corresponds to:

```text
6 distinct reports
        ↓
24-hour ban

5 more distinct reports (11 total)
        ↓
7-day ban

9 more distinct reports (20 total)
        ↓
Permanent ban
```

Key rules for report-based bans:

1. **Distinct Reporters**: The count is strictly based on distinct reporting accounts so one account cannot generate repeated reports to inflate the count.
2. **Non-Resetting Lifetime Counts**: Report counts do **NOT** reset when a ban expires. If a user receives 6 reports and serves a 24-hour ban, their report count remains 6 upon expiration. If they later receive 5 additional distinct reports (reaching 11), they immediately trigger the 7-day ban.
3. **Server-Side Enforcement**: The server checks the ban state before allowing the account to start matching, enter the waiting queue, or exchange chat traffic.

---

## 28. Ban State

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

For temporary bans:

```text
expires_at != null
```

For permanent bans:

```text
expires_at = null
```

A ban must be enforced server-side.

Changing frontend state or clearing browser storage must not bypass a ban because the account identity exists independently of the browser.

---

## 29. Report Threshold Flow

Example progression:

```text
Reports #1 to #6 received
    ↓
24-hour ban triggered (Count = 6)
    ↓
24 hours expire → User unbanned (Count remains 6)
    ↓
Reports #7 to #11 received (5 new distinct reporters)
    ↓
7-day ban triggered (Count = 11)
    ↓
7 days expire → User unbanned (Count remains 11)
    ↓
Reports #12 to #20 received (9 new distinct reporters)
    ↓
Permanent ban triggered (Count = 20)
```

The system does not create multiple simultaneous bans.

The latest threshold determines the account's current restriction.

---

## 30. Duplicate & Context-Bound Reporting

Reporting enforces two critical safeguards against abuse:

### 1. Distinct Reporter Constraint

A single reporter can count at most once toward a target account's report threshold:

```text
UNIQUE(reporter_user_id, reported_user_id)
```

If the same user submits another report against the same account, it is rejected as already reported.

### 2. Context-Bound Enforcement

Reports are strictly context-bound:

* A user may **only** report another user if they are currently in an active match with that user, or within a short grace window immediately after the match ends (`match_id` verified against `MatchRoomDO` context).
* Direct API submissions attempting to report arbitrary `user_id`s without a verified matching session are rejected server-side.

This prevents coordinated out-of-band report bombing and target harassment.

---

## 31. User Visibility

The matched participant sees the other user's display name.

Example:

```text
BlueFox482
```

The other user does not receive:

```text
email address
Supabase user ID
IP address
precise coordinates
network information
internal identifiers
```

The selected campus should not expose the user's exact location.

---

## 32. What the Server Knows During Active Use

During active use, the system may temporarily know:

```text
authenticated user_id
temporary current location
selected campuses
current eligible campus
connection information
current match
rate-limit state
messages currently being transmitted
```

The precise current coordinates are matching data, not historical profile data.

The application does not maintain location history.

---

## 33. Session Lifetime

A temporary session contains state similar to:

```text
TemporarySession
├── user_id
├── selected campuses
├── temporary current location
├── matching preferences
├── connection
├── match_id
└── rate-limit state
```

The session exists only while required.

There is no requirement to create a separate permanent session row merely because someone visits the website.

---

## 34. Closing the Website

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

## 35. Match Lifecycle

```text
WAITING
   ↓
MATCHED
   ↓
ACTIVE
   ↓
ENDED
```

A match ends when:

```text
User skips
User leaves
User blocks the other user
User disconnects
System terminates match
```

After termination:

```text
Old WebSocket
      ↓
Cannot exchange messages
```

---

## 36. Failure Handling

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

## 37. PostgreSQL

PostgreSQL is hosted remotely by Supabase.

It is not hosted on the developer's laptop.

Production relationship:

```text
Cloudflare Worker
       │
       │ database access
       ▼
Supabase
       │
       ▼
Managed PostgreSQL
```

The database is used for account-related application data and information that must survive beyond temporary runtime state.

---

## 38. Persistent Database Contents

Conceptually:

```text
Supabase PostgreSQL
│
├── UserProfile
│
├── Campus
│
├── UserCampusPreference
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
IP-based identities
Device fingerprints
```

Authentication identities remain managed by Supabase Auth.

---

## 39. User Profile Table

Conceptually:

```text
UserProfile
├── user_id
├── display_name
├── created_at
└── updated_at
```

`user_id` corresponds to the authenticated Supabase user.

No separate password field exists in this table.

---

## 40. User Campus Preference

Conceptually:

```text
UserCampusPreference
├── user_id
├── campus_id
└── created_at
```

This represents which campuses the user wants to discover.

A user can select multiple campuses.

Example:

```text
User A
├── Campus A
├── Campus B
└── Campus D
```

---

## 41. User Block Table

Conceptually:

```text
UserBlock
├── blocker_user_id
├── blocked_user_id
└── created_at
```

The relationship is directional.

If:

```text
A blocks B
```

then A cannot be matched with B.

B can still interact with other users unless they independently block or are otherwise restricted.

The matcher must check both directions so that either participant being blocked by the other prevents the pair:

```text
A blocks B
OR
B blocks A
        ↓
Reject A ↔ B
```

---

## 42. Report Table

Conceptually:

```text
Report
├── id
├── reporter_user_id
├── reported_user_id
├── match_id (context verification)
├── reason (category enum)
├── details (optional string, max 300 chars)
└── created_at
```

Constraints & rules:

* **Distinct Reporter Constraint**: `UNIQUE(reporter_user_id, reported_user_id)` ensures a single reporter counts only once toward the target's threshold.
* **Context Proof**: `match_id` references the ephemeral match session verified server-side at report time.
* **Optional Text Box**: `details` stores optional free-text explanations (e.g. for "Other" or specific details) up to 300 characters.
* **Lifetime Non-Resetting**: Reports remain permanently in this table and drive automatic cumulative ban thresholds even after temporary bans expire.

The report table does not contain normal chat messages.

---

## 43. Ban Table

Conceptually:

```text
UserBan
├── user_id
├── ban_type
├── banned_at
├── expires_at
└── reason
```

A permanent ban has no expiry (`expires_at = null`).

A temporary ban has an expiration timestamp (`expires_at != null`).

The API and realtime layer must check the current ban state before allowing service use.

---

## 44. Campus Geospatial Data

Campus configuration represents the physical boundaries of each supported campus.

Conceptually:

```text
Campus
├── id
├── name
├── type
├── boundary (GeoJSON Polygon)
├── active
└── created_at
```

The boundary is stored as standard GeoJSON polygon data (`Json` type in Prisma schema).

Geospatial resolution details:

* Boundary definitions are cached in Worker / `CampusMatcherDO` memory.
* Point-in-polygon checks are executed directly in the V8 isolate via ray-casting (`@turf/boolean-point-in-polygon`).
* Distance calculations between candidate users inside campuses use the Haversine formula in TypeScript.
* User coordinates are strictly ephemeral in-memory variables and are discarded after matching decisions.

---

## 45. No IP-Based Identity

The network infrastructure may receive an IP address as part of normal internet operation.

The application does not use IP as the account identity.

Do not build:

```text
IP
 ↓
Permanent user identity
```

The authenticated Supabase user ID is the application account identity.

---

## 46. No Device Fingerprinting

The application does not use device fingerprinting to identify accounts.

Do not build:

```text
Browser characteristics
+
Hardware characteristics
+
Network characteristics
        ↓
Permanent identity
```

The account remains tied to the authenticated Supabase identity.

---

## 47. No Location History

The application uses current location only for eligibility and matching.

Conceptually:

```text
Browser geolocation
       ↓
Temporary current coordinates
       ↓
In-isolate campus eligibility check
       ↓
In-memory distance calculation
       ↓
Match decision
       ↓
Temporary coordinates discarded
```

The application does not maintain a historical movement trail.

---

## 48. Automatic Abuse Controls

The system should automatically enforce:

```text
HTTP rate limits
WebSocket message rate limits
Session creation limits
Reconnect limits
Queue abuse limits
Connection limits
Payload-size limits
Message-size limits
Ban enforcement
Block enforcement
Context-bound report threshold enforcement
Report detail character limits (max 300 chars)
```

These are server-side controls.

No continuous human observation of ordinary conversations is required for them to work.

---

## 49. Security Principles

The browser is never trusted for security-sensitive decisions.

The server determines:

```text
authenticated user identity
account ban state
match membership & match_id context
message ownership
rate limits
block relationships
campus eligibility (in-memory polygon verification)
proximity eligibility
distinct report counts
```

The browser cannot legitimately claim:

```text
"I am user X"
"I am not banned"
"I am in match Y"
"I can send unlimited messages"
"I can bypass a block"
"I can ignore campus restrictions"
"I can report arbitrary user Z without a match"
```

---

## 50. Data Retention Model

### Normal messages

```text
No persistent retention
```

### Precise current location

```text
Temporary only (in-memory during matching)
```

### Temporary session

```text
Temporary only (in-memory in CampusMatcherDO / MatchRoomDO)
```

### User profile

```text
Persistent
```

### Campus preferences

```text
Persistent
```

### Blocks

```text
Persistent until unblocked or otherwise removed
```

### Reports

```text
Persistent (non-resetting cumulative history with match_id and optional details)
```

### Bans

```text
Persistent while active
```

The architecture does not impose a persistent database for ordinary conversations.

---

## 51. Complete Production Architecture

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
            │ CampusMatcherDO │        │ Auth (Email/Google) │
            │  - Queues       │        │                     │
            │  - Geo matching │        │ Managed PostgreSQL  │
            │  - Pairing      │        │  - User profiles    │
            │        ↓        │        │  - Campuses (GeoJSON│
            │ MatchRoomDO     │        │  - Preferences      │
            │  - Active chat  │        │  - Blocks           │
            │  - Hibernation  │        │  - Reports & reasons│
            │  - Ephemeral ctx│        │  - Bans             │
            └────────┬────────┘        └─────────────────────┘
                     │
                 WebSockets
                  ┌──┴──┐
                  │     │
                User A User B
```

---

## 52. Technology Decisions

| Component | Decision |
| --- | --- |
| Frontend | Next.js + TypeScript |
| Runtime & Package Manager | Bun |
| HTTP/API | Cloudflare Worker |
| Authentication | Supabase Auth |
| Authentication methods | Email + Google |
| Token Verification | Asymmetric ECC (P-256) via Supabase JWKS using `jose` (zero shared secrets) |
| Modern API Keys | Publishable key (`sb_publishable_...`) + Secret key (`sb_secret_...`) |
| Realtime Architecture | Two-Tier Cloudflare Durable Objects (`CampusMatcherDO` + `MatchRoomDO`) |
| Transport | WebSockets (single persistent connection across skips) |
| WebSocket optimization | WebSocket Hibernation in `MatchRoomDO` |
| Matching & Queue | In-memory `CampusMatcherDO` per campus/region |
| Proximity Calculation | In-memory Haversine formula on temporary coordinates |
| Campus Eligibility | In-isolate GeoJSON Polygon Point-in-Polygon (`@turf/boolean-point-in-polygon`) |
| Realtime rate limiting | In-memory sliding window in `MatchRoomDO` |
| Persistent database | Supabase PostgreSQL |
| PostgreSQL hosting | Supabase managed service (connection pooler port 6543) |
| Database ORM & Schema | Prisma (`schema.prisma` as single declarative source of truth) |
| Database driver adapter | `@prisma/adapter-pg` / `@neondatabase/serverless` with `nodejs_compat` |
| Normal message persistence | None |
| Normal chat history | None |
| Precise location history | None |
| Account identity | Supabase Auth user ID |
| Public identity | Random editable display name |
| Campus selection | Persistent user preferences |
| Blocking | Persistent user-to-user blocks |
| Unblocking | Supported |
| Reporting | In-product context-bound flow (requires active `match_id`) |
| Report reasons | Predefined categories + "Other" (with optional text box, max 300 chars) |
| Report threshold enforcement | Automatic server-side bans |
| Report count persistence | Lifetime cumulative non-resetting distinct reporter count |
| 24-hour ban threshold | 6 distinct reporters |
| 7-day ban threshold | 11 distinct reporters (5 additional reports) |
| Permanent ban threshold | 20 distinct reporters (9 additional reports) |
| Skip lifecycle | In-session re-queueing to `CampusMatcherDO` without WebSocket reconnect |
| IP-based identity | None |
| Device fingerprinting | None |
| Proactive human moderation | None |
| Manual review queue | None |
| Moderation dashboard | None |
| WebRTC | Not used |
| Supabase Realtime | Not used |
| D1 | Not used |
| Developer machine | Development only |

---

## 53. Core Principle

```text
Cloudflare Worker
    owns API/auth entry points, session routing, and server-side enforcement.

Supabase Auth
    owns account authentication.

CampusMatcherDO
    owns waiting queues and in-memory geospatial matching.

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

Campus selection
    determines where the user wants to discover people.

Campus geofences
    ensure matching is limited to users physically inside eligible campuses.

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
CAMPUS-ONLY DISCOVERY
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
