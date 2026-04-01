import type { Poll, CreatePollRequest, VoteRequest, PollTemplate, EditPollRequest } from '../types';

const API_BASE_URL = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  vote: (pollId: string, restaurantId: string, username: string): Promise<Poll> => {
    const voteRequest: VoteRequest = { restaurantId, username };
    return request<Poll>(`/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify(voteRequest) });
  },

  resetVotes: (pollId: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/reset`, { method: 'POST' }),

  editPoll: (pollId: string, body: EditPollRequest): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}`, { method: 'PUT', body: JSON.stringify(body) }),

  getResults: (pollId: string): Promise<Poll> =>
    request<Poll>(`/polls/${pollId}/results`),

  deletePoll: (pollId: string): Promise<void> =>
    request<void>(`/polls/${pollId}`, { method: 'DELETE' }),
};

export const templateApi = {
  getAllTemplates: (): Promise<PollTemplate[]> =>
    request<PollTemplate[]>('/templates'),

  recoverTemplate: (fileName: string): Promise<Poll> =>
    request<Poll>(`/templates/${fileName}/recover`, { method: 'POST' }),

  deleteTemplate: (fileName: string): Promise<void> =>
    request<void>(`/templates/${fileName}`, { method: 'DELETE' }),
};
