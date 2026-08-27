'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, Loader2, Edit3, Globe, FolderGit2, Tag, FileText } from 'lucide-react';
import { toast } from './Toast';
import { DIRECTORY_CATEGORIES } from '../../lib/categories';

export interface AdminQuickEditModalProps {
  server: {
    id: string;
    name: string;
    description: string;
    category: string;
    url: string;
    websiteUrl?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminQuickEditModal({
  server,
  isOpen,
  onClose,
  onSuccess,
}: AdminQuickEditModalProps) {
  const router = useRouter();
  const [name, setName] = useState(server.name || '');
  const [category, setCategory] = useState(server.category || DIRECTORY_CATEGORIES[0]);
  const [description, setDescription] = useState(server.description || '');
  const [url, setUrl] = useState(server.url || '');
  const [websiteUrl, setWebsiteUrl] = useState(server.websiteUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: server.id,
          action: 'edit',
          fields: {
            name: name.trim(),
            description: description.trim(),
            category: category.trim(),
            url: url.trim(),
            websiteUrl: websiteUrl.trim() || undefined,
          },
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save changes.');
      }

      toast.success('Listing updated in-place!');
      onSuccess?.();
      onClose();
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-quick-edit-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="surface"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
              }}
            >
              <Edit3 size={18} />
            </div>
            <div>
              <h2 id="admin-quick-edit-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                In-Place Admin Edit
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {server.id}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Listing Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
            />
          </div>

          {/* Category */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              <Tag size={14} style={{ color: 'var(--text-secondary)' }} /> Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
              style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              {DIRECTORY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <FileText size={14} style={{ color: 'var(--text-secondary)' }} /> Description
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {description.length}/2000
              </span>
            </div>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              className="input"
              style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.88rem', resize: 'vertical' }}
            />
          </div>

          {/* Repository URL */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              <FolderGit2 size={14} style={{ color: 'var(--text-secondary)' }} /> Repository / Source URL
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input"
              style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
            />
          </div>

          {/* Website URL */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              <Globe size={14} style={{ color: 'var(--text-secondary)' }} /> Website / Product URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="input"
              style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
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
                gap: '0.4rem',
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--brand-gradient)',
                color: 'var(--bg-color)',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
