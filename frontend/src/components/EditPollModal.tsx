import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Switch, message } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { pollApi } from '../services/api';
import type { Poll, EditPollRequest } from '../types';

interface EditPollModalProps {
  poll: Poll | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: (updatedPoll: Poll) => void;
}

export const EditPollModal: React.FC<EditPollModalProps> = ({ poll, visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const dailyResetValue = Form.useWatch('dailyReset', form);

  useEffect(() => {
    if (poll && visible) {
      form.setFieldsValue({
        title: poll.title,
        restaurants: poll.restaurants.map(r => ({
          name: r.name,
          description: r.description || '',
        })),
        dailyReset: poll.dailyReset,
        titleTemplate: poll.titleTemplate || '',
      });
    }
  }, [poll, visible, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const request: EditPollRequest = {
        title: values.title,
        restaurants: values.restaurants || [],
        dailyReset: values.dailyReset || false,
        titleTemplate: values.dailyReset ? (values.titleTemplate || null) : null,
      };

      const updatedPoll = await pollApi.editPoll(poll!.id, request);
      message.success('Poll updated successfully!');
      onSuccess(updatedPoll);
      onClose();
    } catch (error: any) {
      if (error.errorFields) return; // antd validation error, already shown inline
      message.error(error.message || 'Failed to update poll');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Edit Poll"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={700}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label="Poll Title"
          name="title"
          rules={[{ required: true, message: 'Please enter poll title' }]}
        >
          <Input placeholder="e.g., Where should we eat lunch?" />
        </Form.Item>

        <Form.Item
          label="Daily Auto-Reset"
          name="dailyReset"
          valuePropName="checked"
          tooltip="Automatically reset votes at the start of each day."
        >
          <Switch />
        </Form.Item>

        {dailyResetValue && (
          <Form.Item
            label="Title Template"
            name="titleTemplate"
            tooltip={`Use {date} as a placeholder for today's date, e.g. "Lunch Poll {date}".`}
          >
            <Input placeholder='e.g., Lunch Poll {date}' />
          </Form.Item>
        )}

        <Form.List name="restaurants">
          {(fields, { add, remove }) => (
            <>
              <label>Restaurants:</label>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8, marginTop: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    rules={[{ required: true, message: 'Restaurant name required' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder="Restaurant name" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'description']}
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder="Description (optional)" style={{ width: 300 }} />
                  </Form.Item>
                  {fields.length > 1 && (
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  )}
                </Space>
              ))}
              <Form.Item style={{ marginTop: 8 }}>
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Add Restaurant
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <div style={{ color: '#888', fontSize: '12px', marginTop: 8 }}>
          Note: Existing votes will be preserved if restaurant names match. New restaurants start with 0 votes.
        </div>
      </Form>
    </Modal>
  );
};
