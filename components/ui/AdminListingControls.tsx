'use client';

import {
  Activity,
  Check,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { DIRECTORY_CATEGORIES } from '../../lib/categories';
import { SafeMarkdown } from './SafeMarkdown';
import { toast } from './Toast';

/* -------------------------------------------------------------------------- */
/*                               ADMIN CONTEXT                                */
/* -------------------------------------------------------------------------- */

interface AdminContextValue {
  isAdmin: boolean;
  serverId: string;
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  serverId: '',
});

export function AdminProvider({
  serverId,
  children,
}: {
  serverId: string;
  children: React.ReactNode;
}) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mcp/${serverId}/is-owner`);
        if (res.ok) {
          const data = (await res.json()) as {
            isOwner?: boolean;
            isAdmin?: boolean;
          };
          if (!cancelled && data?.isAdmin) {
            setIsAdmin(true);
          }
        }
      } catch {
        // Leave default false
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  return (
    <AdminContext.Provider value={{ isAdmin, serverId }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}

/* -------------------------------------------------------------------------- */
/*                               TOP ADMIN BAR                                */
/* -------------------------------------------------------------------------- */

export interface AdminTopBarProps {
  server: {
    id: string;
    status: string;
    featuredUntil?: string | Date | null;
  };
}

export function AdminTopBar({ server }: AdminTopBarProps) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [enrichingAi, setEnrichingAi] = useState(false);
  const [enrichStatusText, setEnrichStatusText] = useState<string | null>(null);
  const [togglingFeatured, setTogglingFeatured] = useState(false);
  const [togglingPublish, setTogglingPublish] = useState(false);

  if (!isAdmin) return null;

  const isFeatured =
    server.featuredUntil && new Date(server.featuredUntil) > new Date();
  const isPublished = server.status === 'active';

  const handleTriggerHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: server.id, action: 'check_health' }),
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
        body: JSON.stringify({ id: server.id, action: 'enrich_ai' }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
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
      if (!res.ok)
        throw new Error(data.error || 'Failed to toggle featured status');
      toast.success(
        isFeatured ? 'Removed from featured' : 'Marked as Featured (7 days)',
      );
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
      if (!res.ok)
        throw new Error(data.error || 'Failed to toggle publish status');
      toast.success(
        isPublished ? 'Listing unpublished' : 'Listing published active',
      );
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change publish status');
    } finally {
      setTogglingPublish(false);
    }
  };

  return (
    <div
      style={{
        marginBottom: '1.25rem',
        padding: '0.75rem 1.15rem',
        borderRadius: '12px',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        background:
          'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.03) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
            }}
          >
            <ShieldCheck size={15} />
          </div>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.02em',
            }}
          >
            Admin Mode
          </span>
        </div>

        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: isPublished
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            color: isPublished ? '#10b981' : '#f87171',
            border: `1px solid ${isPublished ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}
        >
          {server.status}
        </span>

        {isFeatured && (
          <span
            style={{
              fontSize: '0.68rem',
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

        {enrichStatusText && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              color: '#00e5ff',
              marginLeft: '0.25rem',
            }}
          >
            <Loader2 size={12} className="animate-spin" /> {enrichStatusText}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={handleTriggerAiEnrichment}
          disabled={enrichingAi}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.75rem',
            borderRadius: '7px',
            border: '1px solid rgba(0, 229, 255, 0.4)',
            background:
              'linear-gradient(135deg, rgba(0, 229, 255, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
            color: '#00e5ff',
            fontWeight: 700,
            fontSize: '0.78rem',
            cursor: enrichingAi ? 'not-allowed' : 'pointer',
            opacity: enrichingAi ? 0.7 : 1,
          }}
        >
          {enrichingAi ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          {enrichingAi ? 'Enriching...' : 'Re-Run AI Enrichment'}
        </button>

        <button
          type="button"
          onClick={handleToggleFeatured}
          disabled={togglingFeatured}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.4rem 0.65rem',
            borderRadius: '7px',
            border: '1px solid var(--border-color)',
            background: isFeatured
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(255, 255, 255, 0.05)',
            color: isFeatured ? '#f59e0b' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.75rem',
            cursor: togglingFeatured ? 'not-allowed' : 'pointer',
          }}
        >
          <Star size={12} />
          {togglingFeatured ? '...' : isFeatured ? 'Unfeature' : 'Feature 7d'}
        </button>

        <button
          type="button"
          onClick={handleTogglePublish}
          disabled={togglingPublish}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.4rem 0.65rem',
            borderRadius: '7px',
            border: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: isPublished ? 'var(--text-secondary)' : '#10b981',
            fontWeight: 600,
            fontSize: '0.75rem',
            cursor: togglingPublish ? 'not-allowed' : 'pointer',
          }}
        >
          {isPublished ? <EyeOff size={12} /> : <Eye size={12} />}
          {togglingPublish ? '...' : isPublished ? 'Unpublish' : 'Republish'}
        </button>

        <button
          type="button"
          onClick={handleTriggerHealthCheck}
          disabled={checkingHealth}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.4rem 0.65rem',
            borderRadius: '7px',
            border: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.75rem',
            cursor: checkingHealth ? 'not-allowed' : 'pointer',
          }}
        >
          {checkingHealth ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Activity size={12} />
          )}
          {checkingHealth ? '...' : 'Check Health'}
        </button>

        <Link
          href={`/admin?search=${encodeURIComponent(server.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.4rem 0.65rem',
            borderRadius: '7px',
            border: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.75rem',
            textDecoration: 'none',
          }}
        >
          <ExternalLink size={12} /> Full Admin
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            INLINE EDITABLE NAME                            */
/* -------------------------------------------------------------------------- */

export function AdminInlineName({
  serverId,
  initialName,
}: {
  serverId: string;
  initialName: string;
}) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return <span className="detail-page-name">{initialName}</span>;
  }

  if (isEditing) {
    const handleSave = async () => {
      if (!name.trim()) return;
      setSaving(true);
      try {
        const res = await fetch('/api/admin/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: serverId,
            action: 'edit',
            fields: { name: name.trim() },
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to update name');
        toast.success('Listing name updated');
        setIsEditing(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update name');
      } finally {
        setSaving(false);
      }
    };

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          ref={(el) => el?.focus()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setName(initialName);
              setIsEditing(false);
            }
          }}
          style={{
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            padding: '0.2rem 0.6rem',
            fontSize: '1.5rem',
            fontWeight: 700,
            outline: 'none',
            maxWidth: '380px',
          }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          aria-label="Save name"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.35rem',
            borderRadius: '6px',
            background: 'var(--brand-gradient)',
            color: 'var(--bg-color)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setName(initialName);
            setIsEditing(false);
          }}
          disabled={saving}
          aria-label="Cancel editing name"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.35rem',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </span>
    );
  }

  return (
    <span
      className="detail-page-name"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        position: 'relative',
      }}
    >
      <span>{initialName}</span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label="Edit title inline"
        title="Admin: Edit listing name"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.25rem',
          borderRadius: '6px',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          cursor: 'pointer',
          verticalAlign: 'middle',
        }}
      >
        <Edit2 size={13} />
      </button>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                          INLINE EDITABLE CATEGORY                          */
/* -------------------------------------------------------------------------- */

export function AdminInlineCategory({
  serverId,
  currentCategory,
  categorySlug,
}: {
  serverId: string;
  currentCategory: string;
  categorySlug: string;
}) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [category, setCategory] = useState(currentCategory);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return <Link href={`/categories/${categorySlug}`}>{currentCategory}</Link>;
  }

  if (isEditing) {
    const handleSave = async (newCat: string) => {
      setSaving(true);
      try {
        const res = await fetch('/api/admin/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: serverId,
            action: 'edit',
            fields: { category: newCat },
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to update category');
        toast.success(`Category updated to ${newCat}`);
        setIsEditing(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update category');
      } finally {
        setSaving(false);
      }
    };

    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
      >
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            void handleSave(e.target.value);
          }}
          disabled={saving}
          ref={(el) => el?.focus()}
          style={{
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            padding: '0.2rem 0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            colorScheme: 'light dark',
          }}
        >
          {DIRECTORY_CATEGORIES.map((cat) => (
            <option
              key={cat}
              value={cat}
              style={{
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
              }}
            >
              {cat}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          disabled={saving}
          aria-label="Cancel category edit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.2rem',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </span>
    );
  }

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
    >
      <Link href={`/categories/${categorySlug}`}>{currentCategory}</Link>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label="Edit category inline"
        title="Admin: Change category"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.15rem 0.3rem',
          borderRadius: '4px',
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          cursor: 'pointer',
          fontSize: '0.7rem',
          lineHeight: 1,
        }}
      >
        <Edit2 size={10} />
      </button>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                        INLINE EDITABLE DESCRIPTION                         */
/* -------------------------------------------------------------------------- */

export function AdminInlineDescription({
  serverId,
  initialDescription,
  repoUrl,
}: {
  serverId: string;
  initialDescription: string;
  repoUrl: string;
}) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(initialDescription || '');
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return (
      <div
        className="detail-summary"
        style={{
          fontSize: '1.25rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.25rem',
          lineHeight: '1.6',
        }}
      >
        <SafeMarkdown
          content={initialDescription}
          utmContent={serverId}
          repoUrl={repoUrl}
        />
      </div>
    );
  }

  if (isEditing) {
    const handleSave = async () => {
      if (!description.trim()) return;
      setSaving(true);
      try {
        const res = await fetch('/api/admin/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: serverId,
            action: 'edit',
            fields: { description: description.trim() },
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok)
          throw new Error(data.error || 'Failed to update description');
        toast.success('Description updated');
        setIsEditing(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update description');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Admin: Edit Description / Summary
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {description.length}/2000
          </span>
        </div>

        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          ref={(el) => el?.focus()}
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setDescription(initialDescription);
              setIsEditing(false);
            }}
            disabled={saving}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              background: 'var(--brand-gradient)',
              color: 'var(--bg-color)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            {saving ? 'Saving...' : 'Save Description'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="detail-summary group"
      style={{
        fontSize: '1.25rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.25rem',
        lineHeight: '1.6',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <SafeMarkdown
            content={initialDescription}
            utmContent={serverId}
            repoUrl={repoUrl}
          />
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          title="Admin: Edit description inline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.3rem 0.6rem',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            flexShrink: 0,
            marginTop: '0.2rem',
          }}
        >
          <Edit2 size={12} /> Edit
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            INLINE EDITABLE LINK                            */
/* -------------------------------------------------------------------------- */

export function AdminInlineLinkPopover({
  serverId,
  type,
  currentUrl,
}: {
  serverId: string;
  type: 'repository' | 'website';
  currentUrl: string;
}) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl || '');
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fieldName = type === 'repository' ? 'url' : 'websiteUrl';
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: serverId,
          action: 'edit',
          fields: {
            [fieldName]: url.trim() || (type === 'website' ? null : undefined),
          },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to update URL');
      toast.success(
        `${type === 'repository' ? 'Repository' : 'Website'} URL updated`,
      );
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update URL');
    } finally {
      setSaving(false);
    }
  };

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Edit ${type} URL`}
        title={`Admin: Edit ${type} URL`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.25rem',
          borderRadius: '4px',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          cursor: 'pointer',
          marginLeft: '0.25rem',
        }}
      >
        <Edit2 size={12} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '0.4rem',
            zIndex: 100,
            background: 'var(--bg-card, #18181b)',
            color: 'var(--text-primary)',
            padding: '0.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
            width: '320px',
          }}
        >
          <form
            onSubmit={handleSave}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                Edit {type === 'repository' ? 'Repository' : 'Website'} URL
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.1rem',
                }}
              >
                <X size={14} />
              </button>
            </div>
            <input
              type="url"
              required={type === 'repository'}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              ref={(el) => el?.focus()}
              style={{
                width: '100%',
                background: 'var(--bg-color)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.35rem 0.5rem',
                fontSize: '0.8rem',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.4rem',
                marginTop: '0.25rem',
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={saving}
                style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '5px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '5px',
                  background: 'var(--brand-gradient)',
                  color: 'var(--bg-color)',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </span>
  );
}
