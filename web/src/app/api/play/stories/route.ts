import { NextResponse } from 'next/server';
import { obsidianCitadelStory } from '@/content/stories/obsidian_citadel';
import { ghaleSiahsangStory } from '@/content/stories/ghale_siahsang';

export async function GET() {
  const stories = [
    {
      id: obsidianCitadelStory.id,
      title: obsidianCitadelStory.title,
      tagline: obsidianCitadelStory.tagline,
      synopsis: obsidianCitadelStory.synopsis,
      genres: obsidianCitadelStory.genres,
      language: obsidianCitadelStory.language,
      coverImageUrl: obsidianCitadelStory.coverImageUrl,
      author: obsidianCitadelStory.author,
      statsPreview: obsidianCitadelStory.rpgSystem.stats.map((s) => s.name),
    },
    {
      id: ghaleSiahsangStory.id,
      title: ghaleSiahsangStory.title,
      tagline: ghaleSiahsangStory.tagline,
      synopsis: ghaleSiahsangStory.synopsis,
      genres: ghaleSiahsangStory.genres,
      language: ghaleSiahsangStory.language,
      coverImageUrl: ghaleSiahsangStory.coverImageUrl,
      author: ghaleSiahsangStory.author,
      statsPreview: ghaleSiahsangStory.rpgSystem.stats.map((s) => s.name),
    },
  ];

  return NextResponse.json({
    success: true,
    data: stories,
  });
}
