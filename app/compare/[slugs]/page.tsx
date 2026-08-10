import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { getServerById, type Server, type ServerTool } from '@/lib/servers';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import { Badge } from '@/components/ui/Badge';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { resolveInstallConfig } from '@/lib/installConfig';
import {
  Scale,
  Star,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { isVerifiedListing } from '@/lib/featuredStatus';

export async function generateMetadata({ params }: { params: Promise<{ slugs: string }> }): Promise<Metadata> {
  const { slugs } = await params;
  const ids = slugs.split(/-vs-|,/).map((s) => s.trim()).filter(Boolean);
  const servers = (await Promise.all(ids.map((id) => getServerById(id)))).filter(
    (s): s is Server => Boolean(s)
  );

  if (servers.length === 0) {
    return { title: 'Comparison Not Found', robots: { index: false } };
  }

  const names = servers.map((s) => s.name).join(' vs. ');
  return {
    title: `${names} Comparison | AllMCPs`,
    description: `Side-by-side comparison of ${names} MCP servers. Evaluate tool features, GitHub stars, installation configs, and specs.`,
    alternates: {
      canonical: `https://allmcps.com/compare/${slugs}`,
    },
  };
}

export default async function CompareMatrixPage({ params }: { params: Promise<{ slugs: string }> }) {
  const { slugs } = await params;
  const ids = slugs.split(/-vs-|,/).map((s) => s.trim()).filter(Boolean);
  const servers = (await Promise.all(ids.map((id) => getServerById(id)))).filter(
    (s): s is Server => Boolean(s)
  );

  if (servers.length < 1) {
    notFound();
  }

  const titleNames = servers.map((s) => s.name).join(' vs ');

  return (
    <PageShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
          <Link href="/compare" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Compare
          </Link>
          <ChevronRight size={14} />
          <span style={{ color: '#ffffff' }}>{titleNames}</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
            {titleNames}
          </h1>
          <p style={{ fontSize: '1rem', color: '#94a3b8' }}>
            Side-by-side feature and tool comparison matrix
          </p>
        </div>

        {/* Matrix Table */}
        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#0f172a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '1.25rem', width: '220px', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Feature / Spec
                </th>
                {servers.map((s) => (
                  <th key={s.id} style={{ padding: '1.25rem', color: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={32} />
                      <div>
                        <Link href={`/mcp/${s.id}`} style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>
                          {s.name}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.category}</div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Category */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem' }}>Category</td>
                {servers.map((s) => (
                  <td key={s.id} style={{ padding: '1rem 1.25rem', color: '#ffffff', fontSize: '0.9rem' }}>
                    {s.category}
                  </td>
                ))}
              </tr>

              {/* GitHub Stars */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem' }}>GitHub Stars</td>
                {servers.map((s) => (
                  <td key={s.id} style={{ padding: '1rem 1.25rem', color: '#ffffff', fontSize: '0.9rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Star size={14} style={{ color: '#f5c518' }} /> {(s.githubStars || 0).toLocaleString()}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Verification & Health */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem' }}>Verification</td>
                {servers.map((s) => {
                  const verified = isVerifiedListing(s);
                  return (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', fontSize: '0.9rem' }}>
                      {verified ? (
                        <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                          <ShieldCheck size={16} /> Verified Active
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Community Listing</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Tool Count */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem' }}>Tools Exposed</td>
                {servers.map((s) => {
                  const tools = Array.isArray(s.tools) ? s.tools : [];
                  return (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', color: '#ffffff', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 600, color: '#00e5ff' }}>{tools.length} tools</span>
                    </td>
                  );
                })}
              </tr>

              {/* Auth Type */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem' }}>Auth Type</td>
                {servers.map((s) => (
                  <td key={s.id} style={{ padding: '1rem 1.25rem', color: '#ffffff', fontSize: '0.9rem', textTransform: 'capitalize' }}>
                    {s.authType || 'None / Local'}
                  </td>
                ))}
              </tr>

              {/* Pricing Model */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem' }}>Pricing</td>
                {servers.map((s) => (
                  <td key={s.id} style={{ padding: '1rem 1.25rem', color: '#ffffff', fontSize: '0.9rem', textTransform: 'capitalize' }}>
                    {s.pricingModel || 'Free'}
                  </td>
                ))}
              </tr>

              {/* Config Snippet */}
              <tr>
                <td style={{ padding: '1.25rem', fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem', verticalAlign: 'top' }}>
                  Install Config
                </td>
                {servers.map((s) => {
                  const cfg = resolveInstallConfig({
                    id: s.id,
                    name: s.name,
                    url: s.url,
                    description: s.description,
                    installKind: s.installKind,
                    installCommand: s.installCommand,
                    installArgs: s.installArgs,
                    installPackage: s.installPackage,
                    installConfidence: s.installConfidence,
                    suggestedInstallCommand: s.suggestedInstallCommand,
                    suggestedInstallArgs: s.suggestedInstallArgs,
                  });
                  const json = JSON.stringify(
                    {
                      mcpServers: {
                        [s.id]: cfg.kind === 'remote' ? { url: cfg.url } : { command: cfg.command, args: cfg.args },
                      },
                    },
                    null,
                    2
                  );

                  return (
                    <td key={s.id} style={{ padding: '1.25rem', verticalAlign: 'top' }}>
                      <CopyBlock code={json} language="json" />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
