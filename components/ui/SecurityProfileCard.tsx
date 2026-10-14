import { ScanSearch } from 'lucide-react';
import { assessInstallRisk } from '../../lib/installRisk';
import {
  CAPABILITY_LABEL,
  type Capability,
  parseSecurityProfile,
} from '../../lib/securityProfile';
import type { Server } from '../../lib/servers';

/**
 * What this server can reach, from the tools it actually returned over MCP
 * and what our sandbox saw while it started. Same calm register as
 * VulnSignalCard: capabilities are facts, not warnings — a terminal server is
 * supposed to run commands. Only tool-description injection patterns and a
 * changed tool surface get emphasis, because those are not what a user would
 * expect from any server.
 */
export function SecurityProfileCard({ server }: { server: Server }) {
  const profile = parseSecurityProfile(server.securityProfile);
  // The install command is checked even for servers we have never run: it is
  // what the user is about to paste into their client.
  const installRisk = assessInstallRisk(server);
  if (!profile && installRisk.length === 0) return null;

  const sb = profile?.sandbox;
  const changedAt = server.toolsChangedAt
    ? new Date(server.toolsChangedAt as string | Date)
    : null;
  const recentChange =
    changedAt && Date.now() - changedAt.getTime() < 30 * 24 * 60 * 60 * 1000;

  const row = (label: string, value: string) => (
    <div
      key={label}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '0.75rem',
        fontSize: '0.8rem',
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span
        style={{
          color: 'var(--text-primary)',
          textAlign: 'right',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  );

  const sandboxRows: [string, string][] = [];
  if (sb?.connections)
    sandboxRows.push([
      'Network at startup',
      sb.connections.length === 0
        ? 'None'
        : `${sb.connections.length} connection${sb.connections.length === 1 ? '' : 's'}`,
    ]);
  if (sb?.filesWritten)
    sandboxRows.push([
      'Files written at startup',
      sb.filesWritten.length === 0 ? 'None' : String(sb.filesWritten.length),
    ]);
  if (sb?.installScripts)
    sandboxRows.push([
      'Install scripts',
      sb.installScripts.length === 0 ? 'None' : sb.installScripts.join(', '),
    ]);
  if (sb && sb.hasProvenance != null)
    sandboxRows.push([
      'npm provenance',
      sb.hasProvenance ? 'Signed build' : 'Not published',
    ]);
  if (sb?.packageAgeDays != null)
    sandboxRows.push(['Package age', `${sb.packageAgeDays} days`]);
  if (sb?.maintainerCount != null)
    sandboxRows.push(['Maintainers', String(sb.maintainerCount)]);

  return (
    <div
      className="surface"
      style={{
        padding: '1.35rem',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ScanSearch
          size={16}
          style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
        />
        <h3
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          What it can do
        </h3>
      </div>

      {installRisk.length > 0 && (
        <div
          role="alert"
          style={{
            padding: '0.7rem',
            borderRadius: '10px',
            border: '1px solid var(--admin-warn)',
            fontSize: '0.8rem',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
          }}
        >
          <strong>Check the install command first.</strong>{' '}
          {installRisk.map((f) => f.label).join('; ')}. Registries like npm and
          PyPI can take down malicious packages; a command like this skips them.
        </div>
      )}

      {profile && (
        <>
          <p
            style={{
              margin: 0,
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            From the {profile.toolCount} tool
            {profile.toolCount === 1 ? '' : 's'} this server returned when we
            ran it
            {profile.annotatedTools > 0
              ? `; ${profile.annotatedTools} declare their own safety hints`
              : ''}
            .
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {profile.capabilities.map((cap: Capability) => {
              const tools = profile.toolsByCapability[cap] ?? [];
              return (
                <span
                  key={cap}
                  title={tools.slice(0, 12).join(', ')}
                  style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {CAPABILITY_LABEL[cap]} · {tools.length}
                </span>
              );
            })}
          </div>

          {profile.poisoning.length > 0 && (
            <div
              style={{
                padding: '0.7rem',
                borderRadius: '10px',
                border: '1px solid var(--admin-warn)',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}
            >
              <strong>Unusual tool instructions.</strong>{' '}
              {profile.poisoning.length} tool description
              {profile.poisoning.length === 1 ? '' : 's'} contain text aimed at
              the AI model rather than at you (
              {[...new Set(profile.poisoning.map((p) => p.pattern))].join('; ')}
              ). Read the tool descriptions before connecting.
            </div>
          )}

          {recentChange && changedAt && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              Tool definitions changed on {changedAt.toISOString().slice(0, 10)}
              . Review them if you approved this server earlier.
            </div>
          )}

          {sandboxRows.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '0.7rem',
              }}
            >
              {sandboxRows.map(([l, v]) => row(l, v))}
            </div>
          )}

          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
            }}
          >
            Observed {profile.profiledAt.slice(0, 10)} in an isolated sandbox. A
            description of reach, not a security audit.
          </p>
        </>
      )}
    </div>
  );
}
