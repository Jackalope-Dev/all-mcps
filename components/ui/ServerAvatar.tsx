'use client';

import { useState } from 'react';
import { getCategoryGradient } from '../../lib/categories';
import { parseServerName } from '../../lib/displayName';

// Deterministic brand-adjacent avatar gradients (cyan / blue / slate)
const GRADIENTS = [
  'linear-gradient(135deg, #00e5ff, #007bff)',
  'linear-gradient(135deg, #007bff, #0f172a)',
  'linear-gradient(135deg, #22d3ee, #0369a1)',
  'linear-gradient(135deg, #38bdf8, #1e3a8a)',
  'linear-gradient(135deg, #0ea5e9, #164e63)',
  'linear-gradient(135deg, #67e8f9, #1d4ed8)',
];

function getGradient(str: string, category?: string) {
  if (category) {
    return getCategoryGradient(category);
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
export function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Site-relative paths (e.g. `/logos/<id>`, `/api/...`)
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\')
  ) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Logo image when set, otherwise a category-themed or deterministic gradient avatar. */
export function ServerAvatar({
  name,
  logoUrl,
  category,
  size = 48,
}: {
  name: string;
  logoUrl?: string | null;
  category?: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const radius = size > 40 ? 12 : 10;
  const { displayName, org } = parseServerName(name);

  // Strip leading '@' from scoped package names (e.g. '@modelcontextprotocol' -> 'modelcontextprotocol')
  // so GitHub org avatar URLs resolve properly.
  const cleanOrg = org ? org.replace(/^@/, '') : null;
  const resolvedLogoUrl =
    logoUrl?.trim() ||
    (cleanOrg
      ? `https://github.com/${encodeURIComponent(cleanOrg)}.png?size=${size * 2}`
      : null);
  const activeLogoUrl = isSafeImageUrl(resolvedLogoUrl)
    ? resolvedLogoUrl
    : null;

  if (activeLogoUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={activeLogoUrl}
        alt={`${displayName} logo`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{
          borderRadius: radius,
          flexShrink: 0,
          objectFit: 'cover',
          background: 'var(--bg-muted)',
        }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: getGradient(name, category),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 40 ? '1.25rem' : '0.9rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        flexShrink: 0,
        color: '#ffffff',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {displayName.charAt(0)}
    </div>
  );
}
