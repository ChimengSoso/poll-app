# Real-Time Poll Synchronization

## Overview

The app now supports **real-time synchronization across multiple browser tabs**. When anyone votes on a poll, all open tabs will automatically update to show the new vote counts.

## How It Works

### Backend (Scala + Pekko)

1. **PollManager Actor** - Maintains a list of subscribers (SSE connections)
2. **Subscribe/Unsubscribe** - New commands to manage subscribers
3. **NotifySubscribers** - When a vote occurs, broadcasts the updated poll to all subscribers
4. **SSE Endpoint** - `/api/polls/updates` streams poll updates to clients

### Frontend (React)

1. **EventSource API** - Connects to the SSE endpoint
2. **Auto-Update** - Receives poll updates and refreshes the UI
3. **Cross-Tab Sync** - All tabs listening to the same SSE stream get updates

## Implementation Details

### Backend Changes

**`PollManager.scala`**:
```scala
case class Subscribe(subscriber: ActorRef[PollUpdate]) extends Command
case class Unsubscribe(subscriber: ActorRef[PollUpdate]) extends Command
case class PollUpdate(poll: PollResponse)

// Notify all subscribers when vote succeeds
notifySubscribers(poll)
```

**`PollRoutes.scala`**:
```scala
path("updates") {
  get {
    // SSE endpoint streams poll updates
    val source = Source.queue[PollManager.PollUpdate](...)
      .map { update =>
        ServerSentEvent(update.poll.toJson.compactPrint,
                       eventType = Some("poll-update"))
      }
      .keepAlive(15.seconds, () => ServerSentEvent.heartbeat)

    complete(source)
  }
}
```

### Frontend Changes

**`api.ts`**:
```typescript
subscribeToPollUpdates: (onUpdate: (poll: Poll) => void) => {
  const eventSource = new EventSource('/api/polls/updates');

  eventSource.addEventListener('poll-update', (event) => {
    const poll = JSON.parse(event.data) as Poll;
    onUpdate(poll);
  });

  return () => eventSource.close();
}
```

**`App.tsx`**:
```typescript
useEffect(() => {
  const unsubscribe = pollApi.subscribeToPollUpdates((updatedPoll) => {
    // Update selected poll if it matches
    if (selectedPoll?.id === updatedPoll.id) {
      setSelectedPoll(updatedPoll);
    }
    // Refresh poll list
    setRefreshTrigger((prev) => prev + 1);
  });

  return () => unsubscribe();
}, [selectedPoll]);
```

## Testing Real-Time Sync

1. **Open two browser tabs** at `http://localhost:3000`
2. **In Tab 1**: Navigate to a poll and vote for a restaurant
3. **In Tab 2**: Watch the vote count update automatically in real-time!

## Benefits

✅ **Instant Updates** - See changes immediately without refreshing
✅ **Multi-User Support** - Multiple users can vote simultaneously
✅ **Cross-Tab Sync** - All tabs stay synchronized
✅ **Scalable** - Actor-based backend handles many concurrent connections
✅ **Efficient** - SSE uses HTTP/1.1 with persistent connections

## Architecture

```
┌─────────────┐         ┌─────────────┐
│   Tab 1     │         │   Tab 2     │
│  (Browser)  │         │  (Browser)  │
└──────┬──────┘         └──────┬──────┘
       │                       │
       │ SSE Connection        │ SSE Connection
       │                       │
       └───────────┬───────────┘
                   │
            ┌──────▼──────┐
            │   Backend   │
            │  Pekko HTTP │
            │   /updates  │
            └──────┬──────┘
                   │
            ┌──────▼──────┐
            │ PollManager │
            │   Actor     │
            │  (Pekko)    │
            └──────┬──────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐         ┌────▼────┐
    │  Poll   │         │  Poll   │
    │ Actor 1 │         │ Actor 2 │
    └─────────┘         └─────────┘
```

## API Endpoint

**SSE Endpoint**: `GET /api/polls/updates`

**Event Type**: `poll-update`

**Event Data**: JSON-serialized `PollResponse` object

**Heartbeat**: Every 15 seconds

## Connection Management

- Connections automatically reconnect on failure
- Heartbeat messages keep connections alive
- Cleanup on component unmount prevents memory leaks
