import React, { useState, useRef } from 'react';
import { Form, Input, Button, Space, Card, message, Radio, Switch } from 'antd';
import { MinusCircleOutlined, PlusOutlined, DownloadOutlined, UploadOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { pollApi } from '../services/api';
import type { CreatePollRequest } from '../types';

interface CreatePollProps {
  onPollCreated: () => void;
}

export const CreatePoll: React.FC<CreatePollProps> = ({ onPollCreated }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dailyResetValue = Form.useWatch('dailyReset', form);
  const titleValue = Form.useWatch('title', form);
  const choicesValue = Form.useWatch('choices', form);

  const hasTitle = !!(titleValue?.trim());
  const hasChoice = choicesValue?.some((c: any) => c?.name?.trim());
  const canSubmit = hasTitle && hasChoice;

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      const request: CreatePollRequest = {
        title: values.title,
        choices: values.choices || [],
        votingMode: values.votingMode || 'multiple',
        dailyReset: values.dailyReset || false,
        titleTemplate: values.dailyReset ? (values.titleTemplate || null) : null,
        requireApproval: values.requireApproval || false,
        anonymousVoting: values.anonymousVoting || false,
      };
      await pollApi.createPoll(request);
      message.success('Poll created successfully!');
      form.resetFields();
      setOpen(false);
      onPollCreated();
    } catch (error: any) {
      message.error(error.message || 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const values = form.getFieldsValue();
    if (!values.title || !values.choices || values.choices.length === 0) {
      message.warning('Please fill in poll details before exporting');
      return;
    }

    const pollData = {
      title: values.title,
      choices: values.choices,
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

        if (!pollData.title || !pollData.choices) {
          message.error('Invalid poll file format');
          return;
        }

        form.setFieldsValue({
          title: pollData.title,
          choices: pollData.choices,
          votingMode: pollData.votingMode || 'multiple',
        });

        message.success('Poll imported successfully!');
      } catch (error) {
        message.error('Failed to parse poll file');
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!open) {
    return (
      <div style={{ marginTop: 16 }}>
        <Button
          type="dashed"
          icon={<PlusCircleOutlined />}
          onClick={() => setOpen(true)}
          block
        >
          Create New Poll
        </Button>
      </div>
    );
  }

  return (
    <Card
      title="Create New Poll"
      style={{ marginTop: 16 }}
      extra={<Button type="text" onClick={() => { setOpen(false); form.resetFields(); }}>Cancel</Button>}
    >
      <Form
        form={form}
        name="create-poll"
        onFinish={onFinish}
        layout="vertical"
        autoComplete="off"
        initialValues={{
          choices: [{ name: '', description: '' }],
          votingMode: 'multiple',
          dailyReset: false,
          requireApproval: false,
          anonymousVoting: false,
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
          tooltip="Single: Each person votes once. Multiple: Each person can vote for multiple choices."
        >
          <Radio.Group>
            <Radio.Button value="single">Single Vote</Radio.Button>
            <Radio.Button value="multiple">Multiple Votes</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label="Daily Auto-Reset"
          name="dailyReset"
          valuePropName="checked"
          tooltip="Automatically reset votes at the start of each day. Useful for recurring daily polls."
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Require Voter Approval"
          name="requireApproval"
          valuePropName="checked"
          tooltip="Users must request and be approved by the poll owner before voting."
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Anonymous Voting"
          name="anonymousVoting"
          valuePropName="checked"
          tooltip="Voter names are hidden from other participants. Only the poll owner can see who voted for what."
        >
          <Switch />
        </Form.Item>

        {dailyResetValue && (
          <Form.Item
            label="Title Template"
            name="titleTemplate"
            tooltip={`Use {date} as a placeholder for today's date, e.g. "Lunch Poll {date}". Leave blank to keep the title unchanged on reset.`}
          >
            <Input placeholder='e.g., Lunch Poll {date}' />
          </Form.Item>
        )}

        <Form.List name="choices">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    rules={[{ required: true, message: 'Choice name required' }]}
                  >
                    <Input placeholder="Choice" style={{ width: 200 }} />
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
                  Add Choice
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} disabled={!canSubmit}>
              Create Poll
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!canSubmit}>
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
