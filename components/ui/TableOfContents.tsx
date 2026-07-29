'use client';

import React, { useState, useEffect, useRef } from 'react';
import { List, ChevronDown, ChevronUp } from 'lucide-react';

export interface TocItem {
  id: string;
  text: string;
  level?: number;
}

export interface TableOfContentsProps {
  items: TocItem[];
  title?: string;
  className?: string;
}

function resolveElement(id: string): HTMLElement | null {
  if (!id) return null;
  const cleanId = id.replace(/^#/, '');
  return (
    document.getElementById(cleanId) ||
    document.getElementById(`user-content-${cleanId}`) ||
    document.querySelector(`[id="${cleanId}"]`) ||
    document.querySelector(`[id="user-content-${cleanId}"]`)
  );
}

export function TableOfContents({
  items,
  title = 'On this page',
  className = '',
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || '');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isClickScrolling = useRef<boolean>(false);

  useEffect(() => {
    if (!items || !items.length) return;

    const headingElements: { id: string; element: HTMLElement }[] = [];

    items.forEach((item) => {
      const el = resolveElement(item.id);
      if (el) {
        headingElements.push({ id: item.id, element: el });
      }
    });

    if (!headingElements.length) return;

    const handleScroll = () => {
      if (isClickScrolling.current) return;

      const scrollPosition = window.scrollY + 100;

      // Check if we are near the bottom of the page
      const isAtBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50;

      if (isAtBottom && headingElements.length > 0) {
        setActiveId(headingElements[headingElements.length - 1].id);
        return;
      }

      // Find current active section
      for (let i = headingElements.length - 1; i >= 0; i--) {
        const { id, element } = headingElements[i];
        const top = element.getBoundingClientRect().top + window.scrollY;

        if (scrollPosition >= top - 20) {
          setActiveId(id);
          return;
        }
      }

      // Fallback to first item if scrolled near top
      if (headingElements.length > 0) {
        setActiveId(headingElements[0].id);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [items]);

  if (!items || items.length === 0) {
    return null;
  }

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveId(id);
    setIsOpen(false);
    isClickScrolling.current = true;

    const el = resolveElement(id);
    if (el) {
      const yOffset = -90; // Header height offset
      const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });

      // Update URL hash without jumping
      if (window.history.pushState) {
        window.history.pushState(null, '', `#${id}`);
      }
    }

    setTimeout(() => {
      isClickScrolling.current = false;
    }, 800);
  };

  const activeItem = items.find((item) => item.id === activeId) || items[0];

  return (
    <nav aria-label="Table of contents" className={className}>
      {/* Mobile Top Accordion (visible on < 1024px) */}
      <div className="lg:hidden surface-muted rounded-xl p-3.5 mb-6 border border-slate-800/80 shadow-sm">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 text-left text-sm font-semibold text-slate-200 focus:outline-none"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <List size={16} className="text-cyan-400 shrink-0" />
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold shrink-0">
              {title}:
            </span>
            <span className="truncate text-cyan-300 text-sm font-medium">
              {activeItem?.text}
            </span>
          </div>
          {isOpen ? (
            <ChevronUp size={18} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronDown size={18} className="text-slate-400 shrink-0" />
          )}
        </button>

        {isOpen && (
          <ol className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
            {items.map((item) => {
              const isActive = item.id === activeId;
              const isH3 = item.level === 3;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => handleLinkClick(e, item.id)}
                    className={`block text-sm py-1 px-2.5 rounded-lg transition-colors ${
                      isH3 ? 'ml-3 text-xs' : ''
                    } ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300 font-semibold border-l-2 border-cyan-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Desktop Sticky Sidebar (visible on >= 1024px) */}
      <div className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/80">
          <List size={15} className="text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {title}
          </h3>
        </div>
        <ol className="flex flex-col gap-1 text-sm border-l border-slate-800/60 pl-0">
          {items.map((item) => {
            const isActive = item.id === activeId;
            const isH3 = item.level === 3;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleLinkClick(e, item.id)}
                  className={`block py-1.5 pr-2 transition-all duration-150 leading-snug ${
                    isH3 ? 'pl-6 text-xs' : 'pl-3'
                  } ${
                    isActive
                      ? 'border-l-2 -ml-[1px] border-cyan-400 text-cyan-300 font-semibold bg-gradient-to-r from-cyan-500/10 to-transparent'
                      : 'border-l-2 -ml-[1px] border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {item.text}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
