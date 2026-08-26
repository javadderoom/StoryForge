'use client';

import React, { useEffect, useRef } from 'react';
import { RealmTheme } from '@/lib/play/realmTheme';

interface AtmosphereCanvasProps {
  theme: RealmTheme;
  enableParticles?: boolean;
  isDanger?: boolean;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export function AtmosphereCanvas({
  theme,
  enableParticles = true,
  isDanger = false,
  className,
}: AtmosphereCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const dangerRef = useRef(isDanger);

  useEffect(() => {
    dangerRef.current = isDanger;
  }, [isDanger]);

  // (Re)build particle field when theme/density changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.round(theme.particleDensity);
    const colors = theme.particleColors;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * theme.particleSpeed * dpr,
        vy: (Math.random() - 0.5) * theme.particleSpeed * dpr - 0.2 * dpr,
        size: (Math.random() * 2 + 1) * dpr,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.2,
      });
    }
    particlesRef.current = particles;

    const render = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Danger vignette when HP < 30
      if (dangerRef.current) {
        const grad = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          canvas.height * 0.2,
          canvas.width / 2,
          canvas.height / 2,
          canvas.height * 0.75
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(220,38,38,0.16)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (enableParticles) {
        for (const p of particlesRef.current) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;

          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      rafRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [theme, enableParticles]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  );
}
