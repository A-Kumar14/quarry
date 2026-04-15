import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import ConverseSidebar from '../components/chat/ConverseSidebar';
import MessageThread from '../components/chat/MessageThread';
import InputBar from '../components/chat/InputBar';
import ResearchDrawer from '../components/chat/ResearchDrawer';
import { useDarkMode } from '../DarkModeContext';
import { useTopOffset } from '../SettingsContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function ConversePage() {
  const [dark] = useDarkMode();
  const topOffset = useTopOffset();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMessageId, setDrawerMessageId] = useState(null);
  const abortRef = useRef(null);
  const sentRef = useRef(false); // guard against StrictMode double-fire

  // Load sessions on mount; cancel any in-flight fetch on unmount
  useEffect(() => {
    fetchSessions();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle ?q= param from homepage search — fire once only
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !sentRef.current) {
      sentRef.current = true;
      setSearchParams({}, { replace: true }); // clean URL before send
      handleSend(q);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSessions() {
    try {
      const res = await fetch(`${API}/chat/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (_) {}
  }

  async function openSession(sessionId, branchId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const branch = session.branches.find(b => b.id === branchId) || session.branches[0];
    setActiveSessionId(sessionId);
    setActiveBranchId(branch.id);
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/branches/${branch.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        setMessages([]);
      }
    } catch (_) {
      setMessages([]);
    }
  }

  async function handleNewSession() {
    try {
      const res = await fetch(`${API}/chat/sessions`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setActiveSessionId(data.session_id);
        setActiveBranchId(data.branch_id);
        setMessages([]);
        await fetchSessions();
      }
    } catch (_) {}
  }

  async function handleSend(text) {
    if (!text.trim() || streaming) return;

    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    let sessionId = activeSessionId;
    let branchId = activeBranchId;

    // Add user message immediately
    const userMsg = {
      id: 'pending-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);

    // Add streaming placeholder
    const streamId = 'stream-' + Date.now();
    setMessages(prev => [...prev, {
      id: streamId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    }]);

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          branch_id: branchId,
          message: text,
          history,
        }),
        signal: abortRef.current?.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let researchData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === 'session') {
              sessionId = evt.session_id;
              branchId = evt.branch_id;
              setActiveSessionId(sessionId);
              setActiveBranchId(branchId);
            } else if (evt.type === 'chunk') {
              fullContent += evt.text;
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, content: fullContent } : m
              ));
            } else if (evt.type === 'sources') {
              researchData = { sources: evt.sources, contradictions: [], perspectives: [], query_used: null };
            } else if (evt.type === 'title') {
              setSessions(prev => prev.map(s =>
                s.id === sessionId ? { ...s, title: evt.title } : s
              ));
            }
          } catch (_) {}
        }
      }

      // Finalise stream message
      setMessages(prev => prev.map(m =>
        m.id === streamId
          ? { ...m, streaming: false, research_data: researchData }
          : m
      ));
    } catch (_) {}

    setStreaming(false);
    fetchSessions();
  }

  async function handleFork(messageId) {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${API}/chat/sessions/${activeSessionId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_message_id: messageId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveBranchId(data.branch_id);
        const idx = messages.findIndex(m => m.id === messageId);
        if (idx !== -1) setMessages(messages.slice(0, idx + 1));
        await fetchSessions();
      }
    } catch (_) {}
  }

  function openResearchDrawer(messageId) {
    setDrawerMessageId(messageId);
    setDrawerOpen(true);
  }

  const drawerMessage = messages.find(m => m.id === drawerMessageId) || null;
  const activeBranchLabel = sessions
    .find(s => s.id === activeSessionId)
    ?.branches.find(b => b.id === activeBranchId)
    ?.label || null;

  return (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      pt: `${topOffset + 64}px`,
      background: '#110f0d',
      overflow: 'hidden',
    }}>
      <ConverseSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        activeBranchId={activeBranchId}
        onSelectSession={openSession}
        onNewSession={handleNewSession}
      />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <MessageThread
          messages={messages}
          streaming={streaming}
          activeBranchLabel={activeBranchLabel}
          onResearch={openResearchDrawer}
          onFork={handleFork}
        />
        <InputBar onSend={handleSend} disabled={streaming} />
        <ResearchDrawer
          open={drawerOpen}
          message={drawerMessage}
          onClose={() => setDrawerOpen(false)}
        />
      </Box>
    </Box>
  );
}
