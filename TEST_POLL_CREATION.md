# Test: Poll Creation Sync Across Tabs

## What We Fixed

1. **Backend**: Added `notifySubscribers()` when a new poll is created in `PollManager`
2. **Frontend**: Modified `updatePollInList()` to **add new polls** to the list (not just update existing ones)

## Test Steps

### 1. Start Backend
```bash
cd backend
sbt run
```

Wait for: `Server online at http://0.0.0.0:8080/`

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

Wait for: `Local: http://localhost:3000/`

### 3. Open Two Browser Tabs

**Tab 1:**
- Open `http://localhost:3000`
- Press F12 to open DevTools Console
- You should see:
  ```
  [SSE] Connecting to poll updates...
  [SSE] Connection established
  ```

**Tab 2:**
- Open another tab at `http://localhost:3000`
- Press F12 to open DevTools Console
- You should see the same connection messages

### 4. Create a Poll in Tab 1

**In Tab 1:**
1. Fill in the form:
   - Title: "Lunch Today?"
   - Restaurant 1: "Pizza Place" / "Best pizza in town"
   - Restaurant 2: "Sushi Bar" / "Fresh sushi"
2. Click "Create Poll"

**In Tab 1 Console, you should see:**
```
[SSE] Received poll update: <poll-id> Total votes: 0
[PollList] Received update for poll: <poll-id>
[PollList] Adding new poll: <poll-id>
```

### 5. Check Tab 2 (WITHOUT REFRESHING!)

**In Tab 2:**
- Look at the poll list
- **The new poll should appear automatically!** 🎉

**In Tab 2 Console, you should see:**
```
[SSE] Received poll update: <poll-id> Total votes: 0
[PollList] Received update for poll: <poll-id>
[PollList] Adding new poll: <poll-id>
```

## Success Criteria

✅ **Tab 1**: Creates poll, poll appears in list
✅ **Tab 2**: **WITHOUT REFRESH**, new poll appears in list automatically
✅ **Console**: Both tabs show SSE update messages
✅ **Network Tab**: EventSource connection to `/api/polls/updates` is active

## If It Doesn't Work

### Check Backend Console
- Should see subscriber connections
- Should see vote/create notifications

### Check Frontend Console (Both Tabs)
Look for errors:
- ❌ `[SSE] Connection error` → Backend not running or wrong port
- ❌ No `[SSE]` messages → EventSource not connecting
- ❌ CORS errors → Check backend CORS headers

### Check Network Tab (F12 → Network)
- Filter: "updates"
- Should see: `polls/updates` with Type: "eventsource"
- Status should be: "200" or "(pending)"
- If Status is "404" → Backend route not configured
- If Status is "CORS error" → Check backend CORS settings

### Quick Debug Commands

**Test SSE endpoint directly:**
```bash
curl -N http://localhost:8080/api/polls/updates
```
Should hang (this is correct - waiting for events)

**Test poll creation:**
```bash
curl -X POST http://localhost:8080/api/polls \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","restaurants":[{"name":"A","description":""}]}'
```

Should return the created poll JSON.

## What's Next

Once poll creation works across tabs, we'll test:
- ✅ Poll creation sync
- ⏳ Vote sync (when you vote in one tab, other tabs update)
- ⏳ Poll deletion sync
