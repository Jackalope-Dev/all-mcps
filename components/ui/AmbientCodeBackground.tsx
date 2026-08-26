import React from 'react';

/**
 * Decorative, non-interactive backdrop for marketing hero/section surfaces —
 * a dot-grid texture plus a couple of columns of faint, slowly scrolling
 * MCP-flavored JSON-RPC lines. This is the site's own take on "an animated
 * code/terminal background" (inspired by, not copied from, Firecrawl) — pure
 * CSS animation, no canvas/library, consistent with the rest of the app.
 *
 * Render as the first child of a `position: relative` container; this
 * component absolutely-fills that container and sits behind normal content
 * (content needs no z-index — this layer is z-index: 0 and pointer-events: none).
 */
const COLUMN_A = [
  '{"jsonrpc":"2.0","method":"tools/list"}',
  '{"name":"query_database","inputSchema":{...}}',
  '{"jsonrpc":"2.0","id":7,"method":"tools/call"}',
  '{"name":"read_file","arguments":{"path":"./"}}',
  '// tool_result: 12 rows returned',
  '{"name":"search_web","arguments":{"q":"mcp"}}',
  '{"jsonrpc":"2.0","result":{"content":[...]}}',
  '{"name":"git_commit","arguments":{"msg":"..."}}',
];

const COLUMN_B = [
  '{"capabilities":{"tools":{},"resources":{}}}',
  '{"name":"embed_text","arguments":{"n":384}}',
  '// server ready — 14 tools registered',
  '{"jsonrpc":"2.0","method":"resources/read"}',
  '{"name":"http_fetch","arguments":{"url":"..."}}',
  '{"protocolVersion":"2025-06-18"}',
  '{"name":"memory_store","arguments":{"k":"..."}}',
  '// connection: stdio',
];

function CodeColumn({ lines, className }: { lines: string[]; className: string }) {
  // Duplicated once so the 50%-translateY loop is seamless — same trick as
  // BadgeMarquee/FeaturedMarquee's horizontal loops, just vertical.
  const doubled = [...lines, ...lines];
  return (
    <div className={`ambient-code-col ${className}`} aria-hidden="true">
      {doubled.map((line, i) => (
        <span key={i} className="ambient-code-line">
          {line}
        </span>
      ))}
    </div>
  );
}

export function AmbientCodeBackground() {
  return (
    <div className="ambient-code-bg" aria-hidden="true">
      <div className="ambient-code-grid bg-grid-fade" />
      <div className="ambient-code-cols">
        <CodeColumn lines={COLUMN_A} className="ambient-code-col-a" />
        <CodeColumn lines={COLUMN_B} className="ambient-code-col-b" />
      </div>
      <div className="ambient-code-fade" />
    </div>
  );
}
