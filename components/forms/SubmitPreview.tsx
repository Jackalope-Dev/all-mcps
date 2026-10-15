'use client';

import { Clock, Globe } from 'lucide-react';
import { useState } from 'react';
import { isGitHubRepoUrl } from '../../lib/repoUrl';

/** Splits "🛠️ Developer Tools" into its emoji and label. */
function splitCategory(category: string): { emoji: string; label: string } {
  const match = category.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
  return match
    ? { emoji: match[1], label: match[2] }
    : { emoji: '', label: category };
}

function githubOwner(url: string): string | null {
  if (!isGitHubRepoUrl(url)) return null;
  try {
    return new URL(url).pathname.split('/').filter(Boolean)[0] || null;
  } catch {
    return null;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Live preview of how the submitted listing will look as a directory card.
 * Purely presentational — mirrors the shape of the browse card, not its code.
 */
export function SubmitPreview({
  name,
  description,
  category,
  url,
  tags,
}: {
  name: string;
  description: string;
  category: string;
  url: string;
  tags: string[];
}) {
  const owner = githubOwner(url);
  const [avatarFailed, setAvatarFailed] = useState<string | null>(null);
  const { emoji, label } = splitCategory(category);
  const displayName = name.trim() || 'Your server name';
  const initial = (name.trim()[0] || 'M').toUpperCase();
  const host = owner ? `github.com/${owner}` : hostOf(url);
  const showAvatar = owner && avatarFailed !== owner;

  return (
    <section className="acct-preview" aria-label="Listing preview">
      <div className="acct-preview-top">
        <div className="acct-preview-avatar" aria-hidden="true">
          {showAvatar ? (
            // biome-ignore lint/performance/noImgElement: tiny remote avatar, no Next image config for github.com
            <img
              src={`https://github.com/${owner}.png?size=88`}
              alt=""
              width={44}
              height={44}
              onError={() => setAvatarFailed(owner)}
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div className="acct-preview-id">
          <p
            className={`acct-preview-name${name.trim() ? '' : ' is-placeholder'}`}
          >
            {displayName}
          </p>
          {host ? (
            <p className="acct-preview-host">
              <Globe size={12} aria-hidden="true" />
              {host}
            </p>
          ) : null}
        </div>
        <span className="acct-preview-status">
          <Clock size={11} aria-hidden="true" />
          Pending
        </span>
      </div>
      <p
        className={`acct-preview-desc${description.trim() ? '' : ' is-placeholder'}`}
      >
        {description.trim() ||
          'A one-line summary of what your server lets AI agents do.'}
      </p>
      <div className="acct-preview-meta">
        <span className="acct-preview-cat">
          {emoji ? <span aria-hidden="true">{emoji}</span> : null}
          {label}
        </span>
        {tags.slice(0, 3).map((t) => (
          <span key={t} className="acct-preview-tag">
            #{t}
          </span>
        ))}
      </div>
    </section>
  );
}
