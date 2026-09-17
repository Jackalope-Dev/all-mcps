'use client';

import { FaqSection } from '../ui/FaqSection';

interface FaqItem {
  q: string;
  a: string;
}

interface ClientFaqAccordionProps {
  faqList: FaqItem[];
}

export function ClientFaqAccordion({ faqList }: ClientFaqAccordionProps) {
  return <FaqSection items={faqList} defaultOpenIndex={0} />;
}
