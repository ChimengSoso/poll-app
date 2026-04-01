# Plan: Voter Allowlist / Approval System

## Why This Is Needed
Username-only auth means anyone can vote multiple times under a different name (incognito window, new browser). The fix is an opt-in **per-poll allowlist**: the poll owner approves voters one by one. Once approved, a user can vote in all future daily resets of the same poll without re-requesting.

---

## What Changes (Overview)

| Layer | Files Changed |
|---|---|
| Backend models | `models/Poll.scala`, `json/JsonFormats.scala` |
| Backend actors | `actors/PollActor.scala`, `actors/PollManager.scala` |
| Backend HTTP | `routes/PollRoutes.scala` |
| Frontend types | `frontend/src/types/index.ts` |
| Frontend API | `frontend/src/services/api.ts` |
| Frontend UI | `VotePanel.tsx`, `CreatePoll.tsx`, `EditPollModal.tsx` |

---

## Backend Changes

### 1. `models/Poll.scala` — New Fields

**`Poll` case class** — add 3 fields with defaults:
```scala
requireApproval: Boolean = false,
approvedVoters: Set[String] = Set.empty,   // permanently approved users
pendingVoters: Set[String] = Set.empty     // awaiting owner decision
```

**`PollResponse` case class** — grows from 11 → 14 fields:
```scala
// existing 11 fields stay unchanged...
requireApproval: Boolean = false,
approvedVoters: List[String] = List.empty,
pendingVoters: List[String] = List.empty
```

**`CreatePollRequest`** — grows from 6 → 7 fields:
```scala
requireApproval: Boolean  // added
```

**`EditPollRequest`** — grows from 4 → 5 fields:
```scala
requireApproval: Boolean  // added
```

**New case class** (for request/approve/reject body):
```scala
case class VoterActionRequest(username: String)
```

---

### 2. `json/JsonFormats.scala` — Updated Arities

```scala
implicit val pollResponseFormat      = jsonFormat14(PollResponse.apply)   // was 11
implicit val createPollRequestFormat = jsonFormat7(CreatePollRequest.apply) // was 6
implicit val editPollRequestFormat   = jsonFormat5(EditPollRequest.apply)   // was 4
implicit val voterActionRequestFormat = jsonFormat1(VoterActionRequest.apply) // new
```

---

### 3. `actors/PollActor.scala` — New Commands & Vote Guard

**4 new commands:**
```scala
case class RequestToVote(username: String, replyTo: ActorRef[VoterRequestResponse]) extends Command
case class ApproveVoter(username: String, replyTo: ActorRef[VoterActionResponse]) extends Command
case class RejectVoter(username: String, replyTo: ActorRef[VoterActionResponse]) extends Command
case class RevokeVoter(username: String, replyTo: ActorRef[VoterActionResponse]) extends Command

sealed trait VoterRequestResponse
case class VoterRequestSuccess(poll: PollResponse) extends VoterRequestResponse
case class VoterRequestFailure(message: String) extends VoterRequestResponse

sealed trait VoterActionResponse
case class VoterActionSuccess(poll: PollResponse) extends VoterActionResponse
case class VoterActionFailure(message: String) extends VoterActionResponse
```

**Vote handler — add approval guard** (insert after `applyDailyReset`, before existing Single/Multiple logic):
```
if current.requireApproval && !current.approvedVoters.contains(username) then
  replyTo ! VoteFailure("User is not approved to vote in this poll")
  active(current)   // keep daily-reset state even on failure
else
  // existing voting logic unchanged
```

**EditPoll command** — extend signature with `requireApproval: Boolean`.  
When `requireApproval` flips false → true, auto-approve users who have already voted today:
```
val newApprovedVoters =
  if requireApproval && !poll.requireApproval then poll.approvedVoters ++ poll.voters
  else poll.approvedVoters
```

**`toPollResponse`** — pass the 3 new fields:
```scala
poll.requireApproval,
poll.approvedVoters.toList,
poll.pendingVoters.toList
```

**`applyDailyReset` and `ResetVotes`** — no change needed.  
Both already only reset `voters`, `restaurants.votes`, `totalVotes`. The new `approvedVoters`/`pendingVoters` fields are not touched → **approval persists across daily resets automatically**.

**Handler logic for the 4 new commands:**

| Command | Guard | State Transition |
|---|---|---|
| RequestToVote | not already pending/approved | `pendingVoters + username` |
| ApproveVoter | must be in pendingVoters | move to `approvedVoters`, remove from `pendingVoters` |
| RejectVoter | must be in pendingVoters | remove from `pendingVoters` |
| RevokeVoter | must be in approvedVoters | remove from `approvedVoters` |

---

### 4. `actors/PollManager.scala` — 4 New Commands + SSE Notification

```scala
case class RequestPollVote(pollId, username, replyTo: ActorRef[VoterRequestPollResponse]) extends Command
case class ApprovePollVoter(pollId, username, replyTo: ActorRef[VoterActionPollResponse]) extends Command
case class RejectPollVoter(pollId, username, replyTo: ActorRef[VoterActionPollResponse]) extends Command
case class RevokePollVoter(pollId, username, replyTo: ActorRef[VoterActionPollResponse]) extends Command
```

