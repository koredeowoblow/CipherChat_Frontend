import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, UserPlus, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useKeyStore from '../store/keyStore';
import cryptoService from '../services/cryptoService';
import nacl from 'tweetnacl';
import { decodeUTF8, encodeBase64 } from 'tweetnacl-util';

export default function Register() {
  const [username, setUsername] = useState('');
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // prevent double-submit
    setIsLoading(true);
    setError('');

    if (password.length < 8) {
      setError('Account password must be at least 8 characters.');
      setIsLoading(false);
      return;
    }
    if (privateKeyPassword.length < 8) {
      setError('Decryption password must be at least 8 characters.');
      setIsLoading(false);
      return;
    }

    try {
      const keyPair = cryptoService.generateKeyPair();
      const fingerprint = encodeBase64(nacl.hash(decodeUTF8(keyPair.publicKey))).substring(0, 32);
      const encryptedPrivateKey = cryptoService.encryptPrivateKey(keyPair.privateKey, privateKeyPassword);
      localStorage.setItem('encryptedPrivateKey', JSON.stringify(encryptedPrivateKey));

      const { data } = await api.post('/auth/register', {
        username,
        email,
        password,
        publicKey: keyPair.publicKey,
        keyFingerprint: fingerprint,
      });

      setKeys(keyPair.privateKey, data.user.publicKey);
      setAuth(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create account. Please try again.');
      setPassword('');
      setPrivateKeyPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0b0d14]">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-[#0e1019] border-r border-[#1c1f32] p-12">
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
              <Lock size={16} className="text-white" aria-hidden="true" />
            </div>
            <span className="text-[#edf0ff] font-semibold text-lg tracking-tight">CipherChat</span>
          </div>

          <h1 className="text-3xl font-bold text-[#edf0ff] leading-snug mb-4">
            Your keys.<br />Your messages.
          </h1>
          <p className="text-[#8890b0] text-sm leading-relaxed">
            When you register, a unique encryption keypair is generated on your device. Your private key never touches our servers.
          </p>
        </div>

        {/* Key warning callout */}
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" aria-hidden="true" />
            <span className="text-amber-400 text-sm font-semibold">Save your decryption password</span>
          </div>
          <p className="text-amber-200/60 text-xs leading-relaxed">
            We cannot recover your messages if you forget your local decryption password. Write it somewhere safe before you proceed.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-md bg-accent-500 flex items-center justify-center">
              <Lock size={14} className="text-white" aria-hidden="true" />
            </div>
            <span className="text-[#edf0ff] font-semibold">CipherChat</span>
          </div>

          <h2 className="text-2xl font-semibold text-[#edf0ff] mb-1">Create account</h2>
          <p className="text-sm text-[#8890b0] mb-8">
            Already have one?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 transition-colors">
              Sign in
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

          {/* Mobile warning */}
          <div className="lg:hidden mb-6 bg-amber-500/8 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={13} className="text-amber-400" aria-hidden="true" />
              <span className="text-amber-400 text-xs font-semibold">Save your decryption password</span>
            </div>
            <p className="text-amber-200/50 text-xs">Write it down — we can't recover it for you.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {/* Username */}
            <div>
              <label htmlFor="reg-username" className="block text-xs font-medium text-[#8890b0] mb-1.5">Username</label>
              <input
                id="reg-username"
                type="text"
                placeholder="yourhandle"
                autoComplete="username"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={30}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-[#8890b0] mb-1.5">Email</label>
              <input
                id="reg-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Account password */}
            <div>
              <label htmlFor="reg-password" className="block text-xs font-medium text-[#8890b0] mb-1.5">Account password</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className="input-field pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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

            {/* Divider */}
            <div className="relative pt-2">
              <div className="border-t border-[#1c1f32]" />
              <span className="absolute top-1/2 left-0 -translate-y-1/2 px-3 bg-[#0b0d14] text-[10px] uppercase tracking-widest text-[#3a3f5c] font-medium">
                Encryption setup
              </span>
            </div>

            {/* Decryption password */}
            <div>
              <label htmlFor="reg-decryption" className="block text-xs font-medium text-[#8890b0] mb-1.5">
                Decryption password
              </label>
              <div className="relative">
                <input
                  id="reg-decryption"
                  type={showKeyPwd ? 'text' : 'password'}
                  placeholder="Protects your local private key"
                  autoComplete="off"
                  className="input-field pr-10"
                  value={privateKeyPassword}
                  onChange={(e) => setPrivateKeyPassword(e.target.value)}
                  required
                  minLength={8}
                  aria-describedby="decryption-hint"
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
              <p id="decryption-hint" className="text-[11px] text-[#3a3f5c] mt-1.5 ml-0.5">
                Used to unlock your private key on this device. Different from your account password.
              </p>
            </div>

            <button
              type="submit"
              id="register-submit"
              disabled={isLoading}
              className="btn-primary flex items-center justify-center gap-2 mt-6"
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  <span>Creating account…</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} aria-hidden="true" />
                  <span>Create account</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
