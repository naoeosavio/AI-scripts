import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const AUTO_DISMISS_MS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  error: 7000,
};

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-(--color-success)/40 bg-(--color-bg-primary) text-(--color-success)',
  error: 'border-(--color-error)/50 bg-(--color-bg-primary) text-(--color-error)',
  info: 'border-(--color-accent)/40 bg-(--color-bg-primary) text-(--color-accent-text)',
};

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 px-3.5 py-2.5 border rounded-none shadow-lg max-w-sm select-none ${TYPE_STYLES[item.type]}`}
    >
      {item.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
      {item.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
      {item.type === 'info' && <Info className="w-4 h-4 shrink-0 mt-0.5" />}
      <span className="flex-1 text-[11px] font-sans leading-snug text-(--color-text-primary) break-words whitespace-pre-wrap">
        {item.message}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        title="Dismiss"
        aria-label="Dismiss notification"
        className="p-0.5 shrink-0 text-(--color-text-muted) hover:text-(--color-text-primary) transition-colors cursor-pointer"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev.slice(-4), { id, type, message }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS[type]);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="fixed bottom-3 right-3 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {items.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastRow item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
