import type { Poll, CreatePollRequest, VoteRequest, RemoveVoteRequest, PollTemplate, EditPollRequest, VoterActionRequest } from '../types';
import { setHistoryAuthToken } from './historyApi';

const API_BASE_URL = '/api';

let authToken: string | null = null;
export const setAuthToken = (token: string | null) => {
  authToken = token;
  setHistoryAuthToken(token);
};

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
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const pollApi = {
  getAllPolls: (): Promise<Poll[]> =>
    request<Poll[]>('/polls'),

  getPoll: (pollId: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}`),

  createPoll: (body: CreatePollRequest): Promise<Poll> =>
    request<Poll>('/polls', { method: 'POST', body: JSON.stringify(body) }),

  vote: (pollId: string, choiceId: string): Promise<Poll> => {
    const voteRequest: VoteRequest = { choiceId };
    return request<Poll>(`/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify(voteRequest) });
  },

  removeVote: (pollId: string, choiceId: string): Promise<Poll> => {
    const removeRequest: RemoveVoteRequest = { choiceId };
    return request<Poll>(`/polls/${pollId}/vote`, { method: 'DELETE', body: JSON.stringify(removeRequest) });
  },

  resetVotes: (pollId: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/reset`, { method: 'POST' }),

  editPoll: (pollId: string, body: EditPollRequest): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}`, { method: 'PUT', body: JSON.stringify(body) }),

  getResults: (pollId: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/results`),

  deletePoll: (pollId: string): Promise<void> =>
    request<void>(`/polls/${pollId}`, { method: 'DELETE' }),

  requestToVote: (pollId: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/request-vote`, { method: 'POST' }),

  approveVoter: (pollId: string, username: string): Promise<Poll> => {
    const body: VoterActionRequest = { username };
    return request<Poll>(`/polls/${pollId}/approve-voter`, { method: 'POST', body: JSON.stringify(body) });
  },

  rejectVoter: (pollId: string, username: string): Promise<Poll> => {
    const body: VoterActionRequest = { username };
    return request<Poll>(`/polls/${pollId}/reject-voter`, { method: 'POST', body: JSON.stringify(body) });
  },

  revokeVoter: (pollId: string, username: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/voters/${encodeURIComponent(username)}`, { method: 'DELETE' }),

  closePoll: (pollId: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/close`, { method: 'POST' }),

  reopenPoll: (pollId: string, password: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/reopen`, { method: 'POST', body: JSON.stringify({ password }) }),

  forceReset: (pollId: string, password: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/force-reset`, { method: 'POST', body: JSON.stringify({ password }) }),
};

export const templateApi = {
  getAllTemplates: (): Promise<PollTemplate[]> =>
    request<PollTemplate[]>('/templates'),

  recoverTemplate: (fileName: string): Promise<Poll> =>
    request<Poll>(`/templates/${fileName}/recover`, { method: 'POST' }),

  deleteTemplate: (fileName: string): Promise<void> =>
    request<void>(`/templates/${fileName}`, { method: 'DELETE' }),
};
