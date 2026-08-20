import { NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';
import { ghaleSiahsangStory } from '@/content/stories/ghale_siahsang';
import { obsidianCitadelStory } from '@/content/stories/obsidian_citadel';

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET() {
  try {
    const stories = await StoryRepository.getAllStories();
    return NextResponse.json(
      {
        success: true,
        data: stories,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error: any) {
    console.warn('API error fetching stories from DB, returning static manifests:', error);
    return NextResponse.json(
      {
        success: true,
        data: [
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
        ],
      },
      { headers: corsHeaders }
    );
  }
}