Each follows the same wrapped-message pattern as existing commands (e.g. `VotePoll`).  
On success: reply to caller **and** call `notifySubscribers(poll)` — this makes all connected browsers (including the requesting user's) update in real time via SSE.

`EditPoll` command also gains `requireApproval: Boolean` and passes it through to `PollActor.EditPoll`.

---

### 5. `routes/PollRoutes.scala` — 4 New Routes

All placed **before** `path(Segment)` (order matters in Pekko HTTP):

```
POST   /api/polls/{id}/request-vote    body: VoterActionRequest  → PollResponse
POST   /api/polls/{id}/approve-voter   body: VoterActionRequest  → PollResponse
POST   /api/polls/{id}/reject-voter    body: VoterActionRequest  → PollResponse
DELETE /api/polls/{id}/voters/{user}   no body                   → PollResponse
```

`PUT /api/polls/{id}` — pass `editRequest.requireApproval` to `PollManager.EditPoll`.

Template recovery (`POST /api/templates/{file}/recover`) — explicitly set `requireApproval = false` when constructing `CreatePollRequest` from a template (do not carry over old voter lists).

---

## Frontend Changes

### 6. `frontend/src/types/index.ts`

```typescript
// Poll interface — add:
requireApproval: boolean;
approvedVoters: string[];
pendingVoters: string[];

// CreatePollRequest — add:
requireApproval: boolean;

// EditPollRequest — add:
requireApproval: boolean;

// New interface:
export interface VoterActionRequest { username: string; }
```

---

### 7. `frontend/src/services/api.ts`

Add 4 methods to `pollApi`:
```typescript
requestToVote: (pollId, username) => POST /polls/{id}/request-vote  { username }
approveVoter:  (pollId, username) => POST /polls/{id}/approve-voter { username }
rejectVoter:   (pollId, username) => POST /polls/{id}/reject-voter  { username }
revokeVoter:   (pollId, username) => DELETE /polls/{id}/voters/{username}
```

---

### 8. `frontend/src/components/VotePanel.tsx`

**Compute approval state** (top of component):
```typescript
const isApprovalRequired = poll.requireApproval;
const isApproved  = username ? poll.approvedVoters.includes(username) : false;
const isPending   = username ? poll.pendingVoters.includes(username)  : false;
```

**Action column** — when `isApprovalRequired && !isApproved`:
- If `isPending` → show disabled Tag: `"Pending approval"`
- If `!isPending` → show `"Request to vote"` Button (calls `handleRequestToVote`)
- Normal Vote / Remove buttons only render when `!isApprovalRequired || isApproved`

**New alerts** (above the grid):
```
requireApproval && !isApproved && isPending  →  Warning: "Your request is pending owner approval"
requireApproval && !isApproved && !isPending →  Info: "This poll requires approval to vote"
```

**Owner approval panel** (below the grid, only when `username === poll.createdBy && poll.requireApproval`):

```
┌─ Voter Approvals ────────────────────────────────┐
│ Pending Requests                                  │
│   alice   [Approve]  [Reject]                     │
│   bob     [Approve]  [Reject]                     │
│                                                   │
│ Approved Voters                                   │
│   [charlie ✓]  [Revoke]                          │
└───────────────────────────────────────────────────┘
```

Add handlers: `handleRequestToVote`, `handleApproveVoter`, `handleRejectVoter`, `handleRevokeVoter`.  
Add state: `requesting: boolean` for loading state on the request button.

---

### 9. `frontend/src/components/CreatePoll.tsx`

Add after "Daily Auto-Reset" switch:
```tsx
<Form.Item
  label="Require Voter Approval"
  name="requireApproval"
  valuePropName="checked"
  tooltip="Users must request access and be approved by you before voting."
>
  <Switch />
</Form.Item>
```

Add `requireApproval: false` to `initialValues`.  
Include `requireApproval: values.requireApproval || false` in the submitted request object.

---

### 10. `frontend/src/components/EditPollModal.tsx`

Same Switch Form.Item as CreatePoll.  
In `useEffect`: load `poll.requireApproval` into the form.  
In `handleSubmit`: include `requireApproval: values.requireApproval || false`.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Approval is per-poll | "ever this poll ask again" — approval to one poll doesn't leak to others |
| `approvedVoters` survives daily reset | "this support on diary poll" — approved users vote every day without re-requesting |
| `pendingVoters` also survives reset | A pending request doesn't disappear overnight |
| Toggle ON auto-approves existing voters | Turning on approval mid-poll doesn't suddenly block people who already voted |
| Template recovery resets approval | Recovered polls start fresh — old voter lists don't carry over |
| SSE notifies all 4 voter actions | Requesting user sees their approval in real time without refreshing |

---

## Verification Checklist

- [ ] `sbt compile` — no errors after model changes
- [ ] `npm run build` — TypeScript passes
- [ ] `POST /vote` with unapproved user on `requireApproval=true` poll → 400 error
- [ ] Full request → approve → vote flow works end to end
- [ ] Revoke → subsequent vote blocked
- [ ] Daily reset preserves `approvedVoters` and `pendingVoters`
- [ ] `PUT` with `requireApproval: true` on poll with existing voters → those voters appear in `approvedVoters`
- [ ] SSE emits `poll-update` after each voter action (visible in browser Network tab or `test-sse.html`)
- [ ] Non-approved user's VotePanel auto-updates after owner approves (no page refresh needed)
