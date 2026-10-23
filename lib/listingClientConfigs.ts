import {
  buildClientConfigs,
  type ClientConfig,
  serverConfigKey,
} from './clientConfigs';
import {
  isUnverifiedInstall,
  type ResolvedInstall,
  resolveInstallConfig,
} from './installConfig';

type ListingInstallFields = {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  installKind?: string | null;
  installCommand?: string | null;
  installArgs?: string[] | string | null;
  installPackage?: string | null;
  installConfidence?: string | null;
  remoteEndpointUrl?: string | null;
  suggestedInstallCommand?: string | null;
  suggestedInstallArgs?: string[] | string | null;
  aiEnvVars?: string[] | null;
};

/**
 * The resolved install for a listing, with the same inputs every surface uses.
 * The endpoint and submitted command are part of that: without them the API
 * served a guess for a listing whose page showed the owner's endpoint.
 */
export function resolveListingInstall(
  server: ListingInstallFields,
): ResolvedInstall {
  return resolveInstallConfig({
    id: server.id,
    name: server.name,
    url: server.url,
    description: server.description,
    installKind: server.installKind,
    installCommand: server.installCommand,
    installArgs: server.installArgs,
    installPackage: server.installPackage,
    installConfidence: server.installConfidence,
    remoteEndpointUrl: server.remoteEndpointUrl,
    suggestedInstallCommand: server.suggestedInstallCommand,
    suggestedInstallArgs: server.suggestedInstallArgs,
  });
}

/**
 * Every client's config for a listing, or null when the install was only
 * guessed from the listing's name. Same rule as the listing page: a guessed
 * package may not exist or may be a stranger's, so no config is better than
 * one someone pastes and runs.
 */
export function listingClientConfigs(
  server: ListingInstallFields,
): ClientConfig[] | null {
  const install = resolveListingInstall(server);
  if (isUnverifiedInstall(install)) return null;
  return buildClientConfigs({
    install,
    serverKey: serverConfigKey(server.id),
    serverName: server.name,
    env: (server.aiEnvVars || []).map((key) => ({ key })),
  });
}
