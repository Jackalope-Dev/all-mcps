import { BadgeCheck, CircleCheck, Download, Heart, Star } from 'lucide-react';
import Link from 'next/link';
import { categoryHueClass, getCategoryMeta } from '../../lib/categories';
import { parseServerName } from '../../lib/displayName';
import { isFeaturedListing, isVerifiedListing } from '../../lib/featuredStatus';
import { formatCompactNumber } from '../../lib/format';
import { InlineMarkdown } from '../ui/InlineMarkdown';
import { ServerAvatar } from '../ui/ServerAvatar';

/**
 * The fields a directory row or card renders. Both the /api/browse feed items
 * and full `Server` rows satisfy it, so browse, category, tag and homepage
 * lists all share one look. Hook-free: renders from server components too.
 */
export type DirectoryServer = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  logoUrl?: string | null;
  isOfficial?: boolean | null;
  isPremium?: boolean | null;
  featuredUntil?: string | Date | number | null;
  upvotes?: number | null;
  copies?: number | null;
  githubStars?: number | null;
  /** Trust tier verified / runs_needs_keys (lib/trustTier.ts). */
  testedWorking?: boolean;
};

function Badges({ server }: { server: DirectoryServer }) {
  const featured = isFeaturedListing(server);
  const verified = isVerifiedListing(server);
  return (
    <>
      {verified && (
        <span
          className="dir-flag dir-flag--verified"
          title={
            server.isOfficial
              ? 'Official server from the vendor'
              : 'Ownership verified on AllMCPs'
          }
        >
          <BadgeCheck size={13} aria-hidden="true" />
          {server.isOfficial ? 'Official' : 'Verified'}
        </span>
      )}
      {server.testedWorking && (
        <span
          className="dir-flag dir-flag--tested"
          title="We ran it in a sandbox or reached it live"
        >
          <CircleCheck size={12} aria-hidden="true" />
          Tested
        </span>
      )}
      {featured && (
        <span className="dir-flag dir-flag--featured">Featured</span>
      )}
    </>
  );
}

/** Upvotes · installs · stars, in fixed-width columns so rows line up. */
export function ServerStats({ server }: { server: DirectoryServer }) {
  const upvotes = server.upvotes || 0;
  const installs = server.copies || 0;
  const stars = server.githubStars ?? null;
  return (
    <div className="dir-stats tabular">
      <span
        className="dir-stat"
        title={`${upvotes.toLocaleString('en-US')} upvotes`}
      >
        <Heart size={13} aria-hidden="true" />
        <span className="sr-only">Upvotes: </span>
        {formatCompactNumber(upvotes)}
      </span>
      <span
        className="dir-stat"
        title={`${installs.toLocaleString('en-US')} installs`}
      >
        <Download size={13} aria-hidden="true" />
        <span className="sr-only">Installs: </span>
        {formatCompactNumber(installs)}
      </span>
      <span
        className={`dir-stat${stars ? '' : ' is-empty'}`}
        title={
          stars ? `${stars.toLocaleString('en-US')} GitHub stars` : undefined
        }
      >
        <Star size={13} aria-hidden="true" />
        <span className="sr-only">GitHub stars: </span>
        {stars ? formatCompactNumber(stars) : '—'}
      </span>
    </div>
  );
}

function CategoryTag({ category }: { category: string }) {
  const meta = getCategoryMeta(category);
  return (
    <span className="dir-cat tint-pill">
      <span className="dir-cat-label">{meta.label}</span>
    </span>
  );
}

/** One scannable list row: avatar · name + one-line pitch · category · signals. */
export function ServerRow({
  server,
  hideCategory = false,
  headingLevel = 3,
}: {
  server: DirectoryServer;
  hideCategory?: boolean;
  headingLevel?: 2 | 3;
}) {
  const { displayName, org } = parseServerName(server.name);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Link
      href={`/mcp/${server.id}`}
      className={`dir-row spotlight ${categoryHueClass(server.category)}${hideCategory ? ' dir-row--nocat' : ''}${isFeaturedListing(server) ? ' is-featured' : ''}`}
    >
      <ServerAvatar
        name={server.name}
        logoUrl={server.logoUrl}
        category={server.category}
        size={40}
      />
      <div className="dir-row-main">
        <div className="dir-row-head">
          <Heading className="dir-row-name">{displayName}</Heading>
          {org && <span className="dir-row-org">{org}</span>}
          <Badges server={server} />
        </div>
        <p className="dir-row-desc">
          <InlineMarkdown
            content={server.description || 'No description provided.'}
          />
        </p>
      </div>
      {!hideCategory && <CategoryTag category={server.category} />}
      <ServerStats server={server} />
    </Link>
  );
}

/** Grid card: same data as the row, stacked for visual browsing. */
export function ServerCard({
  server,
  hideCategory = false,
}: {
  server: DirectoryServer;
  hideCategory?: boolean;
}) {
  const { displayName, org } = parseServerName(server.name);
  return (
    <Link
      href={`/mcp/${server.id}`}
      className={`dir-card spotlight ${categoryHueClass(server.category)}${isFeaturedListing(server) ? ' is-featured' : ''}`}
    >
      <div className="dir-card-top">
        <ServerAvatar
          name={server.name}
          logoUrl={server.logoUrl}
          category={server.category}
          size={40}
        />
        <div className="dir-card-title">
          <h3 className="dir-row-name">{displayName}</h3>
          {org && <span className="dir-row-org">{org}</span>}
        </div>
      </div>
      <div className="dir-card-flags">
        <Badges server={server} />
      </div>
      <p className="dir-card-desc">
        <InlineMarkdown
          content={server.description || 'No description provided.'}
        />
      </p>
      <div className="dir-card-foot">
        {hideCategory ? <span /> : <CategoryTag category={server.category} />}
        <ServerStats server={server} />
      </div>
    </Link>
  );
}

/** Stable keys for placeholder lists (index keys trip the lint ratchet). */
export function skeletonKeys(count: number): string[] {
  return Array.from({ length: count }, (_, n) => `skel-${n}`);
}

/** Page-shaped placeholder rows for loading.tsx files and "Load more". */
export function ServerRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {skeletonKeys(count).map((k, i) => (
        <div key={k} className="dir-row dir-row--skeleton" aria-hidden="true">
          <div className="skeleton dir-skel-avatar" />
          <div className="dir-row-main">
            <div
              className="skeleton dir-skel-line"
              style={{ width: `${32 + ((i * 17) % 28)}%` }}
            />
            <div
              className="skeleton dir-skel-line dir-skel-line--sm"
              style={{ width: `${58 + ((i * 23) % 30)}%` }}
            />
          </div>
        </div>
      ))}
    </>
  );
}
