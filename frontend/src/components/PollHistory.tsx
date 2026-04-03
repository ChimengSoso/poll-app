import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Table, Tag, Typography, Empty, message, Progress } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { historyApi } from '../services/historyApi';
import { pollUpdateService } from '../services/pollUpdateService';
import type { PollHistory as PollHistoryType, PollSnapshot, ChoiceSummary } from '../types';

const { Text } = Typography;

export const PollHistory: React.FC = () => {
  const [histories, setHistories] = useState<PollHistoryType[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistories = async () => {
    try {
      setLoading(true);
      const data = await historyApi.getAllHistories();
      setHistories(data);
    } catch (error: any) {
      message.error(error.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistories();
  }, []);

  useEffect(() => {
    return pollUpdateService.subscribe((poll) => {
      if (!poll.active && poll.id !== '__template_updated__') {
        loadHistories();
      }
    });
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = new Blob([JSON.stringify(histories, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `all-history.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success('History exported!');
    } catch (error: any) {
      message.error(error.message || 'Failed to export history');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setImporting(true);
        const data = JSON.parse(e.target?.result as string);
        const merged = await historyApi.importAllHistories(Array.isArray(data) ? data : [data]);
        setHistories(merged);
        message.success(`Imported — ${merged.reduce((n, h) => n + h.snapshots.length, 0)} snapshot(s) total`);
      } catch (error: any) {
        message.error(error.message || 'Failed to import history');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() + 543;
    const time = d.toLocaleTimeString('th-TH');
    return `วันที่ ${day} ${month} ${year} ${time}`;
  };

  const winnerTag = (snapshot: PollSnapshot) => {
    const maxVotes = Math.max(...snapshot.summary.choices.map(c => c.votes), 0);
    const tied = snapshot.summary.choices.filter(c => c.votes === maxVotes);
    const tieLabel = tied.slice(0, 2).map(c => c.name).join(', ') + (tied.length > 2 ? '...' : '');
    if (snapshot.summary.winner)
      return <Tag color="gold" style={{ margin: 0 }}>Winner: {snapshot.summary.winner}</Tag>;
    if (snapshot.summary.totalVotes > 0)
      return <Tag color="orange" style={{ margin: 0 }}>Tie: {tieLabel}</Tag>;
    return <Tag style={{ margin: 0 }}>No votes</Tag>;
  };

  const snapshotColumns = (snapshot: PollSnapshot) => [
    {
      title: 'Choice',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) =>
        snapshot.summary.winner === name ? <Text strong>{name} 🏆</Text> : name,
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
        if (snapshot.summary.anonymousVoting)
          return <Text type="secondary">{record.votes} anonymous vote{record.votes !== 1 ? 's' : ''}</Text>;
        return record.voters.map(v => <Tag key={v} color="blue" style={{ marginBottom: 2 }}>{v}</Tag>);
      },
    },
  ];

  const renderSnapshotDetail = (snapshot: PollSnapshot) => (
    <div style={{ padding: '12px 4px 16px', borderBottom: '1px solid #f0f0f0' }}>
      <Space style={{ marginBottom: 8 }}>
        <Text type="secondary">Closed by <Text strong>{snapshot.closedBy}</Text></Text>
        <Text type="secondary">· {snapshot.summary.totalVotes} vote{snapshot.summary.totalVotes !== 1 ? 's' : ''}</Text>
        {snapshot.summary.anonymousVoting && <Tag color="purple">Anonymous</Tag>}
      </Space>
      <Table
        dataSource={[...snapshot.summary.choices].sort((a, b) => b.votes - a.votes)}
        columns={snapshotColumns(snapshot)}
        rowKey="name"
        pagination={false}
        size="small"
      />
    </div>
  );

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 4px', borderBottom: '1px solid #f0f0f0',
  };

  return (
    <Card
      loading={loading}
      extra={
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting} disabled={histories.length === 0}>
            Export All
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()} loading={importing}>
            Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </Space>
      }
    >
      {histories.length === 0 ? (
        <Empty description="No history yet — history is recorded each time a poll is closed." />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={0}>
          {histories.map(history => {
            const snapshots = [...history.snapshots].reverse();
            const latest = snapshots[0];
            const pollLabel = history.pollTitle || history.pollId;
            const isPollExpanded = expandedPollId === history.pollId;

            if (snapshots.length === 1) {
              const isSnapExpanded = expandedSnapshotId === latest.snapshotId;
              return (
                <div key={history.pollId}>
                  <div onClick={() => setExpandedSnapshotId(isSnapExpanded ? null : latest.snapshotId)} style={{ ...rowStyle, cursor: 'pointer' }}>
                    <Text style={{ flex: 1 }}>{pollLabel}</Text>
                    <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{formatDate(latest.timestamp)}</Text>
                    {winnerTag(latest)}
                  </div>
                  {isSnapExpanded && renderSnapshotDetail(latest)}
                </div>
              );
            }

            return (
              <div key={history.pollId}>
                <div onClick={() => setExpandedPollId(isPollExpanded ? null : history.pollId)} style={{ ...rowStyle, cursor: 'pointer' }}>
                  <Text style={{ flex: 1 }}>{pollLabel}</Text>
                  <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{formatDate(latest.timestamp)}</Text>
                  {winnerTag(latest)}
                  <Tag style={{ margin: 0 }}>{snapshots.length} closes</Tag>
                </div>
                {isPollExpanded && (
                  <div style={{ paddingLeft: 16, background: '#fafafa' }}>
                    {snapshots.map((snapshot, idx) => {
                      const isSnapExpanded = expandedSnapshotId === snapshot.snapshotId;
                      return (
                        <div key={snapshot.snapshotId}>
                          <div onClick={() => setExpandedSnapshotId(isSnapExpanded ? null : snapshot.snapshotId)} style={{ ...rowStyle, cursor: 'pointer' }}>
                            <Text type="secondary" style={{ minWidth: 24 }}>#{snapshots.length - idx}</Text>
                            <Text type="secondary" style={{ flex: 1, whiteSpace: 'nowrap' }}>{formatDate(snapshot.timestamp)}</Text>
                            {winnerTag(snapshot)}
                          </div>
                          {isSnapExpanded && renderSnapshotDetail(snapshot)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Space>
      )}
    </Card>
  );
};
