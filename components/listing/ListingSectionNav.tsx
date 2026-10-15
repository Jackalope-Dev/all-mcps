'use client';

import {
  BookOpen,
  CircleHelp,
  Download,
  type LucideIcon,
  ShieldCheck,
  Shuffle,
  Star,
  Wrench,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ListingSection = { id: string; label: string; count?: number };

/** Icon + hue per section — hues match the section heading tiles on the page. */
const SECTION_STYLE: Record<string, { icon: LucideIcon; hue: string }> = {
  install: { icon: Download, hue: 'hue-teal' },
  overview: { icon: BookOpen, hue: 'hue-blue' },
  'tools-schema': { icon: Wrench, hue: 'hue-violet' },
  security: { icon: ShieldCheck, hue: 'hue-indigo' },
  reviews: { icon: Star, hue: 'hue-amber' },
  faq: { icon: CircleHelp, hue: 'hue-pink' },
  alternatives: { icon: Shuffle, hue: 'hue-green' },
};

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Sticky in-page navigation for /mcp/[id]: a floating pill dock whose active
 * indicator slides between sections. Highlights the section in view
 * (IntersectionObserver — no scroll listeners) and keeps the active item
 * scrolled into view on narrow screens where the dock scrolls sideways.
 */
export function ListingSectionNav({
  sections,
}: {
  sections: ListingSection[];
}) {
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lockUntil = useRef(0);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting)
            visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (Date.now() < lockUntil.current) return;
        // First section (in document order) that overlaps the reading band.
        const next = sections.find((s) => visible.has(s.id));
        if (next) setActive(next.id);
      },
      // A band just below the sticky header + this nav.
      { rootMargin: '-140px 0px -55% 0px', threshold: 0 },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [sections]);

  // Position the sliding indicator under the active item, and keep that item
  // in view when the dock scrolls sideways (narrow screens).
  useIsomorphicLayoutEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!list || !link) return;
    const measure = () =>
      setIndicator({ left: link.offsetLeft, width: link.offsetWidth });
    measure();
    if (list.scrollWidth > list.clientWidth) {
      const left =
        link.offsetLeft - list.clientWidth / 2 + link.clientWidth / 2;
      list.scrollTo({ left, behavior: 'smooth' });
    }
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    ro?.observe(list);
    return () => ro?.disconnect();
  }, [active]);

  if (sections.length < 2) return null;

  return (
    <nav className="lst-secnav" aria-label="On this page">
      <div className="lst-secnav-dock">
        <div className="lst-secnav-inner scroll-x" ref={listRef}>
          {indicator ? (
            <span
              className="lst-secnav-indicator"
              aria-hidden="true"
              style={{
                transform: `translateX(${indicator.left}px)`,
                width: indicator.width,
              }}
            />
          ) : null}
          {sections.map((s) => {
            const style = SECTION_STYLE[s.id];
            const Icon = style?.icon;
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                data-id={s.id}
                className={`lst-secnav-link ${style?.hue ?? ''}`.trim()}
                aria-current={isActive ? 'location' : undefined}
                onClick={(e) => {
                  const target = document.getElementById(s.id);
                  if (!target) return;
                  e.preventDefault();
                  setActive(s.id);
                  lockUntil.current = Date.now() + 900;
                  // Land the section just below the sticky site header + this
                  // nav (a native #hash jump ignores them), in one motion, and
                  // update the hash without stacking history entries.
                  const nav =
                    e.currentTarget.closest<HTMLElement>('.lst-secnav');
                  const header = document.querySelector('.site-header');
                  const offset =
                    (header?.getBoundingClientRect().height ?? 64) +
                    (nav?.offsetHeight ?? 60) +
                    12;
                  const top =
                    target.getBoundingClientRect().top +
                    window.scrollY -
                    offset;
                  const reduce = window.matchMedia(
                    '(prefers-reduced-motion: reduce)',
                  ).matches;
                  window.scrollTo({
                    top,
                    behavior: reduce ? 'auto' : 'smooth',
                  });
                  history.replaceState(null, '', `#${s.id}`);
                }}
              >
                {Icon ? (
                  <Icon
                    size={15}
                    className="lst-secnav-icon"
                    aria-hidden="true"
                  />
                ) : null}
                {s.label}
                {s.count != null && s.count > 0 ? (
                  <span className="lst-secnav-count">{s.count}</span>
                ) : null}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
