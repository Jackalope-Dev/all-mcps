'use client';

import { ChevronUp, Layers, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { StackBuilderModal } from '@/components/StackBuilderModal';
import { clearStack, getStackServerIds } from '@/lib/stackStore';

const BUBBLE_KEY = 'mcp_stack_bubble_dismissed';

export function FloatingStackDock() {
  const pathname = usePathname();
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  // Stable so the modal's focus/scroll-lock effect doesn't re-run per render.
  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    const refresh = () => {
      const ids = getStackServerIds();
      setServerIds(ids);
      if (ids.length > 0) {
        try {
          if (!localStorage.getItem(BUBBLE_KEY)) setShowBubble(true);
        } catch {
          // Storage blocked — skip the one-time hint.
        }
      }
    };
    refresh();
    window.addEventListener('mcp_stack_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('mcp_stack_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const dismissBubble = () => {
    setShowBubble(false);
    try {
      localStorage.setItem(BUBBLE_KEY, 'true');
    } catch {}
  };

  // The /stack page already shows the full builder inline.
  // Keep the modal mounted if the stack is emptied from inside it.
  if ((serverIds.length === 0 && !modalOpen) || pathname === '/stack') {
    return null;
  }

  const count = serverIds.length;

  return (
    <>
      {count > 0 ? (
        <section className="stk-dock" aria-label="Your MCP stack">
          {showBubble ? (
            <div className="stk-dock-bubble" role="status">
              <p>
                <strong>Stack started.</strong> Keep adding servers, then export
                them all as one config.
              </p>
              <button
                type="button"
                onClick={dismissBubble}
                aria-label="Dismiss tip"
                className="stk-dock-x"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="stk-dock-main"
            onClick={() => {
              dismissBubble();
              setModalOpen(true);
            }}
            aria-haspopup="dialog"
          >
            <span className="stk-dock-icon" aria-hidden="true">
              <Layers size={16} />
              <span key={count} className="stk-dock-badge tabular">
                {count}
              </span>
            </span>
            <span className="stk-dock-label">
              <span className="stk-dock-title">Your stack</span>
              <span className="stk-dock-sub">
                {count} {count === 1 ? 'server' : 'servers'} · export
              </span>
            </span>
            <ChevronUp size={16} className="stk-dock-chev" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => clearStack()}
            title="Clear stack"
            aria-label="Clear stack"
            className="stk-dock-x"
          >
            <X size={15} />
          </button>
        </section>
      ) : null}

      {modalOpen ? (
        <StackBuilderModal isOpen={true} onClose={closeModal} />
      ) : null}
    </>
  );
}
