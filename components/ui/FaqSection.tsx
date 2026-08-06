import React from 'react';

interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

interface FaqSectionProps {
  title?: React.ReactNode;
  items: FaqItem[];
  className?: string;
}

/**
 * Shared FAQ card list used across tool, server, and category pages so every
 * "Frequently Asked Questions" block shares one light/dark-safe style.
 */
export function FaqSection({ title, items, className }: FaqSectionProps) {
  return (
    <div className={className}>
      {title && (
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>
          {title}
        </h2>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {items.map((item) => (
          <div key={item.question} className="faq-card">
            <h3 className="faq-card-question">{item.question}</h3>
            <div className="faq-card-answer">{item.answer}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
