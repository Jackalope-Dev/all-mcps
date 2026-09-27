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
    try {
      existingServers = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } catch {
      console.warn(
        'Could not read or parse existing mcp-servers.json; starting fresh.',
      );
    }

    const existingMap = new Map(
      Array.isArray(existingServers)
        ? existingServers
            .filter((s) => s && typeof s.id === 'string')
            .map((s) => [s.id, s])
        : [],
    );
    const seen = new Set();
    const merged = [];

    const sanitizeUrl = (raw) => {
      if (typeof raw !== 'string') return '';
      try {
        const u = new URL(raw);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          return u.href.slice(0, 500);
        }
      } catch {
        // invalid
      }
      return '';
    };

    for (const server of payload.servers) {
      if (!server || typeof server.id !== 'string') continue;
      const cleanId = server.id.trim();
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanId) || seen.has(cleanId)) continue;
      seen.add(cleanId);

      const cleanName =
        typeof server.name === 'string' ? server.name.slice(0, 200) : cleanId;
      const cleanDesc =
        typeof server.description === 'string'
          ? server.description.slice(0, 2000)
          : '';
      const cleanCategory =
        typeof server.category === 'string'
          ? server.category.slice(0, 100)
          : '';
      const cleanUrl =
        sanitizeUrl(server.repository) || `https://github.com/${cleanId}`;

      const existing = existingMap.get(cleanId);
      if (existing) {
        // Update existing record with latest core fields while keeping schema fields intact
        merged.push({
          ...existing,
          id: cleanId,
          name: cleanName || existing.name,
          description: cleanDesc || existing.description,
          category: cleanCategory || existing.category,
          url: cleanUrl || existing.url,
        });
      } else {
        // Add new record from live catalog
        merged.push({
          id: cleanId,
          name: cleanName,
          description: cleanDesc,
          category: cleanCategory,
          url: cleanUrl,
          isOfficial: false,
          status: 'active',
          createdAt:
            typeof payload.generatedAt === 'string'
              ? payload.generatedAt.slice(0, 50)
              : new Date().toISOString(),
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
