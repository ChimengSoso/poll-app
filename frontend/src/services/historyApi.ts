import type { PollHistory } from '../types';

const API_BASE_URL = '/api';

let authToken: string | null = null;
export const setHistoryAuthToken = (token: string | null) => { authToken = token; };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let msg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.message) msg = body.message;
    } catch {}
    throw new Error(msg);
  }
  return response.json() as Promise<T>;
}

export const historyApi = {
  getHistory: (pollId: string): Promise<PollHistory> =>
    request<PollHistory>(`/polls/${pollId}/history`),

  importHistory: (pollId: string, data: PollHistory): Promise<PollHistory> =>
    request<PollHistory>(`/polls/${pollId}/history/import`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  downloadHistory: async (pollId: string, pollTitle: string): Promise<void> => {
    const history = await request<PollHistory>(`/polls/${pollId}/history`);
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pollTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-history.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
