'use client';

import { useEffect } from 'react';
import { scheduleAnalytics } from '../lib/analyticsLoader';

/**
 * Loads GA + PostHog on first interaction or shortly after load, off the
 * hydration critical path (see lib/analyticsLoader.ts). Mounted once in the
 * root layout.
 */
export function DeferredAnalytics() {
  useEffect(() => scheduleAnalytics(), []);
  return null;
}
