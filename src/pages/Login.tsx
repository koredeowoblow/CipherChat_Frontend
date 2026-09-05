import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, ShieldCheck, Eye, EyeOff } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import useKeyStore from "../store/keyStore";
import cryptoService from "../services/cryptoService";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privateKeyPassword, setPrivateKeyPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showKeyPwd, setShowKeyPwd] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setKeys = useKeyStore((state) => state.setKeys);
  const [hasPrivateKey, setHasPrivateKey] = useState(false);

  useEffect(() => {
    setHasPrivateKey(!!localStorage.getItem("encryptedPrivateKey"));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.ciphertext && parsed.nonce && parsed.salt) {
          localStorage.setItem("encryptedPrivateKey", content);
          setHasPrivateKey(true);
          setError("");
        } else {
          setError(
            "That doesn't look like a valid key file. Please ensure it's the .json file you exported.",
          );
        }
      } catch {
        setError(
          "We couldn't read that key file. Please try downloading it again.",
        );
      }
    };
    reader.readAsText(file);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // prevent double-submit
    setIsLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/login", { email, password });

      const storedEncryptedKeyStr = localStorage.getItem("encryptedPrivateKey");
      if (!storedEncryptedKeyStr) {
        throw new Error(
          "Your private key is missing on this device. Please import your key file or register again.",
        );
      }

      const storedEncryptedKey = JSON.parse(storedEncryptedKeyStr);
      const decryptedPrivateKey = cryptoService.decryptPrivateKey(
        storedEncryptedKey,
        privateKeyPassword,
      );
      cryptoService.computeSharedSecret(
        data.user.publicKey,
        decryptedPrivateKey,
      );

      setKeys(decryptedPrivateKey, data.user.publicKey);
      setAuth(data.user, data.token);
      navigate("/");
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "We couldn't sign you in. Please check your passwords and try again.",
      );
      // Clear sensitive fields on failure — never re-use a failed password
      setPassword("");
      setPrivateKeyPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-ui-base">
      {/* ── Left panel — brand ── */}
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
            Private by design.
            <br />
            Secure by default.
          </h1>
          <p className="text-ui-subtle text-sm leading-relaxed">
            Your messages are encrypted on your device before they leave it. Not
            even the server can read them.
          </p>
        </div>

        <div className="space-y-5">
          {[
            {
              label: "End-to-end encrypted",
              desc: "State-of-the-art cryptography secures every message",
            },
            {
              label: "Zero-knowledge server",
              desc: "We only store encrypted data, never your actual messages",
            },
            {
              label: "Keys stay on device",
              desc: "Your private key is securely stored in your browser",
            },
          ].map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <ShieldCheck
                size={16}
                className="text-accent-500 mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-ui-primary text-sm font-medium">{f.label}</p>
                <p className="text-ui-subtle text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <img
              src="/logos.png"
              alt="CipherChat Logo"
              className="w-8 h-8 object-contain"
            />
            <span className="text-ui-bright font-semibold">CipherChat</span>
          </div>

          <h2 className="text-2xl font-semibold text-ui-bright mb-1">
            Sign in
          </h2>
          <p className="text-sm text-ui-subtle mb-8">
            New here?{" "}
            <Link
              to="/register"
              className="text-accent-400 hover:text-accent-300 transition-colors"
            >
              Create an account
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

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-ui-subtle mb-1.5"
              >
                Email
              </label>
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
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-ui-subtle mb-1.5"
              >
                Account password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input-field pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

            {/* Decryption password or Import Key */}
            {!hasPrivateKey ? (
              <div className="pt-2">
                <div className="bg-ui-elevated border border-ui-border rounded-lg p-4 text-center">
                  <ShieldCheck
                    size={24}
                    className="mx-auto text-accent-500 mb-2"
                  />
                  <h3 className="text-sm font-medium text-ui-bright mb-1">
                    Private Key Required
                  </h3>
                  <p className="text-xs text-ui-subtle mb-3">
                    You need to import your private key to log in on this
                    device.
                  </p>
                  <label className="btn-secondary cursor-pointer block py-2 rounded-lg text-sm transition-colors hover:bg-ui-border">
                    <span>Select Key File (.json)</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <label
                  htmlFor="login-decryption"
                  className="block text-xs font-medium text-ui-subtle mb-1.5"
                >
                  Key password
                  <span className="ml-2 font-normal text-ui-muted">
                    (unlocks your secure local key)
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="login-decryption"
                    type={showKeyPwd ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="off"
                    className="input-field pr-10"
                    value={privateKeyPassword}
                    onChange={(e) => setPrivateKeyPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyPwd((v) => !v)}
                    aria-label={
                      showKeyPwd
                        ? "Hide decryption password"
                        : "Show decryption password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-muted hover:text-ui-subtle transition-colors"
                  >
                    {showKeyPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              id="login-submit"
              disabled={isLoading || !hasPrivateKey}
              className="btn-primary flex items-center justify-center gap-2 mt-6"
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <div
                    className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin"
                    aria-hidden="true"
                  />
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
