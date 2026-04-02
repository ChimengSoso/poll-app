import { useState, useEffect } from 'react';
import { Layout, Tabs, Typography, Button, Badge } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { UserProvider, useUser } from './contexts/UserContext';
import { Login } from './components/Login';
import { CreatePoll } from './components/CreatePoll';
import { PollList } from './components/PollList';
import { VotePanel } from './components/VotePanel';
import { Results } from './components/Results';
import { TemplateList } from './components/TemplateList';
import { PendingResets } from './components/PendingResets';
import { pollUpdateService } from './services/pollUpdateService';
import { authUpdateService } from './services/authUpdateService';
import type { Poll } from './types';

const { Header, Content } = Layout;
const { Title } = Typography;

function MainApp() {
  const { username, logout } = useUser();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [activeTab, setActiveTab] = useState('1');
  const [pendingResetsCount, setPendingResetsCount] = useState(0);

  useEffect(() => {
    if (!selectedPoll) return;
    const unsubscribe = pollUpdateService.subscribe((updatedPoll) => {
      if (selectedPoll.id === updatedPoll.id) {
        setSelectedPoll(updatedPoll);
      }
    });
    return () => unsubscribe();
  }, [selectedPoll?.id]);

  // Keep badge count updated via SSE
  useEffect(() => {
    const unsubscribe = authUpdateService.subscribe((event) => {
      if (event.type === 'reset-update') {
        setPendingResetsCount((prev) => {
          // Only increment if it's a new request ID not yet counted
          return prev; // actual count managed by PendingResets component
        });
      } else if (event.type === 'reset-approved') {
        setPendingResetsCount((prev) => Math.max(0, prev - 1));
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePollCreated = () => setRefreshTrigger((prev) => prev + 1);

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
    {
      key: '5',
      label: (
        <Badge count={pendingResetsCount} size="small">
          <span style={{ paddingRight: pendingResetsCount > 0 ? 8 : 0 }}>Pending Resets</span>
        </Badge>
      ),
      children: <PendingResets onCountChange={setPendingResetsCount} />,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#001529',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Title level={2} style={{ color: 'white', margin: '16px 0' }}>
          🗳️ OpenPoll
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'white' }}>
            <UserOutlined /> {username}
          </span>
          <Button icon={<LogoutOutlined />} onClick={logout} type="default">
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
