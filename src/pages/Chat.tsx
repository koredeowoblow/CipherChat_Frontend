import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import useKeyStore from '../store/keyStore';
import cryptoService from '../services/cryptoService';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import {
  Send, Search, LogOut, MessageSquare, Lock, Plus, X,
  Ban, UserCheck, UserX, ChevronDown, Menu, AlertCircle,
  CheckCircle2, Info, Settings, ShieldCheck, Download,
  Mic, Trash2, Image as ImageIcon, Reply
} from 'lucide-react';
import Avatar from '../components/Avatar';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏'];

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
        <h2 id="block-title" className="text-base font-semibold text-ui-bright mb-2">Block {username}?</h2>
        <p className="text-sm text-ui-subtle mb-6">
          {username} won't be able to send you messages or chat requests. You can unblock them later.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-secondary text-sm py-2.5 rounded-lg">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors opacity-90 hover:opacity-100" style={{ background: 'var(--color-ui-danger)' }}>
            Block user
          </button>
        </div>
      </div>
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
    onlineUsers, setOnlineStatus, updateMessageReactions
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
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Refs — allow stable callbacks to read latest values without being deps
  const settingsRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Request Notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
        showToast('We couldn\'t load your conversations. Please check your connection.', 'error');
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
        setMessageError('We couldn\'t load messages for this conversation.');
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
        
        // Notify if it's from someone else and we're not actively looking at it
        if (payload.senderId !== userRef.current?.id) {
          if (document.hidden || activeConversationIdRef.current !== payload.conversationId) {
            if ('Notification' in window && Notification.permission === 'granted') {
              const conv = conversationsRef.current.find(c => c.id === payload.conversationId);
              const senderName = conv?.participants.find((p: any) => p.user?.id === payload.senderId)?.user?.username || 'Someone';
              new Notification(`New message from ${senderName}`, {
                body: 'You have a new encrypted message.'
              });
            }
          }
        }

      } else if (type === 'conversation:new') {
        const existing = conversationsRef.current.find(c => c.id === payload.id);
        if (!existing) {
          setConversations([payload, ...conversationsRef.current]);
          showToast('You have a new chat request.', 'info');
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
      } else if (type === 'user:online') {
        setOnlineStatus(payload.userId, payload.isOnline);
      } else if (type === 'message:reaction') {
        updateMessageReactions(payload.conversationId, payload.messageId, payload.reactions);
      }
    });

    return () => { unsubscribe(); };
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

    // Ensure dummy reaction array in optimistic message
    try {
      let ss = sharedSecrets[activeConversationId];
      if (!ss) {
        const { data } = await api.get(`/users/public-key/${otherParticipant.user.id}`);
        ss = cryptoService.computeSharedSecret(data.publicKey, privateKey);
        setSharedSecret(activeConversationId, ss);
      }
      const payloadObj: any = { type: 'text', content: text };
      if (replyingToMessage) {
        let preview = 'Message';
        try {
          const data = JSON.parse(replyingToMessage.plaintext);
          if (data.type === 'text') preview = data.content;
          else if (data.type === 'audio') preview = 'Audio message';
          else if (data.type === 'image') preview = 'Image message';
        } catch { preview = replyingToMessage.plaintext || 'Message'; }
        payloadObj.replyTo = { id: replyingToMessage.id, preview };
      }
      const payloadStr = JSON.stringify(payloadObj);
      const enc = cryptoService.encryptMessage(payloadStr, ss);
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
        authTag: 'dummy', createdAt: data.createdAt, plaintext: payloadStr,
        reactions: []
      });
      setReplyingToMessage(null);
    } catch {
      setInputMessage(text); // restore on failure
      showToast('Failed to send. Try again.', 'error');
    }
  };

  // ─── Voice Notes ──────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      showToast('Microphone access denied or not available.', 'error');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const sendRecording = () => {
    if (!mediaRecorderRef.current || !activeConversationId || !privateKey || !otherParticipant) return;

    mediaRecorderRef.current.onstop = async () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);

      if (audioChunksRef.current.length === 0) return;

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64AudioMessage = reader.result as string;
        
        try {
          let ss = sharedSecrets[activeConversationId];
          if (!ss) {
            const { data } = await api.get(`/users/public-key/${otherParticipant.user.id}`);
            ss = cryptoService.computeSharedSecret(data.publicKey, privateKey);
            setSharedSecret(activeConversationId, ss);
          }
          const payloadObj: any = { type: 'audio', content: base64AudioMessage };
          if (replyingToMessage) {
            let preview = 'Message';
            try {
              const data = JSON.parse(replyingToMessage.plaintext);
              if (data.type === 'text') preview = data.content;
              else if (data.type === 'audio') preview = 'Audio message';
              else if (data.type === 'image') preview = 'Image message';
            } catch { preview = replyingToMessage.plaintext || 'Message'; }
            payloadObj.replyTo = { id: replyingToMessage.id, preview };
          }
          const payloadStr = JSON.stringify(payloadObj);
          const enc = cryptoService.encryptMessage(payloadStr, ss);
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
            authTag: 'dummy', createdAt: data.createdAt, plaintext: payloadStr,
          });
          setReplyingToMessage(null);
        } catch {
          showToast('Failed to send voice note.', 'error');
        }
      };
      
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
  };

  // ─── Image Upload ─────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        // Resize logic (max 1280px)
        const MAX_SIZE = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);

        const base64Image = canvas.toDataURL('image/jpeg', 0.8);

        // Encrypt and send
        if (!activeConversationId || !privateKey || !otherParticipant) return;
        try {
          let ss = sharedSecrets[activeConversationId];
          if (!ss) {
            const { data } = await api.get(`/users/public-key/${otherParticipant.user.id}`);
            ss = cryptoService.computeSharedSecret(data.publicKey, privateKey);
            setSharedSecret(activeConversationId, ss);
          }
          const payloadObj: any = { type: 'image', content: base64Image };
          if (replyingToMessage) {
            let preview = 'Message';
            try {
              const data = JSON.parse(replyingToMessage.plaintext);
              if (data.type === 'text') preview = data.content;
              else if (data.type === 'audio') preview = 'Audio message';
              else if (data.type === 'image') preview = 'Image message';
            } catch { preview = replyingToMessage.plaintext || 'Message'; }
            payloadObj.replyTo = { id: replyingToMessage.id, preview };
          }
          const payloadStr = JSON.stringify(payloadObj);
          const enc = cryptoService.encryptMessage(payloadStr, ss);
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
            authTag: 'dummy', createdAt: data.createdAt, plaintext: payloadStr,
          });
          setReplyingToMessage(null);
        } catch {
          showToast('Failed to send image.', 'error');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const renderMessageContent = (plaintext: string | undefined) => {
    if (!plaintext) {
      return (
        <span className="flex items-center gap-1.5 opacity-50 italic text-xs">
          <Lock size={10} aria-hidden /> Decrypting…
        </span>
      );
    }
    
    try {
      const data = JSON.parse(plaintext);
      
      const replyBubble = data.replyTo ? (
        <div 
          className="bg-black/10 dark:bg-white/10 p-2 rounded-md mb-1.5 border-l-2 border-accent-400 text-xs overflow-hidden text-ellipsis cursor-pointer hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
        >
          {data.replyTo.preview}
        </div>
      ) : null;

      if (data.type === 'audio') {
        return (
          <div className="flex flex-col">
            {replyBubble}
            <audio src={data.content} controls className="max-w-[200px] sm:max-w-xs outline-none h-10" />
          </div>
        );
      } else if (data.type === 'image') {
        return (
          <div className="flex flex-col">
            {replyBubble}
            <img src={data.content} alt="Encrypted attachment" className="max-w-[200px] sm:max-w-xs rounded-xl" />
          </div>
        );
      } else if (data.type === 'text') {
        return (
          <div className="flex flex-col">
            {replyBubble}
            <span>{data.content}</span>
          </div>
        );
      }
    } catch (e) {
      // Fallback for older messages that weren't JSON stringified
      return <span>{plaintext}</span>;
    }
    
    return <span>{plaintext}</span>;
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await api.post(`/messages/${messageId}/react`, { emoji });
      setHoveredMessageId(null);
    } catch {
      showToast('Failed to add reaction', 'error');
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
      showToast('Chat request accepted!', 'success');
    } catch { showToast('We couldn\'t accept the request. Please try again.', 'error'); }
  };

  const handleRejectRequest = async () => {
    if (!activeConversationId) return;
    try {
      await api.post(`/conversations/${activeConversationId}/reject`);
      removeConversation(activeConversationId);
      setActiveConversation(null);
      showToast('Chat request declined.', 'info');
    } catch { showToast('We couldn\'t decline the request. Please try again.', 'error'); }
  };

  // ─── Block ────────────────────────────────────────────────
  const handleBlockConfirmed = async () => {
    if (!blockConfirmUser) return;
    const { id, username } = blockConfirmUser;
    setBlockConfirmUser(null);
    try {
      await api.post('/users/block', { blockedUserId: id });
      showToast(`${username} has been blocked.`, 'success');
    } catch { showToast('We couldn\'t block this user. Please try again.', 'error'); }
  };

  // ─── Extract Active Now Users ─────────────────────────────
  const activeNowUsers = React.useMemo(() => {
    const usersMap = new Map();
    conversations.forEach(conv => {
      const otherUser = conv.participants.find((p: any) => p.user?.id !== user?.id)?.user;
      if (otherUser && onlineUsers[otherUser.id] && !usersMap.has(otherUser.id)) {
        usersMap.set(otherUser.id, { ...otherUser, conversationId: conv.id });
      }
    });
    return Array.from(usersMap.values());
  }, [conversations, onlineUsers, user?.id]);

  // ─── Export Key ───────────────────────────────────────────
  const handleExportKey = () => {
    try {
      const encryptedKeyStr = localStorage.getItem('encryptedPrivateKey');
      if (!encryptedKeyStr) {
        showToast('No private key found on this device.', 'error');
        return;
      }
      const blob = new Blob([encryptedKeyStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cipherchat-key.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Your key file has been downloaded successfully.', 'success');
    } catch {
      showToast('We couldn\'t export your key. Please try again.', 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <>
    <div className="flex h-screen overflow-hidden bg-ui-base text-ui-primary">

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside
        className={`w-[280px] flex-shrink-0 flex flex-col z-30 transition-transform duration-300 fixed md:relative inset-y-0 left-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} bg-ui-surface border-r border-ui-border2`}
        aria-label="Conversations"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-ui-border2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-500 flex items-center justify-center flex-shrink-0" aria-hidden>
              <Lock size={13} className="text-white" />
            </div>
            <span className="text-ui-bright font-semibold text-sm tracking-tight">CipherChat</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button onClick={handleExportKey} aria-label="Export key" className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-ui-muted hover:text-ui-subtle hover:bg-ui-elevated transition-colors">
              <Download size={16} aria-hidden />
            </button>
            <button onClick={logout} aria-label="Log out" className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-ui-muted hover:text-ui-subtle hover:bg-ui-elevated transition-colors">
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>

        {/* Current user strip */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-ui-border2">
          {user && <Avatar name={user.username} size="sm" />}
          <div className="min-w-0">
            <p className="text-ui-bright text-sm font-medium truncate">{user?.username}</p>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[var(--color-ui-success)]' : 'bg-[var(--color-ui-muted)]'}`} aria-hidden />
              <span className="text-[11px] text-ui-muted">{isConnected ? 'Connected' : 'Reconnecting…'}</span>
            </div>
          </div>
        </div>

        {/* Search + new */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-ui-border2">
          <div className="relative flex-1 min-w-0">
            <label htmlFor="conv-search" className="sr-only">Search conversations</label>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-muted pointer-events-none" aria-hidden />
            <input
              id="conv-search" type="search" placeholder="Search…"
              className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md transition-all outline-none"
              style={{ background: 'var(--color-ui-base)', border: '1px solid var(--color-ui-border)', color: 'var(--color-ui-primary)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent-500)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-ui-border)')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsNewChatOpen(true)}
            aria-label="New chat"
            className="w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center rounded-md bg-accent-600 hover:bg-accent-500 text-white transition-colors"
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>

        {/* Active Now Carousel */}
        {!searchQuery && activeNowUsers.length > 0 && (
          <div className="pt-3 pb-2 border-b border-ui-border2">
            <h3 className="px-4 text-xs font-semibold text-ui-muted mb-2 uppercase tracking-wider">Active Now</h3>
            <div className="flex overflow-x-auto gap-3 px-4 pb-2 snap-x scrollbar-hide">
              {activeNowUsers.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => { setActiveConversation(u.conversationId); setIsSidebarOpen(false); }}
                  className="flex flex-col items-center gap-1.5 min-w-[56px] snap-start group"
                  aria-label={`Chat with ${u.username}`}
                >
                  <div className="transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                    <Avatar name={u.username} size="lg" isOnline={true} />
                  </div>
                  <span className="text-[10px] text-ui-primary font-medium w-full truncate text-center opacity-80 group-hover:opacity-100 transition-opacity">
                    {u.username.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        <nav className="flex-1 overflow-y-auto py-1" aria-label="Conversations">
          {isLoadingConvs ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-ui-border)', borderTopColor: 'var(--color-accent-500)' }} role="status" aria-label="Loading" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center py-12 px-6 text-center gap-3">
              <MessageSquare size={28} className="text-[var(--color-ui-border)]" aria-hidden />
              <p className="text-sm text-ui-muted">{searchQuery ? 'No matches' : 'No conversations yet'}</p>
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-l-2 ${
                    isActive ? 'bg-ui-elevated border-accent-500' : 'border-transparent hover:bg-ui-elevated'
                  }`}
                >
                  {otherUser && (
                    <Avatar 
                      name={otherUser.username} 
                      size="sm" 
                      isOnline={!isPendingConv && !!onlineUsers[otherUser.id]}
                      hasWarningBadge={isPendingConv}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium truncate ${isActive ? 'text-ui-bright' : 'text-ui-primary'}`}>
                        {otherUser?.username || 'Unknown'}
                      </span>
                      {isPendingConv && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-ui-warning-bg)', color: 'var(--color-ui-warning)', border: '1px solid var(--color-ui-warning-border)' }}>
                          {conv.createdBy === user?.id ? 'sent' : 'request'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: convTyping ? 'var(--color-accent-500)' : 'var(--color-ui-muted)' }}>
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
      <main className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ background: 'var(--color-ui-base)' }}>
        {activeConversationId ? (
          <>
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--color-ui-surface)', borderBottom: '1px solid var(--color-ui-border2)' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-md text-ui-muted hover:text-ui-subtle transition-colors" aria-label="Open sidebar">
                  <Menu size={20} aria-hidden />
                </button>
                {otherParticipant?.user && (
                  <Avatar 
                    name={otherParticipant.user.username} 
                    isOnline={!!onlineUsers[otherParticipant.user.id]} 
                  />
                )}
                <div className="min-w-0">
                  <h1 className="text-sm font-semibold text-ui-bright truncate">{otherParticipant?.user.username}</h1>
                  <div className="flex items-center gap-1 text-ui-muted">
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
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md text-ui-muted hover:text-ui-subtle hover:bg-ui-elevated transition-colors"
                >
                  <Settings size={15} aria-hidden />
                  <ChevronDown size={12} className={`transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {isSettingsOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-1.5 w-48 rounded-lg shadow-xl animate-fade-in z-50 overflow-hidden bg-ui-surface border border-ui-border">
                    <button
                      role="menuitem"
                      onClick={() => { setIsSettingsOpen(false); if (otherParticipant) setBlockConfirmUser({ id: otherParticipant.user.id, username: otherParticipant.user.username }); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--color-ui-danger)] hover:bg-[var(--color-ui-danger-bg)] transition-colors"
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
                  <p className="text-sm text-ui-subtle">{messageError}</p>
                  <button
                    onClick={() => { setMessageError(''); setActiveConversation(activeConversationId); }}
                    className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-ui-border)]">
                  <Lock size={24} aria-hidden />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              ) : (
                activeMessages.map(msg => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex msg-enter ${isMine ? 'justify-end' : 'justify-start'} group relative`}
                      onMouseEnter={() => setHoveredMessageId(msg.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                    >
                      {/* Reaction Menu */}
                      {hoveredMessageId === msg.id && (
                         <div className={`absolute -top-11 ${isMine ? 'right-4' : 'left-4'} flex bg-ui-surface border border-ui-border rounded-full shadow-lg p-1 z-10 animate-fade-in gap-1`}>
                            {EMOJIS.map(e => (
                               <button key={e} onClick={() => handleReact(msg.id, e)} className="hover:bg-ui-elevated rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors text-lg" aria-label={`React with ${e}`}>{e}</button>
                            ))}
                            <div className="w-px h-6 bg-ui-border mx-1 self-center" aria-hidden />
                            <button onClick={() => setReplyingToMessage(msg)} className="hover:bg-ui-elevated rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors text-ui-muted hover:text-ui-primary" aria-label="Reply to message">
                              <Reply size={18} aria-hidden />
                            </button>
                         </div>
                      )}
                      
                      <div className="flex flex-col relative max-w-[85%] md:max-w-[75%] min-w-0">
                        <div
                          className={`px-4 py-2.5 text-sm leading-relaxed break-words [word-break:break-word] relative ${
                            isMine 
                              ? 'bg-accent-500 text-white rounded-[18px_18px_4px_18px]' 
                              : 'bg-ui-elevated text-ui-primary border border-ui-border rounded-[18px_18px_18px_4px]'
                          }`}
                        >
                          {renderMessageContent(msg.plaintext)}
                          <time
                            className={`block text-[10px] mt-1 text-right ${isMine ? 'text-accent-100' : 'text-ui-muted'}`}
                            dateTime={msg.createdAt}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </time>
                        </div>
                        
                        {/* Reactions Display */}
                        {msg.reactions && msg.reactions.length > 0 && (
                           <div className={`flex flex-wrap gap-1 mt-1 z-10 -ml-1 -mr-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => (
                                 <button 
                                   key={emoji} 
                                   onClick={() => handleReact(msg.id, emoji)}
                                   className={`flex items-center gap-1 bg-ui-surface border text-xs rounded-full px-2 py-0.5 shadow-sm transition-colors ${
                                     msg.reactions!.some(r => r.emoji === emoji && r.userId === user?.id) 
                                       ? 'border-accent-500 bg-accent-500/10' 
                                       : 'border-ui-border hover:bg-ui-elevated'
                                   }`}
                                 >
                                    <span>{emoji}</span>
                                    <span className="text-ui-subtle">{msg.reactions!.filter(r => r.emoji === emoji).length}</span>
                                 </button>
                              ))}
                           </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} aria-hidden />
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 px-4 md:px-8 py-4 border-t border-ui-border2 relative">
              {replyingToMessage && (
                <div className="flex items-center justify-between bg-ui-elevated p-2 mb-2 rounded-lg border border-ui-border absolute bottom-full left-4 right-4 md:left-8 md:right-8 -translate-y-2 shadow-sm animate-slide-up z-20">
                  <div className="flex flex-col overflow-hidden text-sm pl-2 border-l-2 border-accent-500">
                    <span className="text-accent-500 font-semibold text-xs">Replying to message</span>
                    <span className="text-ui-subtle truncate max-w-[200px] md:max-w-md">
                      {(() => {
                        let preview = replyingToMessage.plaintext;
                        try {
                          const data = JSON.parse(replyingToMessage.plaintext);
                          if (data.type === 'text') preview = data.content;
                          else if (data.type === 'audio') preview = 'Audio message';
                          else if (data.type === 'image') preview = 'Image message';
                        } catch {}
                        return preview;
                      })()}
                    </span>
                  </div>
                  <button onClick={() => setReplyingToMessage(null)} aria-label="Cancel reply" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ui-muted hover:text-ui-primary rounded-md transition-colors mr-1">
                    <X size={18} aria-hidden />
                  </button>
                </div>
              )}

              {isTypingNow && (
                <div className="flex items-center gap-2 mb-2.5" aria-live="polite">
                  <div className="flex gap-0.5" aria-hidden>
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-ui-muted">{otherParticipant?.user.username} is typing…</span>
                </div>
              )}

              {isPending && !isInitiator ? (
                <div className="space-y-3">
                  <p className="text-center text-sm text-ui-subtle">
                    <span className="text-ui-bright font-medium">{otherParticipant?.user.username}</span> wants to start a conversation.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleRejectRequest} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium text-[var(--color-ui-danger)] hover:bg-[var(--color-ui-danger-bg)] transition-colors" style={{ border: '1px solid var(--color-ui-danger-border)' }}>
                      <UserX size={14} aria-hidden /> Decline
                    </button>
                    <button onClick={handleAcceptRequest} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium text-white bg-accent-600 hover:bg-accent-500 transition-colors">
                      <UserCheck size={14} aria-hidden /> Accept
                    </button>
                  </div>
                </div>
              ) : isPending && isInitiator ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-ui-warning)] animate-pulse" aria-hidden />
                  <span className="text-sm text-ui-muted">Waiting for {otherParticipant?.user.username} to accept…</span>
                </div>
              ) : isRecording ? (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm transition-all" style={{ background: 'var(--color-ui-surface)', border: '1px solid var(--color-accent-500)' }}>
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-ui-danger)] animate-pulse" aria-hidden />
                    <span className="text-ui-bright font-medium">{formatTime(recordingTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={cancelRecording} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-ui-muted hover:text-[var(--color-ui-danger)] hover:bg-[var(--color-ui-danger-bg)] transition-colors" aria-label="Cancel recording">
                      <Trash2 size={18} aria-hidden />
                    </button>
                    <button onClick={sendRecording} className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent-600 hover:bg-accent-500 text-white transition-colors" aria-label="Send recording">
                      <Send size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2" aria-label="Send a message">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    className="hidden"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach image"
                    className="flex-shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-xl bg-ui-surface border border-ui-border text-ui-muted hover:text-ui-primary hover:border-ui-border2 transition-all active:scale-95"
                  >
                    <ImageIcon size={20} aria-hidden />
                  </button>
                  <label htmlFor="message-input" className="sr-only">Type your message</label>
                  <input
                    id="message-input"
                    type="text"
                    placeholder="Message…"
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'var(--color-ui-surface)', border: '1px solid var(--color-ui-border)', color: 'var(--color-ui-bright)' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--color-accent-500)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--color-ui-border)')}
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    autoComplete="off"
                  />
                  {inputMessage.trim() ? (
                    <button
                      type="submit"
                      aria-label="Send message"
                      className="flex-shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-xl bg-accent-600 hover:bg-accent-500 text-white transition-all active:scale-95"
                    >
                      <Send size={18} aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecording}
                      aria-label="Record voice note"
                      className="flex-shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-xl bg-ui-surface border border-ui-border text-ui-muted hover:text-ui-primary hover:border-ui-border2 transition-all active:scale-95"
                    >
                      <Mic size={20} aria-hidden />
                    </button>
                  )}
                </form>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden absolute top-4 left-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-ui-muted hover:text-ui-subtle transition-colors" aria-label="Open sidebar">
              <Menu size={20} aria-hidden />
            </button>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-ui-surface border border-ui-border">
              <Lock size={24} className="text-accent-500" aria-hidden />
            </div>
            <h1 className="text-lg font-semibold text-ui-bright mb-2">No conversation selected</h1>
            <p className="text-sm text-ui-muted max-w-xs mb-6 leading-relaxed">
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
        <div className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden animate-slide-up bg-ui-surface border border-ui-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ui-border2">
            <h2 id="new-chat-title" className="text-base font-semibold text-ui-bright">New conversation</h2>
            <button onClick={() => setIsNewChatOpen(false)} aria-label="Close" className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-ui-muted hover:text-ui-subtle transition-colors">
              <X size={20} aria-hidden />
            </button>
          </div>
          <div className="p-4 border-b border-ui-border2">
            <label htmlFor="user-search" className="sr-only">Search by username</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted pointer-events-none" aria-hidden />
              <input
                id="user-search" type="search" placeholder="Search by username…"
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'var(--color-ui-base)', border: '1px solid var(--color-ui-border)', color: 'var(--color-ui-bright)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--color-accent-500)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-ui-border)')}
                value={userSearchQuery}
                onChange={e => handleSearchUsers(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-2" role="listbox" aria-label="Search results">
            {isSearchingUsers ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-ui-border)', borderTopColor: 'var(--color-accent-500)' }} role="status" />
              </div>
            ) : userSearchResults.length > 0 ? (
              userSearchResults.map(u => (
                <button
                  key={u.id} role="option" aria-selected="false"
                  onClick={() => handleStartChat(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-ui-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar name={u.username} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ui-bright truncate">{u.username}</p>
                    <p className="text-xs text-ui-muted capitalize">{u.status || 'offline'}</p>
                  </div>
                </button>
              ))
            ) : userSearchQuery ? (
              <p className="text-center text-sm text-ui-muted py-10">No users found for "{userSearchQuery}"</p>
            ) : (
              <p className="text-center text-sm text-ui-muted py-10 px-4">Search for someone to start a private conversation.</p>
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
