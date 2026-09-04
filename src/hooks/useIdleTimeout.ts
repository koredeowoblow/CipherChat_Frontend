import { useEffect, useRef } from 'react';
import useAuthStore from '../store/authStore';
import useKeyStore from '../store/keyStore';
import api from '../services/api';

export function useIdleTimeout(timeoutMs: number = 10 * 60 * 1000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    if (!token) return;

    const logout = () => {
      useAuthStore.getState().logout();
      useKeyStore.getState().clearKeys();
      api.post('/auth/logout').catch(() => {});
      window.location.href = '/login'; 
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logout, timeoutMs);
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    // Throttle the resets slightly to avoid too many calls on mousemove
    let lastReset = Date.now();
    const handleEvent = () => {
      const now = Date.now();
      if (now - lastReset > 1000) {
        lastReset = now;
        resetTimer();
      }
    };

    events.forEach(event => window.addEventListener(event, handleEvent));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => window.removeEventListener(event, handleEvent));
    };
  }, [token, timeoutMs]);
}
