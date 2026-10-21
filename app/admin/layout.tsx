import type { ReactNode } from 'react';
import './admin.css';

// Exists only to scope the admin console's stylesheet to /admin (it used to
// live in app/styles/account.css, loaded render-blocking on every page).
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
