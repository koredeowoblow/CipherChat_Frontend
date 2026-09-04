import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import useKeyStore from '../store/keyStore';
import cryptoService from '../services/cryptoService';
import api from '../services/api';
import {
  Send, Search, LogOut, MessageSquare, Lock, Plus, X,
  Ban, UserCheck, UserX, ChevronDown, Menu, AlertCircle,
  CheckCircle2, Info, Settings, ShieldCheck,
} from 'lucide-react';

const TYPING_TIMEOUT = 2500;

// ─── Toast ────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; type: ToastType; message: string; }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type === 'success' ? 'toast-success' : t.type === 'error' ? 'toast-error' : 'toast-info'}`} role="status">
          {t.type === 'success' && <CheckCircle2 size={14} aria-hidden />}
          {t.type === 'error'   && <AlertCircle  size={14} aria-hidden />}
          {t.type === 'info'    && <Info          size={14} aria-hidden />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} aria-label="Dismiss" className="opacity-50 hover:opacity-100 transition-opacity ml-1">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Block Confirm Modal ──────────────────────────────────────
function BlockConfirmModal({ username, onConfirm, onCancel }: { username: string; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in" role="dialog" aria-modal aria-labelledby="block-title">
      <div className="card rounded-xl w-full max-w-sm mx-4 shadow-2xl animate-slide-up p-6">
        <h2 id="block-title" className="text-base font-semibold text-[#edf0ff] mb-2">Block {username}?</h2>
        <p className="text-sm text-[#8890b0] mb-6">
          {username} won't be able to send you messages or chat requests. You can unblock them later.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-secondary text-sm py-2.5 rounded-lg">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-sm font-medium transition-colors">
            Block user
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1 % name.length) * 13) % 360;
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white select-none`}
      style={{ backgroundColor: `hsl(${hue},55%,28%)`, boxShadow: `0 0 0 1px hsl(${hue},55%,42%)` }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function Chat() {
  const { isConnected, sendMessage: sendWsMessage, subscribe } = useWebSocket();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const {
    conversations, messages, activeConversationId, typingUsers,
    setConversations, setActiveConversation, setMessages,
    addMessage, updateMessagePlaintext, setTyping,
    removeConversation, updateConversation,
  } = useChatStore();

  const privateKey = useKeyStore(s => s.privateKey);
  const { sharedSecrets, setSharedSecret } = useKeyStore();

  // UI state
  const [inputMessage, setInputMessage] = useState('');
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [messageError, setMessageError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [blockConfirmUser, setBlockConfirmUser] = useState<{ id: string; username: string } | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Refs — allow stable callbacks to read latest values without being deps
  const settingsRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef(conversations);
  const messagesRef = useRef(messages);
  const privateKeyRef = useRef(privateKey);
  const sharedSecretsRef = useRef(sharedSecrets);
  const userRef = useRef(user);
  const activeConversationIdRef = useRef(activeConversationId);

  // Keep refs in sync with latest values without triggering effects
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { privateKeyRef.current = privateKey; }, [privateKey]);
  useEffect(() => { sharedSecretsRef.current = sharedSecrets; }, [sharedSecrets]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);

  // ─── Toast ────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── Derived ──────────────────────────────────────────────
  const filteredConversations = conversations.filter(conv => {
    const other = conv.participants.find((p: any) => p.user?.id !== user?.id);
    return other?.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
  });
  const activeConv = conversations.find(c => c.id === activeConversationId);
  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const otherParticipant = activeConv?.participants.find((p: any) => p.user?.id !== user?.id);
  const isPending = activeConv?.status === 'pending';
  const isInitiator = activeConv?.createdBy === user?.id;
  const isTypingNow = activeConversationId
    ? (typingUsers[activeConversationId] || []).filter(uid => uid !== user?.id).length > 0
    : false;

  // ─── Auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    // Only smooth-scroll when new messages arrive, not on initial load
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // ─── Close settings on outside click ──────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setIsSettingsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ─── Decrypt messages (stable, reads via refs) ────────────
  // Does NOT appear in any useCallback dep array — reads all values through refs.
  const decryptMessages = useCallback(async (conversationId: string, msgs: any[]) => {
    const pk = privateKeyRef.current;
    if (!pk) return;

    const conv = conversationsRef.current.find(c => c.id === conversationId);
    const other = conv?.participants.find((p: any) => p.user?.id !== userRef.current?.id);
    if (!other) return;

    let ss = sharedSecretsRef.current[conversationId];
    if (!ss) {
      try {
        const { data } = await api.get(`/users/public-key/${other.user.id}`);
        ss = cryptoService.computeSharedSecret(data.publicKey, pk);
        setSharedSecret(conversationId, ss);
      } catch { return; }
    }

    msgs.forEach(msg => {
      if (!msg.plaintext) {
        try {
          updateMessagePlaintext(conversationId, msg.id, cryptoService.decryptMessage(msg.encryptedContent, msg.iv, ss));
        } catch {
          updateMessagePlaintext(conversationId, msg.id, '⚠ Decryption failed');
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — reads everything through refs

  // ─── Fetch conversations ONCE on mount ────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/conversations');
        setConversations(data);
        // Only auto-select if no conversation is already active
        if (data.length > 0 && !activeConversationIdRef.current) {
          setActiveConversation(data[0].id);
        }
      } catch {
        showToast('Failed to load conversations.', 'error');
      } finally {
        setIsLoadingConvs(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once only

  // ─── Fetch messages when switching conversations ───────────
  useEffect(() => {
    if (!activeConversationId) return;

    // SKIP fetch if we already have cached messages for this conversation
    const cached = messagesRef.current[activeConversationId];
    if (cached && cached.length > 0) {
      // Still decrypt any not-yet-decrypted messages in cache
      decryptMessages(activeConversationId, cached);
      return;
    }

    setMessageError('');

    (async () => {
      try {
        const { data } = await api.get(`/messages/conversation/${activeConversationId}`);
        setMessages(activeConversationId, data);
        decryptMessages(activeConversationId, data);
      } catch {
        setMessageError('Failed to load messages.');
      }
    })();
  }, [activeConversationId, decryptMessages, setMessages]);

  // ─── WebSocket subscription (stable, reads via refs) ──────
  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      const { type, payload } = msg;

      if (type === 'message:new') {
        addMessage(payload);
        decryptMessages(payload.conversationId, [payload]);

      } else if (type === 'conversation:new') {
        const existing = conversationsRef.current.find(c => c.id === payload.id);
        if (!existing) {
          setConversations([payload, ...conversationsRef.current]);
          showToast('New chat request.', 'info');
        }

      } else if (type === 'conversation:accepted') {
        const conv = conversationsRef.current.find(c => c.id === payload.conversationId);
        if (conv) {
          updateConversation({ ...conv, status: 'accepted' });
          const name = conv.participants.find((p: any) => p.user?.id !== userRef.current?.id)?.user?.username;
          showToast(`${name || 'Someone'} accepted your chat request.`, 'success');
        }

      } else if (type === 'conversation:rejected') {
        removeConversation(payload.conversationId);
        if (activeConversationIdRef.current === payload.conversationId) setActiveConversation(null);
        showToast('Chat request declined.', 'info');

      } else if (type === 'user:typing') {
        setTyping(payload.conversationId, payload.userId, payload.isTyping);
        if (payload.isTyping) {
          setTimeout(() => setTyping(payload.conversationId, payload.userId, false), TYPING_TIMEOUT + 500);
        }
      }
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]); // subscribe is stable; other deps read through refs

  // ─── Send message ─────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConversationId || !privateKey || !otherParticipant) return;

    const text = inputMessage;
    setInputMessage(''); // clear immediately — optimistic

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendWsMessage({ type: 'user:typing', payload: { conversationId: activeConversationId, isTyping: false } });

    try {
      let ss = sharedSecrets[activeConversationId];
      if (!ss) {
        const { data } = await api.get(`/users/public-key/${otherParticipant.user.id}`);
        ss = cryptoService.computeSharedSecret(data.publicKey, privateKey);
        setSharedSecret(activeConversationId, ss);
      }
      const enc = cryptoService.encryptMessage(text, ss);
      const { data } = await api.post('/messages', {
        conversationId: activeConversationId,
        encryptedContent: enc.ciphertext,
        encryptedSessionKey: 'dummy',
        iv: enc.nonce,
        authTag: 'dummy',
      });
      addMessage({
        id: data.id, conversationId: activeConversationId,
        senderId: user!.id, encryptedContent: enc.ciphertext,
        encryptedSessionKey: 'dummy', iv: enc.nonce,
        authTag: 'dummy', createdAt: data.createdAt, plaintext: text,
      });
    } catch {
      setInputMessage(text); // restore on failure
      showToast('Failed to send. Try again.', 'error');
    }
  };

  // ─── Typing indicator ─────────────────────────────────────
  const handleInputKeyDown = () => {
    if (!activeConversationId) return;
    sendWsMessage({ type: 'user:typing', payload: { conversationId: activeConversationId, isTyping: true } });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() =>
      sendWsMessage({ type: 'user:typing', payload: { conversationId: activeConversationId, isTyping: false } })
    , TYPING_TIMEOUT);
  };

  // ─── User search ──────────────────────────────────────────
  const handleSearchUsers = async (q: string) => {
    setUserSearchQuery(q);
    if (!q.trim()) { setUserSearchResults([]); return; }
    setIsSearchingUsers(true);
    try {
      const { data } = await api.get(`/users/search?q=${q}`);
      setUserSearchResults(data.filter((u: any) => u.id !== user?.id));
    } catch { showToast('Search failed.', 'error'); }
    finally { setIsSearchingUsers(false); }
  };

  // ─── Start chat ───────────────────────────────────────────
  const handleStartChat = async (recipientId: string) => {
    try {
      const { data } = await api.post('/conversations/direct', { recipientId });
      if (!conversationsRef.current.find(c => c.id === data.id)) {
        setConversations([data, ...conversationsRef.current]);
      }
      setActiveConversation(data.id);
      setIsNewChatOpen(false);
      setUserSearchQuery('');
      setUserSearchResults([]);
      setIsSidebarOpen(false);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to start chat.', 'error');
    }
  };

  // ─── Accept / Reject ──────────────────────────────────────
  const handleAcceptRequest = async () => {
    if (!activeConversationId) return;
    try {
      const { data } = await api.post(`/conversations/${activeConversationId}/accept`);
      updateConversation(data);
      showToast('Chat accepted!', 'success');
    } catch { showToast('Failed to accept.', 'error'); }
  };

  const handleRejectRequest = async () => {
    if (!activeConversationId) return;
    try {
      await api.post(`/conversations/${activeConversationId}/reject`);
      removeConversation(activeConversationId);
      setActiveConversation(null);
      showToast('Request declined.', 'info');
    } catch { showToast('Failed to decline.', 'error'); }
  };

  // ─── Block ────────────────────────────────────────────────
  const handleBlockConfirmed = async () => {
    if (!blockConfirmUser) return;
    const { id, username } = blockConfirmUser;
    setBlockConfirmUser(null);
    try {
      await api.post('/users/block', { blockedUserId: id });
      showToast(`${username} blocked.`, 'success');
    } catch { showToast('Failed to block user.', 'error'); }
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <>
    <div className="flex h-screen overflow-hidden" style={{ background: '#0b0d14', color: '#c8ccee' }}>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside
        className={`w-[280px] flex-shrink-0 flex flex-col z-30 transition-transform duration-300 fixed md:relative inset-y-0 left-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: '#0e1019', borderRight: '1px solid #1c1f32' }}
        aria-label="Conversations"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid #1c1f32' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-500 flex items-center justify-center flex-shrink-0" aria-hidden>
              <Lock size={13} className="text-white" />
            </div>
            <span className="text-[#edf0ff] font-semibold text-sm tracking-tight">CipherChat</span>
          </div>
          <button onClick={logout} aria-label="Log out" title="Log out" className="p-1.5 rounded-lg text-[#3a3f5c] hover:text-[#8890b0] hover:bg-[#171b2d] transition-colors">
            <LogOut size={16} aria-hidden />
          </button>
        </div>

        {/* Current user strip */}
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid #1c1f32' }}>
          {user && <Avatar name={user.username} size="sm" />}
          <div className="min-w-0">
            <p className="text-[#edf0ff] text-sm font-medium truncate">{user?.username}</p>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-[#3a3f5c]'}`} aria-hidden />
              <span className="text-[11px] text-[#3a3f5c]">{isConnected ? 'Connected' : 'Reconnecting…'}</span>
            </div>
          </div>
        </div>

        {/* Search + new */}
        <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: '1px solid #1c1f32' }}>
          <div className="relative flex-1 min-w-0">
            <label htmlFor="conv-search" className="sr-only">Search conversations</label>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#3a3f5c] pointer-events-none" aria-hidden />
            <input
              id="conv-search" type="search" placeholder="Search…"
              className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md transition-all outline-none"
              style={{ background: '#0b0d14', border: '1px solid #252840', color: '#c8ccee' }}
              onFocus={e => (e.target.style.borderColor = '#5c65f5')}
              onBlur={e => (e.target.style.borderColor = '#252840')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsNewChatOpen(true)}
            aria-label="New chat" title="New chat"
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-accent-600 hover:bg-accent-500 text-white transition-colors"
          >
            <Plus size={15} aria-hidden />
          </button>
        </div>

        {/* List */}
        <nav className="flex-1 overflow-y-auto py-1" aria-label="Conversations">
          {isLoadingConvs ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#252840', borderTopColor: '#5c65f5' }} role="status" aria-label="Loading" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center py-12 px-6 text-center gap-3">
              <MessageSquare size={28} className="text-[#252840]" aria-hidden />
              <p className="text-sm text-[#3a3f5c]">{searchQuery ? 'No matches' : 'No conversations yet'}</p>
              {!searchQuery && (
                <button onClick={() => setIsNewChatOpen(true)} className="text-xs text-accent-400 hover:text-accent-300 transition-colors">
                  Start your first chat →
                </button>
              )}
            </div>
          ) : (
            filteredConversations.map(conv => {
              const otherUser = conv.participants.find((p: any) => p.user?.id !== user?.id)?.user;
              const isActive = activeConversationId === conv.id;
              const convTyping = (typingUsers[conv.id] || []).filter(uid => uid !== user?.id).length > 0;
              const isPendingConv = conv.status === 'pending';

              return (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConversation(conv.id); setIsSidebarOpen(false); }}
                  aria-label={`Chat with ${otherUser?.username || 'Unknown'}${isPendingConv ? ' (pending)' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: isActive ? '#171b2d' : 'transparent',
                    borderLeft: `2px solid ${isActive ? '#5c65f5' : 'transparent'}`,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#131520'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="relative">
                    {otherUser && <Avatar name={otherUser.username} size="sm" />}
                    {isPendingConv && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-[#0e1019]" aria-hidden />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate" style={{ color: isActive ? '#edf0ff' : '#c8ccee' }}>
                        {otherUser?.username || 'Unknown'}
                      </span>
                      {isPendingConv && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                          {conv.createdBy === user?.id ? 'sent' : 'request'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: convTyping ? '#5c65f5' : '#3a3f5c' }}>
                      {convTyping ? 'typing…' : new Date(conv.lastMessageAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </nav>
      </aside>

      {/* ── MAIN CHAT ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ background: '#0b0d14' }}>
        {activeConversationId ? (
          <>
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: '#0e1019', borderBottom: '1px solid #1c1f32' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1.5 rounded-md text-[#3a3f5c] hover:text-[#8890b0] transition-colors mr-1" aria-label="Open sidebar">
                  <Menu size={18} aria-hidden />
                </button>
                {otherParticipant?.user && <Avatar name={otherParticipant.user.username} />}
                <div className="min-w-0">
                  <h1 className="text-sm font-semibold text-[#edf0ff] truncate">{otherParticipant?.user.username}</h1>
                  <div className="flex items-center gap-1" style={{ color: '#3a3f5c' }}>
                    <ShieldCheck size={10} aria-hidden />
                    <span className="text-[10px]">End-to-end encrypted</span>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setIsSettingsOpen(v => !v)}
                  aria-label="Conversation settings"
                  aria-haspopup="menu"
                  aria-expanded={isSettingsOpen}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[#3a3f5c] hover:text-[#8890b0] hover:bg-[#171b2d] transition-colors"
                >
                  <Settings size={15} aria-hidden />
                  <ChevronDown size={12} className={`transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {isSettingsOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-1.5 w-48 rounded-lg shadow-xl animate-fade-in z-50 overflow-hidden" style={{ background: '#111320', border: '1px solid #252840' }}>
                    <button
                      role="menuitem"
                      onClick={() => { setIsSettingsOpen(false); if (otherParticipant) setBlockConfirmUser({ id: otherParticipant.user.id, username: otherParticipant.user.username }); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/8 transition-colors"
                    >
                      <Ban size={14} aria-hidden /> Block {otherParticipant?.user.username}
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-3" role="log" aria-live="polite" aria-label="Messages">
              {messageError ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <AlertCircle className="text-red-400" size={32} aria-hidden />
                  <p className="text-sm text-[#8890b0]">{messageError}</p>
                  <button
                    onClick={() => { setMessageError(''); setActiveConversation(activeConversationId); }}
                    className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-[#252840]">
                  <Lock size={24} aria-hidden />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              ) : (
                activeMessages.map(msg => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex msg-enter ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[70%] md:max-w-[60%] px-4 py-2.5 text-sm leading-relaxed break-words"
                        style={isMine
                          ? { background: '#3238c4', color: '#edf0ff', borderRadius: '18px 18px 4px 18px' }
                          : { background: '#171b2d', color: '#c8ccee', border: '1px solid #252840', borderRadius: '18px 18px 18px 4px' }
                        }
                      >
                        {msg.plaintext || (
                          <span className="flex items-center gap-1.5 opacity-50 italic text-xs">
                            <Lock size={10} aria-hidden /> Decrypting…
                          </span>
                        )}
                        <time
                          className="block text-[10px] mt-1"
                          style={{ color: isMine ? 'rgba(237,240,255,0.4)' : '#3a3f5c', textAlign: 'right' }}
                          dateTime={msg.createdAt}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} aria-hidden />
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 px-4 md:px-8 py-4" style={{ borderTop: '1px solid #1c1f32' }}>
              {isTypingNow && (
                <div className="flex items-center gap-2 mb-2.5" aria-live="polite">
                  <div className="flex gap-0.5" aria-hidden>
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-[#3a3f5c]">{otherParticipant?.user.username} is typing…</span>
                </div>
              )}

              {isPending && !isInitiator ? (
                <div className="space-y-3">
                  <p className="text-center text-sm text-[#8890b0]">
                    <span className="text-[#edf0ff] font-medium">{otherParticipant?.user.username}</span> wants to start a conversation.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleRejectRequest} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/8 transition-colors" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                      <UserX size={14} aria-hidden /> Decline
                    </button>
                    <button onClick={handleAcceptRequest} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium text-white bg-accent-600 hover:bg-accent-500 transition-colors">
                      <UserCheck size={14} aria-hidden /> Accept
                    </button>
                  </div>
                </div>
              ) : isPending && isInitiator ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden />
                  <span className="text-sm text-[#3a3f5c]">Waiting for {otherParticipant?.user.username} to accept…</span>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2" aria-label="Send a message">
                  <label htmlFor="message-input" className="sr-only">Type your message</label>
                  <input
                    id="message-input"
                    type="text"
                    placeholder="Message…"
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ background: '#111320', border: '1px solid #252840', color: '#edf0ff' }}
                    onFocus={e => (e.target.style.borderColor = '#5c65f5')}
                    onBlur={e => (e.target.style.borderColor = '#252840')}
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    aria-label="Send message"
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-accent-600 hover:bg-accent-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all active:scale-95"
                  >
                    <Send size={16} aria-hidden />
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden absolute top-4 left-4 p-1.5 rounded-md text-[#3a3f5c] hover:text-[#8890b0] transition-colors" aria-label="Open sidebar">
              <Menu size={18} aria-hidden />
            </button>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: '#111320', border: '1px solid #252840' }}>
              <Lock size={24} className="text-accent-500" aria-hidden />
            </div>
            <h1 className="text-lg font-semibold text-[#edf0ff] mb-2">No conversation selected</h1>
            <p className="text-sm text-[#3a3f5c] max-w-xs mb-6 leading-relaxed">
              Pick a conversation from the sidebar, or start a new encrypted chat.
            </p>
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-600 hover:bg-accent-500 transition-colors"
            >
              <Plus size={15} aria-hidden /> New conversation
            </button>
          </div>
        )}
      </main>
    </div>

    {/* New Chat Modal */}
    {isNewChatOpen && (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 animate-fade-in"
        role="dialog" aria-modal aria-labelledby="new-chat-title"
        onClick={e => { if (e.target === e.currentTarget) setIsNewChatOpen(false); }}
      >
        <div className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden animate-slide-up" style={{ background: '#111320', border: '1px solid #252840' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1c1f32' }}>
            <h2 id="new-chat-title" className="text-base font-semibold text-[#edf0ff]">New conversation</h2>
            <button onClick={() => setIsNewChatOpen(false)} aria-label="Close" className="p-1 rounded-md text-[#3a3f5c] hover:text-[#8890b0] transition-colors">
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="p-4" style={{ borderBottom: '1px solid #1c1f32' }}>
            <label htmlFor="user-search" className="sr-only">Search by username</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3f5c] pointer-events-none" aria-hidden />
              <input
                id="user-search" type="search" placeholder="Search by username…"
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: '#0b0d14', border: '1px solid #252840', color: '#edf0ff' }}
                onFocus={e => (e.target.style.borderColor = '#5c65f5')}
                onBlur={e => (e.target.style.borderColor = '#252840')}
                value={userSearchQuery}
                onChange={e => handleSearchUsers(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-2" role="listbox" aria-label="Search results">
            {isSearchingUsers ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#252840', borderTopColor: '#5c65f5' }} role="status" />
              </div>
            ) : userSearchResults.length > 0 ? (
              userSearchResults.map(u => (
                <button
                  key={u.id} role="option" aria-selected="false"
                  onClick={() => handleStartChat(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = '#171b2d')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar name={u.username} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#edf0ff] truncate">{u.username}</p>
                    <p className="text-xs text-[#3a3f5c] capitalize">{u.status || 'offline'}</p>
                  </div>
                </button>
              ))
            ) : userSearchQuery ? (
              <p className="text-center text-sm text-[#3a3f5c] py-10">No users found for "{userSearchQuery}"</p>
            ) : (
              <p className="text-center text-sm text-[#3a3f5c] py-10 px-4">Search for someone to start a private conversation.</p>
            )}
          </div>
        </div>
      </div>
    )}

    {blockConfirmUser && <BlockConfirmModal username={blockConfirmUser.username} onConfirm={handleBlockConfirmed} onCancel={() => setBlockConfirmUser(null)} />}
    <ToastContainer toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
    </>
  );
}
