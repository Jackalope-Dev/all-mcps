'use client';

import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

export interface TocItem {
  id: string;
  text: string;
  level?: number;
}

export interface TableOfContentsProps {
  items: TocItem[];
  title?: string;
  className?: string;
  /**
   * `rail` — sticky right-rail list (desktop).
   * `inline` — collapsible "On this page" bar (mobile / narrow).
   * `auto` (default) — both, switched by CSS at the article breakpoint.
   */
  variant?: 'auto' | 'rail' | 'inline';
}

function resolveElement(id: string): HTMLElement | null {
  if (!id) return null;
  const cleanId = id.replace(/^#/, '');
  return (
    document.getElementById(cleanId) ||
    document.getElementById(`user-content-${cleanId}`)
  );
}

/** Px from the viewport top at which a heading counts as "current". */
const SPY_OFFSET = 140;

function useScrollSpy(items: TocItem[]) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || '');
  const lockUntil = useRef(0);

  useEffect(() => {
    if (!items.length) return;
    const els = items
      .map((item) => ({ id: item.id, el: resolveElement(item.id) }))
      .filter((h): h is { id: string; el: HTMLElement } => h.el !== null);
    if (!els.length) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < lockUntil.current) return;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActiveId(els[els.length - 1].id);
        return;
      }
      let current = els[0].id;
      for (const { id, el } of els) {
        if (el.getBoundingClientRect().top <= SPY_OFFSET) current = id;
        else break;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  const jumpTo = (id: string) => {
    const el = resolveElement(id);
    if (!el) return;
    setActiveId(id);
    lockUntil.current = Date.now() + 700;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    // Headings carry scroll-margin-top (content.css), so this lands clear of
    // the sticky header.
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  return { activeId, jumpTo };
}

function TocList({
  items,
  activeId,
  onPick,
}: {
  items: TocItem[];
  activeId: string;
  onPick: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  return (
    <ul className="toc-list">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => onPick(e, item.id)}
              className={`toc-link ${item.level === 3 ? 'toc-link--h3' : ''} ${
                isActive ? 'is-active' : ''
              }`}
              aria-current={isActive ? 'location' : undefined}
            >
              {item.text}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function TableOfContents({
  items,
  title = 'On this page',
  className = '',
  variant = 'auto',
}: TableOfContentsProps) {
  const { activeId, jumpTo } = useScrollSpy(items);
  const [open, setOpen] = useState(false);

  if (!items || items.length === 0) return null;

  const pick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setOpen(false);
    jumpTo(id);
  };

  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.id === activeId),
  );
  const activeItem = items[activeIndex];
  const showInline = variant !== 'rail';
  const showRail = variant !== 'inline';

  return (
    <nav
      aria-label="Table of contents"
      className={`toc toc--${variant} ${className}`.trim()}
    >
      {showInline ? (
        <div className={`toc-inline ${open ? 'is-open' : ''}`}>
          <button
            type="button"
            className="toc-inline-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <span className="toc-inline-label">{title}</span>
            <span className="toc-inline-current">{activeItem?.text}</span>
            <span className="toc-inline-count tabular">
              {activeIndex + 1}/{items.length}
            </span>
            <ChevronDown size={16} aria-hidden="true" className="toc-chevron" />
          </button>
          <div className="toc-inline-panel" inert={!open}>
            <div className="toc-inline-panel-inner">
              <TocList items={items} activeId={activeId} onPick={pick} />
            </div>
          </div>
        </div>
      ) : null}

      {showRail ? (
        <div className="toc-rail">
          <p className="toc-rail-title">{title}</p>
          <TocList items={items} activeId={activeId} onPick={pick} />
          <button
            type="button"
            className="toc-top"
            onClick={() => {
              const reduce = window.matchMedia(
                '(prefers-reduced-motion: reduce)',
              ).matches;
              window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
            }}
          >
            Back to top ↑
          </button>
        </div>
      ) : null}
    </nav>
  );
}
