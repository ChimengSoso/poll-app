export interface Choice {
  id: string;
  name: string;
  description?: string;
  votes: number;
  voters: string[];
}

export interface Poll {
  id: string;
  title: string;
  choices: Choice[];
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
  choices: ChoiceInput[];
  votingMode: string;
  createdBy: string;
  dailyReset: boolean;
  titleTemplate: string | null;
}

export interface ChoiceInput {
  name: string;
  description?: string;
}

export interface VoteRequest {
  choiceId: string;
  username: string;
}

export interface RemoveVoteRequest {
  choiceId: string;
  username: string;
}

export interface EditPollRequest {
  title: string;
  choices: ChoiceInput[];
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
