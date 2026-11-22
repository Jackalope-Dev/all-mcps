import { maskPaths } from '../../lib/payloadPaths';
import {
  InstallPanelClient,
  type InstallPanelProps,
  type InstallPanelServer,
} from './InstallPanelClient';

/**
 * Server half of the install panel. It passes the client only the fields the
 * panel reads (handing it the whole listing row serialized the README writeup
 * and every other column into the RSC payload), with their slashes escaped:
 * install commands and arguments like `/path/to/venv/bin/python3` otherwise
 * reach the payload as "/..." strings that Googlebot crawls as URLs.
 */
export function InstallPanel({
  server,
  setupUrl,
  setupLabel,
}: InstallPanelProps) {
  const fields: InstallPanelServer = {
    id: server.id,
    name: server.name,
    url: server.url,
    description: server.description,
    remoteEndpointUrl: server.remoteEndpointUrl,
    installCommand: server.installCommand,
    installPackage: server.installPackage,
    installArgs: server.installArgs,
    installKind: server.installKind,
    installConfidence: server.installConfidence,
    suggestedInstallCommand: server.suggestedInstallCommand,
    suggestedInstallArgs: server.suggestedInstallArgs,
    aiEnvVars: server.aiEnvVars,
    installNote: server.installNote,
    installNoteHref: server.installNoteHref,
    setupSteps: server.setupSteps,
    setupNote: server.setupNote,
    setupSourceUrl: server.setupSourceUrl,
    setupSource: server.setupSource,
  };
  return (
    <InstallPanelClient
      {...maskPaths({ server: fields, setupUrl, setupLabel })}
    />
  );
}
