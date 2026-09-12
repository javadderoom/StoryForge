'use client';

import React, { useMemo } from 'react';
import { segmentProse } from '@/lib/play/dialogueSegments';

interface NarrativeProseProps {
  text: string;
  isPersian?: boolean;
  /** Body text color for narration. */
  bodyColor?: string;
  /** Accent color for the dialogue bar + tint. */
  accentColor?: string;
  fontSizeClass?: string;
  lineHeightClass?: string;
}

/**
 * Renders scene prose with a clear visual split:
 * narration keeps the classic reader style, while direct speech
 * gets an accent side-bar, tinted backdrop, and italic voice.
 */
export function NarrativeProse({
  text,
  isPersian = true,
  bodyColor = '#E4E4E7',
  accentColor = '#F59E0B',
  fontSizeClass = 'text-base md:text-lg',
  lineHeightClass = 'leading-loose',
}: NarrativeProseProps) {
  const segments = useMemo(() => segmentProse(text || ''), [text]);
  const barSide = isPersian ? { borderRight: `3px solid ${accentColor}` } : { borderLeft: `3px solid ${accentColor}` };

  return (
    <div className="space-y-4">
      {segments.map((seg, i) =>
        seg.type === 'dialogue' ? (
          <blockquote
            key={i}
            dir={isPersian ? 'rtl' : 'ltr'}
            className={`whitespace-pre-line rounded-xl px-4 py-3 italic tracking-wide ${fontSizeClass} ${lineHeightClass}`}
            style={{
              ...barSide,
              color: '#FDE68A',
              backgroundColor: `${accentColor}14`,
            }}
          >
            <span aria-hidden="true" className="mr-1 opacity-60">
              {isPersian ? '❝ ' : '"'}
            </span>
            {seg.text}
          </blockquote>
        ) : (
          <p
            key={i}
            className={`whitespace-pre-line tracking-wide ${fontSizeClass} ${lineHeightClass}`}
            style={{ color: bodyColor }}
          >
            {seg.text}
          </p>
        )
      )}
    </div>
  );
}
