import { lazy, StrictMode, Suspense, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { clearMemoryToken } from './auth.ts';
import LoginScreen from './components/LoginScreen.tsx';
import { ToastProvider } from './components/Toast.tsx';
import { ThemeProvider } from './theme.tsx';
import './index.css';

// The main environment is code-split: this chunk (login gate) loads first,
// and App (+ terminal/chat/files) is fetched ONLY after a successful login.
const App = lazy(() => import('./App.tsx'));

function Shell() {
  // null = still checking /api/auth/status; true/false once known.
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/status', { headers: { 'Cache-Control': 'no-store' } });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error('status failed');
        const required = Boolean((data as any).authRequired);
        setAuthRequired(required);
        // No TELL_TOKEN on the server → skip login entirely.
        if (!required) setAuthenticated(true);
      } catch {
        if (!cancelled)
          setStatusError('Não foi possível contatar o servidor. Verifique se ele está rodando e recarregue.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(() => {
    clearMemoryToken();
    setAuthenticated(false);
  }, []);

  // Token rotated/revoked mid-session (or expired server-side): any authed
  // API call answering 401 drops back to the isolated login screen.
  useEffect(() => {
    const onUnauthorized = () => logout();
    const onUnload = () => clearMemoryToken();
    window.addEventListener('tell:unauthorized', onUnauthorized);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('tell:unauthorized', onUnauthorized);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [logout]);

  return (
    <ThemeProvider>
      <ToastProvider>
        {statusError ? (
          <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary) px-4">
            <p role="alert" className="text-sm font-mono text-(--color-error) text-center">
              {statusError}
            </p>
          </div>
        ) : authRequired === null ? (
          <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary)">
            <p className="text-xs font-mono text-(--color-text-muted) animate-pulse">Conectando…</p>
          </div>
        ) : !authenticated ? (
          <LoginScreen onSuccess={() => setAuthenticated(true)} />
        ) : (
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary)">
                <p className="text-xs font-mono text-(--color-text-muted) animate-pulse">Carregando ambiente…</p>
              </div>
            }
          >
            <App onLogout={authRequired ? logout : undefined} />
          </Suspense>
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');
createRoot(rootElement).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
