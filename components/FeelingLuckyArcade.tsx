'use client';

import {
  ArrowRight,
  Check,
  Copy,
  Dices,
  ExternalLink,
  Gem,
  Layers,
  RotateCw,
  Server,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackFeatureUse } from '../lib/gtag';

interface ServerResult {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
  isOfficial: boolean;
  isVerifiedActive: boolean;
  upvotes: number;
  githubStars: number | null;
  npmDownloads: number | null;
  qualityScore: number;
  installCommand: string;
  detailUrl: string;
}

type SpinMode = 'random' | 'hidden-gem' | 'superpower' | 'stack';

const REEL_CATEGORIES = [
  'AI & Machine Learning',
  'Developer Tools',
  'Databases & Storage',
  'Security & Auth',
  'Web & API Services',
  'Analytics & Metrics',
  'Cloud Infrastructure',
  'Media & Design',
];

const REEL_BADGES = [
  '95/100 Top Tier',
  'Sleeper Pick',
  'Hot Community',
  'Superpower',
  'Verified Safe',
  'Production Ready',
];

// Helper to synthesize Web Audio 8-bit sound effects
function playSound(
  type: 'spin' | 'stop' | 'jackpot' | 'coin' | 'click',
  muted: boolean,
) {
  if (muted || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'spin') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150 + Math.random() * 200, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'stop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'jackpot') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + i * 0.09 + 0.25,
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.09);
        osc.stop(ctx.currentTime + i * 0.09 + 0.25);
      });
    } else if (type === 'coin') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(987.77, ctx.currentTime);
      osc2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.08);
      osc2.start(ctx.currentTime + 0.08);
      osc2.stop(ctx.currentTime + 0.25);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    }
  } catch {
    /* Audio context block fallback */
  }
}

function getCategoryIcon(catName: string, iconSize = 24) {
  const lower = (catName || '').toLowerCase();
  if (
    lower.includes('ai') ||
    lower.includes('machine') ||
    lower.includes('agent')
  )
    return <Sparkles size={iconSize} />;
  if (lower.includes('dev') || lower.includes('tool'))
    return <Wrench size={iconSize} />;
  if (lower.includes('data') || lower.includes('db') || lower.includes('sql'))
    return <Layers size={iconSize} />;
  if (lower.includes('sec') || lower.includes('auth'))
    return <ShieldCheck size={iconSize} />;
  if (lower.includes('web') || lower.includes('api') || lower.includes('http'))
    return <ExternalLink size={iconSize} />;
  return <Server size={iconSize} />;
}

