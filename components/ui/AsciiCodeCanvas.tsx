'use client';

import React, { useEffect, useRef } from 'react';

interface AsciiCodeCanvasProps {
  className?: string;
  opacity?: number;
  density?: number;
}

const CHARACTERS = [
  '{', '}', '[', ']', '<', '>', '/', '\\', '*', '+', '=', '#', '$', '%', '~',
  '0', '1', 'm', 'c', 'p', 'r', 'p', 'c', 'j', 's', 'o', 'n', ':', ';', '&', '!', '?',
];

/**
 * High-performance HTML5 Canvas component that generates an undulating field of
 * ASCII characters and code particles inspired by Firecrawl's interactive ASCII
 * art and canvas backdrops, styled in AllMCPs' electric cyan & cobalt blue theme.
 *
 * Features:
 * - Subtle sine-wave flow & particle movement
 * - Interactive mouse repulsion / glow ripple
 * - Automatically throttles and pauses when out of view (IntersectionObserver)
 * - Honors `prefers-reduced-motion`
 * - Ultra-lightweight with negligible CPU overhead
 */
export function AsciiCodeCanvas({
  className = '',
  opacity = 0.65,
  density = 24,
}: AsciiCodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let animationFrameId: number;
    let isVisible = true;
    const dpr = window.devicePixelRatio || 1;
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let mouseX = -1000;
    let mouseY = -1000;
    let targetMouseX = -1000;
    let targetMouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = e.clientX - rect.left;
      targetMouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      targetMouseX = -1000;
      targetMouseY = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    // Grid sizing
    const cellWidth = density;
    const cellHeight = density * 1.25;
    let cols = Math.floor(width / cellWidth);
    let rows = Math.floor(height / cellHeight);

    interface Cell {
      char: string;
      baseChar: string;
      x: number;
      y: number;
      offset: number;
      speed: number;
      colorType: 'cyan' | 'blue' | 'slate' | 'dim';
    }

    let cells: Cell[] = [];

    function initCells() {
      if (!canvas) return;
      cols = Math.max(1, Math.floor(width / cellWidth));
      rows = Math.max(1, Math.floor(height / cellHeight));
      cells = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
          const rand = Math.random();
          const colorType: Cell['colorType'] =
            rand > 0.88 ? 'cyan' : rand > 0.72 ? 'blue' : rand > 0.35 ? 'slate' : 'dim';

          cells.push({
            char,
            baseChar: char,
            x: c * cellWidth + cellWidth / 2,
            y: r * cellHeight + cellHeight / 2,
            offset: Math.random() * Math.PI * 2,
            speed: 0.0008 + Math.random() * 0.0012,
            colorType,
          });
        }
      }
    }

    initCells();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      initCells();
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Intersection observer to pause when offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    let time = 0;

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 0.012;
      mouseX += (targetMouseX - mouseX) * 0.1;
      mouseY += (targetMouseY - mouseY) * 0.1;

      ctx.clearRect(0, 0, width, height);

      ctx.font = '10px ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const cellCount = cells.length;
      for (let i = 0; i < cellCount; i++) {
        const cell = cells[i];

        // Undulating sine-wave movement
        const wave = Math.sin(time + cell.offset + cell.x * 0.005 + cell.y * 0.008);
        const wave2 = Math.cos(time * 0.7 + cell.offset + cell.x * 0.008);
        
        // Distance to cursor
        const dx = cell.x - mouseX;
        const dy = cell.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const mouseInfluence = Math.max(0, 1 - dist / 180);

        // Alpha calculation with vertical boundary feathering
        const verticalFade =
          Math.min(1, Math.max(0, (height - cell.y) / (height * 0.35))) *
          Math.min(1, Math.max(0, cell.y / (height * 0.12)));

        let alpha = (0.08 + (wave + 1) * 0.07) * verticalFade;
        if (alpha <= 0.005) continue;

        if (cell.colorType === 'cyan') alpha *= 1.8;
        if (cell.colorType === 'dim') alpha *= 0.5;
        if (mouseInfluence > 0) {
          alpha += mouseInfluence * 0.6;
        }

        // Color selection
        if (mouseInfluence > 0.4 || cell.colorType === 'cyan') {
          ctx.fillStyle = `rgba(0, 229, 255, ${Math.min(alpha * 1.5, 0.85)})`;
        } else if (cell.colorType === 'blue') {
          ctx.fillStyle = `rgba(56, 189, 248, ${Math.min(alpha * 1.3, 0.7)})`;
        } else if (cell.colorType === 'slate') {
          ctx.fillStyle = `rgba(148, 163, 184, ${Math.min(alpha, 0.4)})`;
        } else {
          ctx.fillStyle = `rgba(100, 116, 139, ${Math.min(alpha, 0.25)})`;
        }

        // Occasional char mutation on wave peaks
        let displayChar = cell.char;
        if (wave > 0.95 && Math.random() < 0.02) {
          cell.char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
          displayChar = cell.char;
        }

        const drawX = cell.x + wave2 * 2 + (dx / (dist + 0.1)) * mouseInfluence * 8;
        const drawY = cell.y + wave * 2 + (dy / (dist + 0.1)) * mouseInfluence * 8;

        ctx.fillText(displayChar, drawX, drawY);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
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
