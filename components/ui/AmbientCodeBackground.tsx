import { AsciiCodeCanvas } from './AsciiCodeCanvas';

/**
 * Decorative hero backdrop: a faint graph-paper grid, the brand ASCII flame
 * kept low and quiet, and a fade into the page background. First child of a
 * `position: relative; isolation: isolate` section (styles in
 * app/styles/home.css).
 */
export function AmbientCodeBackground() {
  return (
    <div className="home-ambient" aria-hidden="true">
      <div className="home-ambient-grid" />
      <div className="home-ambient-flame">
        <AsciiCodeCanvas opacity={0.5} density={12} />
      </div>
      <div className="home-ambient-glow" />
    </div>
  );
}
