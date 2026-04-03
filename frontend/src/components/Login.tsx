import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Form, Typography, Alert, Progress, Collapse } from 'antd';
import { UserOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { authApi } from '../services/authApi';
import { authUpdateService } from '../services/authUpdateService';

const { Title, Paragraph, Text } = Typography;

type Step = 'username' | 'login' | 'register' | 'forgot' | 'waiting';

interface LoginProps {
  onLogin: (username: string, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resetVotes, setResetVotes] = useState(0);
  const [resetApproved, setResetApproved] = useState(false);
  const [form] = Form.useForm();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Restore waiting state from sessionStorage on mount
  useEffect(() => {
    const savedId = sessionStorage.getItem('openpoll-reset-id');
    const savedUser = sessionStorage.getItem('openpoll-reset-user');
    const savedExpires = sessionStorage.getItem('openpoll-reset-expires');
    if (savedId && savedUser && savedExpires) {
      setRequestId(savedId);
      setUsername(savedUser);
      setExpiresAt(Number(savedExpires));
      setStep('waiting');
    }
  }, []);

  // Poll reset status every 10s while waiting
  useEffect(() => {
    if (step !== 'waiting' || !requestId) return;

    const check = async () => {
      try {
        const status = await authApi.getResetStatus(requestId);
        setResetVotes(status.votes);
        if (status.status === 'approved') {
          handleResetComplete(true);
        } else if (status.status === 'expired') {
          handleResetExpired();
        }
      } catch {
        // request not found — likely approved and removed
        handleResetComplete(true);
      }
    };

    check();
    pollIntervalRef.current = setInterval(check, 10000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [step, requestId]);

  // SSE subscription while waiting
  useEffect(() => {
    if (step !== 'waiting' || !requestId) return;

    const unsubscribe = authUpdateService.subscribe((event) => {
      if (event.type === 'reset-update' && event.data.requestId === requestId) {
        setResetVotes(event.data.votes);
      } else if (event.type === 'reset-approved' && event.data.requestId === requestId) {
        handleResetComplete(true);
      }
    });

    return () => unsubscribe();
  }, [step, requestId]);

  const handleResetComplete = (approved: boolean) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    sessionStorage.removeItem('openpoll-reset-id');
    sessionStorage.removeItem('openpoll-reset-user');
    sessionStorage.removeItem('openpoll-reset-expires');
    setResetApproved(approved);
    if (approved) {
      setTimeout(() => {
        setStep('login');
        setError('');
        setResetApproved(false);
        form.resetFields();
      }, 3000);
    }
  };

  const handleResetExpired = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    sessionStorage.removeItem('openpoll-reset-id');
    sessionStorage.removeItem('openpoll-reset-user');
    sessionStorage.removeItem('openpoll-reset-expires');
    setError('Your reset request has expired. Please try again.');
    setStep('forgot');
  };

  const clearError = () => setError('');

  // Step 1: check username
  const handleCheckUser = async (values: { username: string }) => {
    setLoading(true);
    setError('');
    try {
      const trimmed = values.username.trim();
      setUsername(trimmed);
      const { exists } = await authApi.checkUser(trimmed);
      setStep(exists ? 'login' : 'register');
      form.resetFields(['password', 'confirm']);
    } catch (e: any) {
      setError(e.message || 'Failed to check username');
    } finally {
      setLoading(false);
    }
  };

  // Step 2b: login
  const handleLogin = async (values: { password: string }) => {
    setLoading(true);
    setError('');
    try {
      const { token } = await authApi.login(username, values.password);
      onLogin(username, token);
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2a: register
  const handleRegister = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { token } = await authApi.register(username, values.password);
      onLogin(username, token);
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: forgot password
  const handleForgotPassword = async (values: { newPassword: string; confirmNew: string }) => {
    if (values.newPassword !== values.confirmNew) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authApi.forgotPassword(username, values.newPassword);
      setRequestId(result.requestId);
      setExpiresAt(result.expiresAt);
      setResetVotes(0);
      sessionStorage.setItem('openpoll-reset-id', result.requestId);
      sessionStorage.setItem('openpoll-reset-user', username);
      sessionStorage.setItem('openpoll-reset-expires', String(result.expiresAt));
      setStep('waiting');
    } catch (e: any) {
      setError(e.message || 'Failed to submit reset request');
    } finally {
      setLoading(false);
    }
  };

  const back = (target: Step) => {
    setError('');
    form.resetFields();
    setStep(target);
  };

  const guideItems = [
    {
      key: '1',
      label: <Text strong>🚀 How to get started?</Text>,
      children: (
        <Typography style={{ fontSize: 13 }}>
          <Paragraph><Text strong>1. Enter your username</Text> — type any username and press Next.</Paragraph>
          <Paragraph><Text strong>2. New user?</Text> — set a password to create your account instantly.</Paragraph>
          <Paragraph><Text strong>3. Returning user?</Text> — enter your password to log in.</Paragraph>
          <Paragraph style={{ marginBottom: 0 }}><Text strong>4. Forgot password?</Text> — submit a reset request. It requires approval from 5 other users before your new password takes effect.</Paragraph>
        </Typography>
      ),
    },
  ];

  const card = (content: React.ReactNode, showGuide = false) => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <Card style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.2)', borderRadius: 12, marginBottom: showGuide ? 16 : 0 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>🗳️</div>
            <Title level={2} style={{ marginBottom: 4 }}>OpenPoll</Title>
            <Paragraph type="secondary">Create polls and vote on anything with your team</Paragraph>
          </div>
          {content}
        </Card>
        {showGuide && (
          <Collapse
            items={guideItems}
            ghost
            style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, color: 'white' }}
          />
        )}
      </div>
    </div>
  );

  // ── Step 1: Username ──────────────────────────────────────────────────────
  if (step === 'username') {
    return card(
      <Form form={form} onFinish={handleCheckUser} layout="vertical" size="large">
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form.Item name="username" rules={[
          { required: true, message: 'Please enter your name' },
          { min: 2, message: 'At least 2 characters' },
          { max: 30, message: 'At most 30 characters' },
          { pattern: /^[a-zA-Z0-9_-]+$/, message: 'Only letters, numbers, _ and - allowed' },
        ]}>
          <Input prefix={<UserOutlined />} placeholder="Enter your username" autoFocus />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>Next</Button>
        </Form.Item>
      </Form>
    , true);
  }

  // ── Step 2b: Login ────────────────────────────────────────────────────────
  if (step === 'login') {
    return card(
      <>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Welcome back, <Text strong>{username}</Text>
        </Text>
        <Form form={form} onFinish={handleLogin} layout="vertical" size="large">
          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
          <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" autoFocus />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>Log In</Button>
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => back('username')} style={{ padding: 0 }}>
              Back
            </Button>
            <Button type="link" onClick={() => { clearError(); setStep('forgot'); form.resetFields(); }} style={{ padding: 0 }}>
              Forgot password?
            </Button>
          </div>
        </Form>
      </>
    );
  }

  // ── Step 2a: Register ─────────────────────────────────────────────────────
  if (step === 'register') {
    return card(
      <>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Welcome! Set a password to create your account as <Text strong>{username}</Text>
        </Text>
        <Form form={form} onFinish={handleRegister} layout="vertical" size="large">
          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
          <Form.Item name="password" rules={[
            { required: true, message: 'Please set a password' },
            { min: 6, message: 'At least 6 characters' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="New password" autoFocus />
          </Form.Item>
          <Form.Item name="confirm" rules={[{ required: true, message: 'Please confirm your password' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>Create Account</Button>
          </Form.Item>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => back('username')} style={{ padding: 0 }}>
            Back
          </Button>
        </Form>
      </>
    );
  }

  // ── Step 3: Forgot password ───────────────────────────────────────────────
  if (step === 'forgot') {
    return card(
      <>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Enter a new password for <Text strong>{username}</Text>. Your colleagues will need to confirm your identity before it takes effect.
        </Text>
        <Form form={form} onFinish={handleForgotPassword} layout="vertical" size="large">
          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
          <Form.Item name="newPassword" rules={[
            { required: true, message: 'Please enter a new password' },
            { min: 6, message: 'At least 6 characters' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="New password" autoFocus />
          </Form.Item>
          <Form.Item name="confirmNew" rules={[{ required: true, message: 'Please confirm your password' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>Submit Reset Request</Button>
          </Form.Item>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => back('login')} style={{ padding: 0 }}>
            Back to login
          </Button>
        </Form>
      </>
    );
  }

  // ── Step 4: Waiting for approval ──────────────────────────────────────────
  if (step === 'waiting') {
    if (resetApproved) {
      return card(
        <Alert
          message="Password Reset Approved!"
          description="Your password has been updated. Redirecting to login..."
          type="success"
          showIcon
        />
      );
    }

    const pct = Math.round((resetVotes / 5) * 100);
    const timeLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 3600000)) : 24;

    return card(
      <>
        <Alert
          message="Reset request submitted"
          description={`Ask your colleagues to go to the "Pending Resets" tab and click "Confirm Identity" for ${username}.`}
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Text strong>Confirmations received</Text>
          <Progress
            percent={pct}
            format={() => `${resetVotes}/5`}
            status="active"
            style={{ marginTop: 8 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>Expires in ~{timeLeft}h</Text>
        </div>
        <Button type="link" onClick={() => { back('forgot'); }} style={{ padding: 0 }}>
          Cancel and try again
        </Button>
      </>
    );
  }

  return null;
};
