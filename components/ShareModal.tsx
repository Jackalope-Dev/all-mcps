'use client';

import { Share2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

// The dialog (snippets, badge builder, share targets) only matters after a
// click, so it loads on demand instead of riding in the listing page bundle.
// Hover/focus on the trigger warms the chunk so the open feels instant.
const loadDialog = () => import('./ShareModalDialog');
const ShareModalDialog = dynamic(
  () => loadDialog().then((m) => m.ShareModalDialog),
  { ssr: false },
);

export default function ShareModal({
  serverId,
  serverName,
}: {
  serverId: string;
  serverName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        onPointerEnter={loadDialog}
        onFocus={loadDialog}
        className="btn btn-secondary btn-sm"
        title="Share this listing or embed a badge"
        aria-label="Share"
      >
        <Share2 size={15} aria-hidden="true" />
        <span className="lst-btn-label">Share</span>
      </button>

      {isOpen && (
        <ShareModalDialog
          serverId={serverId}
          serverName={serverName}
          onClose={close}
        />
      )}
    </>
  );
}
