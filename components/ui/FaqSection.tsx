'use client';

import { Plus } from 'lucide-react';
import React, { useId, useRef, useState } from 'react';
import { serializeJsonLd } from '@/lib/jsonLd';

interface FaqItem {
  question?: React.ReactNode;
  q?: React.ReactNode;
  answer?: React.ReactNode;
  a?: React.ReactNode;
}

export interface FaqSectionProps {
  title?: React.ReactNode;
  /** id on the title heading, so a table-of-contents entry can target it. */
  headingId?: string;
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
 * Accessible FAQ accordion (WAI-ARIA APG accordion pattern: aria-expanded,
 * aria-controls, role="region", arrow-key navigation) with optional
 * FAQPage JSON-LD. Answers stay in the DOM when collapsed (inert, height 0)
 * so their text is still present for crawlers and in-page find.
 */
export function FaqSection({
  title,
  headingId,
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

    if (e.key === 'ArrowDown') targetIndex = (index + 1) % total;
    else if (e.key === 'ArrowUp') targetIndex = (index - 1 + total) % total;
    else if (e.key === 'Home') targetIndex = 0;
    else if (e.key === 'End') targetIndex = total - 1;

    if (targetIndex !== null) {
      e.preventDefault();
      buttonRefs.current[targetIndex]?.focus();
    }
  };

  const jsonLd = renderJsonLd
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
          '@type': 'Question',
          name: nodeToString(item.question ?? item.q),
          acceptedAnswer: {
            '@type': 'Answer',
            text: nodeToString(item.answer ?? item.a),
          },
        })),
      }
    : null;

  return (
    <section className={`faq ${className ?? ''}`.trim()}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}

      {title && (
        <h2 className="faq-title" id={headingId}>
          {title}
        </h2>
      )}

      <div className="faq-list">
        {items.map((item, index) => {
          const questionText = item.question ?? item.q;
          const answerText = item.answer ?? item.a;
          const isOpen = openIndex === index;
          const buttonId = `${baseId}-btn-${index}`;
          const panelId = `${baseId}-panel-${index}`;
          const key = typeof questionText === 'string' ? questionText : index;

          return (
            <div key={key} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
              <h3 className="faq-q">
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
                  className="faq-trigger"
                >
                  <span>{questionText}</span>
                  <Plus size={18} aria-hidden="true" className="faq-icon" />
                </button>
              </h3>
              <section
                id={panelId}
                aria-labelledby={buttonId}
                className="faq-panel"
                inert={!isOpen}
              >
                <div className="faq-panel-inner">
                  <div className="faq-a">{answerText}</div>
                </div>
              </section>
            </div>
          );
        })}
      </div>
    </section>
  );
}
