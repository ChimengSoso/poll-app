import React, { useState, useRef } from 'react';
import { Form, Input, Button, Space, Card, message, Radio, Divider } from 'antd';
import { MinusCircleOutlined, PlusOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { pollApi } from '../services/api';
import { useUser } from '../contexts/UserContext';
import type { CreatePollRequest } from '../types';

interface CreatePollProps {
  onPollCreated: () => void;
}

export const CreatePoll: React.FC<CreatePollProps> = ({ onPollCreated }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { username } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      const request: CreatePollRequest = {
        title: values.title,
        restaurants: values.restaurants || [],
        votingMode: values.votingMode || 'multiple',
        createdBy: username!,
      };
      await pollApi.createPoll(request);
      message.success('Poll created successfully!');
      form.resetFields();
      onPollCreated();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const values = form.getFieldsValue();
    if (!values.title || !values.restaurants || values.restaurants.length === 0) {
      message.warning('Please fill in poll details before exporting');
      return;
    }

    const pollData = {
      title: values.title,
      restaurants: values.restaurants,
      votingMode: values.votingMode || 'multiple',
    };

    const jsonString = JSON.stringify(pollData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `poll-${values.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('Poll exported successfully!');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const pollData = JSON.parse(content);

        if (!pollData.title || !pollData.restaurants) {
          message.error('Invalid poll file format');
          return;
        }

        form.setFieldsValue({
          title: pollData.title,
          restaurants: pollData.restaurants,
          votingMode: pollData.votingMode || 'multiple',
        });

        message.success('Poll imported successfully!');
      } catch (error) {
        message.error('Failed to parse poll file');
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card title="Create New Poll">
      <Form
        form={form}
        name="create-poll"
        onFinish={onFinish}
        layout="vertical"
        autoComplete="off"
        initialValues={{
          restaurants: [{ name: '', description: '' }],
          votingMode: 'multiple',
        }}
      >
        <Form.Item
          label="Poll Title"
          name="title"
          rules={[{ required: true, message: 'Please enter poll title' }]}
        >
          <Input placeholder="e.g., Where should we eat lunch?" />
        </Form.Item>

        <Form.Item
          label="Voting Mode"
          name="votingMode"
          tooltip="Single: Each person votes once. Multiple: Each person can vote for multiple restaurants."
        >
          <Radio.Group>
            <Radio.Button value="single">Single Vote</Radio.Button>
            <Radio.Button value="multiple">Multiple Votes</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.List name="restaurants">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    rules={[{ required: true, message: 'Restaurant name required' }]}
                  >
                    <Input placeholder="Restaurant name" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'description']}
                  >
                    <Input placeholder="Description (optional)" style={{ width: 300 }} />
                  </Form.Item>
                  {fields.length > 1 && (
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  )}
                </Space>
              ))}
              <Form.Item>
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Add Restaurant
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Poll
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Export to File
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
              Import from File
            </Button>
          </Space>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </Form.Item>
      </Form>
    </Card>
  );
};
