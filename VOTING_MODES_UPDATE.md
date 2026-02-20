# Voting Modes & User Registration Update

## 🎯 New Features

### 1. User Registration/Login
- Users must register with a username before voting
- Username is tracked with each vote

### 2. Voting Modes
Two voting modes are now supported:

**Single Vote Mode:**
- Each user can vote for **ONE** restaurant only
- Once voted, user cannot change their vote or vote again
- Perfect for "choose one restaurant" polls

**Multiple Vote Mode:**
- Each user can vote for **MULTIPLE** restaurants
- User can vote once per restaurant (no duplicate votes)
- Perfect for "vote for all restaurants you like" polls

## 📊 Backend Changes

### Models (`backend/src/main/scala/models/Poll.scala`)

```scala
enum VotingMode:
  case Single   // One vote per user
  case Multiple // Multiple votes per user

case class Restaurant(
  id: String,
  name: String,
  description: Option[String],
  votes: Int,
  voters: List[String]  // ← NEW: Track who voted
)

case class Poll(
  id: String,
  title: String,
  restaurants: List[Restaurant],
  totalVotes: Int,
  active: Boolean,
  votingMode: VotingMode,      // ← NEW: Single or Multiple
  createdBy: String,            // ← NEW: Poll creator username
  voters: Set[String]           // ← NEW: All users who voted
)

case class CreatePollRequest(
  title: String,
  restaurants: List[RestaurantInput],
  votingMode: String,     // ← NEW: "single" or "multiple"
  createdBy: String       // ← NEW: Creator username
)

case class VoteRequest(
  restaurantId: String,
  username: String        // ← NEW: Voter username
)

case class PollResponse(
  id: String,
  title: String,
  restaurants: List[Restaurant],
  totalVotes: Int,
  active: Boolean,
  votingMode: String,    // ← NEW
  createdBy: String,     // ← NEW
  voters: List[String]   // ← NEW
)
```

### Vote Validation (`backend/src/main/scala/actors/PollActor.scala`)

**Single Vote Mode:**
```scala
// Check if user has already voted in this poll
if poll.voters.contains(username) then
  VoteFailure("User has already voted (single vote mode)")
else
  // Allow vote
```

**Multiple Vote Mode:**
```scala
// Check if user has voted for this specific restaurant
if restaurant.voters.contains(username) then
  VoteFailure("User has already voted for this restaurant")
else
  // Allow vote
```

## 🎨 Frontend Changes Needed

### 1. Update Types (`frontend/src/types/index.ts`)

```typescript
export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  votes: number;
  voters: string[];  // NEW
}

export interface Poll {
  id: string;
  title: string;
  restaurants: Restaurant[];
  totalVotes: number;
  active: boolean;
  votingMode: string;  // NEW: "single" | "multiple"
  createdBy: string;   // NEW
  voters: string[];    // NEW
}

export interface CreatePollRequest {
  title: string;
  restaurants: RestaurantInput[];
  votingMode: string;   // NEW
  createdBy: string;    // NEW
}

export interface VoteRequest {
  restaurantId: string;
  username: string;     // NEW
}
```

### 2. Create Login Component (`frontend/src/components/Login.tsx`)

```typescript
// Simple username input form
// Store username in localStorage or React Context
```

### 3. User Context (`frontend/src/contexts/UserContext.tsx`)

```typescript
// Manage logged-in user state
// Provide username to all components
```

### 4. Update CreatePoll Component
- Add voting mode selector (radio buttons: Single / Multiple)
- Pass `createdBy` (current username)

### 5. Update VotePanel Component
- Pass `username` in vote request
- Show voting mode in UI
- Disable vote buttons if user already voted (single mode)
- Show which restaurants user has voted for

## 🚀 Next Steps

1. ✅ Backend updated and compiled
2. ⏳ Create frontend Login component
3. ⏳ Update frontend types
4. ⏳ Add User Context to App
5. ⏳ Update CreatePoll with voting mode selector
6. ⏳ Update VotePanel to use username
7. ⏳ Test both voting modes

## API Changes

### Create Poll
```bash
POST /api/polls
{
  "title": "Where to eat?",
  "restaurants": [...],
  "votingMode": "single",    # NEW
  "createdBy": "john"        # NEW
}
```

### Vote
```bash
POST /api/polls/{pollId}/vote
{
  "restaurantId": "abc123",
  "username": "john"         # NEW
}
```

### Response
```json
{
  "id": "poll123",
  "title": "Where to eat?",
  "restaurants": [
    {
      "id": "rest1",
      "name": "Pizza Place",
      "votes": 5,
      "voters": ["john", "jane", ...]  // NEW
    }
  ],
  "totalVotes": 10,
  "active": true,
  "votingMode": "single",     // NEW
  "createdBy": "john",        // NEW
  "voters": ["john", "jane"]  // NEW: All users who voted
}
```

## Testing

### Single Vote Mode
1. User "john" votes for "Pizza"
2. User "john" tries to vote for "Sushi" → ❌ Error: Already voted
3. User "jane" votes for "Sushi" → ✅ Success

### Multiple Vote Mode
1. User "john" votes for "Pizza" → ✅ Success
2. User "john" votes for "Sushi" → ✅ Success
3. User "john" tries to vote for "Pizza" again → ❌ Error: Already voted for this restaurant
4. User "jane" votes for "Pizza" → ✅ Success
