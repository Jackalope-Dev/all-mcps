import type { ReactNode } from 'react';
import '../styles/account.css';

// Scopes the account stylesheet to /dashboard, including its loading.tsx
// skeleton (it used to load on every page from the root layout).
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
