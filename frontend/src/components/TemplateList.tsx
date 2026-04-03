import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Card, Button, Space, Modal, message } from 'antd';
import { DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { ColDef } from 'ag-grid-community';
import { templateApi } from '../services/api';
import type { PollTemplate } from '../types';

interface TemplateListProps {
  onTemplateRecover: () => void;
  refreshTrigger?: number;
  onCountChange?: (count: number) => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({ onTemplateRecover, refreshTrigger, onCountChange }) => {
  const [templates, setTemplates] = useState<PollTemplate[]>([]);
  const [, setLoading] = useState(false);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await templateApi.getAllTemplates();
      setTemplates(data);
      onCountChange?.(data.length);
    } catch (error: any) {
      message.error('Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await templateApi.getAllTemplates();
        if (!cancelled) {
          setTemplates(data);
          onCountChange?.(data.length);
        }
      } catch (error: any) {
        if (!cancelled) message.error('Failed to load templates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const handleRecover = async (fileName: string, title: string) => {
    Modal.confirm({
      title: 'Recover Poll',
      content: `Are you sure you want to recover "${title}"?`,
      onOk: async () => {
        try {
          await templateApi.recoverTemplate(fileName);
          message.success('Poll recovered successfully!');
          onTemplateRecover();
          loadTemplates();
        } catch (error: any) {
          message.error('Failed to recover poll');
        }
      },
    });
  };

  const handleDelete = async (fileName: string) => {
    Modal.confirm({
      title: 'Delete Permanently',
      content: 'Are you sure you want to permanently delete this poll from the recycle bin?',
      onOk: async () => {
        try {
          await templateApi.deleteTemplate(fileName);
          message.success('Permanently deleted.');
          loadTemplates();
        } catch (error: any) {
          message.error('Failed to delete.');
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
    <Card>
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
