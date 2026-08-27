import fs from 'node:fs';
import path from 'node:path';

const dataPath = path.join(process.cwd(), 'data', 'mcp-servers.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let sql = ``;

for (const server of data) {
  // escape single quotes
  const id = server.id.replace(/'/g, "''");
  const name = server.name.replace(/'/g, "''");
  const url = server.url.replace(/'/g, "''");
  const desc = server.description.replace(/'/g, "''");
  const cat = server.category.replace(/'/g, "''");
  const isOfficial = server.isOfficial ? 1 : 0;

  // created_at is stored in Unix *seconds* to match the schema's mode:'timestamp'
  // and the Drizzle submit route (`createdAt: new Date()`). Do NOT multiply by 1000 —
  // milliseconds here get read back as `new Date(value * 1000)` (year ~58000) and break
  // date sorting (e.g. the homepage "Newest" filter).
  sql += `INSERT INTO servers (id, name, url, description, category, is_official, status, created_at) VALUES ('${id}', '${name}', '${url}', '${desc}', '${cat}', ${isOfficial}, 'active', strftime('%s', 'now')) ON CONFLICT(id) DO NOTHING;\n`;
}

fs.writeFileSync(path.join(process.cwd(), 'drizzle', 'seed.sql'), sql);
console.log('Created drizzle/seed.sql');
