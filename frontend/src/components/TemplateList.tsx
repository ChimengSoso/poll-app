import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Card, Button, Space, Modal, message } from 'antd';
import { ReloadOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { ColDef } from 'ag-grid-community';
import { templateApi } from '../services/api';
import type { PollTemplate } from '../types';

interface TemplateListProps {
  onTemplateRecover: () => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({ onTemplateRecover }) => {
  const [templates, setTemplates] = useState<PollTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await templateApi.getAllTemplates();
      setTemplates(data);
    } catch (error: any) {
      message.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleRecover = async (fileName: string, title: string) => {
    Modal.confirm({
      title: 'Recover Poll',
      content: `Are you sure you want to recover "${title}"?`,
      onOk: async () => {
        try {
          await templateApi.recoverTemplate(fileName);
          message.success('Poll recovered successfully!');
          onTemplateRecover();
        } catch (error: any) {
          message.error('Failed to recover poll');
        }
      },
    });
  };

  const handleDelete = async (fileName: string) => {
    Modal.confirm({
      title: 'Delete Template',
      content: 'Are you sure you want to delete this template?',
      onOk: async () => {
        try {
          await templateApi.deleteTemplate(fileName);
          message.success('Template deleted successfully');
          loadTemplates();
        } catch (error: any) {
          message.error('Failed to delete template');
        }
      },
    });
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const columnDefs: ColDef<PollTemplate>[] = useMemo(
    () => [
      {
        headerName: 'Title',
        field: 'title',
        flex: 2,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Original Poll ID',
        field: 'pollId',
        flex: 2,
      },
      {
        headerName: 'Saved At',
        field: 'savedAt',
        flex: 2,
        sortable: true,
        valueFormatter: (params) => formatDate(params.value),
      },
      {
        headerName: 'Actions',
        flex: 2,
        cellRenderer: (params: any) => (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRecover(params.data.fileName, params.data.title)}
            >
              Recover
            </Button>
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(params.data.fileName)}
            />
          </Space>
        ),
      },
    ],
    []
  );

  return (
    <Card
      title="Poll Templates (Deleted Polls Backup)"
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadTemplates} loading={loading}>
          Refresh
        </Button>
      }
    >
      <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={templates}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
          }}
        />
      </div>
    </Card>
  );
};
