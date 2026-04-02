import React, { useMemo } from 'react';
import { Card, Statistic, Row, Col, Table, Tag, Typography } from 'antd';
import type { Poll, Choice } from '../types';
import { TrophyOutlined } from '@ant-design/icons';
import { useUser } from '../contexts/UserContext';

const { Text } = Typography;

interface ResultsProps {
  poll: Poll;
}

export const Results: React.FC<ResultsProps> = ({ poll }) => {
  const { username } = useUser();
  const isOwner = username === poll.createdBy;
  const showVoterNames = !poll.anonymousVoting || isOwner;
  const winners = useMemo(() => {
    if (poll.choices.length === 0) return [];
    const maxVotes = Math.max(...poll.choices.map(r => r.votes));
    if (maxVotes === 0) return [];
    return poll.choices.filter(r => r.votes === maxVotes);
  }, [poll]);

  const calculatePercentage = (votes: number): string => {
    if (poll.totalVotes === 0) return '0%';
    return `${Math.round((votes / poll.totalVotes) * 100)}%`;
  };

  const sortedChoices = useMemo(
    () => [...poll.choices].sort((a, b) => b.votes - a.votes),
    [poll]
  );

  const columns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 70,
      render: (_: any, __: Choice, index: number) => index + 1,
    },
    {
      title: 'Choice',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string | undefined) => desc || '-',
    },
    {
      title: 'Votes',
      dataIndex: 'votes',
      key: 'votes',
      sorter: (a: Choice, b: Choice) => a.votes - b.votes,
    },
    {
      title: 'Percentage',
      key: 'percentage',
      render: (_: any, record: Choice) => calculatePercentage(record.votes),
    },
  ];

  return (
    <Card title={`Results: ${poll.title}`}>
      {winners.length > 0 && poll.totalVotes > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title={winners.length === 1 ? 'Winner' : 'Winners (Tie)'}
                value={winners.map(w => w.name).join(', ')}
                prefix={<TrophyOutlined style={{ color: '#ffd700' }} />}
                valueStyle={{ fontSize: winners.length > 1 ? '16px' : '24px' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="Total Votes" value={poll.totalVotes} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Winning Percentage"
                value={calculatePercentage(winners[0].votes)}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Table
        dataSource={sortedChoices}
        columns={columns}
        rowKey="id"
        pagination={false}
        expandable={{
          expandedRowRender: (record: Choice) => (
            <div style={{ padding: '4px 0' }}>
              {record.voters.length === 0 ? (
                <Text type="secondary">No votes yet</Text>
              ) : showVoterNames ? (
                <>
                  <Text strong style={{ marginRight: 8 }}>Voted by:</Text>
                  {record.voters.map(voter => (
                    <Tag key={voter} color="blue" style={{ marginBottom: 4 }}>
                      {voter}
                    </Tag>
                  ))}
                </>
              ) : (
                <Text type="secondary">{record.voters.length} anonymous vote{record.voters.length !== 1 ? 's' : ''}</Text>
              )}
            </div>
          ),
          rowExpandable: () => true,
        }}
      />
    </Card>
  );
};
