'use client';

import { useState } from 'react';
import { parseServerName } from '../../lib/displayName';
import { getCategoryGradient } from '../../lib/categories';

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

  if (logoUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: radius, flexShrink: 0, objectFit: 'cover' }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  const { displayName } = parseServerName(name);

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
        fontSize: size > 40 ? '1.5rem' : '1.1rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        flexShrink: 0,
        color: '#ffffff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      }}
    >
      {displayName.charAt(0)}
    </div>
  );
}

