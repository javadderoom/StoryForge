'use client';

import React, { useMemo, useRef } from 'react';
import { segmentProse, splitParagraphs } from '@/lib/play/dialogueSegments';

export interface ProseSpotlight {
  /** Name/title variants that trigger insertion when mentioned. */
  names: string[];
  node: React.ReactNode;
}

interface NarrativeProseProps {
  text: string;
  isPersian?: boolean;
  /** Body text color for narration. */
  bodyColor?: string;
  /** Accent color for the dialogue bar + tint. */
  accentColor?: string;
  fontSizeClass?: string;
  lineHeightClass?: string;
  /**
   * Discovery cards interleaved with the prose: each renders directly below
   * the first paragraph/dialogue block mentioning one of its names.
   * Cards never mentioned fall back to the bottom of the scene.
   */
  spotlights?: ProseSpotlight[];
}

function normalizeSpot(text: string): string {
  return (text || '')
    .replace(/[‌‍‎‏­]/g, ' ')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[«»""“”`’‘]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Renders scene prose with a clear visual split and editorial paragraph rhythm:
 * - Dialogue gets an accent side-bar, tinted backdrop, and italic quotation styling.
 * - Non-dialogue (narration) is cleanly separated paragraph by paragraph (بند به بند),
 *   with distinct paragraph spacing (margin) noticeably different from the tight
 *   intra-paragraph line-height, and refined typographic contrast.
 */
export function NarrativeProse({
  text,
  isPersian = true,
  bodyColor = '#E4E4E7',
  accentColor = '#F59E0B',
  fontSizeClass = 'text-base md:text-lg',
  lineHeightClass = 'leading-relaxed md:leading-loose',
  spotlights = [],
}: NarrativeProseProps) {
  const segments = useMemo(() => segmentProse(text || ''), [text]);
  const pendingRef = useRef<{ names: string[]; placed: boolean }[]>([]);
  pendingRef.current = spotlights.map((s) => ({
    names: s.names.map(normalizeSpot).filter(Boolean),
    placed: false,
  }));

  const barSide = isPersian
    ? { borderRight: `3px solid ${accentColor}` }
    : { borderLeft: `3px solid ${accentColor}` };

  let globalParagraphIndex = 0;

  const takeSpotlight = (blockText: string, index: number): React.ReactNode => {
    const norm = normalizeSpot(blockText);
    if (!norm) return null;
    const pending = pendingRef.current[index];
    if (!pending || pending.placed) return null;
    if (pending.names.some((nm) => norm.includes(nm))) {
      pending.placed = true;
      return spotlights[index]?.node ?? null;
    }
    return null;
  };

  const tryAnySpotlight = (blockText: string): React.ReactNode => {
    for (let i = 0; i < spotlights.length; i++) {
      const node = takeSpotlight(blockText, i);
      if (node) return <React.Fragment key={`spot-${i}`}>{node}</React.Fragment>;
    }
    return null;
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {segments.map((seg, i) => {
        if (seg.type === 'dialogue') {
          const card = tryAnySpotlight(seg.text);
          return (
            <React.Fragment key={i}>
              <blockquote
                dir={isPersian ? 'rtl' : 'ltr'}
                className={`rounded-2xl px-5 py-3.5 italic tracking-wide transition-all shadow-sm ${fontSizeClass} ${lineHeightClass}`}
                style={{
                  ...barSide,
                  color: '#FDE68A',
                  backgroundColor: `${accentColor}12`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block opacity-75 font-serif select-none mr-1.5 ml-1.5"
                >
                  {isPersian ? '«' : '"'}
                </span>
                <span>{seg.text}</span>
                <span
                  aria-hidden="true"
                  className="inline-block opacity-75 font-serif select-none mr-1.5 ml-1.5"
                >
                  {isPersian ? '»' : '"'}
                </span>
              </blockquote>
              {card}
            </React.Fragment>
          );
        }

        const paragraphs = splitParagraphs(seg.text);

        return (
          <div key={i} className="narrative-segment space-y-4 md:space-y-5">
            {paragraphs.map((paragraph, pIdx) => {
              const isLead = globalParagraphIndex === 0;
              globalParagraphIndex++;
              const card = tryAnySpotlight(paragraph);

              return (
                <React.Fragment key={pIdx}>
                  <p
                    dir={isPersian ? 'rtl' : 'ltr'}
                    className={`text-justify tracking-wide transition-colors duration-200 ${fontSizeClass} ${lineHeightClass} ${
                      isLead
                        ? 'text-zinc-100 font-medium'
                        : 'text-zinc-200/90 font-normal'
                    }`}
                    style={{
                      color: isLead ? '#F4F4F5' : bodyColor,
                    }}
                  >
                    {paragraph}
                  </p>
                  {card}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
      {/* Spotlights never mentioned in the prose fall back to the bottom. */}
      {spotlights.map((s, i) =>
        pendingRef.current[i] && !pendingRef.current[i].placed ? (
          <React.Fragment key={`spot-rest-${i}`}>{s.node}</React.Fragment>
        ) : null
      )}
    </div>
  );
}
export { splitParagraphs };
