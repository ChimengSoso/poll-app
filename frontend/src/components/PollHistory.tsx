import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Table, Tag, Typography, Empty, message, Progress, Modal } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { historyApi } from '../services/historyApi';
import { useUser } from '../contexts/UserContext';
import type { Poll, PollHistory as PollHistoryType, PollSnapshot, ChoiceSummary } from '../types';

const { Text } = Typography;

interface PollHistoryProps {
  poll: Poll;
  onHistoryCount: (count: number) => void;
}

export const PollHistory: React.FC<PollHistoryProps> = ({ poll, onHistoryCount }) => {
  const { username } = useUser();
  const [history, setHistory] = useState<PollHistoryType | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOwner = username === poll.createdBy;

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await historyApi.getHistory(poll.id);
      setHistory(data);
      onHistoryCount(data.snapshots.length);
    } catch (error: any) {
      message.error(error.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await historyApi.getHistory(poll.id);
        if (!cancelled) {
          setHistory(data);
          onHistoryCount(data.snapshots.length);
        }
      } catch (error: any) {
        if (!cancelled) message.error(error.message || 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [poll.id, poll.active]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await historyApi.downloadHistory(poll.id, poll.title);
      message.success('History exported!');
    } catch (error: any) {
      message.error(error.message || 'Failed to export history');
    } finally {
      setExporting(false);
    }
  };

  const doImport = async (data: any) => {
    try {
      const merged = await historyApi.importHistory(poll.id, data);
      setHistory(merged);
      onHistoryCount(merged.snapshots.length);
      message.success(`Imported successfully — ${merged.snapshots.length} snapshot(s) total`);
    } catch (error: any) {
      message.error(error.message || 'Failed to import history');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.pollTitle && data.pollTitle !== poll.title) {
          Modal.confirm({
            title: 'Different Poll Title',
            content: `You are importing history from "${data.pollTitle}" into "${poll.title}". The titles don't match. Continue anyway?`,
            okText: 'Import Anyway',
            cancelText: 'Cancel',
            onOk: () => doImport(data),
          });
        } else {
          await doImport(data);
        }
      } catch (error: any) {
        message.error(error.message || 'Failed to import history');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString();

  const snapshotColumns = (snapshot: PollSnapshot) => {
    const showVoters = !snapshot.summary.anonymousVoting || isOwner;
    const maxVotes = Math.max(...snapshot.summary.choices.map(c => c.votes), 0);
    return [
      {
        title: 'Choice',
        dataIndex: 'name',
        key: 'name',
        render: (name: string) => {
          const isWinner = snapshot.summary.winner === name;
          return isWinner ? <Text strong>{name} 🏆</Text> : name;
        },
      },
      {
        title: 'Votes',
        dataIndex: 'votes',
        key: 'votes',
        width: 80,
      },
      {
        title: 'Share',
        key: 'share',
        width: 140,
        render: (_: any, record: ChoiceSummary) => {
          const pct = snapshot.summary.totalVotes === 0 ? 0 : Math.round((record.votes / snapshot.summary.totalVotes) * 100);
          return <Progress percent={pct} size="small" strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} />;
        },
      },
      {
        title: 'Voted by',
        key: 'voters',
        render: (_: any, record: ChoiceSummary) => {
          if (record.votes === 0) return <Text type="secondary">—</Text>;
          if (!showVoters) return <Text type="secondary">{record.votes} anonymous vote{record.votes !== 1 ? 's' : ''}</Text>;
          return record.voters.map(v => <Tag key={v} color="blue" style={{ marginBottom: 2 }}>{v}</Tag>);
        },
      },
    ];
  };

  const snapshots = history ? [...history.snapshots].reverse() : [];

  return (
    <Card
      title={`History: ${poll.title}`}
      loading={loading}
      extra={
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting} disabled={!history || history.snapshots.length === 0}>
            Export
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </Space>
      }
    >
      {snapshots.length === 0 ? (
        <Empty description="No history yet — history is recorded each time the poll is closed." />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {snapshots.map((snapshot, idx) => (
            <Card
              key={snapshot.snapshotId}
              size="small"
              type="inner"
              title={
                <Space>
                  <Text strong>#{snapshots.length - idx}</Text>
                  <Text>{formatDate(snapshot.timestamp)}</Text>
                  <Tag color="default">{snapshot.event}</Tag>
                  {snapshot.summary.winner
                    ? <Tag color="gold">Winner: {snapshot.summary.winner}</Tag>
                    : snapshot.summary.totalVotes > 0
                      ? <Tag color="orange">Tie</Tag>
                      : <Tag>No votes</Tag>
                  }
                </Space>
              }
              extra={
                <Space>
                  <Text type="secondary">Closed by <Text strong>{snapshot.closedBy}</Text></Text>
                  <Text type="secondary">· {snapshot.summary.totalVotes} vote{snapshot.summary.totalVotes !== 1 ? 's' : ''}</Text>
                  {snapshot.summary.anonymousVoting && <Tag color="purple">Anonymous</Tag>}
                </Space>
              }
            >
              <Table
                dataSource={[...snapshot.summary.choices].sort((a, b) => b.votes - a.votes)}
                columns={snapshotColumns(snapshot)}
                rowKey="name"
                pagination={false}
                size="small"
              />
            </Card>
          ))}
        </Space>
      )}
    </Card>
  );
};
