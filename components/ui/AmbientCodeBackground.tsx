import { AsciiCodeCanvas } from './AsciiCodeCanvas';

/**
 * Decorative backdrop: Firecrawl graph-paper grid + [ TAG ] labels + ASCII flame.
 * First child of a `position: relative; overflow: hidden` section.
 */
const TAGS = [
  { text: '[ STDIO ]', className: 'ambient-tag-tr' },
  { text: '[ TOOLS/LIST ]', className: 'ambient-tag-bl' },
  { text: '[ .JSON ]', className: 'ambient-tag-br' },
];

export function AmbientCodeBackground() {
  return (
    <div className="ambient-code-bg" aria-hidden="true">
      <div className="ambient-grid" />
      <AsciiCodeCanvas opacity={0.72} density={11} />
      {TAGS.map((tag) => (
        <span key={tag.text} className={`ambient-tag ${tag.className}`}>
          {tag.text}
        </span>
      ))}
      <div className="ambient-code-fade" />
    </div>
  );
}
