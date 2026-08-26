'use client';

import React, { useRef, useState } from 'react';
import { RealmTheme, riskColor } from '@/lib/play/realmTheme';
import { audioService } from '@/lib/play/audioService';

interface ChoiceOption {
  id: string;
  text: string;
  style?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  requiredStatId?: string;
  targetDC?: number;
}

interface ThreeDChoiceCardProps {
  choice: ChoiceOption;
  theme: RealmTheme;
  isPersian?: boolean;
  onTap: () => void;
}

export function ThreeDChoiceCard({ choice, theme, onTap }: ThreeDChoiceCardProps) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, px: 50, py: 50 });
  const [hover, setHover] = useState(false);
  const risk = (choice.riskLevel as 'low' | 'medium' | 'high') || 'medium';
  const edgeColor = riskColor(theme, risk);

  function handleMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const rotY = ((px - 50) / 50) * 6;
    const rotX = ((50 - py) / 50) * 6;
    setTilt({ x: rotX, y: rotY, px, py });
  }

  function reset() {
    setTilt({ x: 0, y: 0, px: 50, py: 50 });
    setHover(false);
  }

  return (
    <button
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => {
        setHover(true);
        audioService.playSfx('buttonClick');
      }}
      onMouseLeave={reset}
      onClick={onTap}
      className="group relative w-full text-start rounded-2xl border p-4 transition-shadow"
      style={{
        background: `linear-gradient(135deg, ${theme.cardBg} 0%, ${theme.bgGradientEnd} 100%)`,
        borderColor: hover ? edgeColor : theme.cardBorder,
        borderLeft: `3px solid ${edgeColor}`,
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${hover ? 'translateY(-2px)' : ''}`,
        transition: hover ? 'transform 60ms linear, border-color 200ms, box-shadow 200ms' : 'transform 300ms ease-out, border-color 200ms, box-shadow 200ms',
        boxShadow: hover ? `0 10px 30px -10px ${theme.accentGlow}` : 'none',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Moving specular sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200"
        style={{
          opacity: hover ? 0.6 : 0,
          background: `radial-gradient(220px circle at ${tilt.px}% ${tilt.py}%, ${theme.accentGlow}, transparent 60%)`,
        }}
      />
      <span className="relative flex items-start gap-3">
        <span
          className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: edgeColor, boxShadow: `0 0 8px ${edgeColor}` }}
        />
        <span
          className="text-sm leading-relaxed transition-colors"
          style={{ color: hover ? theme.primaryAccent : '#E4E4E7' }}
        >
          {choice.text}
        </span>
      </span>
    </button>
  );
}
