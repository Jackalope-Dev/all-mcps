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

      const scrollPosition = window.scrollY + 120;

      // Check if near bottom of page
      const isAtBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60;

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

      if (headingElements.length > 0) {
        setActiveId(headingElements[0].id);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

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
      <div className="lg:hidden toc-sidebar-card mb-6">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 text-left focus:outline-none"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <List size={16} className="text-cyan-400 shrink-0" />
            <span className="toc-sidebar-title shrink-0">{title}:</span>
            <span className="truncate text-cyan-300 text-sm font-semibold">
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
          <ul className="toc-sidebar-list mt-3 pt-3 border-t border-slate-800 max-h-[60vh] overflow-y-auto">
            {items.map((item) => {
              const isActive = item.id === activeId;
              const isH3 = item.level === 3;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => handleLinkClick(e, item.id)}
                    className={`toc-link ${isH3 ? 'toc-link--h3' : ''} ${
                      isActive ? 'is-active' : ''
                    }`}
                  >
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Desktop Sticky Sidebar (visible on >= 1024px) */}
      <div className="hidden lg:block toc-sidebar-container">
        <div className="toc-sidebar-card">
          <div className="toc-sidebar-header">
            <List size={16} className="text-cyan-400 shrink-0" />
            <h3 className="toc-sidebar-title">{title}</h3>
          </div>
          <ul className="toc-sidebar-list">
            {items.map((item) => {
              const isActive = item.id === activeId;
              const isH3 = item.level === 3;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => handleLinkClick(e, item.id)}
                    className={`toc-link ${isH3 ? 'toc-link--h3' : ''} ${
                      isActive ? 'is-active' : ''
                    }`}
                  >
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
