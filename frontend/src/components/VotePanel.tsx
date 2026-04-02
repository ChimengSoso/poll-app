import React, { useState, useMemo } from 'react';
import { Card, Button, Space, message, Progress, Tag, Alert, Popconfirm, List, Typography } from 'antd';
import { ReloadOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { pollApi } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { EditPollModal } from './EditPollModal';
import type { Poll, Choice } from '../types';

interface VotePanelProps {
  poll: Poll;
  onVoteSuccess: (updatedPoll: Poll) => void;
}

export const VotePanel: React.FC<VotePanelProps> = ({ poll, onVoteSuccess }) => {
  const [voting, setVoting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const { username } = useUser();

  const isApprovalRequired = poll.requireApproval;
  const isApproved = username ? (poll.approvedVoters.includes(username) || username === poll.createdBy) : false;
  const isPending = username ? poll.pendingVoters.includes(username) : false;
  const isOwner = username === poll.createdBy;

  const handleVote = async (choiceId: string) => {
    if (!username) {
      message.error('You must be logged in to vote');
      return;
    }
    try {
      setVoting(true);
      const updatedPoll = await pollApi.vote(poll.id, choiceId);
      message.success('Vote recorded!');
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error(error.message || 'Failed to vote');
    } finally {
      setVoting(false);
    }
  };

  const handleRemoveVote = async (choiceId: string) => {
    if (!username) return;
    try {
      setRemoving(true);
      const updatedPoll = await pollApi.removeVote(poll.id, choiceId);
      message.success('Vote removed');
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error(error.message || 'Failed to remove vote');
    } finally {
      setRemoving(false);
    }
  };

  const handleResetVotes = async () => {
    try {
      setResetting(true);
      const updatedPoll = await pollApi.resetVotes(poll.id);
      message.success('All votes have been reset!');
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error(error.message || 'Failed to reset votes');
    } finally {
      setResetting(false);
    }
  };

  const handleRequestToVote = async () => {
    if (!username) return;
    try {
      setRequesting(true);
      const updatedPoll = await pollApi.requestToVote(poll.id);
      message.success('Request sent! Waiting for owner approval.');
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error(error.message || 'Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  const handleApproveVoter = async (voter: string) => {
    try {
      const updatedPoll = await pollApi.approveVoter(poll.id, voter);
      message.success(`${voter} approved`);
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error(error.message || 'Failed to approve voter');
    }
  };

  const handleRejectVoter = async (voter: string) => {
    try {
      const updatedPoll = await pollApi.rejectVoter(poll.id, voter);
      message.success(`${voter} rejected`);
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error(error.message || 'Failed to reject voter');
    }
  };

  const handleRevokeVoter = async (voter: string) => {
    try {
      const updatedPoll = await pollApi.revokeVoter(poll.id, voter);
      message.success(`${voter} revoked`);
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error(error.message || 'Failed to revoke voter');
    }
  };

  const hasUserVoted = username ? poll.voters.includes(username) : false;
  const isSingleVoteMode = poll.votingMode === 'single';

  const calculatePercentage = (votes: number): number => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((votes / poll.totalVotes) * 100);
  };

  const getWinners = (): Choice[] => {
    if (poll.choices.length === 0) return [];
    const maxVotes = Math.max(...poll.choices.map(r => r.votes));
    if (maxVotes === 0) return [];
    return poll.choices.filter(r => r.votes === maxVotes);
  };

  const winners = getWinners();

  const columnDefs: ColDef<Choice>[] = useMemo(
    () => [
      {
        headerName: 'Choice',
        field: 'name',
        flex: 2,
        sortable: true,
      },
      {
        headerName: 'Description',
        field: 'description',
        flex: 2,
        valueGetter: (params) => params.data?.description || '-',
      },
      {
        headerName: 'Votes',
        field: 'votes',
        flex: 1,
        sortable: true,
        sort: 'desc',
      },
      {
        headerName: 'Percentage',
        flex: 2,
        cellRenderer: (params: any) => {
          const percentage = calculatePercentage(params.data?.votes || 0);
          return (
            <Progress
              percent={percentage}
              size="small"
              status="active"
              strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
            />
          );
        },
      },
      {
        headerName: 'Action',
        flex: 2,
        cellRenderer: (params: any) => {
          const choice = params.data;

          if (isApprovalRequired && !isApproved) {
            return <Tag color="red">Not allowed to vote</Tag>;
          }

          const userVotedForThis = username ? choice.voters.includes(username) : false;
          const canVote = isSingleVoteMode ? !hasUserVoted : !userVotedForThis;

          return (
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={() => handleVote(choice.id)}
                loading={voting}
                disabled={!poll.active || !canVote}
              >
                {userVotedForThis ? 'Voted ✓' : 'Vote'}
              </Button>
              {userVotedForThis && poll.active && (
                <Popconfirm
                  title="Remove your vote?"
                  onConfirm={() => handleRemoveVote(choice.id)}
                  okText="Remove"
                  cancelText="Cancel"
                >
                  <Button size="small" danger loading={removing}>
                    Remove
                  </Button>
                </Popconfirm>
              )}
              {userVotedForThis && (
                <Tag color="green">You voted</Tag>
              )}
            </Space>
          );
        },
      },
    ],
    [voting, removing, poll, username, hasUserVoted, isSingleVoteMode, isApprovalRequired, isApproved]
  );

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{poll.title}</span>
          <span style={{ fontSize: '14px', color: '#888' }}>
            Total Votes: {poll.totalVotes} | Mode: {poll.votingMode === 'single' ? 'Single Vote' : 'Multiple Votes'} | Created by: {poll.createdBy}
            {poll.dailyReset && ' | Auto-resets daily'}
            {poll.requireApproval && ' | Approval required'}
            {poll.anonymousVoting && ' | Anonymous voting'}
          </span>
        </Space>
      }
      extra={
        <Space>
          {isApprovalRequired && !isApproved && !isOwner && (
            isPending ? (
              <Tag color="orange">Pending approval</Tag>
            ) : (
              <Button
                type="primary"
                onClick={handleRequestToVote}
                loading={requesting}
                disabled={!poll.active}
              >
                Request to vote
              </Button>
            )
          )}
          {isOwner && (
            <>
              <Button
                icon={<EditOutlined />}
                onClick={() => setEditModalVisible(true)}
              >
                Edit Poll
              </Button>
              <Popconfirm
                title="Reset all votes?"
                description="This will reset all votes and everyone can vote again. Are you sure?"
                onConfirm={handleResetVotes}
                okText="Yes, reset"
                cancelText="Cancel"
              >
                <Button
                  danger
                  icon={<ReloadOutlined />}
                  loading={resetting}
                >
                  Reset Votes
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      }
    >
      {winners.length > 0 && (
        <Alert
          message={
            winners.length === 1
              ? `🏆 Winner: ${winners[0].name}`
              : `🏆 Winners: ${winners.map(w => w.name).join(', ')}`
          }
          description={
            winners.length === 1
              ? `${winners[0].name} is leading with ${winners[0].votes} vote${winners[0].votes !== 1 ? 's' : ''}!`
              : `Tied with ${winners[0].votes} vote${winners[0].votes !== 1 ? 's' : ''} each!`
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {isApprovalRequired && !isApproved && isPending && (
        <Alert
          message="Pending Approval"
          description="Your request to vote is pending owner approval."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {isApprovalRequired && !isApproved && !isPending && !isOwner && (
        <Alert
          message="Approval Required"
          description="This poll requires approval to vote. Click 'Request to vote' in the top-right corner."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {isSingleVoteMode && hasUserVoted && (!isApprovalRequired || isApproved) && (
        <Alert
          message="Single Vote Mode"
          description="You have already cast your vote. You cannot vote again or change your vote."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {!isSingleVoteMode && (!isApprovalRequired || isApproved) && (
        <Alert
          message="Multiple Vote Mode"
          description="You can vote for multiple choices. Click 'Vote' on each choice you like!"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={poll.choices}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true }}
        />
      </div>

      {isOwner && isApprovalRequired && (
        <div style={{ marginTop: 24 }}>
          {poll.pendingVoters.length > 0 && (
            <Card
              size="small"
              title={<Typography.Text strong>Pending Requests ({poll.pendingVoters.length})</Typography.Text>}
              style={{ marginBottom: 16 }}
            >
              <List
                size="small"
                dataSource={poll.pendingVoters}
                renderItem={(voter) => (
                  <List.Item
                    actions={[
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => handleApproveVoter(voter)}
                      >
                        Approve
                      </Button>,
                      <Button
                        size="small"
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => handleRejectVoter(voter)}
                      >
                        Reject
                      </Button>,
                    ]}
                  >
                    {voter}
                  </List.Item>
                )}
              />
            </Card>
          )}
          {poll.approvedVoters.length > 0 && (
            <Card
              size="small"
              title={<Typography.Text strong>Approved Voters ({poll.approvedVoters.length})</Typography.Text>}
            >
              <List
                size="small"
                dataSource={poll.approvedVoters}
                renderItem={(voter) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        title={`Revoke ${voter}'s access?`}
                        onConfirm={() => handleRevokeVoter(voter)}
                        okText="Revoke"
                        cancelText="Cancel"
                      >
                        <Button size="small" danger>
                          Revoke
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    {voter}
                  </List.Item>
                )}
              />
            </Card>
          )}
        </div>
      )}

      <EditPollModal
        poll={poll}
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSuccess={onVoteSuccess}
      />
    </Card>
  );
};
