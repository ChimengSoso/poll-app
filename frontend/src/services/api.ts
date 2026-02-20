import axios from 'axios';
import type { Poll, CreatePollRequest, VoteRequest, PollTemplate, EditPollRequest } from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const pollApi = {
  // Get all polls
  getAllPolls: async (): Promise<Poll[]> => {
    const response = await api.get<Poll[]>('/polls');
    return response.data;
  },

  // Get a specific poll
  getPoll: async (pollId: string): Promise<Poll> => {
    const response = await api.get<Poll>(`/polls/${pollId}`);
    return response.data;
  },

  // Create a new poll
  createPoll: async (request: CreatePollRequest): Promise<Poll> => {
    const response = await api.post<Poll>('/polls', request);
    return response.data;
  },

  // Vote for a restaurant
  vote: async (pollId: string, restaurantId: string, username: string): Promise<Poll> => {
    const voteRequest: VoteRequest = { restaurantId, username };
    const response = await api.post<Poll>(`/polls/${pollId}/vote`, voteRequest);
    return response.data;
  },

  // Reset all votes in a poll
  resetVotes: async (pollId: string): Promise<Poll> => {
    const response = await api.post<Poll>(`/polls/${pollId}/reset`);
    return response.data;
  },

  // Edit poll
  editPoll: async (pollId: string, request: EditPollRequest): Promise<Poll> => {
    const response = await api.put<Poll>(`/polls/${pollId}`, request);
    return response.data;
  },

  // Get poll results
  getResults: async (pollId: string): Promise<Poll> => {
    const response = await api.get<Poll>(`/polls/${pollId}/results`);
    return response.data;
  },

  // Delete a poll
  deletePoll: async (pollId: string): Promise<void> => {
    await api.delete(`/polls/${pollId}`);
  },
};

export const templateApi = {
  // Get all templates
  getAllTemplates: async (): Promise<PollTemplate[]> => {
    const response = await api.get<PollTemplate[]>('/templates');
    return response.data;
  },

  // Recover poll from template
  recoverTemplate: async (fileName: string): Promise<Poll> => {
    const response = await api.post<Poll>(`/templates/${fileName}/recover`);
    return response.data;
  },

  // Delete template
  deleteTemplate: async (fileName: string): Promise<void> => {
    await api.delete(`/templates/${fileName}`);
  },
};

export default api;
