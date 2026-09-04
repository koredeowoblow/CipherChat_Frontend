import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * SetupKeys — redirects to main chat for now.
 * This page is reserved for future key management features (import/export keys, rotate keys, etc.)
 */
export default function SetupKeys() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ui-base" aria-label="Redirecting to chat">
      <div className="flex flex-col items-center gap-4 text-ui-muted">
        <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
        <p className="text-sm">Redirecting…</p>
      </div>
    </div>
  );
}
