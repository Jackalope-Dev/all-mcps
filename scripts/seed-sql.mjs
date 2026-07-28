import fs from 'fs';
import path from 'path';

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
  
  sql += `INSERT INTO servers (id, name, url, description, category, is_official, status, created_at) VALUES ('${id}', '${name}', '${url}', '${desc}', '${cat}', ${isOfficial}, 'active', strftime('%s', 'now') * 1000) ON CONFLICT(id) DO NOTHING;\n`;
}

fs.writeFileSync(path.join(process.cwd(), 'drizzle', 'seed.sql'), sql);
console.log('Created drizzle/seed.sql');
