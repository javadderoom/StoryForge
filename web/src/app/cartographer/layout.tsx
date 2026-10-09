'use client';

import React from 'react';
import { StudioStoryProvider } from '@/lib/context/StudioStoryContext';

export default function CartographerLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudioStoryProvider>
      <div className="w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none">
        {children}
      </div>
    </StudioStoryProvider>
  );
}
