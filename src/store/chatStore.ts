import { create } from 'zustand';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  encryptedContent: string;
  encryptedSessionKey: string;
  iv: string;
  authTag: string;
  createdAt: string;
  reactions?: Array<{ emoji: string; userId: string }>;
  // Decrypted fields added on the fly
  plaintext?: string;
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  name?: string;
  avatar?: string;
  lastMessageAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdBy: string;
  participants: {
    user: {
      id: string;
      username: string;
      avatar?: string;
    }
  }[];
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  typingUsers: Record<string, string[]>; // conversationId -> [userId]
  onlineUsers: Record<string, boolean>; // userId -> isOnline
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  updateConversation: (conversation: Conversation) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageReactions: (conversationId: string, messageId: string, reactions: Array<{ emoji: string; userId: string }>) => void;
  setActiveConversation: (id: string | null) => void;
  updateMessagePlaintext: (conversationId: string, messageId: string, plaintext: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  setOnlineStatus: (userId: string, isOnline: boolean) => void;
}

const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  typingUsers: {},
  onlineUsers: {},

  setConversations: (conversations) => set({ conversations }),
  
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations]
  })),

  removeConversation: (id) => set((state) => ({
    conversations: state.conversations.filter(c => c.id !== id)
  })),

  updateConversation: (conversation) => set((state) => ({
    conversations: state.conversations.map(c => c.id === conversation.id ? conversation : c)
  })),

  setMessages: (conversationId, messages) => set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: messages
    }
  })),

  addMessage: (message) => set((state) => {
    const existingMessages = state.messages[message.conversationId] || [];
    if (existingMessages.some(m => m.id === message.id)) {
      return state;
    }
    
    const updatedConversations = state.conversations.map(c => {
      if (c.id === message.conversationId) {
        return { ...c, lastMessageAt: message.createdAt };
      }
      return c;
    }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return {
      messages: {
        ...state.messages,
        [message.conversationId]: [...existingMessages, message]
      },
      conversations: updatedConversations
    };
  }),

  updateMessageReactions: (conversationId, messageId, reactions) => set((state) => {
    const msgs = state.messages[conversationId] || [];
    return {
      messages: {
        ...state.messages,
        [conversationId]: msgs.map(m => m.id === messageId ? { ...m, reactions } : m)
      }
    };
  }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  updateMessagePlaintext: (conversationId, messageId, plaintext) => set((state) => {
    const msgs = state.messages[conversationId] || [];
    return {
      messages: {
        ...state.messages,
        [conversationId]: msgs.map(m => m.id === messageId ? { ...m, plaintext } : m)
      }
    };
  }),

  setTyping: (conversationId, userId, isTyping) => set((state) => {
    const current = state.typingUsers[conversationId] || [];
    const updated = isTyping
      ? Array.from(new Set([...current, userId]))
      : current.filter(id => id !== userId);
    return {
      typingUsers: { ...state.typingUsers, [conversationId]: updated }
    };
  }),

  setOnlineStatus: (userId, isOnline) => set((state) => ({
    onlineUsers: { ...state.onlineUsers, [userId]: isOnline }
  })),
}));

export default useChatStore;
