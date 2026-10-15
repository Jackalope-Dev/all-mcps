/// <reference types="react/canary" />
import { ViewTransition } from 'react';

/**
 * Root template — remounts whenever the first path segment changes, so the
 * ViewTransition below sees an exit (old page) and an enter (new page) and
 * the browser cross-fades between them (classes in app/styles/foundation.css).
 * Search-param changes (filters, sorting) don't remount, so list updates stay
 * instant instead of fading the whole page.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
