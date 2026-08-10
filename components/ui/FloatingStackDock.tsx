'use client';

import React, { useState, useEffect } from 'react';
import { Layers, ChevronUp, Trash2, X, Download, Sparkles } from 'lucide-react';
import { getStackServerIds, clearStack } from '@/lib/stackStore';
import { StackBuilderModal } from '@/components/StackBuilderModal';

export function FloatingStackDock() {
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  const refresh = () => {
    const ids = getStackServerIds();
    setServerIds(ids);
    if (ids.length > 0) {
      const dismissed = localStorage.getItem('mcp_stack_bubble_dismissed');
      if (!dismissed) {
        setShowBubble(true);
      }
    }
  };

  useEffect(() => {
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
      localStorage.setItem('mcp_stack_bubble_dismissed', 'true');
    } catch {}
  };

  if (serverIds.length === 0) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 9990,
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.5rem 0.85rem 0.5rem 0.65rem',
          borderRadius: '999px',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--accent-glow)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px var(--accent-glow)',
        }}
      >
        {/* Onboarding Speech Bubble Callout */}
        {showBubble && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 12px)',
              left: 0,
              width: '280px',
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--accent-color)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5), 0 0 20px var(--accent-glow)',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles size={14} /> Multi-Server Stack
              </span>
              <button
                type="button"
                onClick={dismissBubble}
                aria-label="Dismiss guide"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Add more servers to your stack to export and install them all at once in a single configuration file!
            </p>
            <div
              style={{
                position: 'absolute',
                bottom: '-6px',
                left: '24px',
                width: '10px',
                height: '10px',
                backgroundColor: 'var(--bg-elevated)',
                borderRight: '1px solid var(--accent-color)',
                borderBottom: '1px solid var(--accent-color)',
                transform: 'rotate(45deg)',
              }}
            />
          </div>
        )}

        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#020617',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        >
          {serverIds.length}
        </div>

        <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          MCP Stack
        </div>

        <button
          type="button"
          onClick={() => {
            dismissBubble();
            setModalOpen(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #00e5ff, #007bff)',
            color: '#020617',
            fontWeight: 700,
            fontSize: '0.78rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Export / View <ChevronUp size={13} />
        </button>

        <button
          type="button"
          onClick={() => clearStack()}
          title="Clear Stack"
          aria-label="Clear Stack"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {modalOpen && (
        <StackBuilderModal
          isOpen={true}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
