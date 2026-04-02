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
  requireApproval: boolean;
  approvedVoters: string[];
  pendingVoters: string[];
  anonymousVoting: boolean;
}

export interface CreatePollRequest {
  title: string;
  choices: ChoiceInput[];
  votingMode: string;
  dailyReset: boolean;
  titleTemplate: string | null;
  requireApproval: boolean;
  anonymousVoting: boolean;
}

export interface ChoiceInput {
  name: string;
  description?: string;
}

// username comes from JWT — body only carries choiceId
export interface VoteRequest {
  choiceId: string;
}

export interface RemoveVoteRequest {
  choiceId: string;
}

export interface EditPollRequest {
  title: string;
  choices: ChoiceInput[];
  dailyReset: boolean;
  titleTemplate: string | null;
  requireApproval: boolean;
  anonymousVoting: boolean;
}

export interface VoterActionRequest {
  username: string;
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

export interface ChoiceSummary {
  name: string;
  votes: number;
  voters: string[];
}

export interface SnapshotSummary {
  title: string;
  totalVotes: number;
  votingMode: string;
  anonymousVoting: boolean;
  choices: ChoiceSummary[];
  winner?: string;
}

export interface PollSnapshot {
  snapshotId: string;
  timestamp: number;
  event: string;
  closedBy: string;
  summary: SnapshotSummary;
}

export interface PollHistory {
  version: string;
  pollId: string;
  pollTitle: string;
  snapshots: PollSnapshot[];
}

export interface ResetStatusResponse {
  requestId: string;
  username: string;
  votes: number;
  threshold: number;
  status: 'pending' | 'approved' | 'expired';
  expiresAt: number;
}
