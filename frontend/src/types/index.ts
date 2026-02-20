export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  votes: number;
  voters: string[];  // List of usernames who voted for this restaurant
}

export interface Poll {
  id: string;
  title: string;
  restaurants: Restaurant[];
  totalVotes: number;
  active: boolean;
  votingMode: 'single' | 'multiple';  // Voting mode
  createdBy: string;  // Username of poll creator
  voters: string[];  // All users who have voted in this poll
  deleted?: boolean;  // Whether the poll has been deleted
}

export interface CreatePollRequest {
  title: string;
  restaurants: RestaurantInput[];
  votingMode: string;  // "single" or "multiple"
  createdBy: string;  // Username of creator
}

export interface RestaurantInput {
  name: string;
  description?: string;
}

export interface VoteRequest {
  restaurantId: string;
  username: string;  // Username of voter
}

export interface EditPollRequest {
  title: string;
  restaurants: RestaurantInput[];
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
