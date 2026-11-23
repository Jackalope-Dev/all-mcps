import type { ReactNode } from 'react';
import '../styles/tools.css';

// Exists only to scope the tools stylesheet to /tools (it used to load
// render-blocking on every page from the root layout).
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return children;
}
