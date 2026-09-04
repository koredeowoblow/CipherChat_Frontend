import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useKeyStore from '../store/keyStore';
import cryptoService from '../services/cryptoService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [privateKeyPassword, setPrivateKeyPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showKeyPwd, setShowKeyPwd] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setKeys = useKeyStore((state) => state.setKeys);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // prevent double-submit
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });

      const storedEncryptedKeyStr = localStorage.getItem('encryptedPrivateKey');
      if (!storedEncryptedKeyStr) {
        throw new Error('Private key not found on this device. Please register again or import your key.');
      }

      const storedEncryptedKey = JSON.parse(storedEncryptedKeyStr);
      const decryptedPrivateKey = cryptoService.decryptPrivateKey(storedEncryptedKey, privateKeyPassword);
      cryptoService.computeSharedSecret(data.user.publicKey, decryptedPrivateKey);

      setKeys(decryptedPrivateKey, data.user.publicKey);
      setAuth(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Incorrect credentials or decryption password.');
      // Clear sensitive fields on failure — never re-use a failed password
      setPassword('');
      setPrivateKeyPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0b0d14]">
      {/* ── Left panel — brand ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-[#0e1019] border-r border-[#1c1f32] p-12">
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
              <Lock size={16} className="text-white" aria-hidden="true" />
            </div>
            <span className="text-[#edf0ff] font-semibold text-lg tracking-tight">CipherChat</span>
          </div>

          <h1 className="text-3xl font-bold text-[#edf0ff] leading-snug mb-4">
            Private by design.<br />Secure by default.
          </h1>
          <p className="text-[#8890b0] text-sm leading-relaxed">
            Your messages are encrypted on your device before they leave it. Not even the server can read them.
          </p>
        </div>

        <div className="space-y-5">
          {[
            { label: 'End-to-end encrypted', desc: 'X25519 + XSalsa20-Poly1305' },
            { label: 'Zero-knowledge server', desc: 'We store ciphertext, never plaintext' },
            { label: 'Keys stay on device', desc: 'Your private key never leaves your browser' },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-3">
              <ShieldCheck size={16} className="text-accent-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[#c8ccee] text-sm font-medium">{f.label}</p>
                <p className="text-[#8890b0] text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-md bg-accent-500 flex items-center justify-center">
              <Lock size={14} className="text-white" aria-hidden="true" />
            </div>
            <span className="text-[#edf0ff] font-semibold">CipherChat</span>
          </div>

          <h2 className="text-2xl font-semibold text-[#edf0ff] mb-1">Sign in</h2>
          <p className="text-sm text-[#8890b0] mb-8">
            New here?{' '}
            <Link to="/register" className="text-accent-400 hover:text-accent-300 transition-colors">
              Create an account
            </Link>
          </p>

          {/* Always-present error zone — never causes layout shift */}
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="mb-6 overflow-hidden transition-all duration-200"
            style={{ maxHeight: error ? '80px' : '0', opacity: error ? 1 : 0 }}
          >
            <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
              {error}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-[#8890b0] mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-[#8890b0] mb-1.5">Account password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input-field pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a3f5c] hover:text-[#8890b0] transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Decryption password */}
            <div className="pt-2">
              <label htmlFor="login-decryption" className="block text-xs font-medium text-[#8890b0] mb-1.5">
                Decryption password
                <span className="ml-2 font-normal text-[#3a3f5c]">(unlocks your local private key)</span>
              </label>
              <div className="relative">
                <input
                  id="login-decryption"
                  type={showKeyPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="off"
                  className="input-field pr-10"
                  value={privateKeyPassword}
                  onChange={(e) => setPrivateKeyPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKeyPwd(v => !v)}
                  aria-label={showKeyPwd ? 'Hide decryption password' : 'Show decryption password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a3f5c] hover:text-[#8890b0] transition-colors"
                >
                  {showKeyPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit"
              disabled={isLoading}
              className="btn-primary flex items-center justify-center gap-2 mt-6"
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <LogIn size={16} aria-hidden="true" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
