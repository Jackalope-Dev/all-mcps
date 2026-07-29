'use client';

import { useState } from 'react';
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

function getGradient(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/** Logo image when set, otherwise a deterministic gradient avatar keyed off the display name's initial. */
export function ServerAvatar({
  name,
  logoUrl,
  size = 48,
}: {
  name: string;
  logoUrl?: string | null;
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
        background: getGradient(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 40 ? '1.5rem' : '1.1rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      {displayName.charAt(0)}
    </div>
  );
}
