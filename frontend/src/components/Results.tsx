import React, { useMemo } from 'react';
import { Card, Statistic, Row, Col, Table, Tag, Typography } from 'antd';
import type { Poll, Restaurant } from '../types';
import { TrophyOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ResultsProps {
  poll: Poll;
}

export const Results: React.FC<ResultsProps> = ({ poll }) => {
  const winners = useMemo(() => {
    if (poll.restaurants.length === 0) return [];
    const maxVotes = Math.max(...poll.restaurants.map(r => r.votes));
    if (maxVotes === 0) return [];
    return poll.restaurants.filter(r => r.votes === maxVotes);
  }, [poll]);

  const calculatePercentage = (votes: number): string => {
    if (poll.totalVotes === 0) return '0%';
    return `${Math.round((votes / poll.totalVotes) * 100)}%`;
  };

  const sortedRestaurants = useMemo(
    () => [...poll.restaurants].sort((a, b) => b.votes - a.votes),
    [poll]
  );

  const columns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 70,
      render: (_: any, __: Restaurant, index: number) => index + 1,
    },
    {
      title: 'Restaurant',
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
      sorter: (a: Restaurant, b: Restaurant) => a.votes - b.votes,
    },
    {
      title: 'Percentage',
      key: 'percentage',
      render: (_: any, record: Restaurant) => calculatePercentage(record.votes),
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
        dataSource={sortedRestaurants}
        columns={columns}
        rowKey="id"
        pagination={false}
        expandable={{
          expandedRowRender: (record: Restaurant) => (
            <div style={{ padding: '4px 0' }}>
              {record.voters.length === 0 ? (
                <Text type="secondary">No votes yet</Text>
              ) : (
                <>
                  <Text strong style={{ marginRight: 8 }}>Voted by:</Text>
                  {record.voters.map(voter => (
                    <Tag key={voter} color="blue" style={{ marginBottom: 4 }}>
                      {voter}
                    </Tag>
                  ))}
                </>
              )}
            </div>
          ),
          rowExpandable: () => true,
        }}
      />
    </Card>
  );
};
