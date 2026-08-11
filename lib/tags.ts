import { getActiveServersLight, type Server } from './servers';
import { parseCategoryLabel } from './categories';

export function slugifyTag(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Known technology and topic keywords to extract from server metadata */
const TECH_KEYWORDS: { slug: string; label: string; pattern: RegExp }[] = [
  { slug: 'github', label: 'GitHub', pattern: /\b(github|git)\b/i },
  { slug: 'postgres', label: 'PostgreSQL', pattern: /\b(postgres|postgresql|pg)\b/i },
  { slug: 'sqlite', label: 'SQLite', pattern: /\b(sqlite|sqlite3)\b/i },
  { slug: 'mysql', label: 'MySQL', pattern: /\b(mysql|mariadb)\b/i },
  { slug: 'redis', label: 'Redis', pattern: /\b(redis|valkey)\b/i },
  { slug: 'mongodb', label: 'MongoDB', pattern: /\b(mongodb|mongo)\b/i },
  { slug: 'supabase', label: 'Supabase', pattern: /\b(supabase)\b/i },
  { slug: 'slack', label: 'Slack', pattern: /\b(slack)\b/i },
  { slug: 'discord', label: 'Discord', pattern: /\b(discord)\b/i },
  { slug: 'notion', label: 'Notion', pattern: /\b(notion)\b/i },
  { slug: 'figma', label: 'Figma', pattern: /\b(figma)\b/i },
  { slug: 'linear', label: 'Linear', pattern: /\b(linear)\b/i },
  { slug: 'jira', label: 'Jira', pattern: /\b(jira|atlassian)\b/i },
  { slug: 'docker', label: 'Docker', pattern: /\b(docker|container|containers)\b/i },
  { slug: 'kubernetes', label: 'Kubernetes', pattern: /\b(k8s|kubernetes)\b/i },
  { slug: 'python', label: 'Python', pattern: /\b(python|pip|pipx|pytest)\b/i },
  { slug: 'typescript', label: 'TypeScript', pattern: /\b(typescript|ts|node|npm|npx)\b/i },
  { slug: 'browser-automation', label: 'Browser Automation', pattern: /\b(browser|puppeteer|playwright|selenium)\b/i },
  { slug: 'vector-db', label: 'Vector DB', pattern: /\b(vector|pinecone|chroma|qdrant|weaviate|milvus)\b/i },
  { slug: 'seo', label: 'SEO', pattern: /\b(seo|sitemap|robots\.txt)\b/i },
  { slug: 'email', label: 'Email', pattern: /\b(email|gmail|sendgrid|resend|imap|smtp)\b/i },
  { slug: 'audio-speech', label: 'Audio & Speech', pattern: /\b(audio|speech|tts|whisper|voice)\b/i },
  { slug: 'video', label: 'Video', pattern: /\b(video|ffmpeg|youtube)\b/i },
  { slug: 'image-processing', label: 'Image Processing', pattern: /\b(image|images|screenshot|canvas)\b/i },
  { slug: 'filesystem-storage', label: 'Filesystem & Storage', pattern: /\b(filesystem|files|storage|s3|drive)\b/i },
  { slug: 'weather', label: 'Weather', pattern: /\b(weather|forecast|meteo)\b/i },
  { slug: 'crypto-web3', label: 'Crypto & Web3', pattern: /\b(crypto|blockchain|ethereum|solana|bitcoin|web3)\b/i },
  { slug: 'calendar', label: 'Calendar', pattern: /\b(calendar|gcal|scheduling)\b/i },
  { slug: 'obsidian', label: 'Obsidian', pattern: /\b(obsidian)\b/i },
  { slug: 'auth', label: 'Auth & OAuth', pattern: /\b(auth|oauth|jwt|authentication)\b/i },
];

/** Extract all matching tag objects ({ slug, label }) for a server */
export function extractTagsForServer(server: Server): { slug: string; label: string }[] {
  const map = new Map<string, string>();

  // 1. Explicit server tags
  const tags = Array.isArray(server.tags) ? server.tags : [];
  for (const raw of tags) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const label = raw.trim();
    const slug = slugifyTag(label);
    if (slug && !map.has(slug)) {
      map.set(slug, label);
    }
  }

  // 2. Category tag
  if (server.category) {
    const cleanCat = parseCategoryLabel(server.category).label;
    const catSlug = slugifyTag(cleanCat);
    if (catSlug && !map.has(catSlug)) {
      map.set(catSlug, cleanCat);
    }
  }

  // 3. AI Use Cases tags
  const useCases = Array.isArray(server.aiUseCases) ? server.aiUseCases : [];
  for (const uc of useCases) {
    if (typeof uc !== 'string' || !uc.trim()) continue;
    const label = uc.trim();
    const slug = slugifyTag(label);
    if (slug && slug.length >= 3 && slug.length <= 30 && !map.has(slug)) {
      map.set(slug, label);
    }
  }

  // 4. Technology & Keyword extraction from Name / Description
  const textToScan = `${server.name || ''} ${server.description || ''} ${server.url || ''}`;
  for (const kw of TECH_KEYWORDS) {
    if (!map.has(kw.slug) && kw.pattern.test(textToScan)) {
      map.set(kw.slug, kw.label);
    }
  }

  return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
}

export type TagWithCount = {
  slug: string;
  label: string;
  count: number;
};

/** Get all tags with server counts across all active servers in the catalog */
export async function getAllTagsWithCounts(): Promise<TagWithCount[]> {
  const servers = await getActiveServersLight();
  const counts = new Map<string, { label: string; count: number }>();

  for (const server of servers) {
    const extracted = extractTagsForServer(server);
    for (const { slug, label } of extracted) {
      const existing = counts.get(slug);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(slug, { label, count: 1 });
      }
    }
  }

  return Array.from(counts.entries())
    .map(([slug, data]) => ({ slug, ...data }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Get all active servers matching a tag slug */
export async function getServersForTag(targetSlug: string): Promise<{ servers: Server[]; rawTag: string }> {
  const servers = await getActiveServersLight();
  const matched: Server[] = [];
  let foundLabel = targetSlug;

  for (const server of servers) {
    const extracted = extractTagsForServer(server);
    const match = extracted.find((t) => t.slug === targetSlug);
    if (match) {
      matched.push(server);
      if (match.label) foundLabel = match.label;
    }
  }

  return { servers: matched, rawTag: foundLabel };
}
