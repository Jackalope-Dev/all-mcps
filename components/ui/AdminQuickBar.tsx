'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Edit3, ExternalLink, Activity, Sparkles, Loader2, Check } from 'lucide-react';
import { AdminQuickEditModal } from './AdminQuickEditModal';
import { toast } from './Toast';

export interface AdminQuickBarProps {
  server: {
    id: string;
    name: string;
    description: string;
    category: string;
    url: string;
    websiteUrl?: string | null;
    status: string;
    healthStatus?: string | null;
    isPremium?: boolean;
    isOfficial?: boolean;
  };
}

export function AdminQuickBar({ server }: AdminQuickBarProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mcp/${server.id}/is-owner`);
        if (res.ok) {
          const data = (await res.json()) as { isOwner?: boolean; isAdmin?: boolean };
          if (!cancelled && data?.isAdmin) {
            setIsAdmin(true);
          }
        }
      } catch {
        // Network error — leave default false
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [server.id]);

  if (!isAdmin) return null;

  const handleTriggerHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: server.id,
          action: 'check_health',
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Health check failed');
      toast.success(data.message || 'Health check completed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger health check');
    } finally {
      setCheckingHealth(false);
    }
  };

  return (
    <>
      <div
        className="surface"
        style={{
          padding: '1.25rem',
          borderRadius: '14px',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.02) 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
              }}
            >
              <ShieldCheck size={16} />
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
              Admin Controls
            </span>
          </div>

          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: server.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: server.status === 'active' ? '#10b981' : '#f87171',
              border: `1px solid ${server.status === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            {server.status}
          </span>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          You have admin permissions for this listing. Clean up copy, adjust URLs, or manage status without leaving the page.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              width: '100%',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Edit3 size={15} /> Quick Edit (In-Place)
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleTriggerHealthCheck}
              disabled={checkingHealth}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: checkingHealth ? 'not-allowed' : 'pointer',
              }}
            >
              {checkingHealth ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
              {checkingHealth ? 'Checking...' : 'Check Health'}
            </button>

            <Link
              href={`/admin?search=${encodeURIComponent(server.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} /> Full Admin
            </Link>
          </div>
        </div>
      </div>

      <AdminQuickEditModal
        server={server}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  );
}
