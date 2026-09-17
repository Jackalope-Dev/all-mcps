import fs from 'node:fs';
import path from 'node:path';

/**
 * Derives the directory's category list from the catalog into a tiny committed
 * manifest (~2 KB of strings) so lib/categories can stay in sync with the data
 * WITHOUT importing the ~1.5 MB data/mcp-servers.json at module scope — which
 * would otherwise be pulled into the client bundle by every 'use client'
 * component that imports lib/categories (DirectoryGrid, SubmitForm, …).
 *
 * Committed like lib/blog-manifest.json and regenerated on every prebuild.
 */
const DATA_FILE = path.join(process.cwd(), 'data', 'mcp-servers.json');
const OUTPUT_FILE = path.join(process.cwd(), 'lib', 'category-manifest.json');

function build() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const servers = JSON.parse(raw);

  const categories = Array.from(
    new Set(servers.map((s) => s.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  fs.writeFileSync(
    OUTPUT_FILE,
    `${JSON.stringify(categories, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `Generated category manifest with ${categories.length} categories -> ${OUTPUT_FILE}`,
  );
}

build();
