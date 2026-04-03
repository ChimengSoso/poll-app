import { useState, useEffect } from 'react';
import { Layout, Tabs, Dropdown, Badge, Modal, Typography } from 'antd';
import { LogoutOutlined, UserOutlined, QuestionCircleOutlined } from '@ant-design/icons';
const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;
import { UserProvider, useUser } from './contexts/UserContext';
import { Login } from './components/Login';
import { CreatePoll } from './components/CreatePoll';
import { PollList } from './components/PollList';
import { VotePanel } from './components/VotePanel';
import { Results } from './components/Results';
import { TemplateList } from './components/TemplateList';
import { PendingResets } from './components/PendingResets';
import { PollHistory } from './components/PollHistory';
import { pollUpdateService } from './services/pollUpdateService';
import { authUpdateService } from './services/authUpdateService';
import { authApi } from './services/authApi';
import { templateApi } from './services/api';
import type { Poll } from './types';

function MainApp() {
  const { username, logout } = useUser();
  const [guideVisible, setGuideVisible] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [templateRefreshTrigger, setTemplateRefreshTrigger] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);
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
        // Fetch count directly because TemplateList may not be mounted (tab hidden when count=0)
        templateApi.getAllTemplates()
          .then(templates => setTemplateCount(templates.length))
          .catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch initial pending count on login (for users who join after a request was created)
  useEffect(() => {
    authApi.getPendingResets()
      .then(resets => setPendingResetsCount(resets.filter(r => r.status === 'pending').length))
      .catch(() => {});
  }, []);

  // Fetch initial template count so Recycle Bin tab shows/hides correctly on first load
  useEffect(() => {
    templateApi.getAllTemplates()
      .then(templates => setTemplateCount(templates.length))
      .catch(() => {});
  }, []);

  // Keep badge count updated via SSE
  useEffect(() => {
    const unsubscribe = authUpdateService.subscribe((event) => {
      if (event.type === 'reset-update') {
        setPendingResetsCount((prev) => Math.max(prev, 1));
      } else if (event.type === 'reset-approved' || event.type === 'reset-cancelled') {
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
    if (activeTab === '4' && templateCount === 0) setActiveTab('1');
    if (activeTab === '5' && pendingResetsCount === 0) setActiveTab('1');
  }, [selectedPoll, templateCount, pendingResetsCount, activeTab]);

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
    ...(templateCount > 0 ? [{
      key: '4',
      label: 'Recycle Bin',
      children: <TemplateList onTemplateRecover={handlePollCreated} refreshTrigger={templateRefreshTrigger} onCountChange={setTemplateCount} />,
    }] : []),
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
    {
      key: '6',
      label: 'History',
      children: <PollHistory />,
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
        <div onClick={() => setActiveTab('1')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <span style={{ fontSize: 26 }}>🗳️</span>
          <span className="logo-text">OpenPoll</span>
        </div>
        <Dropdown
          menu={{
            items: [
              { key: 'guide', icon: <QuestionCircleOutlined />, label: 'Guide' },
              { type: 'divider' },
              { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
            ],
            onClick: ({ key }) => {
              if (key === 'logout') logout();
              if (key === 'guide') setGuideVisible(true);
            },
          }}
          trigger={['click']}
        >
          <div className="user-badge">
            <UserOutlined style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }} />
            <span style={{ color: 'white', fontWeight: 500, fontSize: 14, letterSpacing: '0.04em' }}>{username}</span>
          </div>
        </Dropdown>
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center', background: '#001529', color: 'rgba(255,255,255,0.35)', fontSize: 12, padding: '12px 24px' }}>
        © {new Date().getFullYear()} OpenPoll. All rights reserved.
      </Footer>

      <Modal
        title="OpenPoll Guide"
        open={guideVisible}
        onCancel={() => setGuideVisible(false)}
        footer={null}
        width={640}
      >
        <Typography>
          <Title level={5}>🗳️ Polls</Title>
          <Paragraph>Create a poll with one or more choices. Each poll belongs to its creator (owner).</Paragraph>

          <Title level={5}>🗳️ Voting Modes</Title>
          <Paragraph>
            <Text strong>Single</Text> — each voter may pick exactly one choice.<br />
            <Text strong>Multiple</Text> — each voter may vote for any number of choices.
          </Paragraph>

          <Title level={5}>🔒 Approval Required</Title>
          <Paragraph>When enabled, voters must request access. The owner approves or rejects each request before they can vote.</Paragraph>

          <Title level={5}>👤 Anonymous Voting</Title>
          <Paragraph>Voter names are hidden from other participants. Only the poll owner can see who voted for what.</Paragraph>

          <Title level={5}>📅 Daily Reset</Title>
          <Paragraph>
            Votes are automatically cleared each day. Use <Text code>{'{date}'}</Text> or <Text code>{'{date_th}'}</Text> in the title template for a Thai date, or <Text code>{'{date_en}'}</Text> for English format.<br />
            The owner can also trigger a <Text strong>Force Daily Reset</Text> manually (requires password).
          </Paragraph>

          <Title level={5}>🔐 Close &amp; Re-open</Title>
          <Paragraph>The owner can close a poll to stop voting. Re-opening requires password confirmation. Every close is recorded in History.</Paragraph>

          <Title level={5}>📜 History</Title>
          <Paragraph>
            Every time a poll is closed, a snapshot is saved. History persists even after the poll is deleted. You can export and import history as a JSON file.<br />
            To <Text strong>delete a snapshot</Text>, any user (except the poll closer) can click the delete icon to cast a vote. The required votes equal the <Text strong>winner's vote count</Text> in that snapshot. The user who <Text strong>closed the poll</Text> cannot vote — they can only approve the deletion once the threshold is reached.
          </Paragraph>

          <Title level={5}>🗑️ Recycle Bin</Title>
          <Paragraph>Deleted polls are moved here. You can restore (recover) them back as active polls, or permanently delete them.</Paragraph>

          <Title level={5}>🔑 Forgot Password</Title>
          <Paragraph>Submit a password reset request. It requires approval votes from <Text strong>5 other users</Text> before the new password takes effect.</Paragraph>
        </Typography>
      </Modal>
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
