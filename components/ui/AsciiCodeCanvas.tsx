'use client';

import React, { useEffect, useRef } from 'react';

interface AsciiCodeCanvasProps {
  className?: string;
  opacity?: number;
  density?: number;
}

/**
 * Classic ASCII fire, remapped onto AllMCPs cyan.
 *
 * Heat is seeded at the bottom of the field, averaged upward, and mapped
 * onto a density ramp of characters plus a slate → blue → cyan → white
 * color scale. That is the Firecrawl flame motif (design.md: ~85ms/frame,
 * pause off-screen, honor prefers-reduced-motion) expressed in our brand
 * rather than heat-orange.
 *
 * Pointer proximity adds a local heat bloom. Reduced-motion visitors get
 * a single static frame.
 */
const RAMP = ' .\'`^":;~-_+<>i!lI?/\\|()1{}[]rcvunxzjftLCJUYXZO0Qoahkbdpqwm*WMB8&%$#@';
const HOT_GLYPHS = '{ } [ ] / * # $ > 0 1 m c p'.split(' ');

const FRAME_MS = 85;
const COOLING = 1.7;

function heatColor(t: number, light: boolean): [number, number, number, number] {
  // t is 0..1. Dark theme: dim slate → brand blue → cyan → white.
  // Light theme: pale slate → blue → cyan, never blown-out white.
  const stops = light
    ? [
        [100, 116, 139, 0.0],
        [14, 116, 144, 0.35],
        [2, 132, 199, 0.55],
        [8, 145, 178, 0.72],
        [3, 105, 161, 0.88],
      ]
    : [
        [15, 23, 42, 0.0],
        [30, 64, 175, 0.22],
        [0, 123, 255, 0.45],
        [0, 229, 255, 0.72],
        [186, 250, 255, 0.92],
        [255, 255, 255, 1.0],
      ];
  const clamped = Math.max(0, Math.min(0.999, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = stops[i];
  const b = stops[i + 1] ?? stops[i];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
    a[3] + (b[3] - a[3]) * f,
  ];
}

function glyphFor(heat: number): string {
  if (heat > 180 && Math.random() < 0.18) {
    return HOT_GLYPHS[(Math.random() * HOT_GLYPHS.length) | 0];
  }
  const idx = Math.min(RAMP.length - 1, Math.max(0, ((heat / 255) * (RAMP.length - 1)) | 0));
  return RAMP[idx];
}

export function AsciiCodeCanvas({
  className = '',
  opacity = 0.55,
  density = 12,
}: AsciiCodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    const ctx = context;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let cellW = density;
    let cellH = density * 1.35;
    let heat: Uint8Array = new Uint8Array(0);
    let visible = true;
    let raf = 0;
    let lastDraw = 0;
    let mouseX = -1;
    let mouseY = -1;
    let targetX = -1;
    let targetY = -1;

    const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';

    const idx = (x: number, y: number) => y * cols + x;

    function resize() {
      if (!canvas) return;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cellW = density;
      cellH = density * 1.35;
      cols = Math.max(8, Math.floor(width / cellW));
      rows = Math.max(8, Math.floor(height / cellH));
      // Cap the field so a 4k window cannot spawn tens of thousands of glyphs.
      const maxCells = 2800;
      if (cols * rows > maxCells) {
        const scale = Math.sqrt(maxCells / (cols * rows));
        cols = Math.max(8, Math.floor(cols * scale));
        rows = Math.max(8, Math.floor(rows * scale));
        cellW = width / cols;
        cellH = height / rows;
      }
      heat = new Uint8Array(cols * rows);
      seedBase();
    }

    function seedBase() {
      // A quiet ember bed so the first frame is not empty.
      for (let x = 0; x < cols; x++) {
        heat[idx(x, rows - 1)] = 140 + ((Math.random() * 80) | 0);
        if (rows > 2) heat[idx(x, rows - 2)] = 80 + ((Math.random() * 60) | 0);
      }
    }

    function tick() {
      // Seed the floor. Intensity is biased toward the left/right so the
      // headline in the center stays readable.
      for (let x = 0; x < cols; x++) {
        const edge = Math.abs(x / cols - 0.5) * 2; // 0 center, 1 edges
        const bias = 0.35 + edge * 0.65;
        if (Math.random() < 0.55 * bias) {
          heat[idx(x, rows - 1)] = Math.min(255, 160 + ((Math.random() * 95 * bias) | 0));
        } else if (Math.random() < 0.12) {
          heat[idx(x, rows - 1)] = 20;
        }
      }

      // Pointer bloom.
      if (mouseX >= 0 && mouseY >= 0) {
        const cx = Math.floor(mouseX / cellW);
        const cy = Math.floor(mouseY / cellH);
        const radius = 4;
        for (let y = cy - radius; y <= cy + radius; y++) {
          for (let x = cx - radius; x <= cx + radius; x++) {
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            const d = Math.hypot(x - cx, y - cy);
            if (d > radius) continue;
            const add = ((1 - d / radius) * 70) | 0;
            const i = idx(x, y);
            heat[i] = Math.min(255, heat[i] + add);
          }
        }
      }

      // Propagate upward with neighbor averaging + floor cooling.
      const next = new Uint8Array(heat.length);
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols; x++) {
          const left = heat[idx(x > 0 ? x - 1 : x, y + 1)];
          const mid = heat[idx(x, y + 1)];
          const right = heat[idx(x < cols - 1 ? x + 1 : x, y + 1)];
          const self = heat[idx(x, y)];
          const avg = (left + mid + right + self) / 4;
          const cooled = avg - COOLING - Math.random() * 1.4;
          next[idx(x, y)] = cooled > 0 ? cooled | 0 : 0;
        }
      }
      for (let x = 0; x < cols; x++) {
        next[idx(x, rows - 1)] = heat[idx(x, rows - 1)];
      }
      heat = next;
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${Math.max(9, Math.floor(cellW * 0.92))}px var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, monospace)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const light = isLight();
      const fadeTop = height * 0.12;
      const fadeBottom = height * 0.78;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const h = heat[idx(x, y)];
          if (h < 10) continue;
          const px = x * cellW + cellW / 2;
          const py = y * cellH + cellH / 2;

          // Feather the top so copy stays readable; denser toward the floor.
          const yFade =
            py < fadeTop
              ? py / fadeTop
              : py > fadeBottom
                ? 1
                : 0.35 + ((py - fadeTop) / (fadeBottom - fadeTop)) * 0.65;

          const t = h / 255;
          const [r, g, b, a] = heatColor(t, light);
          const alpha = a * yFade * (0.55 + t * 0.45);
          if (alpha < 0.03) continue;
          ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${Math.min(0.9, alpha)})`;
          ctx.fillText(glyphFor(h), px, py);
        }
      }
    }

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
    };
    const onLeave = () => {
      targetX = -1;
      targetY = -1;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave, { passive: true });
    window.addEventListener('resize', resize, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    resize();
    tick();
    draw();

    if (reduceMotion) {
      return () => {
        window.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseleave', onLeave);
        window.removeEventListener('resize', resize);
        observer.disconnect();
      };
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      mouseX += (targetX - mouseX) * 0.18;
      mouseY += (targetY - mouseY) * 0.18;
      if (targetX < 0) {
        mouseX = -1;
        mouseY = -1;
      }
      if (t - lastDraw < FRAME_MS) return;
      lastDraw = t;
      tick();
      draw();
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`ascii-code-canvas ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
        zIndex: 0,
      }}
    />
  );
}
