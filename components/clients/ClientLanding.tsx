import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ClientLogo } from '@/components/ClientLogo';
import { ClientConfigSection } from '@/components/clients/ClientConfigSection';
import { ServerConfigCopyButton } from '@/components/clients/ServerConfigCopyButton';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import { mcpClientBySlug } from '@/lib/clients';
import { parseServerName } from '@/lib/displayName';
import type { Server } from '@/lib/servers';

interface ClientLandingProps {
  slug: string;
  crumb: string;
  titleLead: string;
  titleName: string;
  lede: string;
  primaryLabel: string;
  guideLabel: string;
  serversHeading: string;
  /** The page's FAQPage JSON-LD question — rendered visibly here. */
  faq: { q: string; a: string };
  servers: Server[];
}

/**
 * Shared body for the /mcp-for-<client> landing pages: header, the config
 * card, the config-location answer, and a grid of starter servers with
 * one-click config copy. Each page keeps its own metadata and JSON-LD.
 */
export function ClientLanding({
  slug,
  crumb,
  titleLead,
  titleName,
  lede,
  primaryLabel,
  guideLabel,
  serversHeading,
  faq,
  servers,
}: ClientLandingProps) {
  const client = mcpClientBySlug(slug);

  return (
    <main className="page-shell content-page cl-page">
      <div className="page-shell-inner">
        <header className="content-hub-head cl-head animate-in">
          <nav aria-label="Breadcrumb">
            <ol className="crumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/clients">Clients</Link>
              </li>
              <li>
                <span aria-current="page">{crumb}</span>
              </li>
            </ol>
          </nav>
          <ClientLogo
            slug={slug}
            name={client?.name ?? titleName}
            size={56}
            className="cl-head-logo"
          />
          <h1 className="content-hub-title cl-title">
            {titleLead} {titleName}
          </h1>
          <p className="content-hub-lede">{lede}</p>
          <div className="cl-head-actions">
            <Link href="#top-servers" className="btn btn-primary btn-md">
              {primaryLabel}
            </Link>
            <Link href={`/clients/${slug}`} className="btn btn-ghost btn-md">
              {guideLabel} <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </header>

        {client ? (
          <section className="cl-setup" aria-label={`Set up ${client.name}`}>
            <div className="cl-steps">
              <div className="cl-quick">
                <p className="cl-label">Quick answer</p>
                <h2 className="cl-quick-q">{faq.q}</h2>
                <p className="cl-quick-a">{faq.a}</p>
              </div>
              <p className="cl-landing-note">
                Need every step, per OS, with verification and troubleshooting?{' '}
                <Link href={`/clients/${slug}`}>
                  Read the full {client.name} setup guide
                </Link>
                .
              </p>
            </div>
            <div className="cl-config-wrap">
              <ClientConfigSection client={client} featuredServers={servers} />
            </div>
          </section>
        ) : null}

        <section
          id="top-servers"
          className="cl-section"
          aria-labelledby="top-servers-title"
        >
          <div className="cl-section-head">
            <h2 id="top-servers-title" className="content-section-title">
              {serversHeading}
            </h2>
            <Link href="/browse" className="link-arrow">
              Browse all servers <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {servers.length > 0 ? (
            <ul className="cl-servers">
              {servers.map((server) => {
                const { displayName, org } = parseServerName(server.name);
                return (
                  <li key={server.id} className="cl-server">
                    <div className="cl-server-head">
                      <ServerAvatar
                        name={server.name}
                        logoUrl={server.logoUrl}
                        category={server.category}
                        size={36}
                      />
                      <div className="cl-server-name">
                        <Link href={`/mcp/${server.id}`}>{displayName}</Link>
                        {org ? <span>{org}</span> : null}
                      </div>
                    </div>
                    <div className="cl-server-desc">
                      <SafeMarkdown
                        content={server.description || ''}
                        isInline
                      />
                    </div>
                    <div className="cl-server-foot">
                      <span className="content-tag">{server.category}</span>
                      <ServerConfigCopyButton
                        clientSlug={slug}
                        serverName={server.name}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="content-empty">
              <strong>No servers to show yet</strong>
              <p>
                <Link href="/browse">Browse the directory</Link> to find one to
                install.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
