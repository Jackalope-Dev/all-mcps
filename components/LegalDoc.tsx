import type React from 'react';

/**
 * Readable layout for long legal pages (privacy, terms): a narrow prose
 * column plus a sticky table of contents on wide screens.
 */
export function LegalDoc({
  title,
  effective,
  toc,
  children,
}: {
  title: string;
  effective: string;
  toc: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="acct-legal">
      <header className="acct-legal-head">
        <h1 className="text-page-title">{title}</h1>
        <p className="acct-legal-date">Effective {effective}</p>
      </header>
      <div className="acct-legal-grid">
        <nav className="acct-legal-toc" aria-label="On this page">
          <p className="acct-legal-toc-title">On this page</p>
          <ol>
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`}>{t.label}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="markdown-body acct-legal-body">{children}</div>
      </div>
    </div>
  );
}
