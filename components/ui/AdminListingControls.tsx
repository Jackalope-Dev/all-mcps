'use client';

/**
 * Admin hooks for the /mcp/[id] listing page.
 *
 * This module stays tiny on purpose: it owns the admin check and renders the
 * plain visitor markup. The editing UI (top bar, inline editors, link
 * popovers) lives in AdminListingEditors.tsx and is only downloaded once the
 * /is-owner check says the viewer is an admin — regular visitors never pay for
 * it in the listing page's JS bundle.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { AdminTopBarProps } from './AdminListingEditors';

/* -------------------------------------------------------------------------- */
/*                               ADMIN CONTEXT                                */
/* -------------------------------------------------------------------------- */

interface AdminContextValue {
  isAdmin: boolean;
  serverId: string;
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  serverId: '',
});

export function AdminProvider({
  serverId,
  children,
}: {
  serverId: string;
  children: React.ReactNode;
}) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mcp/${serverId}/is-owner`);
        if (res.ok) {
          const data = (await res.json()) as {
            isOwner?: boolean;
            isAdmin?: boolean;
          };
          if (!cancelled && data?.isAdmin) {
            setIsAdmin(true);
          }
        }
      } catch {
        // Leave default false
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  return (
    <AdminContext.Provider value={{ isAdmin, serverId }}>
      {children}
    </AdminContext.Provider>
  );
}

function useAdmin() {
  return useContext(AdminContext);
}

/* -------------------------------------------------------------------------- */
/*                      LAZY EDITORS (admin viewers only)                     */
/* -------------------------------------------------------------------------- */

const loadEditors = () => import('./AdminListingEditors');

const AdminTopBarEditor = dynamic(
  () => loadEditors().then((m) => m.AdminTopBarEditor),
  { ssr: false },
);
const AdminInlineNameEditor = dynamic(
  () => loadEditors().then((m) => m.AdminInlineNameEditor),
  { ssr: false },
);
const AdminInlineCategoryEditor = dynamic(
  () => loadEditors().then((m) => m.AdminInlineCategoryEditor),
  { ssr: false },
);
const AdminInlineDescriptionEditor = dynamic(
  () => loadEditors().then((m) => m.AdminInlineDescriptionEditor),
  { ssr: false },
);
const AdminInlineLinkPopoverEditor = dynamic(
  () => loadEditors().then((m) => m.AdminInlineLinkPopoverEditor),
  { ssr: false },
);

/* -------------------------------------------------------------------------- */
/*                     PUBLIC COMPONENTS (visitor fallbacks)                  */
/* -------------------------------------------------------------------------- */

export function AdminTopBar({ server }: AdminTopBarProps) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return null;
  return <AdminTopBarEditor server={server} />;
}

export function AdminInlineName({
  serverId,
  initialName,
}: {
  serverId: string;
  initialName: string;
}) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) {
    return <span className="detail-page-name">{initialName}</span>;
  }
  return (
    <AdminInlineNameEditor serverId={serverId} initialName={initialName} />
  );
}

export function AdminInlineCategory({
  serverId,
  currentCategory,
  categorySlug,
}: {
  serverId: string;
  currentCategory: string;
  categorySlug: string;
}) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) {
    return <Link href={`/categories/${categorySlug}`}>{currentCategory}</Link>;
  }
  return (
    <AdminInlineCategoryEditor
      serverId={serverId}
      currentCategory={currentCategory}
      categorySlug={categorySlug}
    />
  );
}

export function AdminInlineDescription({
  serverId,
  initialDescription,
  rendered,
}: {
  serverId: string;
  initialDescription: string;
  /**
   * The description already rendered as markdown by the Server Component.
   * Passed in rather than rendered here so this client module doesn't pull
   * the markdown pipeline into every listing page's JS; router.refresh()
   * after a save re-renders it with the new text.
   */
  rendered: React.ReactNode;
}) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) {
    return (
      <div
        className="detail-summary"
        style={{
          fontSize: '1.25rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.25rem',
          lineHeight: '1.6',
        }}
      >
        {rendered}
      </div>
    );
  }
  return (
    <AdminInlineDescriptionEditor
      serverId={serverId}
      initialDescription={initialDescription}
      rendered={rendered}
    />
  );
}

export function AdminInlineLinkPopover({
  serverId,
  type,
  currentUrl,
}: {
  serverId: string;
  type: 'repository' | 'website';
  currentUrl: string;
}) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return null;
  return (
    <AdminInlineLinkPopoverEditor
      serverId={serverId}
      type={type}
      currentUrl={currentUrl}
    />
  );
}
