'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { obsidianCitadelStory } from '@/content/stories/obsidian_citadel';
import { ghaleSiahsangStory } from '@/content/stories/ghale_siahsang';
import { StoryManifest } from '@/lib/types';

interface StudioStoryContextType {
  selectedStoryId: string;
  setSelectedStoryId: (id: string) => void;
  story: StoryManifest;
  isPersian: boolean;
  isRtl: boolean;
  toggleLanguage: () => void;
}

const StudioStoryContext = createContext<StudioStoryContextType | undefined>(undefined);

export function StudioStoryProvider({ children }: { children: ReactNode }) {
  const [selectedStoryId, setSelectedStoryId] = useState<string>('ghale_siahsang');

  const isPersian = selectedStoryId === 'ghale_siahsang';
  const isRtl = isPersian;
  const story = isPersian ? ghaleSiahsangStory : obsidianCitadelStory;

  const toggleLanguage = () => {
    setSelectedStoryId((prev) => (prev === 'ghale_siahsang' ? 'obsidian_citadel' : 'ghale_siahsang'));
  };

  return (
    <StudioStoryContext.Provider
      value={{
        selectedStoryId,
        setSelectedStoryId,
        story,
        isPersian,
        isRtl,
        toggleLanguage,
      }}
    >
      <div dir={isRtl ? 'rtl' : 'ltr'} className={isRtl ? 'font-[Vazirmatn]' : ''}>
        {children}
      </div>
    </StudioStoryContext.Provider>
  );
}

export function useStudioStory() {
  const context = useContext(StudioStoryContext);
  if (!context) {
    throw new Error('useStudioStory must be used within a StudioStoryProvider');
  }
  return context;
}
