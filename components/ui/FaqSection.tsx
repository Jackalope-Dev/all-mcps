'use client';

import { ChevronDown, HelpCircle } from 'lucide-react';
import React, { useId, useRef, useState } from 'react';
import { serializeJsonLd } from '@/lib/jsonLd';

export interface FaqItem {
  question?: React.ReactNode;
  q?: React.ReactNode;
  answer?: React.ReactNode;
  a?: React.ReactNode;
}

export interface FaqSectionProps {
  title?: React.ReactNode;
  items: FaqItem[];
  className?: string;
  defaultOpenIndex?: number | null;
  /** Option to emit inline Schema.org FAQPage JSON-LD. Defaults to true. */
  renderJsonLd?: boolean;
}

/** Recursively extracts plain text from strings and React element nodes for Schema.org JSON-LD */
function nodeToString(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean')
    return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToString).join(' ').trim();
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return nodeToString(props.children);
  }
  return '';
}

/**
 * Standardized, WCAG AAA/AA accessible FAQ accordion component with embedded Schema.org JSON-LD support.
 * Complies with W3C WAI-ARIA APG Accordion Pattern (aria-expanded, aria-controls, role="region", arrow key navigation).
 */
export function FaqSection({
  title,
  items,
  className,
  defaultOpenIndex = 0,
  renderJsonLd = true,
}: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);
  const baseId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!items || items.length === 0) return null;

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const total = items.length;
    let targetIndex: number | null = null;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetIndex = (index + 1) % total;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetIndex = (index - 1 + total) % total;
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetIndex = total - 1;
    }

    if (targetIndex !== null && buttonRefs.current[targetIndex]) {
      buttonRefs.current[targetIndex]?.focus();
    }
  };

  // Structured Data (Schema.org FAQPage)
  const jsonLd = renderJsonLd
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => {
          const qText = nodeToString(item.question ?? item.q);
          const aText = nodeToString(item.answer ?? item.a);
          return {
            '@type': 'Question',
            name: qText,
            acceptedAnswer: {
              '@type': 'Answer',
              text: aText,
            },
          };
        }),
      }
    : null;

  return (
    <div className={className}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}

      {title && (
        <h2
          style={{
            fontSize: '1.4rem',
            color: 'var(--text-primary)',
            marginBottom: '1.25rem',
            fontWeight: 700,
          }}
        >
          {title}
        </h2>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map((item, index) => {
          const questionText = item.question ?? item.q;
          const answerText = item.answer ?? item.a;
          const isOpen = openIndex === index;
          const buttonId = `${baseId}-btn-${index}`;
          const panelId = `${baseId}-panel-${index}`;
          const key = typeof questionText === 'string' ? questionText : index;

          return (
            <div
              key={key}
              style={{
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: isOpen ? 'var(--bg-elevated)' : 'var(--bg-muted)',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
              }}
            >
              <button
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                id={buttonId}
                onClick={() => toggle(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                  }}
                >
                  <HelpCircle
                    size={18}
                    style={{ color: 'var(--brand-cyan)', flexShrink: 0 }}
                    aria-hidden="true"
                  />
                  <span>{questionText}</span>
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  style={{
                    color: 'var(--text-secondary)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0,
                  }}
                />
              </button>

              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  style={{
                    padding: '0 1.25rem 1.25rem 2.85rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    fontSize: '0.925rem',
                  }}
                >
                  {answerText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
