# Plan: Password Authentication + Social Password Recovery

## Why This Is Needed
Anyone can impersonate another user by typing their username. The app has no secret that proves identity. This plan adds password-based authentication and a community-consensus password recovery system that fits the app's existing team/voting nature.

---

## Design Decisions (agreed)
| Question | Decision |
|---|---|
| "Online" definition | Any user with a valid session (logged in, whether currently connected or not) |
| Approval threshold | 5 users |
| If not enough voters | Keep request open for 24 hours, then expire |
| Notification style | "Pending Resets" section (new tab) — no pop-ups |

---

## No New Dependencies
Both password hashing (PBKDF2) and token signing (HMAC-SHA256) use **Java stdlib only** (`javax.crypto`, `java.security`). No changes to `build.sbt`.

---

## New Files

### Backend
| File | Purpose |
|---|---|
| `models/Auth.scala` | Data models for auth and reset requests |
| `services/AuthService.scala` | Password hashing, token sign/verify, server secret |
| `services/UserService.scala` | File-based user credential storage (`users.json`) |
| `services/ResetService.scala` | In-memory reset request management (24h expiry) |
| `routes/AuthRoutes.scala` | Auth endpoints + reset SSE stream |

### Frontend
| File | Purpose |
|---|---|
| `services/authApi.ts` | Auth-related API calls |
| `services/authUpdateService.ts` | SSE client for reset notifications |
| `components/PendingResets.tsx` | Tab showing open reset requests to vote on |

---

## Modified Files

### Backend
- `Main.scala` — combine `AuthRoutes` with `PollRoutes`
- `routes/PollRoutes.scala` — add JWT validation directive to sensitive endpoints
- `models/Poll.scala` — remove `username` from `VoteRequest`/`RemoveVoteRequest`; remove `createdBy` from `CreatePollRequest` (username comes from JWT instead)
- `json/JsonFormats.scala` — add auth model formats; update arity of changed request formats

### Frontend
- `contexts/UserContext.tsx` — store token alongside username; expose `token`; clear on logout
- `services/api.ts` — add `Authorization: Bearer {token}` header to all requests
- `components/Login.tsx` — full rewrite of login flow (see UI section)
- `App.tsx` — add Pending Resets tab; subscribe to `authUpdateService`

---

## Backend: Models (`models/Auth.scala`)

```scala
case class User(
  username: String,
  passwordHash: String,
  salt: String,
  createdAt: Long
)

case class LoginRequest(username: String, password: String)
case class RegisterRequest(username: String, password: String)
case class AuthResponse(token: String, username: String)

case class ResetRequest(
  id: String,
  username: String,
  newPasswordHash: String,   // hashed with the new password — applied on approval
  newSalt: String,
  requestedAt: Long,
  votes: Set[String]         // usernames who confirmed
)

case class ResetStatusResponse(
  requestId: String,
  username: String,
  votes: Int,
  threshold: Int,
  status: String,            // "pending" | "approved" | "expired"
  expiresAt: Long
)
```

---

## Backend: `services/AuthService.scala`

**Server secret** — on first startup, generate a random 32-byte secret and write to `server.secret` file. On subsequent startups, read from file. Tokens issued before a restart remain valid.

**Password hashing** (PBKDF2, 65536 iterations, 256-bit key):
```
hashPassword(password): (hash: String, salt: String)
verifyPassword(password, hash, salt): Boolean
```
Both use `javax.crypto.SecretKeyFactory("PBKDF2WithHmacSHA256")` — no new library.

**Token format** (HMAC-SHA256, no library):
```
token = base64url(username) + "." + base64url(issuedAtMs) + "." + base64url(HMAC(username|issuedAt, secret))
```
- `generateToken(username): String`
- `validateToken(token): Option[String]` — returns `Some(username)` if valid and not expired (30-day TTL)

---

## Backend: `services/UserService.scala`

