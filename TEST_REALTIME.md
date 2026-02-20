# Testing Real-Time Cross-Tab Synchronization

## Step-by-Step Test Instructions

### 1. Start the Backend

```bash
cd backend
sbt run
```

Wait for:
```
========================================
Server online at http://0.0.0.0:8080/
API endpoints: http://0.0.0.0:8080/api/polls
========================================
Press RETURN to stop...
```

### 2. Start the Frontend

**In a NEW terminal:**

```bash
cd frontend
npm run dev
```

Wait for:
```
  ➜  Local:   http://localhost:3000/
```

### 3. Test Real-Time Updates

1. **Open Browser Tab 1**
   - Navigate to `http://localhost:3000`
   - Open browser DevTools (F12) and go to Console tab
   - Look for: `[SSE] Connecting to poll updates...` and `[SSE] Connection established`

2. **Create a Poll in Tab 1**
   - Fill in poll title: "Lunch Today?"
   - Add restaurants:
     - Name: "Pizza Place", Description: "Best pizza"
     - Name: "Sushi Bar", Description: "Fresh fish"
   - Click "Create Poll"

3. **Open Browser Tab 2**
   - Open a NEW tab in the SAME browser window
   - Navigate to `http://localhost:3000`
   - Open DevTools Console (F12)
   - You should see the same poll in both tabs

4. **Vote in Tab 1**
   - Click "View/Vote" on the poll
   - Click "Vote" button for "Pizza Place"
   - Watch for console log: `[SSE] Received poll update: ...`

5. **Check Tab 2**
   - **WITHOUT REFRESHING**, look at Tab 2
   - The vote count should automatically update!
   - Console should show: `[PollList] Received update for poll: ...`

6. **Vote in Tab 2**
   - Now vote for "Sushi Bar" in Tab 2
   - Watch Tab 1 automatically update!

## What You Should See

### In Console (Both Tabs)

```
[SSE] Connecting to poll updates...
[SSE] Connection established
[SSE] Received poll update: <poll-id> Total votes: 1
[PollList] Received update for poll: <poll-id>
[App] Updating selected poll: <poll-id>
```

### In UI (Both Tabs)

- **Poll List**: Total votes column updates automatically
- **Vote Panel**: Vote counts and percentages update in real-time
- **Results Tab**: Winner and statistics update instantly

## Troubleshooting

### SSE Not Connecting

**Check in Console:**
```
[SSE] Connection error: ...
```

**Solution:**
- Make sure backend is running on port 8080
- Check: `http://localhost:8080/api/polls/updates` in browser
- Should see a loading spinner (SSE connection)

### Updates Not Showing

**Check Backend Console:**
- Look for subscriber messages
- Should see when votes are received

**Check Frontend Console:**
- Should see `[SSE] Received poll update` messages
- If not, check Network tab for EventSource connection

### CORS Errors

**If you see CORS errors in console:**
- Backend should have CORS headers enabled (already configured)
- Try restarting both backend and frontend

## Expected Behavior

✅ **Tab 1 votes** → Tab 2 updates automatically
✅ **Tab 2 votes** → Tab 1 updates automatically
✅ **Multiple tabs** → All tabs update simultaneously
✅ **Vote counts** → Update in real-time
✅ **Percentages** → Recalculate automatically
✅ **AG-Grid** → Refreshes with new data

## Architecture Diagram

```
Tab 1 Browser          Tab 2 Browser
      ↓                      ↓
   (Vote)                 (Vote)
      ↓                      ↓
┌─────────────────────────────────┐
│    Backend (Pekko HTTP)         │
│                                  │
│  POST /api/polls/{id}/vote      │
│         ↓                        │
│    PollManager Actor             │
│         ↓                        │
│  notifySubscribers()             │
│         ↓                        │
└─────────────────────────────────┘
      ↓           ↓
   (SSE)       (SSE)
      ↓           ↓
   Tab 1       Tab 2
   (Update)    (Update)
```

## Key Points

1. **Single SSE Connection Per Tab** - Each tab maintains one EventSource connection
2. **Centralized Event Service** - `pollUpdateService` manages subscriptions
3. **Automatic Reconnection** - Connection auto-reconnects after 3 seconds if dropped
4. **Real-Time Broadcast** - Backend pushes updates to all connected clients
5. **Actor-Based** - Pekko actors manage state and subscribers thread-safely
