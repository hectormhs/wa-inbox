import { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import { useSocket } from './hooks/useSocket.js';
import Login from './components/Login.jsx';
import ConversationList from './components/ConversationList.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import Settings from './components/Settings.jsx';
import NewConversation from './components/NewConversation.jsx';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('wa_token'));
  const [agent, setAgent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wa_agent')); } catch { return null; }
  });

  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [agents, setAgents] = useState([]);
  const [filter, setFilter] = useState('open');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState('inbox'); // 'inbox' or 'settings'
  const [showNewConv, setShowNewConv] = useState(false);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations(filter, searchText);
      setConversations(data);
    } catch {}
  }, [filter, searchText]);

  useEffect(() => {
    if (token) {
      loadConversations();
      api.getAgents().then(setAgents).catch(() => {});
    }
  }, [token, loadConversations]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConvId || !token) return;
    (async () => {
      try {
        const [convData, msgs] = await Promise.all([
          api.getConversation(selectedConvId),
          api.getMessages(selectedConvId),
        ]);
        setSelectedConv(convData);
        setMessages(msgs);
        api.markRead(selectedConvId).catch(() => {});
        // Update unread count in list
        setConversations(prev => prev.map(c => c.id === selectedConvId ? { ...c, unread_count: 0 } : c));
      } catch {}
    })();
  }, [selectedConvId, token]);

  // Socket.io handlers
  const handleNewMessage = useCallback((data) => {
    const { message, conversation } = data;
    const convId = message.conversation_id || data.conversation_id;

    // Update messages if we're viewing this conversation
    if (convId === selectedConvId) {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      api.markRead(convId).catch(() => {});
    }

    // Update conversation list
    setConversations(prev => {
      const existing = prev.find(c => c.id === convId);
      if (existing) {
        return prev.map(c => c.id === convId ? {
          ...c,
          last_message_at: message.created_at,
          last_message_preview: message.content?.substring(0, 100) || '',
          unread_count: convId === selectedConvId ? 0 : (c.unread_count || 0) + (message.sender_type === 'contact' ? 1 : 0),
        } : c).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
      }
      // New conversation - reload
      loadConversations();
      return prev;
    });
  }, [selectedConvId, loadConversations]);

  const handleMessageStatus = useCallback((data) => {
    setMessages(prev => prev.map(m =>
      m.meta_message_id === data.meta_message_id ? { ...m, status: data.status } : m
    ));
  }, []);

  const handleConversationUpdated = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  useSocket(token, {
    onNewMessage: handleNewMessage,
    onMessageStatus: handleMessageStatus,
    onConversationUpdated: handleConversationUpdated,
    onConversationCreated: handleConversationUpdated,
  });

  // Actions
  const handleSendMessage = async (content) => {
    try {
      await api.sendMessage(selectedConvId, content);
    } catch (err) {
      alert('Error enviando: ' + err.message);
    }
  };

  const handleSendNote = async (content) => {
    try {
      await api.addNote(selectedConvId, content);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleSendTemplate = async (templateName, language) => {
    try {
      await api.sendTemplate(selectedConvId, templateName, language);
    } catch (err) {
      alert('Error enviando template: ' + err.message);
    }
  };

  const handleAssign = async (agentId) => {
    try {
      await api.assignAgent(selectedConvId, agentId);
      setSelectedConv(prev => ({ ...prev, assigned_agent_id: agentId }));
      loadConversations();
    } catch {}
  };

  const handleSetStatus = async (status) => {
    try {
      await api.setStatus(selectedConvId, status);
      setSelectedConv(prev => ({ ...prev, status }));
      loadConversations();
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('wa_token');
    localStorage.removeItem('wa_agent');
    setToken(null);
    setAgent(null);
  };

  if (!token) {
    return <Login onLogin={(t, a) => { setToken(t); setAgent(a); }} />;
  }

  return (
    <div className="flex h-screen">
      {page === 'settings' ? (
        <Settings agent={agent} onClose={() => setPage('inbox')} />
      ) : (
        <>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={setSelectedConvId}
            filter={filter}
            onFilterChange={setFilter}
            onSearch={setSearchText}
            agent={agent}
            onLogout={handleLogout}
            onOpenSettings={() => setPage('settings')}
            onNewConversation={() => setShowNewConv(true)}
          />
          <ChatWindow
            conversation={selectedConv}
            messages={messages}
            agents={agents}
            currentAgent={agent}
            onSendMessage={handleSendMessage}
            onSendNote={handleSendNote}
            onSendTemplate={handleSendTemplate}
            onAssign={handleAssign}
            onSetStatus={handleSetStatus}
          />
          {showNewConv && (
            <NewConversation
              onClose={() => setShowNewConv(false)}
              onCreated={(convId) => {
                setSelectedConvId(convId);
                loadConversations();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
