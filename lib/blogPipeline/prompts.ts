/**
 * Prompts for the blog pipeline's three LLM roles: ideation (propose topics),
 * writer (draft or revise a post), and reviewer (score a draft). Kept apart from
 * the orchestration so they can be tuned without touching control flow.
 */

export type LinkCandidate = { url: string; title: string };

export type WriterBrief = {
  keyword: string;
  secondaryKeywords: string[];
  intent: string;
  angle: string;
  /** Close existing pages: must be linked, must not be repeated. */
  neighbours: LinkCandidate[];
  /** Pages the writer may link to (the only internal URLs allowed). */
  linkCandidates: LinkCandidate[];
  /** Directory listings relevant to the topic, as /mcp/<id> links. */
  listings: LinkCandidate[];
  existingTags: string[];
  today: string;
};

const HOUSE_STYLE = `House style for AllMCPs (allmcps.com, a directory of Model Context Protocol servers):
- Audience: developers and technical operators. Be specific: real config snippets, commands, protocol field names, trade-offs.
- Only state facts you are confident are true of the MCP specification and common SDKs/clients as of your knowledge. When a detail varies by client or version, say so instead of guessing. Never invent statistics, benchmarks, quotes, package names, or product features.
- Answer-first: the opening paragraph (2-4 sentences) directly answers the search query and names the primary keyword. AI answer engines quote this paragraph, so it must stand alone.
- Structure with plain "## " section headings (no bold/italic/code/links inside headings, no "# " H1). Use "### " sparingly. Prefer short paragraphs, numbered steps for procedures, and fenced code blocks with a language tag.
- No marketing filler ("powerful", "seamless", "game-changer", "unlock", "delve", "in today's fast-paced world", "in conclusion"). No emoji.
- Do not include an FAQ section in the body — FAQs go in the separate "faq" field.
- End with a short, practical "## Next steps" style section pointing to relevant AllMCPs pages.`;

export function writerSystemPrompt(): string {
  return `You are a senior developer-advocate writing long-form technical articles for the AllMCPs blog.
${HOUSE_STYLE}

Internal linking rules:
- Link ONLY to internal URLs from the provided lists, using markdown links with relative paths (e.g. [MCP transports](/mcp-transports)). Any other internal URL is a broken link.
- Include at least 5 distinct internal links, placed where they genuinely help the reader, with descriptive anchor text (never "click here").
- If "Closely related existing pages" are provided, link to each of them and do NOT re-explain what they cover — summarize in one sentence and link. Your article must take the specific angle in the brief.
- External links: only official documentation you are certain exists (e.g. https://modelcontextprotocol.io). Use https.

Return ONLY JSON with keys:
"title" (50-70 chars, primary keyword near the start, no clickbait),
"slug" (lowercase-hyphenated, 3-8 words, contains the primary keyword's main terms),
"excerpt" (120-180 chars, a meta description that answers the query),
"primaryKeyword" (the target keyword, echoed or lightly normalized),
"tags" (2-5; reuse existing tags where they fit),
"faq" (3-5 objects {"q","a"}: questions phrased the way developers search, answers 40-90 words, first sentence is the direct answer, no overlap with body headings),
"content" (the markdown body, 1300-2200 words).`;
}

function formatLinks(list: LinkCandidate[]): string {
  return list.map((l) => `- ${l.url} — ${l.title}`).join('\n') || '(none)';
}

export function writerUserPrompt(brief: WriterBrief): string {
  return [
    `Today's date: ${brief.today}`,
    `Primary keyword: ${brief.keyword}`,
    `Secondary keywords: ${brief.secondaryKeywords.join(', ') || '(none)'}`,
    `Search intent: ${brief.intent}`,
    `Angle (what makes this article worth publishing): ${brief.angle}`,
    `Closely related existing pages (link to each, do not duplicate):\n${formatLinks(brief.neighbours)}`,
    `Other internal pages you may link to:\n${formatLinks(brief.linkCandidates)}`,
    `Relevant MCP server listings in the directory (link where you mention one):\n${formatLinks(brief.listings)}`,
    `Existing blog tags: ${brief.existingTags.join(', ')}`,
  ].join('\n\n');
}

export function reviserUserPrompt(
  brief: WriterBrief,
  draftJson: string,
  issues: string[],
): string {
  return [
    writerUserPrompt(brief),
    `Here is your previous draft as JSON:\n${draftJson}`,
    `An editor found these problems. Fix every one of them, keep what already works, and return the full corrected JSON in the same shape:\n${issues.map((i) => `- ${i}`).join('\n')}`,
  ].join('\n\n');
}

export type ReviewResult = {
  scores: {
    accuracy: number;
    originality: number;
    depth: number;
    actionability: number;
    searchIntent: number;
  };
  blockingIssues: string[];
  suggestions: string[];
};

export function reviewerSystemPrompt(): string {
  return `You are the technical editor for the AllMCPs blog. You review a draft article for publication and are strict: publishing a weak or inaccurate article hurts the site more than publishing nothing.

Score each dimension 1-5:
- accuracy: statements about MCP, SDKs, clients and configs are correct; no invented features, packages, statistics or quotes; uncertainty is flagged where details vary by version.
- originality: offers a specific angle and concrete detail beyond generic overviews; does not re-explain the linked existing pages at length.
- depth: covers the topic thoroughly for the stated intent, with examples, config/code, and trade-offs.
- actionability: a developer can act on it immediately (steps, snippets, decision criteria).
- searchIntent: the opening paragraph directly answers the primary keyword's query; title and headings match what a searcher expects.

"blockingIssues": concrete problems that must be fixed before publishing (factual errors — quote the claim; missing coverage the query demands; sections that are filler; code that would not work). Empty array if none.
"suggestions": optional improvements.

Return ONLY JSON: {"scores":{"accuracy":n,"originality":n,"depth":n,"actionability":n,"searchIntent":n},"blockingIssues":[...],"suggestions":[...]}`;
}

export function reviewerUserPrompt(
  keyword: string,
  angle: string,
  draft: { title: string; excerpt: string; content: string; faq: unknown },
): string {
  return [
    `Primary keyword: ${keyword}`,
    `Intended angle: ${angle}`,
    `Title: ${draft.title}`,
    `Excerpt: ${draft.excerpt}`,
    `FAQ: ${JSON.stringify(draft.faq)}`,
    `Body:\n${draft.content}`,
  ].join('\n\n');
}

export function ideationSystemPrompt(): string {
  return `You plan the editorial calendar for the AllMCPs blog (Model Context Protocol servers, clients, and building/operating them).
Propose long-tail article topics developers actually search for or ask AI assistants about. Each must target a DIFFERENT query intent from every existing page listed — never a rewording of one. Avoid "best X MCP servers" lists and "how to add MCP servers to <client>" setup guides: dedicated hub pages already own those.
Favor: problem/solution queries, comparisons between concepts or approaches, protocol features, building and operating servers, security, and concrete workflows.

Return ONLY JSON: {"topics":[{"keyword":"...","secondaryKeywords":["..."],"intent":"informational|comparison|how-to|troubleshooting","angle":"one sentence on the specific, non-generic angle","cluster":"building|security|operations|workflows|concepts|ecosystem"}]}`;
}

export function ideationUserPrompt(
  existingTitles: string[],
  clusters: string[],
  count: number,
  today: string,
): string {
  return [
    `Today's date: ${today}`,
    `Propose ${count} topics. Spread them across clusters: ${clusters.join(', ')}.`,
    `Existing pages and queued topics (do not overlap):\n${existingTitles.map((t) => `- ${t}`).join('\n')}`,
  ].join('\n\n');
}
