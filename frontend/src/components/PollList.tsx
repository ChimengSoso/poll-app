import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Card, Button, Space, Modal, message } from 'antd';
import { DeleteOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { ColDef } from 'ag-grid-community';
import { pollApi } from '../services/api';
import { pollUpdateService } from '../services/pollUpdateService';
import { EditPollModal } from './EditPollModal';
import type { Poll, Restaurant } from '../types';

interface PollListProps {
  refreshTrigger: number;
  onPollSelect: (poll: Poll) => void;
}

export const PollList: React.FC<PollListProps> = ({ refreshTrigger, onPollSelect }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);

  const loadPolls = async () => {
    try {
      setLoading(true);
      const data = await pollApi.getAllPolls();
      setPolls(data);
    } catch (error: any) {
      message.error('Failed to load polls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, [refreshTrigger]);

  // Update polls in-place when we receive an updated poll
  const updatePollInList = (updatedPoll: Poll) => {
    setPolls((currentPolls) => {
      // If poll is deleted, remove it from the list
      if (updatedPoll.deleted) {
        console.log('[PollList] Removing deleted poll:', updatedPoll.id);
        return currentPolls.filter(p => p.id !== updatedPoll.id);
      }

      const index = currentPolls.findIndex(p => p.id === updatedPoll.id);
      if (index !== -1) {
        // Update existing poll
        const newPolls = [...currentPolls];
        newPolls[index] = updatedPoll;
        return newPolls;
      } else {
        // Add new poll to the list
        console.log('[PollList] Adding new poll:', updatedPoll.id);
        return [updatedPoll, ...currentPolls];
      }
    });
  };

  // Subscribe to SSE updates
  useEffect(() => {
    const unsubscribe = pollUpdateService.subscribe((updatedPoll) => {
      console.log('[PollList] Received update for poll:', updatedPoll.id);
      updatePollInList(updatedPoll);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleEdit = (poll: Poll) => {
    setSelectedPoll(poll);
    setEditModalVisible(true);
  };

  const handleEditSuccess = (updatedPoll: Poll) => {
    updatePollInList(updatedPoll);
    setEditModalVisible(false);
    setSelectedPoll(null);
  };

  const handleDelete = async (pollId: string) => {
    Modal.confirm({
      title: 'Delete Poll',
      content: 'Are you sure you want to delete this poll?',
      onOk: async () => {
        try {
          await pollApi.deletePoll(pollId);
          message.success('Poll deleted successfully');
          loadPolls();
        } catch (error: any) {
          message.error('Failed to delete poll');
        }
      },
    });
  };

  const columnDefs: ColDef<Poll>[] = useMemo(
    () => [
      {
        headerName: 'Title',
        field: 'title',
        flex: 2,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Restaurants',
        field: 'restaurants',
        flex: 1,
        valueGetter: (params) => params.data?.restaurants.length || 0,
      },
      {
        headerName: 'Total Votes',
        field: 'totalVotes',
        flex: 1,
        sortable: true,
      },
      {
        headerName: 'Status',
        field: 'active',
        flex: 1,
        valueGetter: (params) => (params.data?.active ? 'Active' : 'Closed'),
      },
      {
        headerName: 'Actions',
        flex: 2,
        cellRenderer: (params: any) => (
          <Space>
            <Button
              type="primary"
              size="small"
              onClick={() => onPollSelect(params.data)}
            >
              View/Vote
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(params.data)}
            >
              Edit
            </Button>
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(params.data.id)}
            />
          </Space>
        ),
      },
    ],
    [onPollSelect]
  );

  return (
    <Card
      title="Polls"
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadPolls} loading={loading}>
          Refresh
        </Button>
      }
      style={{ marginBottom: 24 }}
    >
      <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={polls}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
          }}
        />
      </div>

      <EditPollModal
        poll={selectedPoll}
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedPoll(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </Card>
  );
};
