'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Scale, X, Plus, Check } from 'lucide-react';
import type { Server } from '@/lib/servers';
import { ServerAvatar } from './ui/ServerAvatar';

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
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
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
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '10px',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedServers.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.3rem 0.6rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  color: '#ffffff',
                }}
              >
                <span>{s.name}</span>
                <button
                  type="button"
                  onClick={() => toggleSelect(s.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCompare}
            disabled={selectedIds.length < 2}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: selectedIds.length >= 2 ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'rgba(255,255,255,0.1)',
              color: selectedIds.length >= 2 ? '#ffffff' : '#64748b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: selectedIds.length >= 2 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Scale size={14} /> Compare Now ({selectedIds.length})
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search
          size={16}
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search servers by name or keyword..."
          style={{
            width: '100%',
            padding: '0.65rem 0.85rem 0.65rem 2.25rem',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Server Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {filtered.map((s) => {
          const isSelected = selectedIds.includes(s.id);
          return (
            <div
              key={s.id}
              onClick={() => toggleSelect(s.id)}
              style={{
                padding: '0.85rem',
                backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255,255,255,0.02)',
                border: isSelected ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={28} />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.category}
                  </div>
                </div>
              </div>

              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: isSelected ? '#a855f7' : 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                {isSelected ? <Check size={13} /> : <Plus size={13} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
