/**
 * Blog posts folded into a stronger page. The Oct 2026 batch removed
 * pipeline-written posts that largely duplicated an existing guide (or added
 * nothing tested) after the Sept 2026 spam update demoted the site; each 301s
 * to the page that already covers the topic.
 */
export const BLOG_REDIRECTS: Record<string, string> = {
  '/blog/mcp-prompt-injection-tool-poisoning': '/mcp-security#prompt-injection',
  '/blog/mcp-tool-input-schema-design':
    '/blog/writing-mcp-tool-descriptions-that-work',
  '/blog/remote-vs-local-mcp-servers': '/deploy-mcp-server#short-answer',
  '/blog/mcp-gateway-proxy-architecture':
    '/blog/architecting-production-mcp-servers',
};