Follows the same pattern as `TemplateService`. Reads/writes `users.json`.

```
findUser(username): Option[User]
createUser(username, passwordHash, salt): Try[Unit]
updatePassword(username, newHash, newSalt): Try[Unit]
deleteUser(username): Try[Unit]
listUsers(): Try[List[User]]       ← for "count of registered users" check
```

---

## Backend: `services/ResetService.scala`

In-memory `mutable.Map[String, ResetRequest]`. Cleared on server restart (acceptable — users just submit a new request).

```
val THRESHOLD = 5
val EXPIRY_MS = 24 * 60 * 60 * 1000L

create(username, newPasswordHash, newSalt): ResetRequest
  // replaces any existing pending request for this username
addVote(requestId, voterUsername): Option[ResetRequest]
  // returns None if request not found/expired; returns Some(updated) otherwise
getStatus(requestId): Option[ResetRequest]
findPendingForUsername(username): Option[ResetRequest]
listActive(): List[ResetRequest]       // all non-expired requests
cleanup(): Unit                        // remove expired entries
isApproved(r: ResetRequest): Boolean = r.votes.size >= THRESHOLD
```

---

## Backend: `routes/AuthRoutes.scala`

### Authentication endpoints

```
POST /api/auth/check
  body: { username }
  response: { exists: Boolean }
  (lets frontend decide whether to show "login" or "register" form)

POST /api/auth/register
  body: RegisterRequest { username, password }
  guards: username not already taken
  action: hashPassword → UserService.createUser → generateToken
  response 201: AuthResponse { token, username }
  response 409: ErrorResponse (username taken)

POST /api/auth/login
  body: LoginRequest { username, password }
  action: UserService.findUser → verifyPassword → generateToken
  response 200: AuthResponse { token, username }
  response 401: ErrorResponse (wrong password or user not found)
```

### Password reset endpoints

```
POST /api/auth/forgot-password
  body: { username, newPassword }
  guards: user must exist, no active reset request already pending
  action: hash newPassword → ResetService.create → SSE broadcast
  response 200: { requestId, expiresAt }
  response 404: ErrorResponse (user not found)
  response 409: ErrorResponse (reset already pending)

POST /api/auth/reset-votes/{requestId}
  requires: valid JWT (voter must be logged in)
  guards: voter hasn't already voted; request not expired; voter != requesting user
  action: ResetService.addVote
         if approved: UserService.updatePassword + ResetService cleanup + SSE broadcast "reset-approved"
         else: SSE broadcast "reset-update" with new vote count
  response 200: ResetStatusResponse
  response 400: ErrorResponse (already voted / expired / self-vote)
  response 404: ErrorResponse (request not found)

GET /api/auth/reset-status/{requestId}
  no auth required (requester may not be logged in)
  response 200: ResetStatusResponse
  response 404: ErrorResponse

GET /api/auth/pending-resets
  requires: valid JWT
  response 200: List[ResetStatusResponse]  (all active requests)

GET /api/auth/updates
  SSE stream for reset events (no auth required — same pattern as /api/polls/updates)
  events:
    reset-update   { requestId, username, votes, threshold, status, expiresAt }
    reset-approved { requestId, username }
```

### JWT validation directive (reused in PollRoutes)

```scala
def authenticated: Directive1[String] =
  optionalHeaderValueByName("Authorization").flatMap {
    case Some(header) =>
      AuthService.validateToken(header.stripPrefix("Bearer ")) match
        case Some(username) => provide(username)
        case None => complete(StatusCodes.Unauthorized, ErrorResponse("Invalid or expired token"))
    case None =>
      complete(StatusCodes.Unauthorized, ErrorResponse("Authentication required"))
  }
```

This directive is defined in `AuthRoutes` and imported into `PollRoutes`.

---

## Backend: PollRoutes — Protected Endpoints

Wrap sensitive routes with `authenticated { username => ... }`:

