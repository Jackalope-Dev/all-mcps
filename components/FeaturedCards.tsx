import { ArrowRight, ArrowUp, Eye, Plus } from 'lucide-react';
import Link from 'next/link';
import { categoryHueClass, getCategoryMeta } from '../lib/categories';
import { parseServerName } from '../lib/displayName';
import { isFeaturedListing } from '../lib/featuredStatus';
import { publicViewCount } from '../lib/format';
import { ImpressionBeacon } from './ImpressionTracker';
import { ServerAvatar } from './ui/ServerAvatar';

type HomeServer = {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string | null;
  isOfficial?: boolean | null;
  isPremium?: boolean | null;
  featuredUntil?: Date | string | number | null;
  views?: number | null;
  totalViews?: number | null;
  upvotes?: number | null;
};

function compact(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** Strip markdown punctuation so a card description reads as plain text. */
function plainText(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ServerCard({ server }: { server: HomeServer }) {
  const { displayName, org } = parseServerName(server.name);
  const cat = getCategoryMeta(server.category);
  const featured = isFeaturedListing(server);
  const views = publicViewCount(server);
  const upvotes = server.upvotes ?? 0;

  return (
    <ImpressionBeacon
      serverId={server.id}
      surface={featured ? 'homepage_featured' : 'homepage_marquee'}
    >
      <Link href={`/mcp/${server.id}`} className="home-server spotlight">
        <div className="home-server-head">
          <ServerAvatar
            name={server.name}
            logoUrl={server.logoUrl}
            category={server.category}
            size={40}
          />
          <div className="home-server-id">
            <h3 className="home-server-name">{displayName}</h3>
            {org && <span className="home-server-org">{org}</span>}
          </div>
          {featured ? (
            <span className="home-server-flag">Featured</span>
          ) : server.isOfficial ? (
            <span className="home-server-flag home-server-flag--quiet">
              Official
            </span>
          ) : null}
        </div>
        <p className="home-server-desc">
          {plainText(server.description || '') || 'No description provided.'}
        </p>
        <div className="home-server-meta">
          <span
            className={`home-server-cat tint-pill ${categoryHueClass(server.category)}`}
          >
            {cat.label}
          </span>
          <span className="home-server-stats tabular">
            {upvotes > 0 && (
              <span title={`${upvotes.toLocaleString('en-US')} upvotes`}>
                <ArrowUp size={12} aria-hidden="true" />
                {compact(upvotes)}
              </span>
            )}
            {views > 0 && (
              <span title={`${views.toLocaleString('en-US')} views`}>
                <Eye size={12} aria-hidden="true" />
                {compact(views)}
              </span>
            )}
          </span>
        </div>
      </Link>
    </ImpressionBeacon>
  );
}

/**
 * Curated homepage preview: paid/featured listings first, then the
 * engagement-ranked picks. Deliberately no filter UI — filtering lives on
 * /browse. Falls back to a browse card so the section is never empty.
 */
export function FeaturedServers({
  servers,
  totalCount,
}: {
  servers: HomeServer[];
  totalCount?: number;
}) {
  const shown = servers.slice(0, 8);
  const totalLabel =
    typeof totalCount === 'number' && totalCount > 0
      ? totalCount.toLocaleString('en-US')
      : null;

  return (
    <section className="section home-servers" aria-labelledby="home-servers">
      <div className="container">
        <div className="section-head section-head--split">
          <div className="home-head-stack">
            <h2 id="home-servers" className="section-title">
              Servers worth starting with
            </h2>
            <p className="section-sub">
              Well-documented, actively maintained servers that people actually
              install.
            </p>
          </div>
          <Link href="/browse" className="link-arrow">
            {totalLabel ? `View all ${totalLabel}` : 'View all servers'}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div className="home-server-grid reveal-stagger">
          {shown.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
          <Link
            href={shown.length > 0 ? '/submit' : '/browse'}
            className="home-server home-server--cta"
          >
            <span className="home-server-cta-icon" aria-hidden="true">
              {shown.length > 0 ? <Plus size={18} /> : <ArrowRight size={18} />}
            </span>
            <span className="home-server-name">
              {shown.length > 0 ? 'Built an MCP server?' : 'Browse the catalog'}
            </span>
            <span className="home-server-desc">
              {shown.length > 0
                ? 'List it free so people can find and install it.'
                : 'Search and filter every MCP server in the directory.'}
            </span>
            <span className="link-arrow">
              {shown.length > 0 ? 'Submit a server' : 'Open browse'}
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Compact row of paid featured listings inside the homepage hero, so they're
 * above the fold on first paint (impressions count at ≥50% visible). Renders
 * nothing when no listing is currently featured.
 */
export function HeroFeatured({ servers }: { servers: HomeServer[] }) {
  const paid = servers.filter((s) => isFeaturedListing(s)).slice(0, 3);
  if (paid.length === 0) return null;
  return (
    <div className="home-hero-featured">
      <span className="home-hero-featured-label">Featured</span>
      <ul className="home-hero-featured-list">
        {paid.map((server) => (
          <li key={server.id}>
            <ImpressionBeacon serverId={server.id} surface="homepage_featured">
              <Link
                href={`/mcp/${server.id}`}
                className="home-hero-featured-item"
              >
                <ServerAvatar
                  name={server.name}
                  logoUrl={server.logoUrl}
                  category={server.category}
                  size={24}
                />
                <span>{parseServerName(server.name).displayName}</span>
              </Link>
            </ImpressionBeacon>
          </li>
        ))}
      </ul>
    </div>
  );
}
