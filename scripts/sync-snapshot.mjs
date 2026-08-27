/**
 * Syncs the static fallback data snapshot (data/mcp-servers.json) from the live production API.
 * Run this periodically or before major releases to keep the build-time snapshot fresh.
 *
 * Usage: npm run sync-snapshot
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.resolve(__dirname, '..', 'data', 'mcp-servers.json');

const PROD_ENDPOINT = 'https://allmcps.com/data.json';

async function syncSnapshot() {
  console.log(
    `📡 Fetching live production catalog snapshot from ${PROD_ENDPOINT}...`,
  );

  try {
    const res = await fetch(PROD_ENDPOINT);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const payload = await res.json();
    if (!payload || !Array.isArray(payload.servers)) {
      throw new Error('Invalid payload format received from live endpoint.');
    }

    console.log(
      `✓ Received ${payload.servers.length} servers from live endpoint.`,
    );

    // Read existing file to preserve rich field data if snapshot is formatted as full server objects
    let existingServers = [];
    if (fs.existsSync(targetPath)) {
      try {
        existingServers = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      } catch (e) {
        console.warn(
          'Could not parse existing mcp-servers.json; overwriting completely.',
        );
      }
    }

    const existingMap = new Map(existingServers.map((s) => [s.id, s]));
    const seen = new Set();
    const merged = [];

    for (const server of payload.servers) {
      if (!server.id || seen.has(server.id)) continue;
      seen.add(server.id);

      const existing = existingMap.get(server.id);
      if (existing) {
        // Update existing record with latest core fields while keeping schema fields intact
        merged.push({
          ...existing,
          name: server.name || existing.name,
          description: server.description || existing.description,
          category: server.category || existing.category,
          url: server.repository || existing.url,
        });
      } else {
        // Add new record from live catalog
        merged.push({
          id: server.id,
          name: server.name,
          description: server.description,
          category: server.category,
          url: server.repository || `https://github.com/${server.id}`,
          isOfficial: false,
          status: 'active',
          createdAt: payload.generatedAt || new Date().toISOString(),
        });
      }
    }

    fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2), 'utf8');
    console.log(
      `🎉 Successfully updated ${targetPath} (${merged.length} total unique listings).`,
    );
  } catch (err) {
    console.error('✗ Failed to sync snapshot:', err.message);
    process.exit(1);
  }
}

syncSnapshot();
