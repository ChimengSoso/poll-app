import React, { useState } from 'react';
import { Card, Input, Button, Form, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

interface LoginProps {
  onLogin: (username: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (values: { username: string }) => {
    setLoading(true);
    // Simulate a brief delay
    setTimeout(() => {
      onLogin(values.username.trim());
      setLoading(false);
    }, 300);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card
        style={{
          maxWidth: 500,
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          borderRadius: '12px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🍽️</div>
          <Title level={2} style={{ marginBottom: '8px' }}>Restaurant Poll App</Title>
          <Paragraph type="secondary">
            Enter your name to create and vote on restaurant polls
          </Paragraph>
        </div>

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Please enter your name' },
              { min: 2, message: 'Name must be at least 2 characters' },
              { max: 30, message: 'Name must be at most 30 characters' },
              {
                pattern: /^[a-zA-Z0-9_-]+$/,
                message: 'Only letters, numbers, _ and - allowed'
              }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your name (e.g., john_doe)"
              autoFocus
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              size="large"
            >
              Enter App
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Paragraph type="secondary" style={{ fontSize: '12px' }}>
            Your name is stored locally and only used for voting identification
          </Paragraph>
        </div>
      </Card>
    </div>
  );
};
