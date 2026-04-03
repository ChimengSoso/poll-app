import type { ResetStatusResponse, DeleteHistoryStatus } from '../types';

const API_BASE = '/api/auth';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('openpoll-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
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

export const authApi = {
  checkUser: (username: string): Promise<{ exists: boolean }> =>
    request('/check', { method: 'POST', body: JSON.stringify({ username }) }),

  register: (username: string, password: string): Promise<{ token: string; username: string }> =>
    request('/register', { method: 'POST', body: JSON.stringify({ username, password }) }),

  login: (username: string, password: string): Promise<{ token: string; username: string }> =>
    request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  forgotPassword: (username: string, newPassword: string): Promise<{ requestId: string; expiresAt: number }> =>
    request('/forgot-password', { method: 'POST', body: JSON.stringify({ username, newPassword }) }),

  getResetStatus: (requestId: string): Promise<ResetStatusResponse> =>
    request(`/reset-status/${requestId}`),

  voteReset: (requestId: string): Promise<ResetStatusResponse> =>
    request(`/reset-votes/${requestId}`, { method: 'POST' }),

  getPendingResets: (): Promise<ResetStatusResponse[]> =>
    request('/pending-resets'),

  cancelResetRequest: (requestId: string): Promise<void> =>
    request(`/reset-request/${requestId}`, { method: 'DELETE' }),

  getDeleteHistoryRequests: (): Promise<DeleteHistoryStatus[]> =>
    request('/history-delete'),

  voteDeleteHistory: (pollId: string, snapshotId: string): Promise<DeleteHistoryStatus> =>
    request('/history-delete', { method: 'POST', body: JSON.stringify({ pollId, snapshotId }) }),

  unvoteDeleteHistory: (requestId: string): Promise<DeleteHistoryStatus> =>
    request(`/history-delete/${requestId}/vote`, { method: 'DELETE' }),

  approveDeleteHistory: (requestId: string): Promise<void> =>
    request(`/history-delete/${requestId}/approve`, { method: 'POST' }),

  rejectDeleteHistory: (requestId: string): Promise<void> =>
    request(`/history-delete/${requestId}/reject`, { method: 'POST' }),
};
