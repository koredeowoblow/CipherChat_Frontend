import { useEffect, useRef, useState, useCallback } from 'react';
import useAuthStore from '../store/authStore';

/**
 * Stable WebSocket hook.
 *
 * Key design decisions vs the naive approach:
 * - `lastJsonMessage` is a ref, not state — prevents a re-render on every
 *   inbound WS message. Instead we expose `onMessage` callback registration
 *   so consumers can react without triggering their own re-renders.
 * - `sendMessage` is stable (never recreated) because ws is held in a ref.
 * - Auto-reconnects with exponential back-off when the connection drops.
 */

type MessageHandler = (msg: { type: string; payload: any }) => void;

export const useWebSocket = () => {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const token = useAuthStore((state: any) => state.token);

  // Registry of message handlers — stored in a ref so adding/removing one
  // doesn't cause hook consumers to re-render.
  const handlers = useRef<Set<MessageHandler>>(new Set());

  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const isMounted = useRef(true);

  const connect = useCallback(() => {
    if (!token || !isMounted.current) return;

    let wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
    if (window.location.protocol === 'https:' && wsBase.startsWith('ws://')) {
      wsBase = wsBase.replace('ws://', 'wss://');
    }
    const wsUrl = `${wsBase}?token=${token}`;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      if (!isMounted.current) return;
      setIsConnected(true);
      reconnectDelay.current = 1000; // reset back-off on successful connect
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Dispatch to all registered handlers WITHOUT setting state → no re-render
        handlers.current.forEach(h => h(data));
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      if (!isMounted.current) return;
      setIsConnected(false);
      // Exponential back-off reconnect (max 15 s)
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, 15000);
        connect();
      }, reconnectDelay.current);
    };

    socket.onerror = () => {
      socket.close(); // will trigger onclose → reconnect
    };
  }, [token]);

  useEffect(() => {
    isMounted.current = true;
    connect();
    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  // Stable send — never causes re-render in consumers
  const sendMessage = useCallback((message: { type: string; payload: any }) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  // Register a message handler. Returns an unsubscribe function.
  const subscribe = useCallback((handler: MessageHandler) => {
    handlers.current.add(handler);
    return () => handlers.current.delete(handler);
  }, []);

  return { isConnected, sendMessage, subscribe };
};
