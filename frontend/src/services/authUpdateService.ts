import type { ResetStatusResponse, DeleteHistoryStatus } from '../types';

export type ResetEvent =
  | { type: 'reset-update'; data: ResetStatusResponse }
  | { type: 'reset-approved'; data: { requestId: string; username: string } }
  | { type: 'reset-cancelled'; data: { requestId: string; username: string } }
  | { type: 'history-delete-update'; data: DeleteHistoryStatus }
  | { type: 'history-delete-done'; data: { requestId: string; pollId: string; snapshotId: string } }
  | { type: 'history-delete-rejected'; data: { requestId: string; snapshotId: string } };

type ResetListener = (event: ResetEvent) => void;

class AuthUpdateService {
  private eventSource: EventSource | null = null;
  private listeners: Set<ResetListener> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  connect() {
    if (this.eventSource) return;

    console.log('[Auth SSE] Connecting to reset updates...');
    this.eventSource = new EventSource('/api/auth/updates');

    this.eventSource.addEventListener('reset-update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as ResetStatusResponse;
        this.notify({ type: 'reset-update', data });
      } catch (error) {
        console.error('[Auth SSE] Failed to parse reset-update:', error);
      }
    });

    this.eventSource.addEventListener('reset-approved', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { requestId: string; username: string };
        this.notify({ type: 'reset-approved', data });
      } catch (error) {
        console.error('[Auth SSE] Failed to parse reset-approved:', error);
      }
    });

    this.eventSource.addEventListener('reset-cancelled', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { requestId: string; username: string };
        this.notify({ type: 'reset-cancelled', data });
      } catch (error) {
        console.error('[Auth SSE] Failed to parse reset-cancelled:', error);
      }
    });

    this.eventSource.addEventListener('history-delete-update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as DeleteHistoryStatus;
        this.notify({ type: 'history-delete-update', data });
      } catch (error) {
        console.error('[Auth SSE] Failed to parse history-delete-update:', error);
      }
    });

    this.eventSource.addEventListener('history-delete-done', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { requestId: string; pollId: string; snapshotId: string };
        this.notify({ type: 'history-delete-done', data });
      } catch (error) {
        console.error('[Auth SSE] Failed to parse history-delete-done:', error);
      }
    });

    this.eventSource.addEventListener('history-delete-rejected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { requestId: string; snapshotId: string };
        this.notify({ type: 'history-delete-rejected', data });
      } catch (error) {
        console.error('[Auth SSE] Failed to parse history-delete-rejected:', error);
      }
    });

    this.eventSource.onopen = () => console.log('[Auth SSE] Connection established');

    this.eventSource.onerror = () => {
      this.disconnect();
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private notify(event: ResetEvent) {
    this.listeners.forEach((listener) => {
      try { listener(event); } catch (error) { console.error('[Auth SSE] Listener error:', error); }
    });
  }

  subscribe(listener: ResetListener): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.disconnect();
    };
  }
}

export const authUpdateService = new AuthUpdateService();
