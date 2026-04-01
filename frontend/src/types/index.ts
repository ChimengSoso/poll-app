export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  votes: number;
  voters: string[];
}

export interface Poll {
  id: string;
  title: string;
  restaurants: Restaurant[];
  totalVotes: number;
  active: boolean;
  votingMode: 'single' | 'multiple';
  createdBy: string;
  voters: string[];
  deleted?: boolean;
  dailyReset: boolean;
  titleTemplate?: string | null;
}

export interface CreatePollRequest {
  title: string;
  restaurants: RestaurantInput[];
  votingMode: string;
  createdBy: string;
  dailyReset: boolean;
  titleTemplate: string | null;
}

export interface RestaurantInput {
  name: string;
  description?: string;
}

export interface VoteRequest {
  restaurantId: string;
  username: string;
}

export interface RemoveVoteRequest {
  restaurantId: string;
  username: string;
}

export interface EditPollRequest {
  title: string;
  restaurants: RestaurantInput[];
  dailyReset: boolean;
  titleTemplate: string | null;
}

export interface ErrorResponse {
  message: string;
}

export interface PollTemplate {
  fileName: string;
  pollId: string;
  title: string;
  savedAt: number;
}
