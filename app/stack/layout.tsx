import type { ReactNode } from 'react';
import '../styles/tools.css';
import '../styles/stack.css';

// Scopes the tool shell and stack builder styles to /stack, including its
// loading.tsx skeleton (they used to load on every page from the root layout).
export default function StackLayout({ children }: { children: ReactNode }) {
  return children;
}
