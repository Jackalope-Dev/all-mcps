import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News and updates from the AllMCPs team — MCP directory, agents, and launch notes.',
  alternates: {
    canonical: 'https://allmcps.com/blog',
  },
};

const POSTS = [
  {
    slug: 'launching-allmcps',
    title: 'Launching AllMCPs: a directory for MCP servers',
    date: '2026-07-27',
    excerpt:
      'AllMCPs is the open directory for discovering, installing, and verifying Model Context Protocol servers — with claim flows, website backlinks, and agent-friendly APIs.',
  },
];

export default function BlogPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <header className="page-header">
          <h1 className="text-page-title">Blog</h1>
          <p className="text-lead">Notes on MCP, agents, and the AllMCPs directory.</p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {POSTS.map((post) => (
            <article key={post.slug} className="surface" style={{ padding: '1.75rem' }}>
              <time dateTime={post.date} className="text-meta" style={{ fontWeight: 600 }}>
                {new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <h2 className="text-section" style={{ margin: '0.5rem 0 0.75rem' }}>
                <Link href={`/blog#${post.slug}`}>{post.title}</Link>
              </h2>
              <p style={{ margin: 0, lineHeight: 1.65 }}>{post.excerpt}</p>
            </article>
          ))}
        </div>

        <article
          id="launching-allmcps"
          className="surface page-panel"
          style={{ marginTop: '2.5rem' }}
        >
          <h2 className="text-section">Launching AllMCPs</h2>
          <div className="markdown-body">
            <p>
              Model Context Protocol (MCP) is how AI agents connect to tools, data, and APIs. The ecosystem already
              has thousands of servers — but discovery is scattered across repos, READMEs, and word of mouth.
            </p>
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>AllMCPs</strong> is the directory we wanted: browse
              and search by category, copy install prompts for agents, and ship a clean detail page for every listing.
            </p>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginTop: '1.5rem' }}>
              What you can do today
            </h3>
            <ul>
              <li>
                <Link href="/browse" style={{ color: 'var(--accent-color)' }}>
                  Browse
                </Link>{' '}
                the catalog with list/grid views, search, and filters (including Verified).
              </li>
              <li>
                Open any listing for install configs, agent prompts, and README content when available.
              </li>
              <li>
                <Link href="/submit" style={{ color: 'var(--accent-color)' }}>
                  Submit
                </Link>{' '}
                your own MCP server and claim ownership after approval.
              </li>
            </ul>
            <p>
              Built by{' '}
              <a href="https://jackalope.digital" target="_blank" rel="noopener noreferrer">
                Jackalope Digital
              </a>
              . Give your AI agents superpowers.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
