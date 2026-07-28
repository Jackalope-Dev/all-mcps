import fs from 'fs';
import path from 'path';

async function seedData() {
  console.log('Fetching awesome-mcp-servers README...');
  const res = await fetch('https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md');
  const text = await res.text();
  
  // The list has sections like "### Category" and then "- [Name](url) - Description"
  const lines = text.split('\n');
  const servers = [];
  
  let currentCategory = 'Other';
  
  for (const line of lines) {
    if (line.startsWith('### ')) {
      currentCategory = line.replace('### ', '').trim();
      continue;
    }
    
    // Match standard awesome list format: - [Name](url) - Description
    const regex = /^- \[([^\]]+)\]\(([^)]+)\)\s*(?:-|–)?\s*(.*)$/;
    const match = line.match(regex);
    
    if (match) {
      const name = match[1].trim();
      const url = match[2].trim();
      let description = match[3] ? match[3].trim() : '';
      
      // Basic cleanup
      description = description.replace(/<[^>]*>?/gm, ''); // remove html tags
      
      // Skip table of contents or awesome list links
      if (url.startsWith('http') && !name.toLowerCase().includes('awesome')) {
        servers.push({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name,
          url,
          description,
          category: currentCategory,
          isOfficial: url.includes('modelcontextprotocol/servers')
        });
      }
    }
  }

  // Deduplicate by URL
  const uniqueServers = Array.from(new Map(servers.map(item => [item.url, item])).values());
  
  // Sort alphabetically
  uniqueServers.sort((a, b) => a.name.localeCompare(b.name));
  
  console.log(`Found ${uniqueServers.length} unique servers across multiple categories.`);
  
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  
  fs.writeFileSync(path.join(dataDir, 'mcp-servers.json'), JSON.stringify(uniqueServers, null, 2));
  console.log('Successfully wrote to data/mcp-servers.json');
}

seedData().catch(console.error);