export function FeelingLuckyArcade() {
  const [mode, setMode] = useState<SpinMode>('random');
  const [isSpinning, setIsSpinning] = useState(false);
  const [reel1Text, setReel1Text] = useState(REEL_CATEGORIES[0]);
  const [reel2Text, setReel2Text] = useState(REEL_BADGES[0]);
  const [reel3Text, setReel3Text] = useState('Ready to Spin');

  const [reel1Locked, setReel1Locked] = useState(false);
  const [reel2Locked, setReel2Locked] = useState(false);
  const [reel3Locked, setReel3Locked] = useState(false);

  const [results, setResults] = useState<ServerResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings & Gamification
  const [isMuted, setIsMuted] = useState(false);
  const [spinCount, setSpinCount] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);

  const animTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const savedMute = localStorage.getItem('allmcps_arcade_muted');
      if (savedMute !== null) setIsMuted(savedMute === 'true');

      const savedSpins = localStorage.getItem('allmcps_arcade_spins');
      if (savedSpins) setSpinCount(parseInt(savedSpins, 10));

      const savedStreak = localStorage.getItem('allmcps_arcade_streak');
      if (savedStreak) setStreakCount(parseInt(savedStreak, 10));

      const savedAchiv = localStorage.getItem('allmcps_arcade_achievements');
      if (savedAchiv) setAchievements(JSON.parse(savedAchiv));
    } catch {
      /* localStorage unavailable fallback */
    }
  }, []);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    try {
      localStorage.setItem('allmcps_arcade_muted', String(next));
    } catch {}
    playSound('click', next);
  };

  const selectMode = (newMode: SpinMode) => {
    setMode(newMode);
    playSound('click', isMuted);
    trackFeatureUse('feeling_lucky_arcade', {
      action: 'select_mode',
      mode: newMode,
    });
  };

  const updateGamification = useCallback(
    (newCount: number, currentMode: SpinMode) => {
      const newStreak = streakCount + 1;
      setSpinCount(newCount);
      setStreakCount(newStreak);

      const unlocked = [...achievements];
      if (newCount >= 1 && !unlocked.includes('first_roll')) {
        unlocked.push('first_roll');
      }
      if (currentMode === 'hidden-gem' && !unlocked.includes('gem_hunter')) {
        unlocked.push('gem_hunter');
      }
      if (currentMode === 'stack' && !unlocked.includes('stack_master')) {
        unlocked.push('stack_master');
      }
      if (newStreak >= 5 && !unlocked.includes('streak_5')) {
        unlocked.push('streak_5');
      }

      setAchievements(unlocked);

      try {
        localStorage.setItem('allmcps_arcade_spins', String(newCount));
        localStorage.setItem('allmcps_arcade_streak', String(newStreak));
        localStorage.setItem(
          'allmcps_arcade_achievements',
          JSON.stringify(unlocked),
        );
      } catch {}
    },
    [achievements, streakCount],
  );

  const handleSpin = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setReel1Locked(false);
    setReel2Locked(false);
    setReel3Locked(false);
    setResults([]);

    playSound('click', isMuted);
    trackFeatureUse('feeling_lucky_arcade', {
      action: 'spin',
      mode,
      spin_count: spinCount + 1,
    });

    let fetchedServers: ServerResult[] = [];
    const count = mode === 'stack' ? 3 : 1;

    const fetchPromise = fetch(
      `/api/v1/servers/random?mode=${mode}&count=${count}&t=${Date.now()}`,
      { cache: 'no-store' },
    )
      .then((res) =>
        res.ok ? (res.json() as Promise<{ servers?: ServerResult[] }>) : null,
      )
      .then((data) => {
        if (data && Array.isArray(data.servers)) {
          fetchedServers = data.servers;
        }
      })
      .catch(() => {});

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      if (reduceMotion) return;
      if (ticks % 3 === 0) playSound('spin', isMuted);

      setReel1Text(
        REEL_CATEGORIES[Math.floor(Math.random() * REEL_CATEGORIES.length)],
      );
      setReel2Text(REEL_BADGES[Math.floor(Math.random() * REEL_BADGES.length)]);
      setReel3Text('Spinning...');
    }, 60);

    animTimerRef.current = window.setTimeout(async () => {
      await fetchPromise;
      clearInterval(interval);

      // Reel 1 Stop
      setReel1Locked(true);
      if (fetchedServers.length > 0) {
        setReel1Text(fetchedServers[0].category);
      }
      playSound('stop', isMuted);

      // Reel 2 Stop after 350ms
      setTimeout(() => {
        setReel2Locked(true);
        if (fetchedServers.length > 0) {
          setReel2Text(`Score ${fetchedServers[0].qualityScore}/100`);
        }
        playSound('stop', isMuted);
      }, 350);

      // Reel 3 Stop after 700ms -> JACKPOT!
      setTimeout(() => {
        setReel3Locked(true);
        if (fetchedServers.length > 0) {
          setReel3Text(fetchedServers[0].name);
        } else {
          setReel3Text('Lucky Match Found');
        }

        setResults(fetchedServers);
        setIsSpinning(false);
        playSound('jackpot', isMuted);

        updateGamification(spinCount + 1, mode);
      }, 700);
    }, 1000);
  };

  const handleCopyCommand = (server: ServerResult) => {
    navigator.clipboard.writeText(server.installCommand);
    setCopiedId(server.id);
    playSound('coin', isMuted);
    trackFeatureUse('feeling_lucky_arcade', {
      action: 'copy_command',
      server_id: server.id,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const modes: Array<{
    id: SpinMode;
    label: string;
    sub: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'random',
      label: 'Wild roll',
      sub: 'Pure random',
      icon: <Dices size={18} />,
    },
    {
      id: 'hidden-gem',
      label: 'Hidden gem',
      sub: 'Underrated sleeper',
      icon: <Gem size={18} />,
    },
    {
      id: 'superpower',
      label: 'Superpower',
      sub: 'Quality score 75+',
      icon: <Zap size={18} />,
    },
    {
      id: 'stack',
      label: 'Triple stack',
      sub: '3-server combo',
      icon: <Layers size={18} />,
    },
  ];

  const reels = [
    {
      text: reel1Text,
      locked: reel1Locked,
      icon: getCategoryIcon(reel1Text, 16),
    },
    { text: reel2Text, locked: reel2Locked, icon: <Star size={16} /> },
    { text: reel3Text, locked: reel3Locked, icon: <Sparkles size={16} /> },
  ];

  return (
    <div className="lucky">
      <div className="lucky-machine">
        <fieldset className="lucky-modes fieldset-plain" aria-label="Spin mode">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              className={`lucky-mode ${mode === m.id ? 'is-active' : ''}`}
              onClick={() => selectMode(m.id)}
              disabled={isSpinning}
            >
              <span className="lucky-mode-icon" aria-hidden="true">
                {m.icon}
              </span>
              <span className="lucky-mode-label">{m.label}</span>
              <span className="lucky-mode-sub">{m.sub}</span>
            </button>
          ))}
        </fieldset>

        <div
          className={`lucky-screen ${isSpinning ? 'is-spinning' : ''}`}
          aria-live="polite"
          aria-busy={isSpinning}
        >
          {reels.map((r, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: three fixed reels.
              key={i}
              className={`lucky-reel ${r.locked ? 'is-locked' : ''}`}
            >
              <span className="lucky-reel-icon" aria-hidden="true">
                {r.icon}
              </span>
              <span className="lucky-reel-text">{r.text}</span>
            </div>
          ))}
        </div>

        <div className="lucky-spin-row">
          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning}
            className="btn btn-primary btn-lg lucky-spin"
          >
            {isSpinning ? (
              <>
                <RotateCw size={18} className="tl-spin" aria-hidden="true" />
                Spinning…
              </>
            ) : (
              <>
                <Dices size={18} aria-hidden="true" />
                {spinCount > 0 ? 'Spin again' : 'Spin'}
              </>
            )}
          </button>
        </div>

        <div className="lucky-footer">
          <span className="lucky-stat">
            Spins <strong className="tabular">{spinCount}</strong>
          </span>
          <span className="lucky-stat">
            Streak <strong className="tabular">{streakCount}</strong>
          </span>
          <span className="lucky-stat">
            <Trophy size={13} aria-hidden="true" /> Achievements{' '}
            <strong className="tabular">{achievements.length}/4</strong>
          </span>
          <span className="tl-spacer" />
          <button
            type="button"
            onClick={toggleMute}
            className={`lucky-toggle ${!isMuted ? 'is-on' : ''}`}
            aria-pressed={!isMuted}
            aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
          >
            {isMuted ? (
              <VolumeX size={14} aria-hidden="true" />
            ) : (
              <Volume2 size={14} aria-hidden="true" />
            )}
            Sound
          </button>
        </div>
      </div>

      {results.length > 0 ? (
        <ul className="lucky-results">
          {results.map((server, i) => (
            <li
              key={server.id}
              className="lucky-result"
              style={{ '--i': i } as React.CSSProperties}
            >
              <div className="lucky-result-tags">
                <span className="lucky-tag">{server.category}</span>
                <span className="lucky-tag">
                  <Star size={12} aria-hidden="true" /> {server.qualityScore}
                  /100
                </span>
                {server.isVerifiedActive ? (
                  <span className="lucky-tag lucky-tag--ok">
                    <ShieldCheck size={12} aria-hidden="true" /> Verified
                  </span>
                ) : null}
              </div>
              <h3 className="lucky-result-title">{server.name}</h3>
              <p className="lucky-result-desc">{server.description}</p>
              {server.installCommand ? (
                <div className="lucky-install">
                  <code>{server.installCommand}</code>
                  <button
                    type="button"
                    className={`tl-code-btn tl-copy ${copiedId === server.id ? 'is-copied' : ''}`}
                    onClick={() => handleCopyCommand(server)}
                  >
                    {copiedId === server.id ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Copy size={14} aria-hidden="true" />
                    )}
                    {copiedId === server.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ) : null}
              <div className="lucky-result-actions">
                <Link
                  href={server.detailUrl}
                  className="btn btn-secondary btn-sm"
                >
                  View details <ArrowRight size={14} aria-hidden="true" />
                </Link>
                {server.url ? (
                  <a
                    href={server.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    Source <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
