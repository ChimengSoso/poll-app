import React, { useMemo } from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { Poll, Restaurant } from '../types';
import { TrophyOutlined } from '@ant-design/icons';

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

  const columnDefs: ColDef<Restaurant>[] = useMemo(
    () => [
      {
        headerName: 'Rank',
        valueGetter: 'node.rowIndex + 1',
        flex: 0.5,
      },
      {
        headerName: 'Restaurant',
        field: 'name',
        flex: 2,
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
        sort: 'desc',
      },
      {
        headerName: 'Percentage',
        flex: 1,
        valueGetter: (params) => calculatePercentage(params.data?.votes || 0),
      },
    ],
    [poll]
  );

  return (
    <Card title={`Results: ${poll.title}`}>
      {winners.length > 0 && poll.totalVotes > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title={winners.length === 1 ? "Winner" : "Winners (Tie)"}
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

      <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={poll.restaurants}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
          }}
        />
      </div>
    </Card>
  );
};
