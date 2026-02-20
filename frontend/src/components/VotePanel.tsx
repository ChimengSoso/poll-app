import React, { useState, useMemo } from 'react';
import { Card, Button, Space, message, Progress, Tag, Alert, Popconfirm } from 'antd';
import { ReloadOutlined, EditOutlined } from '@ant-design/icons';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { pollApi } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { EditPollModal } from './EditPollModal';
import type { Poll, Restaurant } from '../types';

interface VotePanelProps {
  poll: Poll;
  onVoteSuccess: (updatedPoll: Poll) => void;
}

export const VotePanel: React.FC<VotePanelProps> = ({ poll, onVoteSuccess }) => {
  const [voting, setVoting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const { username } = useUser();

  const handleVote = async (restaurantId: string) => {
    if (!username) {
      message.error('You must be logged in to vote');
      return;
    }

    try {
      setVoting(true);
      const updatedPoll = await pollApi.vote(poll.id, restaurantId, username);
      message.success('Vote recorded!');
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to vote');
    } finally {
      setVoting(false);
    }
  };

  const handleResetVotes = async () => {
    try {
      setResetting(true);
      const updatedPoll = await pollApi.resetVotes(poll.id);
      message.success('All votes have been reset!');
      onVoteSuccess(updatedPoll);
    } catch (error: any) {
      message.error('Failed to reset votes');
    } finally {
      setResetting(false);
    }
  };

  const hasUserVoted = username ? poll.voters.includes(username) : false;
  const isSingleVoteMode = poll.votingMode === 'single';

  const calculatePercentage = (votes: number): number => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((votes / poll.totalVotes) * 100);
  };

  const getWinners = (): Restaurant[] => {
    if (poll.restaurants.length === 0) return [];
    const maxVotes = Math.max(...poll.restaurants.map(r => r.votes));
    if (maxVotes === 0) return [];
    return poll.restaurants.filter(r => r.votes === maxVotes);
  };

  const winners = getWinners();

  const columnDefs: ColDef<Restaurant>[] = useMemo(
    () => [
      {
        headerName: 'Restaurant',
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
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          );
        },
      },
      {
        headerName: 'Action',
        flex: 2,
        cellRenderer: (params: any) => {
          const restaurant = params.data;
          const userVotedForThis = username ? restaurant.voters.includes(username) : false;
          const canVote = isSingleVoteMode ? !hasUserVoted : !userVotedForThis;

          return (
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={() => handleVote(restaurant.id)}
                loading={voting}
                disabled={!poll.active || !canVote}
              >
                {userVotedForThis ? 'Voted ✓' : 'Vote'}
              </Button>
              {userVotedForThis && (
                <Tag color="green">You voted</Tag>
              )}
            </Space>
          );
        },
      },
    ],
    [voting, poll, username, hasUserVoted, isSingleVoteMode]
  );

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{poll.title}</span>
          <span style={{ fontSize: '14px', color: '#888' }}>
            Total Votes: {poll.totalVotes} | Mode: {poll.votingMode === 'single' ? 'Single Vote' : 'Multiple Votes'} | Created by: {poll.createdBy}
          </span>
        </Space>
      }
      extra={
        <Space>
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
      {isSingleVoteMode && hasUserVoted && (
        <Alert
          message="Single Vote Mode"
          description="You have already cast your vote. You cannot vote again or change your vote."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {!isSingleVoteMode && (
        <Alert
          message="Multiple Vote Mode"
          description="You can vote for multiple restaurants. Click 'Vote' on each restaurant you like!"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={poll.restaurants}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
          }}
        />
      </div>

      <EditPollModal
        poll={poll}
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSuccess={onVoteSuccess}
      />
    </Card>
  );
};
