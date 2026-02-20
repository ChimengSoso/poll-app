# Restart & Test - Poll Creation Sync

## 🔧 What We Fixed

**CRITICAL FIX**: Route ordering issue - the `path("updates")` route was being matched by `path(Segment)` first, causing 404 errors.

### Route Order (Now Correct):
1. `/api/polls` ← Get all polls / Create poll
2. `/api/polls/updates` ← **SSE endpoint (MUST be before Segment)**
3. `/api/polls/{id}/vote` ← Vote
4. `/api/polls/{id}/results` ← Results
5. `/api/polls/{id}` ← Get/Delete specific poll (LAST)

## 🚀 Restart Instructions

### 1. Stop Everything

**If backend is running:**
- Go to the backend terminal
- Press `ENTER` to stop the server
- Or press `Ctrl+C`

**If frontend is running:**
- Go to the frontend terminal
- Press `Ctrl+C`

### 2. Start Backend (Fresh)

```bash
cd backend
sbt run
```

**Wait for this message:**
```
========================================
Server online at http://0.0.0.0:8080/
API endpoints: http://0.0.0.0:8080/api/polls
========================================
Press RETURN to stop...
```

### 3. Test SSE Endpoint Directly

**Open a new terminal and test:**
```bash
curl -N http://localhost:8080/api/polls/updates
```

**Expected:** The command should "hang" (this is correct! It's waiting for events)
**If you see 404:** Backend didn't restart properly - try again

Press `Ctrl+C` to stop the curl command.

### 4. Start Frontend

```bash
cd frontend
npm run dev
```

**Wait for:**
```
  ➜  Local:   http://localhost:3000/
```

### 5. Test in Browser

**Open Tab 1:**
1. Go to `http://localhost:3000`
2. Press F12 → Console tab
3. Look for:
   ```
   [SSE] Connecting to poll updates...
   [SSE] Connection established
   ```
4. Go to F12 → Network tab
5. Filter: "updates"
6. **You should see:** `updates` with Status: `200` or `(pending)`
   - Type should be: `eventsource`
   - **If 404:** Backend needs restart

**Open Tab 2:**
1. Open new tab at `http://localhost:3000`
2. Press F12 → Console
3. Should see same SSE connection messages

### 6. Create Poll Test

**In Tab 1:**
1. Fill form:
   - Title: "Where to eat?"
   - Restaurant 1: "Pizza" / "Italian"
   - Restaurant 2: "Sushi" / "Japanese"
2. Click "Create Poll"

**Expected in Tab 1 Console:**
```
[SSE] Received poll update: <id> Total votes: 0
[PollList] Received update for poll: <id>
[PollList] Adding new poll: <id>
```

**Expected in Tab 2 (NO REFRESH!):**
- New poll appears in the list automatically
- Console shows same messages

## ✅ Success Checklist

- [ ] Backend starts without errors
- [ ] `curl` test shows SSE endpoint working (hangs)
- [ ] Browser Network tab shows `updates` with Status 200
- [ ] Browser Console shows `[SSE] Connection established`
- [ ] Tab 1 creates poll - appears in list
- [ ] **Tab 2 shows new poll WITHOUT REFRESH** ← THIS IS THE KEY TEST!

## ❌ If Still 404

### Check 1: Backend actually restarted?
```bash
# In backend terminal, you should see:
Server online at http://0.0.0.0:8080/
```

### Check 2: Test with curl
```bash
curl -v http://localhost:8080/api/polls/updates
```

Should show:
```
< HTTP/1.1 200 OK
< Content-Type: text/event-stream
```

If 404, backend didn't load new code.

### Check 3: Verify compilation
```bash
cd backend
sbt clean compile
sbt run
```

## 🎯 Next Steps After This Works

Once poll creation syncs across tabs:
1. ✅ Poll creation ← **Testing this now**
2. ⏳ Vote sync
3. ⏳ Delete sync
