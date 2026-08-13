'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Dices,
  Sparkles,
  Zap,
  Gem,
  Layers,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ExternalLink,
  RotateCw,
  Trophy,
  Tv,
  Star,
  ShieldCheck,
  ArrowRight,
  Wrench,
  Server,
} from 'lucide-react';
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
function playSound(type: 'spin' | 'stop' | 'jackpot' | 'coin' | 'click', muted: boolean) {
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
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.25);
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
  if (lower.includes('ai') || lower.includes('machine') || lower.includes('agent')) return <Sparkles size={iconSize} className="text-cyan-400" />;
  if (lower.includes('dev') || lower.includes('tool')) return <Wrench size={iconSize} className="text-blue-400" />;
  if (lower.includes('data') || lower.includes('db') || lower.includes('sql')) return <Layers size={iconSize} className="text-indigo-400" />;
  if (lower.includes('sec') || lower.includes('auth')) return <ShieldCheck size={iconSize} className="text-emerald-400" />;
  if (lower.includes('web') || lower.includes('api') || lower.includes('http')) return <ExternalLink size={iconSize} className="text-purple-400" />;
  return <Server size={iconSize} className="text-amber-400" />;
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
  const [crtEnabled, setCrtEnabled] = useState(true);
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

  const toggleCrt = () => {
    setCrtEnabled(!crtEnabled);
    playSound('click', isMuted);
  };

  const selectMode = (newMode: SpinMode) => {
    setMode(newMode);
    playSound('click', isMuted);
    trackFeatureUse('feeling_lucky_arcade', { action: 'select_mode', mode: newMode });
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
        localStorage.setItem('allmcps_arcade_achievements', JSON.stringify(unlocked));
      } catch {}
    },
    [achievements, streakCount]
  );

  const handleSpin = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setReel1Locked(false);
    setReel2Locked(false);
    setReel3Locked(false);
    setResults([]);

    playSound('click', isMuted);
    trackFeatureUse('feeling_lucky_arcade', { action: 'spin', mode, spin_count: spinCount + 1 });

    let fetchedServers: ServerResult[] = [];
    const count = mode === 'stack' ? 3 : 1;

    const fetchPromise = fetch(
      `/api/v1/servers/random?mode=${mode}&count=${count}&t=${Date.now()}`,
      { cache: 'no-store' }
    )
      .then((res) => (res.ok ? (res.json() as Promise<{ servers?: ServerResult[] }>) : null))
      .then((data) => {
        if (data && Array.isArray(data.servers)) {
          fetchedServers = data.servers;
        }
      })
      .catch(() => {});

    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      if (ticks % 3 === 0) playSound('spin', isMuted);

      setReel1Text(REEL_CATEGORIES[Math.floor(Math.random() * REEL_CATEGORIES.length)]);
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
    trackFeatureUse('feeling_lucky_arcade', { action: 'copy_command', server_id: server.id });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={`retro-arcade-shell ${crtEnabled ? 'crt-scanlines' : ''}`}>
      <style jsx global>{`
        .retro-arcade-shell {
          position: relative;
          background: var(--surface-background, #020617);
          border: 2px solid rgba(0, 229, 255, 0.4);
          border-radius: 16px;
          padding: 2rem 1.5rem 2.5rem;
          box-shadow: 0 0 40px rgba(0, 229, 255, 0.15), inset 0 0 30px rgba(0, 123, 255, 0.08);
          color: var(--text-primary, #ffffff);
          font-family: inherit;
          margin-bottom: 2.5rem;
          transition: all 0.2s ease;
        }

        html[data-theme='light'] .retro-arcade-shell {
          background: #ffffff;
          border-color: rgba(0, 123, 255, 0.35);
          box-shadow: 0 10px 40px rgba(0, 123, 255, 0.12), inset 0 0 20px rgba(0, 229, 255, 0.05);
          color: #0f172a;
        }

        .crt-scanlines::before {
          content: ' ';
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          border-radius: 14px;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
            linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
          z-index: 5;
          background-size: 100% 4px, 6px 100%;
          pointer-events: none;
          opacity: 0.6;
        }

        html[data-theme='light'] .crt-scanlines::before {
          opacity: 0.25;
          background: linear-gradient(rgba(240, 240, 240, 0) 50%, rgba(2, 132, 199, 0.08) 50%),
            linear-gradient(90deg, rgba(2, 132, 199, 0.03), rgba(0, 229, 255, 0.02), rgba(0, 0, 0, 0.02));
          background-size: 100% 4px, 6px 100%;
        }

        .arcade-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(0, 229, 255, 0.2);
          padding-bottom: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        html[data-theme='light'] .arcade-header-bar {
          border-bottom-color: rgba(0, 123, 255, 0.2);
        }

        .arcade-header-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 800;
          font-size: 1rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #ffffff;
        }

        html[data-theme='light'] .arcade-header-title {
          color: #0f172a;
        }

        .arcade-controls-top {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .arcade-icon-btn {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          padding: 0.4rem 0.65rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.8rem;
          font-weight: 600;
        }

        html[data-theme='light'] .arcade-icon-btn {
          background: #f1f5f9;
          border-color: rgba(0, 0, 0, 0.12);
          color: #64748b;
        }

        .arcade-icon-btn:hover,
        .arcade-icon-btn.active {
          color: #00e5ff;
          border-color: #00e5ff;
          background: rgba(0, 229, 255, 0.1);
        }

        html[data-theme='light'] .arcade-icon-btn.active {
          color: #0284c7;
          border-color: #0284c7;
          background: rgba(2, 132, 199, 0.1);
        }

        .mode-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .mode-card-btn {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1rem 0.75rem;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          text-align: center;
        }

        html[data-theme='light'] .mode-card-btn {
          background: #f8fafc;
          border-color: rgba(0, 0, 0, 0.1);
          color: #475569;
        }

        .mode-card-btn:hover {
          border-color: rgba(0, 229, 255, 0.5);
          color: #fff;
          transform: translateY(-2px);
        }

        html[data-theme='light'] .mode-card-btn:hover {
          border-color: #0284c7;
          color: #0f172a;
        }

        .mode-card-btn.active {
          background: linear-gradient(180deg, rgba(0, 229, 255, 0.15), rgba(0, 123, 255, 0.15));
          border: 1.5px solid #00e5ff;
          color: #fff;
          box-shadow: 0 0 18px rgba(0, 229, 255, 0.25);
        }

        html[data-theme='light'] .mode-card-btn.active {
          background: rgba(2, 132, 199, 0.08);
          border-color: #0284c7;
          color: #0f172a;
          box-shadow: 0 4px 15px rgba(2, 132, 199, 0.15);
        }

        .mode-title {
          font-size: 0.85rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .mode-sub {
          font-size: 0.72rem;
          color: #64748b;
        }

        .mode-card-btn.active .mode-sub {
          color: #94a3b8;
        }

        html[data-theme='light'] .mode-card-btn.active .mode-sub {
          color: #475569;
        }

        /* Slot Machine Display Screen */
        .slot-cabinet-display {
          background: #090d16;
          border: 2px solid rgba(0, 229, 255, 0.3);
          border-radius: 14px;
          padding: 1.5rem 1.25rem;
          margin-bottom: 1.5rem;
          box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.8);
        }

        html[data-theme='light'] .slot-cabinet-display {
          background: #f1f5f9;
          border-color: rgba(2, 132, 199, 0.25);
          box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.04);
        }

        .reels-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.85rem;
          margin-bottom: 1.5rem;
        }

        @media (max-width: 640px) {
          .reels-container {
            grid-template-columns: 1fr;
          }
        }

        .slot-reel {
          background: #020617;
          border: 1px solid rgba(0, 229, 255, 0.25);
          border-radius: 10px;
          padding: 0.85rem 1rem;
          text-align: center;
          min-height: 105px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          box-shadow: inset 0 0 12px rgba(0, 229, 255, 0.1);
          transition: all 0.2s ease;
        }

        html[data-theme='light'] .slot-reel {
          background: #ffffff;
          border-color: rgba(2, 132, 199, 0.2);
          box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.03);
        }

        .slot-reel.locked {
          border-color: #00e5ff;
          box-shadow: 0 0 16px rgba(0, 229, 255, 0.35);
          background: rgba(0, 229, 255, 0.08);
        }

        html[data-theme='light'] .slot-reel.locked {
          border-color: #0284c7;
          box-shadow: 0 4px 15px rgba(2, 132, 199, 0.2);
          background: rgba(2, 132, 199, 0.06);
        }

        .slot-reel-text {
          font-weight: 800;
          font-size: 0.88rem;
          line-height: 1.3;
          color: #00e5ff;
          word-break: break-word;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          max-width: 100%;
        }

        html[data-theme='light'] .slot-reel-text {
          color: #0284c7;
        }

        .slot-reel.locked .slot-reel-text {
          color: #ffffff;
        }

        html[data-theme='light'] .slot-reel.locked .slot-reel-text {
          color: #0f172a;
        }

        .spin-action-bar {
          display: flex;
          justify-content: center;
        }

        .big-spin-button {
          background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 20%, #a1c4fd 40%, #c2e9fb 60%, #e0c3fc 80%, #8ec5fc 100%);
          background-size: 250% 250%;
          animation: pastelRainbow 2.5s ease infinite;
          border: none;
          color: rgba(15, 23, 42, 0.84) !important;
          font-size: 1.1rem;
          font-weight: 900;
          padding: 1rem 2.5rem;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 0 28px rgba(255, 182, 193, 0.6);
          transition: all 0.3s ease;
          text-shadow: none !important;
        }

        html[data-theme='light'] .big-spin-button {
          color: rgba(15, 23, 42, 0.84) !important;
          box-shadow: 0 4px 25px rgba(255, 182, 193, 0.7);
        }

        .big-spin-button.is-spinning {
          animation-duration: 1.2s;
          box-shadow: 0 0 40px rgba(255, 182, 193, 0.95);
        }

        @keyframes pastelRainbow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .big-spin-button:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 0 38px rgba(255, 182, 193, 0.85);
        }

        .big-spin-button:disabled {
          opacity: 0.9;
          cursor: wait;
        }

        .spin-icon-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% {
            transform: rotate(360deg);
          }
        }

        /* Result Display Card */
        .arcade-result-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .arcade-result-card {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(0, 229, 255, 0.4);
          border-radius: 12px;
          padding: 1.25rem;
          position: relative;
          box-shadow: 0 0 20px rgba(0, 229, 255, 0.1);
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        html[data-theme='light'] .arcade-result-card {
          background: #ffffff;
          border-color: rgba(2, 132, 199, 0.3);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .card-top-tags {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .card-cat-pill {
          background: rgba(0, 229, 255, 0.1);
          border: 1px solid rgba(0, 229, 255, 0.3);
          color: #00e5ff;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 6px;
          text-transform: uppercase;
        }

        html[data-theme='light'] .card-cat-pill {
          background: rgba(2, 132, 199, 0.1);
          border-color: rgba(2, 132, 199, 0.3);
          color: #0284c7;
        }

        .card-qs-badge {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #ffd700;
        }

        html[data-theme='light'] .card-qs-badge {
          color: #d97706;
        }

        .card-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: #fff;
          margin-bottom: 0.5rem;
        }

        html[data-theme='light'] .card-title {
          color: #0f172a;
        }

        .card-desc {
          font-size: 0.88rem;
          color: #94a3b8;
          line-height: 1.5;
          margin-bottom: 1rem;
        }

        html[data-theme='light'] .card-desc {
          color: #475569;
        }

        .card-install-box {
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.6rem 0.85rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 1rem;
          font-family: monospace;
          font-size: 0.82rem;
          color: #00e5ff;
        }

        html[data-theme='light'] .card-install-box {
          background: #f8fafc;
          border-color: rgba(0, 0, 0, 0.1);
          color: #0284c7;
        }

        .card-actions-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .arcade-btn-primary {
          background: linear-gradient(135deg, #00e5ff, #007bff);
          color: #ffffff;
          font-weight: 800;
          padding: 0.55rem 1.1rem;
          border-radius: 8px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          transition: all 0.2s ease;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        html[data-theme='light'] .arcade-btn-primary {
          color: #ffffff;
          box-shadow: 0 2px 10px rgba(0, 123, 255, 0.25);
        }

        .arcade-btn-primary:hover {
          box-shadow: 0 0 15px rgba(0, 229, 255, 0.4);
        }

        .arcade-btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          font-weight: 600;
          padding: 0.55rem 1.1rem;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          transition: all 0.2s ease;
        }

        html[data-theme='light'] .arcade-btn-secondary {
          background: #f1f5f9;
          border-color: rgba(0, 0, 0, 0.12);
          color: #0f172a;
        }

        .arcade-btn-secondary:hover {
          border-color: #00e5ff;
          color: #00e5ff;
        }

        html[data-theme='light'] .arcade-btn-secondary:hover {
          border-color: #0284c7;
          color: #0284c7;
        }

        .stats-gamify-bar {
          display: flex;
          align-items: center;
          justify-content: space-around;
          background: transparent;
          border: none;
          padding-top: 1rem;
          margin-top: 1.5rem;
          font-size: 0.82rem;
          color: #94a3b8;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        html[data-theme='light'] .stats-gamify-bar {
          background: transparent;
          border: none;
          color: #64748b;
        }

        .gamify-item {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .gamify-val {
          color: #00e5ff;
          font-weight: 700;
        }

        html[data-theme='light'] .gamify-val {
          color: #0284c7;
        }
      `}</style>

      {/* Header Bar */}
      <div className="arcade-header-bar">
        <div className="arcade-header-title">
          <Dices size={20} className="text-cyan-400" />
          <span>ALLMCPS ARCADE</span>
        </div>

        <div className="arcade-controls-top">
          <button
            type="button"
            className={`arcade-icon-btn ${crtEnabled ? 'active' : ''}`}
            onClick={toggleCrt}
            title="Toggle CRT Scanline Effect"
          >
            <Tv size={14} /> CRT Scanlines
          </button>
          <button
            type="button"
            className={`arcade-icon-btn ${!isMuted ? 'active' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute 8-Bit Sounds' : 'Mute 8-Bit Sounds'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />} {isMuted ? 'Muted' : 'Sound ON'}
          </button>
        </div>
      </div>

      {/* Mode Selector - Big Centered Icons with Text Stacked Beneath */}
      <div className="mode-selector-grid">
        <button
          type="button"
          className={`mode-card-btn ${mode === 'random' ? 'active' : ''}`}
          onClick={() => selectMode('random')}
        >
          <Dices size={32} className="text-cyan-400" />
          <span className="mode-title">Wild Roll</span>
          <span className="mode-sub">100% Pure Random</span>
        </button>

        <button
          type="button"
          className={`mode-card-btn ${mode === 'hidden-gem' ? 'active' : ''}`}
          onClick={() => selectMode('hidden-gem')}
        >
          <Gem size={32} className="text-purple-400" />
          <span className="mode-title">Hidden Gem</span>
          <span className="mode-sub">Underrated Sleeper</span>
        </button>

        <button
          type="button"
          className={`mode-card-btn ${mode === 'superpower' ? 'active' : ''}`}
          onClick={() => selectMode('superpower')}
        >
          <Zap size={32} className="text-amber-400" />
          <span className="mode-title">Superpower</span>
          <span className="mode-sub">Quality Score (75+)</span>
        </button>

        <button
          type="button"
          className={`mode-card-btn ${mode === 'stack' ? 'active' : ''}`}
          onClick={() => selectMode('stack')}
        >
          <Layers size={32} className="text-emerald-400" />
          <span className="mode-title">Triple Stack</span>
          <span className="mode-sub">3 MCP Combo</span>
        </button>
      </div>

      {/* Slot Machine Display Cabinet */}
      <div className="slot-cabinet-display">
        <div className="reels-container">
          {/* Reel 1: Category */}
          <div className={`slot-reel ${reel1Locked ? 'locked' : ''}`}>
            {getCategoryIcon(reel1Text, 26)}
            <span className="slot-reel-text">{reel1Text}</span>
          </div>

          {/* Reel 2: Quality Score */}
          <div className={`slot-reel ${reel2Locked ? 'locked' : ''}`}>
            <Star size={26} className="text-amber-400" />
            <span className="slot-reel-text">{reel2Text}</span>
          </div>

          {/* Reel 3: Server Name */}
          <div className={`slot-reel ${reel3Locked ? 'locked' : ''}`}>
            <Sparkles size={26} className="text-cyan-400" />
            <span className="slot-reel-text">{reel3Text}</span>
          </div>
        </div>

        <div className="spin-action-bar">
          <button
            type="button"
            className={`big-spin-button ${isSpinning ? 'is-spinning' : ''}`}
            onClick={handleSpin}
            disabled={isSpinning}
          >
            {isSpinning ? (
              <>
                <RotateCw size={22} className="spin-icon-spin" /> GENERATING...
              </>
            ) : (
              <>
                <Dices size={22} /> PULL LEVER / SPIN
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result Cards Display */}
      {results.length > 0 && (
        <div className="arcade-result-grid">
          {results.map((server) => (
            <div key={server.id} className="arcade-result-card">
              <div className="card-top-tags">
                <span className="card-cat-pill">{server.category}</span>
                <span className="card-qs-badge">
                  <Star size={13} fill="#FFD700" /> Quality Score: {server.qualityScore}/100
                  {server.isVerifiedActive && (
                    <span className="inline-flex items-center gap-1 text-emerald-400 ml-2">
                      <ShieldCheck size={13} /> Verified
                    </span>
                  )}
                </span>
              </div>

              <h3 className="card-title">{server.name}</h3>
              <p className="card-desc">{server.description}</p>

              <div className="card-install-box">
                <span className="truncate">{server.installCommand}</span>
                <button
                  type="button"
                  className="arcade-btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => handleCopyCommand(server)}
                >
                  {copiedId === server.id ? (
                    <>
                      <Check size={14} className="text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy
                    </>
                  )}
                </button>
              </div>

              <div className="card-actions-row">
                <Link href={server.detailUrl} className="arcade-btn-primary">
                  View Full Details <ArrowRight size={14} />
                </Link>
                <a
                  href={server.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="arcade-btn-secondary"
                >
                  Source Repo <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Gamification & Achievements Bar */}
      <div className="stats-gamify-bar">
        <div className="gamify-item">
          Total Spins: <span className="gamify-val">{spinCount}</span>
        </div>
        <div className="gamify-item">
          Streak: <span className="gamify-val">🔥 {streakCount}</span>
        </div>
        <div className="gamify-item">
          <Trophy size={14} className="text-amber-400" /> Achievements:{' '}
          <span className="gamify-val">{achievements.length}/4 Unlocked</span>
        </div>
      </div>
    </div>
  );
}
