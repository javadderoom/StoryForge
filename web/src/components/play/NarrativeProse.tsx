'use client';

import React, { useMemo } from 'react';
import { segmentProse, splitParagraphs } from '@/lib/play/dialogueSegments';

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
}: NarrativeProseProps) {
  const segments = useMemo(() => segmentProse(text || ''), [text]);
  const barSide = isPersian
    ? { borderRight: `3px solid ${accentColor}` }
    : { borderLeft: `3px solid ${accentColor}` };

  let globalParagraphIndex = 0;

  return (
    <div className="space-y-5 md:space-y-6">
      {segments.map((seg, i) => {
        if (seg.type === 'dialogue') {
          return (
            <blockquote
              key={i}
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
          );
        }

        const paragraphs = splitParagraphs(seg.text);

        return (
          <div key={i} className="narrative-segment space-y-4 md:space-y-5">
            {paragraphs.map((paragraph, pIdx) => {
              const isLead = globalParagraphIndex === 0;
              globalParagraphIndex++;

              return (
                <p
                  key={pIdx}
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
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
export { splitParagraphs };
