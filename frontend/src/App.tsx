import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Typography, Button } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { UserProvider, useUser } from './contexts/UserContext';
import { Login } from './components/Login';
import { CreatePoll } from './components/CreatePoll';
import { PollList } from './components/PollList';
import { VotePanel } from './components/VotePanel';
import { Results } from './components/Results';
import { TemplateList } from './components/TemplateList';
import { pollUpdateService } from './services/pollUpdateService';
import type { Poll } from './types';

const { Header, Content } = Layout;
const { Title } = Typography;

function MainApp() {
  const { username, logout } = useUser();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [activeTab, setActiveTab] = useState('1');

  // Subscribe to real-time poll updates for the selected poll
  useEffect(() => {
    if (!selectedPoll) return;

    const unsubscribe = pollUpdateService.subscribe((updatedPoll) => {
      // Update the selected poll if it matches
      if (selectedPoll.id === updatedPoll.id) {
        console.log('[App] Updating selected poll:', updatedPoll.id);
        setSelectedPoll(updatedPoll);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedPoll?.id]);

  const handlePollCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handlePollSelect = (poll: Poll) => {
    setSelectedPoll(poll);
    setActiveTab('2');
  };

  const handleVoteSuccess = (updatedPoll: Poll) => {
    setSelectedPoll(updatedPoll);
    setRefreshTrigger((prev) => prev + 1);
  };

  const tabItems = [
    {
      key: '1',
      label: 'Polls',
      children: (
        <>
          <PollList refreshTrigger={refreshTrigger} onPollSelect={handlePollSelect} />
          <CreatePoll onPollCreated={handlePollCreated} />
        </>
      ),
    },
    {
      key: '2',
      label: 'Vote',
      children: selectedPoll ? (
        <VotePanel poll={selectedPoll} onVoteSuccess={handleVoteSuccess} />
      ) : (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Title level={4}>Select a poll from the Polls tab to vote</Title>
        </div>
      ),
    },
    {
      key: '3',
      label: 'Results',
      children: selectedPoll ? (
        <Results poll={selectedPoll} />
      ) : (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Title level={4}>Select a poll from the Polls tab to view results</Title>
        </div>
      ),
    },
    {
      key: '4',
      label: 'Templates',
      children: <TemplateList onTemplateRecover={handlePollCreated} />,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#001529',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Title level={2} style={{ color: 'white', margin: '16px 0' }}>
          🍽️ Restaurant Poll App
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'white' }}>
            <UserOutlined /> {username}
          </span>
          <Button
            icon={<LogoutOutlined />}
            onClick={logout}
            type="default"
          >
            Logout
          </Button>
        </div>
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </div>
      </Content>
    </Layout>
  );
}

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

function AppContent() {
  const { isLoggedIn, login } = useUser();

  if (!isLoggedIn) {
    return <Login onLogin={login} />;
  }

  return <MainApp />;
}

export default App;
