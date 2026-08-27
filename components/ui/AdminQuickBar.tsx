'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Edit3,
  ExternalLink,
  Activity,
  Sparkles,
  Loader2,
  Star,
  EyeOff,
  Eye,
} from 'lucide-react';
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
    featuredUntil?: string | Date | null;
    aiEnrichedAt?: string | Date | null;
  };
}

export function AdminQuickBar({ server }: AdminQuickBarProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [enrichingAi, setEnrichingAi] = useState(false);
  const [enrichStatusText, setEnrichStatusText] = useState<string | null>(null);
  const [togglingFeatured, setTogglingFeatured] = useState(false);
  const [togglingPublish, setTogglingPublish] = useState(false);

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

  const isFeatured = server.featuredUntil && new Date(server.featuredUntil) > new Date();
  const isPublished = server.status === 'active';

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
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger health check');
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleTriggerAiEnrichment = async () => {
    setEnrichingAi(true);
    setEnrichStatusText('Fetching README & generating AI content...');
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: server.id,
          action: 'enrich_ai',
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string; aiSummary?: string };
      if (!res.ok) throw new Error(data.error || 'AI enrichment failed');
      toast.success(data.message || 'AI enrichment complete!');
      setEnrichStatusText(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to run AI enrichment');
      setEnrichStatusText(null);
    } finally {
      setEnrichingAi(false);
    }
  };

  const handleToggleFeatured = async () => {
    setTogglingFeatured(true);
    try {
      const action = isFeatured ? 'unfeature' : 'feature';
      const body: Record<string, any> = { id: server.id, action };
      if (!isFeatured) body.days = 7;

      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to toggle featured status');
      toast.success(isFeatured ? 'Removed from featured' : 'Marked as Featured (7 days)');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update featured placement');
    } finally {
      setTogglingFeatured(false);
    }
  };

  const handleTogglePublish = async () => {
    setTogglingPublish(true);
    try {
      const action = isPublished ? 'unpublish' : 'republish';
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: server.id, action }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to toggle publish status');
      toast.success(isPublished ? 'Listing unpublished' : 'Listing published active');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change publish status');
    } finally {
      setTogglingPublish(false);
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
        {/* Header with Admin Badge & Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
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
              Admin Tools
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {isFeatured && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                ★ Featured
              </span>
            )}
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: isPublished ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isPublished ? '#10b981' : '#f87171',
                border: `1px solid ${isPublished ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {server.status}
            </span>
          </div>
        </div>

        {enrichStatusText ? (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              color: '#00e5ff',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Loader2 size={13} className="animate-spin" />
            <span>{enrichStatusText}</span>
          </div>
        ) : null}

        {/* Primary In-Place Edit & Immediate AI Enrichment Buttons */}
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

          <button
            type="button"
            onClick={handleTriggerAiEnrichment}
            disabled={enrichingAi}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              width: '100%',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(0, 229, 255, 0.4)',
              background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
              color: '#00e5ff',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: enrichingAi ? 'not-allowed' : 'pointer',
              opacity: enrichingAi ? 0.7 : 1,
            }}
          >
            {enrichingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {enrichingAi ? 'Enriching with AI...' : 'Re-Run AI Enrichment'}
          </button>

          {/* Quick Action Pills Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            <button
              type="button"
              onClick={handleToggleFeatured}
              disabled={togglingFeatured}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: isFeatured ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                color: isFeatured ? '#f59e0b' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.76rem',
                cursor: togglingFeatured ? 'not-allowed' : 'pointer',
              }}
            >
              <Star size={12} />
              {togglingFeatured ? 'Updating...' : isFeatured ? 'Unfeature' : 'Feature 7d'}
            </button>

            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={togglingPublish}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: isPublished ? 'var(--text-secondary)' : '#10b981',
                fontWeight: 600,
                fontSize: '0.76rem',
                cursor: togglingPublish ? 'not-allowed' : 'pointer',
              }}
            >
              {isPublished ? <EyeOff size={12} /> : <Eye size={12} />}
              {togglingPublish ? 'Updating...' : isPublished ? 'Unpublish' : 'Republish'}
            </button>

            <button
              type="button"
              onClick={handleTriggerHealthCheck}
              disabled={checkingHealth}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.76rem',
                cursor: checkingHealth ? 'not-allowed' : 'pointer',
              }}
            >
              {checkingHealth ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
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
                padding: '0.5rem 0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.76rem',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} /> Full Admin
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
