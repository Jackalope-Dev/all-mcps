'use client';

import { ArrowRight, Calendar, Clock, Rss, Search, Tag, X } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import type { BlogPost } from '../lib/blog';
import { Badge } from './ui/Badge';

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type PostColorTheme = {
  accent: string;
  lightAccent: string;
  badgeVariant: 'cyan' | 'category' | 'verified' | 'official' | 'premium';
  kickerLabel: string;
};

function getPostTheme(post: BlogPost, index: number): PostColorTheme {
  const t = (post.tags || []).map((tag) => tag.toLowerCase());

  if (
    t.some(
      (tag) =>
        tag.includes('sampling') ||
        tag.includes('vision') ||
        tag.includes('ai'),
    )
  ) {
    return {
      accent: '#00e5ff',
      lightAccent: '#0284c7',
      badgeVariant: 'cyan',
      kickerLabel: 'AI & Sampling',
    };
  }
  if (
    t.some(
      (tag) =>
        tag.includes('architect') ||
        tag.includes('deploy') ||
        tag.includes('remote') ||
        tag.includes('production'),
    )
  ) {
    return {
      accent: '#34d399',
      lightAccent: '#047857',
      badgeVariant: 'verified',
      kickerLabel: 'Architecture & Infra',
    };
  }
  if (
    t.some(
      (tag) =>
        tag.includes('secur') ||
        tag.includes('auth') ||
        tag.includes('troubleshoot') ||
        tag.includes('connect'),
    )
  ) {
    return {
      accent: '#fbbf24',
      lightAccent: '#b45309',
      badgeVariant: 'premium',
      kickerLabel: 'Security & Debugging',
    };
  }
  if (
    t.some(
      (tag) =>
        tag.includes('claude') ||
        tag.includes('cursor') ||
        tag.includes('client') ||
        tag.includes('skill') ||
        tag.includes('tool'),
    )
  ) {
    return {
      accent: '#c084fc',
      lightAccent: '#7e22ce',
      badgeVariant: 'category',
      kickerLabel: 'Clients & Tooling',
    };
  }
  if (
    t.some(
      (tag) =>
        tag.includes('browser') ||
        tag.includes('scrape') ||
        tag.includes('playwright') ||
        tag.includes('seo'),
    )
  ) {
    return {
      accent: '#38bdf8',
      lightAccent: '#0369a1',
      badgeVariant: 'cyan',
      kickerLabel: 'Automation & Web',
    };
  }

  const fallbacks: PostColorTheme[] = [
    {
      accent: '#00e5ff',
      lightAccent: '#0284c7',
      badgeVariant: 'cyan',
      kickerLabel: 'Technical Guide',
    },
    {
      accent: '#c084fc',
      lightAccent: '#7e22ce',
      badgeVariant: 'category',
      kickerLabel: 'Developer Notes',
    },
    {
      accent: '#34d399',
      lightAccent: '#047857',
      badgeVariant: 'verified',
      kickerLabel: 'Protocol Deep Dive',
    },
    {
      accent: '#fbbf24',
      lightAccent: '#b45309',
      badgeVariant: 'premium',
      kickerLabel: 'Best Practices',
    },
  ];
  return fallbacks[index % fallbacks.length];
}

export function BlogListClient({
  posts,
  tags,
}: {
  posts: BlogPost[];
  tags: string[];
}) {
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

  const isFiltered = Boolean(query.trim() || activeTag);

  return (
    <div className="blog-index-wrapper">
      {/* Search & Tag Filter Chrome */}
      <div className="blog-filter-bar surface grid-crosshair grid-crosshair-tl grid-crosshair-br">
        <div className="blog-search-row">
          <div
            className="hero-playground-search"
            style={{ flex: 1, minWidth: '240px' }}
          >
            <Search
              size={15}
              style={{ color: 'var(--accent-color)', flexShrink: 0 }}
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search guides, architecture, sampling, clients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search blog posts"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <a
            href="/blog/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            title="Subscribe to RSS Feed"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
            }}
          >
            <Rss size={13} style={{ color: '#fb923c' }} aria-hidden="true" />
            <span>RSS Feed</span>
          </a>
        </div>

        {tags.length > 0 && (
          <div className="blog-tags-container">
            <div className="blog-tags-scroll">
              <button
                type="button"
                className={`directory-tag ${activeTag === null ? 'directory-tag-active' : ''}`}
                onClick={() => setActiveTag(null)}
              >
                All Posts ({posts.length})
              </button>
              {tags.map((tag) => {
                const count = posts.filter((p) => p.tags.includes(tag)).length;
                const isActive = activeTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`directory-tag ${isActive ? 'directory-tag-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() =>
                      setActiveTag((cur) => (cur === tag ? null : tag))
                    }
                  >
                    <span>{tag}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Post Grid */}
      {filtered.length === 0 ? (
        <div
          className="surface"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <Tag
            size={28}
            style={{
              color: 'var(--text-secondary)',
              opacity: 0.5,
              margin: '0 auto 0.75rem',
            }}
          />
          <h3
            style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              margin: '0 0 0.5rem',
            }}
          >
            No articles found
          </h3>
          <p
            style={{
              color: 'var(--text-secondary)',
              margin: '0 0 1.25rem',
              fontSize: '0.9rem',
            }}
          >
            No posts match &ldquo;{query || activeTag}&rdquo;. Try another
            keyword or clear your filters.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setQuery('');
              setActiveTag(null);
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="blog-bento-grid">
          {filtered.map((post, idx) => {
            const isHero = !isFiltered && idx === 0;
            const isWide = !isFiltered && idx === 3;
            const theme = getPostTheme(post, idx);

            const bentoClass = isHero
              ? 'blog-card--hero'
              : isWide
                ? 'blog-card--wide'
                : 'blog-card--standard';

            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className={`blog-card surface grid-crosshair grid-crosshair-tl grid-crosshair-br ${bentoClass}`}
                style={
                  {
                    '--blog-accent': theme.accent,
                    '--blog-light-accent': theme.lightAccent,
                  } as React.CSSProperties
                }
              >
                <div>
                  {/* Kicker bar */}
                  <div className="blog-card-kicker">
                    <span className="blog-card-dot" />
                    <span>
                      {isHero
                        ? 'FEATURED EDITORIAL'
                        : isWide
                          ? 'POPULAR GUIDE'
                          : theme.kickerLabel}
                    </span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Clock size={11} aria-hidden="true" />
                      {post.readingTime} min read
                    </span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <time
                      dateTime={post.date}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Calendar size={11} aria-hidden="true" />
                      {formatDate(post.date)}
                    </time>
                  </div>

                  {/* Title */}
                  <h2 className="blog-card-title">{post.title}</h2>

                  {/* Excerpt */}
                  <p className="blog-card-excerpt">{post.excerpt}</p>
                </div>

                {/* Footer */}
                <div className="blog-card-footer">
                  <div className="blog-card-tags">
                    {post.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="category">
                        {tag}
                      </Badge>
                    ))}
                    {post.tags.length > 3 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-secondary)',
                          alignSelf: 'center',
                        }}
                      >
                        +{post.tags.length - 3}
                      </span>
                    )}
                  </div>

                  <span className="blog-card-cta">
                    <span>{isHero ? 'Read Full Guide' : 'Read Article'}</span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
