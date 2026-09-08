import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { setMemoryToken } from '../auth.ts';
import TellLogoLoop from './TellLogoLoop.tsx';

const TOKEN_MAX = 256;

function backoffMs(fails: number): number {
  if (fails >= 5) return 30_000;
  if (fails >= 3) return 5_000;
  return 0;
}

function isPlausible(v: string): boolean {
  if (v.length < 1 || v.length > TOKEN_MAX) return false;
  if (v.includes('\0') || v.includes('\n') || v.includes('\r')) return false;
  if (v.trim().length === 0) return false;
  return true;
}

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tokenInputId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooling = cooldownUntil > now;
  const waitS = cooling ? Math.ceil((cooldownUntil - now) / 1000) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || cooling) return;
    const token = value;
    if (!isPlausible(token)) {
      setError('Invalid token');
      return;
    }
    setPending(true);
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        // Token lives in volatile memory only — never written to storage.
        setMemoryToken(token);
        setValue('');
        onSuccess();
        return;
      }
      if (res.status === 429) {
        setError('Too many login attempts. Try again in 15 minutes.');
      } else {
        setError('Invalid token');
      }
      const nextFails = fails + 1;
      setFails(nextFails);
      const wait = backoffMs(nextFails);
      if (wait > 0) setCooldownUntil(Date.now() + wait);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError('Login failed. Check the connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary) px-4 py-10">
      <div className="w-full max-w-md">
        <div className="border border-(--color-border-subtle) bg-(--color-bg-secondary) p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center gap-4">
            <TellLogoLoop />
            <div className="flex items-center gap-2 text-(--color-text-primary)">
              <ShieldCheck className="w-4 h-4 text-(--color-accent)" />
              <h1 className="font-display text-lg font-black tracking-wide">Tell Web — Restricted access</h1>
            </div>
            <p className="text-xs font-mono text-(--color-text-muted)">
              Enter the <strong className="text-(--color-text-secondary)">TELL_TOKEN</strong> on every connection.
              Nothing is stored in the browser.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3" autoComplete="off">
            <label
              htmlFor={tokenInputId}
              className="text-[11px] font-bold uppercase tracking-widest text-(--color-text-secondary)"
            >
              Access token
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-muted) pointer-events-none" />
              <input
                ref={inputRef}
                id={tokenInputId}
                name="tell-token"
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value.slice(0, TOKEN_MAX))}
                placeholder="Paste the server token"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={TOKEN_MAX}
                disabled={pending || cooling}
                className="w-full bg-(--color-bg-input) border border-(--color-border-medium) text-(--color-text-primary) font-mono text-sm pl-10 pr-11 py-2.5 outline-none focus:border-(--color-accent) disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide token' : 'Show token'}
                disabled={pending || cooling}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-(--color-text-muted) hover:text-(--color-text-primary) cursor-pointer disabled:opacity-50"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p role="alert" className="text-xs font-mono text-(--color-error)">
                {error}
              </p>
            )}
            {cooling && (
              <p className="text-xs font-mono text-(--color-text-muted)">
                Wait {waitS}s before retrying (anti brute-force).
              </p>
            )}

            <button
              type="submit"
              disabled={pending || cooling || value.length === 0}
              className="mt-1 w-full py-2.5 text-sm font-bold font-display bg-(--color-accent) text-white hover:bg-(--color-accent-hover) transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? 'Verifying…' : cooling ? `Wait ${waitS}s` : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 border-t border-(--color-border-subtle) pt-4 text-[11px] font-mono text-(--color-text-muted) leading-relaxed">
            <p>
              No token? On the server: <code>openssl rand -hex 32</code> then start with{' '}
              <code>TELL_TOKEN=&lt;token&gt;</code>.
            </p>
            <p className="mt-1">
              Active protections: anti brute-force, anti-timing delay, no persistence, same origin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
