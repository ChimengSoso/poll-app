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
  const [templateRefreshTrigger, setTemplateRefreshTrigger] = useState(0);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [activeTab, setActiveTab] = useState('1');
  const [pendingResetsCount, setPendingResetsCount] = useState(0);

  useEffect(() => {
    if (!selectedPoll) return;
    const unsubscribe = pollUpdateService.subscribe((updatedPoll) => {
      if (updatedPoll.id === '__template_updated__') return;
      if (selectedPoll.id === updatedPoll.id) {
        if (updatedPoll.deleted) {
          setSelectedPoll(null);
        } else {
          setSelectedPoll(updatedPoll);
        }
      }
    });
    return () => unsubscribe();
  }, [selectedPoll?.id]);

  // Reload templates whenever a poll is deleted or a template is added/removed
  useEffect(() => {
    const unsubscribe = pollUpdateService.subscribe((updatedPoll) => {
      if (updatedPoll.deleted || updatedPoll.id === '__template_updated__') {
        setTemplateRefreshTrigger((prev) => prev + 1);
      }
    });
    return () => unsubscribe();
  }, []);

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

  // Redirect away from tabs that become hidden
  useEffect(() => {
    if (activeTab === '2' && !selectedPoll) setActiveTab('1');
    if (activeTab === '3' && (!selectedPoll || selectedPoll.totalVotes === 0)) setActiveTab('1');
    if (activeTab === '5' && pendingResetsCount === 0) setActiveTab('1');
  }, [selectedPoll, pendingResetsCount, activeTab]);

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
    ...(selectedPoll ? [
      {
        key: '2',
        label: 'Vote',
        children: <VotePanel poll={selectedPoll} onVoteSuccess={handleVoteSuccess} />,
      },
    ] : []),
    ...(selectedPoll && selectedPoll.totalVotes > 0 ? [
      {
        key: '3',
        label: 'Results',
        children: <Results poll={selectedPoll} />,
      },
    ] : []),
    {
      key: '4',
      label: 'Templates',
      children: <TemplateList onTemplateRecover={handlePollCreated} refreshTrigger={templateRefreshTrigger} />,
    },
    ...(pendingResetsCount > 0 ? [
      {
        key: '5',
        label: (
          <Badge count={pendingResetsCount} size="small">
            <span style={{ paddingRight: 8 }}>Pending Resets</span>
          </Badge>
        ),
        children: <PendingResets onCountChange={setPendingResetsCount} />,
      },
    ] : []),
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
