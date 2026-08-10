'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Scale, X, Plus, Check } from 'lucide-react';
import type { Server } from '@/lib/servers';
import { ServerAvatar } from './ui/ServerAvatar';
import { trackFeatureUse } from '@/lib/gtag';

interface CompareSelectorProps {
  servers: Server[];
}

export function CompareSelector({ servers }: CompareSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!query.trim()) return servers.slice(0, 12);
    const q = query.toLowerCase();
    return servers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [servers, query]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      if (selectedIds.length < 4) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const handleCompare = () => {
    if (selectedIds.length < 2) return;
    trackFeatureUse('compare_servers', { server_ids: selectedIds, count: selectedIds.length });
    if (selectedIds.length === 2) {
      const [a, b] = selectedIds;
      const [c0, c1] = a < b ? [a, b] : [b, a];
      router.push(`/mcp/${c0}/vs/${c1}`);
    } else {
      const path = selectedIds.join('-vs-');
      router.push(`/compare/${path}`);
    }
  };

  const selectedServers = useMemo(() => {
    const map = new Map(servers.map((s) => [s.id, s]));
    return selectedIds.map((id) => map.get(id)).filter((s): s is Server => Boolean(s));
  }, [servers, selectedIds]);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.75rem',
      }}
    >
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Select Servers to Compare (2 to 4)
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Search or pick from popular tools below to generate a comparison matrix.
        </p>
      </div>

      {/* Selected Items Bar */}
      {selectedServers.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '10px',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            {selectedServers.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.65rem',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  maxWidth: '100%',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <button
                  type="button"
                  onClick={() => toggleSelect(s.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCompare}
            disabled={selectedIds.length < 2}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: selectedIds.length >= 2 ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'rgba(255,255,255,0.08)',
              color: selectedIds.length >= 2 ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: selectedIds.length >= 2 ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              minWidth: '140px',
              flexShrink: 0,
            }}
          >
            <Scale size={15} style={{ flexShrink: 0 }} /> Compare Now ({selectedIds.length})
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search
          size={16}
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', flexShrink: 0 }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search servers by name or keyword..."
          style={{
            width: '100%',
            padding: '0.65rem 0.85rem 0.65rem 2.25rem',
            backgroundColor: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Server Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
        {filtered.map((s) => {
          const isSelected = selectedIds.includes(s.id);
          return (
            <div
              key={s.id}
              onClick={() => toggleSelect(s.id)}
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg-color)',
                border: isSelected ? '1px solid #a855f7' : '1px solid var(--border-color)',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden', minWidth: 0, flex: 1 }}>
                <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={28} />
                <div style={{ overflow: 'hidden', minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.category}
                  </div>
                </div>
              </div>

              <div
                style={{
                  width: '24px',
                  height: '24px',
                  minWidth: '24px',
                  flexShrink: 0,
                  borderRadius: '50%',
                  backgroundColor: isSelected ? '#a855f7' : 'rgba(168, 85, 247, 0.15)',
                  border: isSelected ? 'none' : '1px solid rgba(168, 85, 247, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSelected ? '#ffffff' : '#a855f7',
                }}
              >
                {isSelected ? <Check size={13} style={{ flexShrink: 0 }} /> : <Plus size={13} style={{ flexShrink: 0 }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