```scala
path(Segment / "vote") { pollId =>
  post {
    authenticated { username =>
      entity(as[VoteRequest]) { req =>
        // username comes from JWT, not body
        pollManager.ask(PollManager.VotePoll(pollId, req.restaurantId, username, _))
        ...
      }
    }
  }
}
```

Sensitive routes to protect: `POST /vote`, `DELETE /vote`, `POST /reset`, `POST /polls`, `PUT /polls/{id}`, `DELETE /polls/{id}`, all voter-approval routes (from PLAN.md).

Read-only routes stay public: `GET /polls`, `GET /polls/{id}`, `GET /polls/updates`, `GET /results`, `GET /templates`.

### Request model simplification

Since username comes from JWT:
- `VoteRequest` → only `restaurantId: String` (remove `username`)
- `RemoveVoteRequest` → only `restaurantId: String` (remove `username`)
- `CreatePollRequest` → remove `createdBy` (injected from JWT in route handler)

Update `jsonFormat` arities accordingly:
- `VoteRequest` / `RemoveVoteRequest` → `jsonFormat1`
- `CreatePollRequest` → `jsonFormat5` (was 7 after PLAN.md, now 6 after removing `createdBy`)

---

## Frontend: `contexts/UserContext.tsx`

Extend to store token:
```typescript
interface UserContextType {
  username: string | null;
  token: string | null;
  login: (username: string, token: string) => void;
  logout: () => void;
  isLoggedIn: boolean;
}
```

`login(username, token)` — saves both to localStorage (`poll-app-username`, `poll-app-token`).  
`logout()` — clears both.  
On mount: load both from localStorage.

---

## Frontend: `services/api.ts`

All `request<T>()` calls need `Authorization: Bearer {token}` on sensitive routes. Add a `setToken(token)` function or pass the token through a module-level variable:

```typescript
let authToken: string | null = null;
export const setAuthToken = (token: string | null) => { authToken = token; }

// In request():
headers: {
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  ...options.headers,
}
```

`UserContext` calls `setAuthToken(token)` after login and `setAuthToken(null)` after logout.

---

## Frontend: `services/authApi.ts`

```typescript
export const authApi = {
  checkUser: (username) => GET /api/auth/check?username=... → { exists: boolean }
  register:  (username, password) → POST /api/auth/register → AuthResponse
  login:     (username, password) → POST /api/auth/login → AuthResponse
  forgotPassword: (username, newPassword) → POST /api/auth/forgot-password → { requestId, expiresAt }
  getResetStatus: (requestId) → GET /api/auth/reset-status/{id} → ResetStatusResponse
  voteReset: (requestId) → POST /api/auth/reset-votes/{id} → ResetStatusResponse
  getPendingResets: () → GET /api/auth/pending-resets → ResetStatusResponse[]
}
```

---

## Frontend: `services/authUpdateService.ts`

Same pattern as `pollUpdateService.ts` but connects to `/api/auth/updates` and emits typed events:

```typescript
type ResetEvent = { type: 'reset-update' | 'reset-approved'; data: ResetStatusResponse }
type ResetListener = (event: ResetEvent) => void;
```

---

## Frontend: Login Flow (rewrite `Login.tsx`)

**Step 1 — Username screen**
- User enters username → click "Next"
- Calls `authApi.checkUser(username)`

**Step 2a — Register screen** (if `exists === false`)
- "Welcome! Set a password to create your account."
- Password + Confirm Password fields
- Submit → `authApi.register(username, password)` → `login(username, token)`

**Step 2b — Login screen** (if `exists === true`)
- "Enter your password"
- Password field + "Forgot password?" link
- Submit → `authApi.login(username, password)` → `login(username, token)`

