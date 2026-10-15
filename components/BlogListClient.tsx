'use client';

import { ArrowRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BlogPost } from '../lib/blog';
import { blogTagClass, blogTagHueClass } from './content/blogTags';

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function PostMeta({ post }: { post: BlogPost }) {
  return (
    <span className="blog-post-meta">
      <time dateTime={post.date}>{formatDate(post.date)}</time>
      <span aria-hidden="true">·</span>
      <span>{post.readingTime} min read</span>
    </span>
  );
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

  // Most-used tags first: the filter row reads as "topics", not an alphabet.
  const tagCounts = useMemo(
    () =>
      tags
        .map((tag) => ({
          tag,
          count: posts.filter((p) => p.tags.includes(tag)).length,
        }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    [posts, tags],
  );

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
  const featured = isFiltered ? undefined : filtered[0];
  const rest = isFiltered ? filtered : filtered.slice(1);

  const reset = () => {
    setQuery('');
    setActiveTag(null);
  };

  return (
    <div className="blog-list">
      <div className="blog-toolbar">
        <label className="blog-search">
          <Search size={16} aria-hidden="true" className="blog-search-icon" />
          <input
            type="search"
            className="form-input"
            placeholder="Search articles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search blog posts"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="blog-search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>

        {tagCounts.length > 0 ? (
          <div className="fade-x blog-tags">
            <div
              className="topic-chips scroll-x"
              role="toolbar"
              aria-label="Filter by tag"
            >
              <button
                type="button"
                className="chip"
                aria-pressed={activeTag === null}
                onClick={() => setActiveTag(null)}
              >
                All <span className="chip-count">{posts.length}</span>
              </button>
              {tagCounts.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  className="chip"
                  aria-pressed={activeTag === tag}
                  onClick={() =>
                    setActiveTag((cur) => (cur === tag ? null : tag))
                  }
                >
                  {blogTagHueClass(tag) ? (
                    <span
                      className={`topic-dot ${blogTagHueClass(tag)}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  {tag} <span className="chip-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <p className="blog-result-count" aria-live="polite">
        {isFiltered
          ? `${filtered.length} of ${posts.length} articles`
          : `${posts.length} articles`}
      </p>

      {filtered.length === 0 ? (
        <div className="content-empty">
          <strong>No articles found</strong>
          <p>
            Nothing matches &ldquo;{query || activeTag}&rdquo;. Try another
            keyword or clear your filters.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={reset}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          {featured ? (
            <Link
              href={`/blog/${featured.slug}`}
              className="blog-featured spotlight"
            >
              <span className="blog-featured-label">Latest</span>
              <h2 className="blog-featured-title">{featured.title}</h2>
              <p className="blog-featured-excerpt">{featured.excerpt}</p>
              <span className="blog-featured-foot">
                <PostMeta post={featured} />
                <span className="blog-read">
                  Read article <ArrowRight size={14} aria-hidden="true" />
                </span>
              </span>
            </Link>
          ) : null}

          <ul className="blog-grid">
            {rest.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="blog-item">
                  <PostMeta post={post} />
                  <h2 className="blog-item-title">{post.title}</h2>
                  <p className="blog-item-excerpt">{post.excerpt}</p>
                  <span className="blog-item-tags">
                    {post.tags
                      .filter((t) => t !== 'MCP')
                      .slice(0, 3)
                      .map((tag) => (
                        <span key={tag} className={blogTagClass(tag)}>
                          {tag}
                        </span>
                      ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
