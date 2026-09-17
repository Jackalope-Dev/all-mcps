import { ArrowUpRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { OutboundLink } from './ui/OutboundLink';
import { Reveal } from './ui/Reveal';

// Jackalope head mark — the exact antlered-hare geometry and "echo" motif used
// on jackalope.digital (its BrandMark `characterPaths` + EchoBackdrop). The
// silhouette is fanned into layered strokes that fold toward a single outline
// and back out. Kept in sync with that site's asset by copying it verbatim.
const CHARACTER_PATHS = {
  farEar: 'M85 65 C77 48 74 16 84 9 C94 3 97 20 95 34 L93 62 Z',
  nearEar: 'M80 68 C64 58 43 23 51 17 C60 9 79 32 88 61 Z',
  antler:
    'M99 64 C100 49 111 40 115 28 C117 23 115 17 117 14 C121 10 124 16 123 23 C128 22 131 17 134 19 C139 24 128 32 121 32 C119 39 115 44 113 48 C122 47 127 43 130 45 C135 50 122 57 108 57 L107 67 Z',
  head: 'M78 59 C86 53 100 53 109 60 C116 65 116 73 124 76 L132 80 C139 85 132 96 122 98 L109 100 C102 103 100 110 102 116 C84 116 73 108 69 99 C80 98 80 89 76 81 C72 73 71 65 78 59 Z',
};

const HEAD_OUTLINE = [
  CHARACTER_PATHS.farEar,
  CHARACTER_PATHS.nearEar,
  CHARACTER_PATHS.antler,
  CHARACTER_PATHS.head,
].join(' ');

const ECHOES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const WAITLIST_URL =
  'https://jackalope.dev/?utm_source=allmcps&utm_medium=referral&utm_campaign=waitlist_callout';

/**
 * Cross-promo card sending AllMCPs visitors to the Jackalope desktop app
 * waitlist. Jackalope Digital builds both.
 */
export function JackalopeCallout() {
  return (
    <Reveal as="section" className="container jd-callout">
      <div className="jd-callout-card">
        <div className="jd-callout-mark" aria-hidden="true">
          {/*
            Same composition as jackalope.digital: a faint animated "echo" of
            the head fanned into folding strokes, with the crisp solid BrandMark
            (the site's actual logo geometry) sitting on top.
          */}
          <svg
            className="jd-echo"
            viewBox="34 -6 118 132"
            fill="none"
            aria-hidden="true"
          >
            {ECHOES.map((echo) => (
              <path
                key={echo}
                d={HEAD_OUTLINE}
                className="jd-echo-line"
                style={
                  {
                    '--echo': echo,
                    animationDelay: `${echo * -0.16}s`,
                  } as CSSProperties
                }
              />
            ))}
          </svg>
          <svg
            className="jd-mark-solid"
            viewBox="38 3 105 117"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d={CHARACTER_PATHS.farEar} />
            <path d={CHARACTER_PATHS.nearEar} />
            <path d={CHARACTER_PATHS.antler} />
            <path d={CHARACTER_PATHS.head} />
          </svg>
        </div>

        <div className="jd-callout-content">
          <p className="jd-callout-kicker">Built by the team behind AllMCPs</p>
          <h2 className="jd-callout-title">
            Meet Jackalope, a desktop workspace for parallel coding agents
          </h2>
          <p className="jd-callout-body">
            Run Claude Code, Codex, and Grok side by side. Each agent works in
            its own Git worktree, so nothing collides, and you review every
            change before it lands. Launching for macOS, Windows, and Linux.
            Early access is going out in waves.
          </p>
          <OutboundLink
            href={WAITLIST_URL}
            destinationType="other"
            target="_blank"
            rel="noopener noreferrer"
            className="jd-callout-btn"
          >
            Join the waitlist
            <ArrowUpRight size={16} aria-hidden="true" />
          </OutboundLink>
        </div>
      </div>
    </Reveal>
  );
}
