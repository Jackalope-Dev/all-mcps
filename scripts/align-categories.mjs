import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'mcp-servers.json');

const CATEGORY_MAP = {
  // Merge "🛠️ Development & Coding" into "💻 Developer Tools"
  '🛠️ Development & Coding': '💻 Developer Tools',
  'Development': '💻 Developer Tools',
  'Dev Tools': '💻 Developer Tools',
  'Developer Tool': '💻 Developer Tools',

  // Add emoji & normalize "Biology, Medicine and Bioinformatics"
  'Biology, Medicine and Bioinformatics': '🧬 Biology & Bioinformatics',

  // Merge RAG into Search & Data Extraction
  '🔎 end to end RAG platforms': '🔎 Search & Data Extraction',
  'end to end RAG platforms': '🔎 Search & Data Extraction',
};

function align() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const servers = JSON.parse(raw);
  let updatedCount = 0;

  const updatedServers = servers.map((server) => {
    const originalCat = server.category;
    if (CATEGORY_MAP[originalCat]) {
      updatedCount++;
      return {
        ...server,
        category: CATEGORY_MAP[originalCat],
      };
    }
    return server;
  });

  fs.writeFileSync(DATA_FILE, `${JSON.stringify(updatedServers, null, 2)}\n`, 'utf8');
  console.log(`Aligned categories for ${updatedCount} server(s) in ${DATA_FILE}`);
}

align();
