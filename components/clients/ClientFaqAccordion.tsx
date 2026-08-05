'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

interface ClientFaqAccordionProps {
  faqList: FaqItem[];
}

export function ClientFaqAccordion({ faqList }: ClientFaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {faqList.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.q}
            style={{
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: isOpen ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.4)',
              transition: 'all 0.2s ease',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => toggle(index)}
              type="button"
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
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <HelpCircle size={18} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                <span>{item.q}</span>
              </span>
              <ChevronDown
                size={18}
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
                style={{
                  padding: '0 1.25rem 1.25rem 3rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  fontSize: '0.925rem',
                }}
              >
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
