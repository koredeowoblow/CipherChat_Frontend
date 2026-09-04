import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface KeyState {
  privateKey: string | null;
  publicKey: string | null;
  // Store shared secrets by conversationId to avoid re-computing them constantly
  sharedSecrets: Record<string, string>;
  setKeys: (privateKey: string, publicKey: string) => void;
  setSharedSecret: (conversationId: string, secret: string) => void;
  clearKeys: () => void;
}

const useKeyStore = create<KeyState>()(
  persist(
    (set) => ({
      privateKey: null,
      publicKey: null,
      sharedSecrets: {},
      setKeys: (privateKey, publicKey) => set({ privateKey, publicKey }),
      setSharedSecret: (conversationId, secret) => set((state) => ({
        sharedSecrets: {
          ...state.sharedSecrets,
          [conversationId]: secret
        }
      })),
      clearKeys: () => set({ privateKey: null, publicKey: null, sharedSecrets: {} }),
    }),
    {
      name: 'key-storage', // Note: in a real app, storing private key in plaintext in localStorage is risky. 
                           // It should be encrypted with a password, but we manage that in the components.
    }
  )
);

export default useKeyStore;
