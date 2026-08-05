'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import type { BlogPost } from '../lib/blog';

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function BlogListClient({ posts, tags }: { posts: BlogPost[]; tags: string[] }) {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesQuery =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesTag = !activeTag || post.tags.includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [posts, query, activeTag]);

  return (
    <>
      <div className="directory-filters" style={{ marginBottom: '2rem' }}>
        <div className="directory-filters-row">
          <Input
            type="text"
            placeholder="Search posts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search blog posts"
            style={{ flexGrow: 1, flexBasis: '280px', margin: 0, minWidth: 0 }}
          />
        </div>

        {tags.length > 0 && (
          <div className="directory-tags-row">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`directory-tag ${activeTag === tag ? 'directory-tag-active' : ''}`}
                aria-pressed={activeTag === tag}
                onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="surface" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No posts match your search or filters.
        </div>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', listStyle: 'none', margin: 0, padding: 0 }}>
          {filtered.map((post) => (
            <li key={post.slug} style={{ listStyle: 'none' }}>
              <Link
                href={`/blog/${post.slug}`}
                className="surface surface-interactive"
                style={{ padding: '1.75rem', display: 'block' }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <time dateTime={post.date} className="text-meta" style={{ fontWeight: 600 }}>
                    {formatDate(post.date)}
                  </time>
                  <span className="text-meta">· {post.readingTime} min read</span>
                </div>
                <h2 className="text-section" style={{ margin: '0.5rem 0 0.75rem' }}>
                  {post.title}
                </h2>
                <p style={{ margin: '0 0 1rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>{post.excerpt}</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="category">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
