import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Progress, Typography, Space, Alert, message, Empty } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { authApi } from '../services/authApi';
import { authUpdateService } from '../services/authUpdateService';
import { useUser } from '../contexts/UserContext';
import type { ResetStatusResponse } from '../types';

const { Text } = Typography;

interface PendingResetsProps {
  onCountChange?: (count: number) => void;
}

function formatTimeRemaining(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const PendingResets: React.FC<PendingResetsProps> = ({ onCountChange }) => {
  const [resets, setResets] = useState<ResetStatusResponse[]>([]);
  const [voting, setVoting] = useState<string | null>(null);
  const { username } = useUser();

  const loadResets = useCallback(async () => {
    try {
      const data = await authApi.getPendingResets();
      setResets(data);
      onCountChange?.(data.length);
    } catch {
      // silently ignore — user may have just logged in
    }
  }, [onCountChange]);

  useEffect(() => {
    loadResets();

    const unsubscribe = authUpdateService.subscribe((event) => {
      if (event.type === 'reset-update') {
        setResets((prev) => {
          const exists = prev.find((r) => r.requestId === event.data.requestId);
          const updated = exists
            ? prev.map((r) => r.requestId === event.data.requestId ? event.data : r)
            : [...prev, event.data];
          onCountChange?.(updated.filter(r => r.status === 'pending').length);
          return updated;
        });
      } else if (event.type === 'reset-approved') {
        setResets((prev) => {
          const updated = prev.filter((r) => r.requestId !== event.data.requestId);
          onCountChange?.(updated.length);
          return updated;
        });
        message.success(`Password reset for ${event.data.username} has been approved!`);
      } else if (event.type === 'reset-cancelled') {
        setResets((prev) => {
          const updated = prev.filter((r) => r.requestId !== event.data.requestId);
          onCountChange?.(updated.length);
          return updated;
        });
      }
    });

    return () => unsubscribe();
  }, [loadResets]);

  const handleVote = async (requestId: string) => {
    try {
      setVoting(requestId);
      const updated = await authApi.voteReset(requestId);
      setResets((prev) => prev.map((r) => r.requestId === requestId ? updated : r));
      message.success('Confirmation recorded!');
    } catch (error: any) {
      message.error(error.message || 'Failed to confirm');
    } finally {
      setVoting(null);
    }
  };

  const activeResets = resets.filter((r) => r.status === 'pending');

  if (activeResets.length === 0) {
    return (
      <Card title="Pending Password Resets">
        <Empty description="No pending password reset requests" />
      </Card>
    );
  }

  return (
    <Card title={`Pending Password Resets (${activeResets.length})`}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {activeResets.map((r) => {
          const alreadyVoted = username ? r.votes >= r.threshold : false;
          const isSelf = username === r.username;
          const pct = Math.round((r.votes / r.threshold) * 100);

          return (
            <Card key={r.requestId} size="small" style={{ borderLeft: '3px solid #1677ff' }}>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Text strong>{r.username} wants to reset their password</Text>
                <Space>
                  <Progress
                    percent={pct}
                    format={() => `${r.votes}/${r.threshold}`}
                    style={{ width: 200, marginBottom: 0 }}
                    status="active"
                  />
                  <Text type="secondary">Expires: {formatTimeRemaining(r.expiresAt)}</Text>
                </Space>
                {isSelf ? (
                  <Alert message="This is your own reset request" type="info" showIcon style={{ padding: '4px 8px' }} />
                ) : alreadyVoted ? (
                  <Text type="success"><CheckOutlined /> You already confirmed this</Text>
                ) : (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={voting === r.requestId}
                    onClick={() => handleVote(r.requestId)}
                  >
                    Confirm Identity
                  </Button>
                )}
              </Space>
            </Card>
          );
        })}
      </Space>
    </Card>
  );
};
