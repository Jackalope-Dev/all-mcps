import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { serializeJsonLd } from '@/lib/jsonLd';
import { FaqSection, type FaqSectionProps } from '../ui/FaqSection';
import {
  FALLBACK_TOOL_ICON,
  TOOL_CATALOG,
  toolEntry,
  toolHue,
} from './toolCatalog';

interface ToolPageProps {
  /** Path of this tool (matches toolCatalog href) — drives icon + related tools. */
  href: string;
  /** Breadcrumb label. */
  crumb: string;
  title: React.ReactNode;
  description: React.ReactNode;
  /** Small facts under the lead. Defaults to free / no sign-in / in-browser. */
  meta?: string[];
  jsonLd?: object[];
  /** The interactive workspace. */
  children: React.ReactNode;
  /** "How it works" heading + prose below the workspace. */
  aboutTitle?: React.ReactNode;
  about?: React.ReactNode;
  faq?: FaqSectionProps['items'];
  /** Set false when the page already emits its own FAQPage JSON-LD. */
  faqJsonLd?: boolean;
  /** Extra links shown at the end of the about column (guides, next steps). */
  links?: Array<{ href: string; label: string }>;
}

const DEFAULT_META = ['Free', 'No sign-in', 'Runs in your browser'];

/**
 * Consistent layout for every developer tool: compact header with breadcrumbs,
 * a full-width workspace, then explanatory copy + FAQ with a related-tools rail.
 */
export function ToolPage({
  href,
  crumb,
  title,
  description,
  meta = DEFAULT_META,
  jsonLd = [],
  children,
  aboutTitle,
  about,
  faq,
  faqJsonLd = true,
  links = [],
}: ToolPageProps) {
  const entry = toolEntry(href);
  const Icon = entry?.icon ?? FALLBACK_TOOL_ICON;
  const related = TOOL_CATALOG.filter(
    (t) => t.href !== href && (!entry || t.group === entry.group),
  ).slice(0, 3);
  const others = TOOL_CATALOG.filter(
    (t) => t.href !== href && !related.includes(t),
  ).slice(0, 6 - related.length);

  return (
    <main className="tl-page">
      {jsonLd.map((data, i) => (
        <script
          // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered JSON-LD blocks.
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
        />
      ))}
      <div className="tl-container">
        <nav aria-label="Breadcrumb">
          <ol className="crumbs tl-crumbs">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/tools">Tools</Link>
            </li>
            <li aria-current="page">{crumb}</li>
          </ol>
        </nav>

        <header className="tl-head animate-in">
          <span
            className={`tl-head-icon hue-${toolHue(href)}`}
            aria-hidden="true"
          >
            <Icon size={22} strokeWidth={1.75} />
          </span>
          <div className="tl-head-text">
            <h1 className="tl-title">{title}</h1>
            <div className="tl-lead">{description}</div>
            {meta.length > 0 ? (
              <ul className="tl-meta" aria-label="About this tool">
                {meta.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </header>

        <div
          className="tl-body animate-in"
          style={{ '--i': 1 } as React.CSSProperties}
        >
          {children}
        </div>

        {about || faq ? (
          <section className="tl-about" aria-label="How it works">
            <div className="tl-about-main">
              {aboutTitle ? (
                <h2 className="tl-about-title">{aboutTitle}</h2>
              ) : null}
              {about ? <div className="tl-prose">{about}</div> : null}
              {faq && faq.length > 0 ? (
                <FaqSection
                  className="tl-faq"
                  title="Frequently asked questions"
                  items={faq}
                  renderJsonLd={faqJsonLd}
                />
              ) : null}
              {links.length > 0 ? (
                <div className="tl-next-links">
                  {links.map((l) => (
                    <Link key={l.href} href={l.href} className="link-arrow">
                      {l.label}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            <aside className="tl-related" aria-label="More tools">
              <p className="tl-related-label">More free tools</p>
              <ul>
                {[...related, ...others].map((t) => {
                  const TIcon = t.icon;
                  return (
                    <li key={t.href}>
                      <Link href={t.href} className="tl-related-item">
                        <span
                          className={`tl-related-icon hue-${toolHue(t.href)}`}
                          aria-hidden="true"
                        >
                          <TIcon size={16} strokeWidth={1.75} />
                        </span>
                        <span className="tl-related-text">
                          <span className="tl-related-name">{t.name}</span>
                          <span className="tl-related-blurb">{t.blurb}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link href="/tools" className="link-arrow tl-related-all">
                All developer tools
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}
