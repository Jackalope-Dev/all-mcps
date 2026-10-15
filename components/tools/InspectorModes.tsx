'use client';

import { FileJson, Plug } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

/**
 * Switches the protocol inspector between its two jobs. Both panes stay
 * mounted (hidden, not unmounted) so switching back keeps a live connection
 * and any pasted payload.
 */
export function InspectorModes({
  live,
  payload,
}: {
  live: React.ReactNode;
  payload: React.ReactNode;
}) {
  const [mode, setMode] = useState<'live' | 'payload'>('live');
  return (
    <div className="pi-modes">
      <div
        className="segmented pi-modes-switch"
        role="tablist"
        aria-label="Inspector mode"
      >
        <button
          type="button"
          role="tab"
          id="pi-tab-live"
          aria-controls="pi-panel-live"
          aria-selected={mode === 'live'}
          onClick={() => setMode('live')}
        >
          <Plug size={14} aria-hidden="true" /> Live server
        </button>
        <button
          type="button"
          role="tab"
          id="pi-tab-payload"
          aria-controls="pi-panel-payload"
          aria-selected={mode === 'payload'}
          onClick={() => setMode('payload')}
        >
          <FileJson size={14} aria-hidden="true" /> Validate a payload
        </button>
      </div>
      <div
        id="pi-panel-live"
        role="tabpanel"
        aria-labelledby="pi-tab-live"
        hidden={mode !== 'live'}
      >
        {live}
      </div>
      <div
        id="pi-panel-payload"
        role="tabpanel"
        aria-labelledby="pi-tab-payload"
        hidden={mode !== 'payload'}
      >
        {payload}
      </div>
    </div>
  );
}
