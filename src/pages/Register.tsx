import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock,
  UserPlus,
  Eye,
  EyeOff,
  AlertTriangle,
  Download,
} from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import useKeyStore from "../store/keyStore";
import cryptoService from "../services/cryptoService";
import nacl from "tweetnacl";
import { decodeUTF8, encodeBase64 } from "tweetnacl-util";
import ThemeToggle from "../components/ThemeToggle";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privateKeyPassword, setPrivateKeyPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showKeyPwd, setShowKeyPwd] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setKeys = useKeyStore((state) => state.setKeys);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // prevent double-submit
    setIsLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Account password must be at least 8 characters.");
      setIsLoading(false);
      return;
    }
    if (privateKeyPassword.length < 8) {
      setError("Your key password must be at least 8 characters.");
      setIsLoading(false);
      return;
    }

    try {
      const keyPair = cryptoService.generateKeyPair();
      const fingerprint = encodeBase64(
        nacl.hash(decodeUTF8(keyPair.publicKey)),
      ).substring(0, 32);
      const encryptedPrivateKey = cryptoService.encryptPrivateKey(
        keyPair.privateKey,
        privateKeyPassword,
      );
      localStorage.setItem(
        "encryptedPrivateKey",
        JSON.stringify(encryptedPrivateKey),
      );

      const { data } = await api.post("/auth/register", {
        username,
        email,
        password,
        publicKey: keyPair.publicKey,
        keyFingerprint: fingerprint,
      });

      setKeys(keyPair.privateKey, data.user.publicKey);
      setAuth(data.user, data.token);
      setShowDownloadPrompt(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "We couldn't create your account. Please try again.",
      );
      setPassword("");
      setPrivateKeyPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadKey = () => {
    const encryptedKeyStr = localStorage.getItem("encryptedPrivateKey");
    if (encryptedKeyStr) {
      const blob = new Blob([encryptedKeyStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cipherchat-key.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    // Navigate to chat after downloading
    navigate("/");
  };

  if (showDownloadPrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ui-base p-6 text-center">
        <div className="max-w-md w-full bg-ui-surface border border-ui-border rounded-xl p-8 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Download size={32} className="text-accent-500" />
          </div>
          <h2 className="text-2xl font-bold text-ui-bright mb-4">
            Download your key file
          </h2>
          <p className="text-ui-subtle text-sm leading-relaxed mb-6">
            Your account was created successfully! To log into this account on
            any other device in the future, you <b>must</b> have this key file.
          </p>
          <div
            className="rounded-lg p-4 mb-8 text-left"
            style={{
              background: "var(--color-ui-warning-bg)",
              border: "1px solid var(--color-ui-warning-border)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle
                size={16}
                style={{ color: "var(--color-ui-warning)" }}
              />
              <span
                className="font-semibold text-sm"
                style={{ color: "var(--color-ui-warning)" }}
              >
                Critical Backup
              </span>
            </div>
            <p className="text-ui-muted text-xs leading-relaxed">
              If you lose this file and clear your browser cache, you will
              permanently lose access to all your messages. We cannot recover it
              for you.
            </p>
          </div>
          <button
            onClick={handleDownloadKey}
            className="btn-primary w-full flex justify-center items-center gap-2 py-3"
          >
            <Download size={18} />
            <span>Download & Continue</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-accent-500 hover:text-accent-400 mt-6 transition-colors"
          >
            I'll do this later (not recommended)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-ui-base">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-ui-surface dark:bg-ui-base/50 border-r border-ui-border2 p-12">
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <img
              src="/logos.png"
              alt="CipherChat Logo"
              className="w-10 h-10 object-contain"
            />
            <span className="text-ui-bright font-semibold text-lg tracking-tight">
              CipherChat
            </span>
          </div>

          <h1 className="text-3xl font-bold text-ui-bright leading-snug mb-4">
            Your keys.
            <br />
            Your messages.
          </h1>
          <p className="text-ui-subtle text-sm leading-relaxed">
            When you register, a unique encryption keypair is generated on your
            device. Your private key never touches our servers.
          </p>
        </div>

        {/* Key warning callout */}
        <div
          className="rounded-xl p-5"
          style={{
            background: "var(--color-ui-warning-bg)",
            border: "1px solid var(--color-ui-warning-border)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle
              size={15}
              style={{ color: "var(--color-ui-warning)" }}
              className="flex-shrink-0"
              aria-hidden="true"
            />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--color-ui-warning)" }}
            >
              Save your key password
            </span>
          </div>
          <p className="text-ui-muted text-xs leading-relaxed">
            We cannot recover your messages if you forget your local key
            password. Write it down somewhere safe before you proceed.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-md bg-accent-500 flex items-center justify-center">
              <Lock size={14} className="text-white" aria-hidden="true" />
            </div>
            <span className="text-ui-bright font-semibold">CipherChat</span>
          </div>

          <h2 className="text-2xl font-semibold text-ui-bright mb-1">
            Create account
          </h2>
          <p className="text-sm text-ui-subtle mb-8">
            Already have one?{" "}
            <Link
              to="/login"
              className="text-accent-400 hover:text-accent-300 transition-colors"
            >
              Sign in
            </Link>
          </p>

          {/* Always-present error zone — never causes layout shift */}
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="mb-6 overflow-hidden transition-all duration-200"
            style={{ maxHeight: error ? "80px" : "0", opacity: error ? 1 : 0 }}
          >
            <div
              className="px-4 py-3 rounded-lg text-sm"
              style={{
                background: "var(--color-ui-danger-bg)",
                border: "1px solid var(--color-ui-danger-border)",
                color: "var(--color-ui-danger)",
              }}
            >
              {error}
            </div>
          </div>

          {/* Mobile warning */}
          <div
            className="lg:hidden mb-6 rounded-lg p-4"
            style={{
              background: "var(--color-ui-warning-bg)",
              border: "1px solid var(--color-ui-warning-border)",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle
                size={13}
                style={{ color: "var(--color-ui-warning)" }}
                aria-hidden="true"
              />
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--color-ui-warning)" }}
              >
                Save your key password
              </span>
            </div>
            <p className="text-ui-muted text-xs">
              Write it down — we can't recover it for you.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {/* Username */}
            <div>
              <label
                htmlFor="reg-username"
                className="block text-xs font-medium text-ui-subtle mb-1.5"
              >
                Username
              </label>
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
              <label
                htmlFor="reg-email"
                className="block text-xs font-medium text-ui-subtle mb-1.5"
              >
                Email
              </label>
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
              <label
                htmlFor="reg-password"
                className="block text-xs font-medium text-ui-subtle mb-1.5"
              >
                Account password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPwd ? "text" : "password"}
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
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-muted hover:text-ui-subtle transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative pt-2">
              <div className="border-t border-ui-border2" />
              <span className="absolute top-1/2 left-0 -translate-y-1/2 px-3 bg-ui-base text-[10px] uppercase tracking-widest text-ui-muted font-medium">
                Encryption setup
              </span>
            </div>

            {/* Decryption password */}
            <div>
              <label
                htmlFor="reg-decryption"
                className="block text-xs font-medium text-ui-subtle mb-1.5"
              >
                Key password
              </label>
              <div className="relative">
                <input
                  id="reg-decryption"
                  type={showKeyPwd ? "text" : "password"}
                  placeholder="Protects your secure local key"
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
                  onClick={() => setShowKeyPwd((v) => !v)}
                  aria-label={
                    showKeyPwd ? "Hide key password" : "Show key password"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-muted hover:text-ui-subtle transition-colors"
                >
                  {showKeyPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p
                id="decryption-hint"
                className="text-[11px] text-ui-muted mt-1.5 ml-0.5"
              >
                Used to unlock your private key on this device. Different from
                your account password.
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
                  <div
                    className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin"
                    aria-hidden="true"
                  />
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
