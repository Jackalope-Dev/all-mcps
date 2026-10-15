'use client';

import { useEffect, useState } from 'react';
import {
  attemptAutoReload,
  isLikelyTransientLoadError,
} from '../lib/errorRecovery';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Recover automatically from transient post-deploy load failures (one guarded
  // reload per URL) only when the error matches a network/chunk failure.
  const [recovering, setRecovering] = useState(() =>
    isLikelyTransientLoadError(error),
  );

  useEffect(() => {
    console.error('Unhandled root layout error:', error);
    if (isLikelyTransientLoadError(error) && attemptAutoReload()) {
      const t = setTimeout(() => setRecovering(false), 4000);
      return () => clearTimeout(t);
    }
    setRecovering(false);
  }, [error]);

  if (recovering) {
    // A reload was triggered (or is being decided) — render a minimal shell so
    // the "Something went wrong" screen never flashes before navigation.
    return (
      <html lang="en">
        <body style={{ margin: 0, background: '#05070c' }} />
      </html>
    );
  }

  // The root layout failed, so no stylesheet is loaded here — styles are
  // inline and self-contained, and follow the visitor's OS color scheme.
  return (
    <html lang="en">
      <head>
        <style>{GLOBAL_ERROR_CSS}</style>
      </head>
      <body className="ge-body">
        <main className="ge-card">
          <svg
            width="44"
            height="44"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
            className="ge-mark"
          >
            <defs>
              <linearGradient id="ge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="100%" stopColor="#007BFF" />
              </linearGradient>
            </defs>
            <rect
              x="2"
              y="2"
              width="28"
              height="28"
              rx="7"
              fill="#070d19"
              stroke="rgba(0, 229, 255, 0.25)"
            />
            <path
              d="M8.5 9.5L14.5 16L8.5 22.5"
              stroke="url(#ge-grad)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18.5 9.5H23.5V22.5H18.5"
              stroke="#38BDF8"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="ge-code">Error</p>
          <h1 className="ge-title">Something went wrong</h1>
          <p className="ge-desc">
            AllMCPs hit an unexpected error while loading. Reloading usually
            fixes it.
          </p>
          <div className="ge-actions">
            <button
              type="button"
              onClick={() => reset()}
              className="ge-btn ge-btn-primary"
            >
              Try again
            </button>
            <a href="/" className="ge-btn ge-btn-secondary">
              Go to homepage
            </a>
          </div>
          {error.digest ? (
            <p className="ge-ref">Reference: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}

const GLOBAL_ERROR_CSS = `
.ge-body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:#05070c;color:#f5f7fa;font-family:"Atkinson Hyperlegible Next",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.ge-card{width:100%;max-width:440px;text-align:center;padding:40px 28px;border-radius:22px;background:#0b0f17;border:1px solid rgba(255,255,255,.07);box-shadow:0 12px 32px -16px rgba(0,0,0,.6)}
.ge-mark{display:block;margin:0 auto 20px}
.ge-code{margin:0 0 8px;font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#00e5ff}
.ge-title{margin:0 0 10px;font-size:26px;font-weight:700;letter-spacing:-.03em;line-height:1.15}
.ge-desc{margin:0 0 28px;color:#9ba5b7;line-height:1.6;font-size:15px}
.ge-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.ge-btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 18px;border-radius:10px;font:600 14px/1 inherit;font-family:inherit;text-decoration:none;cursor:pointer;transition:filter .14s,transform .14s,background-color .14s}
.ge-btn:active{transform:scale(.97)}
.ge-btn:focus-visible{outline:2px solid #00e5ff;outline-offset:2px}
.ge-btn-primary{border:0;color:#fff;background:linear-gradient(135deg,#00E5FF,#007BFF);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 6px 20px -8px rgba(0,229,255,.55)}
.ge-btn-primary:hover{filter:brightness(1.12)}
.ge-btn-secondary{color:#f5f7fa;background:#10151f;border:1px solid rgba(255,255,255,.13)}
.ge-btn-secondary:hover{background:#161c28}
.ge-ref{margin:24px 0 0;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#6b7588}
@media (prefers-color-scheme: light){.ge-body{background:#fafbfc;color:#0b1220}.ge-card{background:#fff;border-color:rgba(15,23,42,.08);box-shadow:0 8px 24px -14px rgba(15,23,42,.12)}.ge-desc{color:#4a5568}.ge-btn-secondary{background:#fff;color:#0b1220;border-color:rgba(15,23,42,.15)}.ge-btn-secondary:hover{background:#f5f7fa}.ge-ref{color:#718096}}
`;
