import type { Poll } from '../types';

type PollUpdateListener = (poll: Poll) => void;

class PollUpdateService {
  private eventSource: EventSource | null = null;
  private listeners: Set<PollUpdateListener> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  connect() {
    if (this.eventSource) {
      return; // Already connected
    }

    console.log('[SSE] Connecting to poll updates...');
    this.eventSource = new EventSource('/api/polls/updates');

    this.eventSource.addEventListener('poll-update', (event: MessageEvent) => {
      try {
        const poll = JSON.parse(event.data) as Poll;
        console.log('[SSE] Received poll update:', poll.id, 'Total votes:', poll.totalVotes);

        // Notify all listeners
        this.listeners.forEach((listener) => {
          try {
            listener(poll);
          } catch (error) {
            console.error('[SSE] Error in listener:', error);
          }
        });
      } catch (error) {
        console.error('[SSE] Failed to parse poll update:', error);
      }
    });

    this.eventSource.onopen = () => {
      console.log('[SSE] Connection established');
    };

    this.eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      this.disconnect();

      // Reconnect after 3 seconds
      this.reconnectTimeout = setTimeout(() => {
        console.log('[SSE] Attempting to reconnect...');
        this.connect();
      }, 3000);
    };
  }

  disconnect() {
    if (this.eventSource) {
      console.log('[SSE] Disconnecting...');
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  subscribe(listener: PollUpdateListener): () => void {
    this.listeners.add(listener);

    // Connect when first subscriber arrives
    if (this.listeners.size === 1) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);

      // Disconnect when last subscriber leaves
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }
}

// Export singleton instance
export const pollUpdateService = new PollUpdateService();
