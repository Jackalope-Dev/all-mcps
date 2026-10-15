'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info';

export type ToastOptions = {
  description?: string;
  duration?: number;
};

type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
  /** Set while the exit animation plays, just before removal. */
  leaving?: boolean;
};

type Listener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION = 4000;
const MAX_TOASTS = 4;
/** Matches the .acct-toast exit animation in app/styles/account.css. */
const EXIT_MS = 180;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((listener) => {
    listener(snapshot);
  });
}

function dismissToast(id: string) {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
  const target = toasts.find((t) => t.id === id);
  if (!target || target.leaving) return;
  // Play the exit animation first, then drop the toast from the stack.
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, EXIT_MS);
}

function addToast(type: ToastType, title: string, options?: ToastOptions) {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const item: ToastItem = {
    id,
    type,
    title,
    description: options?.description,
    duration: options?.duration ?? DEFAULT_DURATION,
  };

  toasts = [...toasts, item].slice(-MAX_TOASTS);
  emit();

  if (item.duration > 0) {
    const timer = setTimeout(() => dismissToast(id), item.duration);
    dismissTimers.set(id, timer);
  }

  return id;
}

/** Imperative toast API — works from any client component. */
export const toast = {
  success(title: string, options?: ToastOptions) {
    return addToast('success', title, options);
  },
  error(title: string, options?: ToastOptions) {
    return addToast('error', title, { duration: 5500, ...options });
  },
  info(title: string, options?: ToastOptions) {
    return addToast('info', title, options);
  },
  dismiss(id: string) {
    dismissToast(id);
  },
  dismissAll() {
    dismissTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    dismissTimers.clear();
    toasts = [];
    emit();
  },
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={17} strokeWidth={2.25} />,
  error: <XCircle size={17} strokeWidth={2.25} />,
  info: <Info size={17} strokeWidth={2.25} />,
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className={`acct-toast acct-toast--${item.type}`}
      data-leaving={item.leaving ? 'true' : undefined}
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="acct-toast-icon" aria-hidden="true">
        {ICONS[item.type]}
      </div>
      <div className="acct-toast-body">
        <p className="acct-toast-title">{item.title}</p>
        {item.description ? (
          <p className="acct-toast-desc">{item.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="acct-toast-dismiss"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** Mount once in the root layout. Renders the toast stack. */
export function ToastProvider() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    listeners.add(setItems);
    setItems([...toasts]);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  const onDismiss = useCallback((id: string) => {
    dismissToast(id);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <section className="acct-toasts" aria-label="Notifications">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </section>,
    document.body,
  );
}