**Step 3 — Forgot password screen** (if "Forgot password?" clicked)
- "Enter your new password" (new password + confirm)
- Submit → `authApi.forgotPassword(username, newPassword)` → shows waiting screen
- **Waiting screen**: "Your reset request has been submitted. X/5 confirmations needed."
  - Stores `requestId` in `sessionStorage`
  - Polls `authApi.getResetStatus(requestId)` every 10s
  - Also subscribes to `authUpdateService` for live updates
  - When `status === "approved"` → "Password reset! Please log in." → back to Step 2b
  - When `status === "expired"` → "Request expired." → back to Step 3 to retry

```
[Username] → [Login | Register] → [Forgot Password → Waiting]
```

---

## Frontend: `components/PendingResets.tsx` (new tab in App.tsx)

Shows all active reset requests. Visible to all logged-in users.

```
┌─ Pending Password Resets ─────────────────────────────┐
│                                                        │
│  alice wants to reset their password                   │
│  Confirmations: ██░░░░░░░░  2/5   Expires: 18h 32m    │
│  [Confirm Identity]                                    │
│                                                        │
│  bob wants to reset their password                     │
│  Confirmations: ████████░░  4/5   Expires: 3h 12m     │
│  ✓ You already confirmed this                          │
│                                                        │
│  (empty state: "No pending password reset requests")   │
└────────────────────────────────────────────────────────┘
```

- "Confirm Identity" calls `authApi.voteReset(requestId)` — only shown if current user hasn't voted yet and is not the requester
- After voting, button changes to "✓ You confirmed this"
- Real-time vote count updates via `authUpdateService`
- When a request reaches 5 votes, it disappears from the list (with a brief success toast)

**Added as Tab 5 in `App.tsx`:**
```
Tab 1: Polls | Tab 2: Vote | Tab 3: Results | Tab 4: Templates | Tab 5: Pending Resets (badge if any)
```

Show a red numeric badge on "Pending Resets" tab when there are active requests.

---

## Complete Auth Flow Diagram

```
NEW USER
  → enters username (not found) → sets password → registered → logged in

RETURNING USER
  → enters username (found) → enters password → verified → logged in
                                  ↓
                           "Forgot password?"
                                  ↓
                    enters new password → reset request created
                                  ↓
                    [waiting screen: polling status]
                                  ↓
                    5 colleagues go to "Pending Resets" tab
                    and click "Confirm Identity"
                                  ↓
                    old password replaced → request approved
                                  ↓
                    waiting screen → "Reset complete, please log in"
                                  ↓
                    user logs in with new password → logged in

VOTER (colleague confirming reset)
  → sees badge on "Pending Resets" tab (or notices on next login)
  → clicks "Confirm Identity" for the person they recognize
  → if 5th voter: request approved, SSE notifies requester
```

---

## Key Invariants

- `approvedVoters` / `pendingVoters` (from PLAN.md) are already isolated from reset — no interaction
- A user cannot vote on their own reset request
- A user can only vote once per reset request
- A reset request for a non-existent user is rejected immediately
- Password is hashed **before** being sent? No — password is sent over HTTPS, hashed **on the server**. Frontend sends plaintext password (TLS protects it in transit)
- After a reset is approved, the `requestId` in sessionStorage is cleared and the login screen shows a success message

---

## Verification Checklist

- [ ] `sbt compile` passes after model/route changes
- [ ] `npm run build` passes (TypeScript)
- [ ] Register new user → login → token stored in localStorage
- [ ] Login with wrong password → 401
- [ ] Login from second browser with same username + correct password → works (proves cross-device)
- [ ] Login with same username but no password (old behavior) → rejected (proves impersonation fixed)
- [ ] Vote without token → 401
- [ ] Submit forgot-password request → appears in other users' "Pending Resets" tab
- [ ] 5 users vote → status changes to "approved" → requester's waiting screen updates
- [ ] After approval, login with new password works; old password rejected
- [ ] Reset request older than 24h → status = "expired" → removed from pending resets list
- [ ] SSE `reset-update` event fires on each new confirmation vote
- [ ] Badge count on "Pending Resets" tab shows number of active requests
