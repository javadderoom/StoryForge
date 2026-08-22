import { StoryManifest } from '@/lib/types';

// Builds a fully valid (schema-conformant) empty StoryManifest used both by the
// Studio "Create New Story" flow and by tests. Kept framework-free (no React/Next
// imports) so it can be consumed from node:test runners.
export function getEmptyStoryManifest(language: 'en' | 'fa'): StoryManifest {
  const ts = Date.now().toString(36);
  return {
    id: `story_${ts}`,
    title: language === 'fa' ? 'داستان جدید' : 'New Story',
    tagline: language === 'fa' ? 'خلاصه‌ای کوتاه از ماجرا...' : 'A brief tale synopsis...',
    synopsis: language === 'fa' ? 'روایت شگفت‌انگیزی که در دل تاریکی آغاز می‌شود.' : 'An untold saga waiting to unfold in the darkness.',
    genres: [],
    language,
    coverImageUrl: '',
    author: 'StoryForge Author',
    version: '0.1.0',
    published: false,
    rpgSystem: {
      hasCombat: true,
      diceType: 'd20',
      stats: [
        { id: 'might', name: language === 'fa' ? 'نیرو' : 'Might', description: '', baseValue: 3, minValue: 1, maxValue: 10 },
        { id: 'cunning', name: language === 'fa' ? 'هوش' : 'Cunning', description: '', baseValue: 3, minValue: 1, maxValue: 10 },
        { id: 'arcana', name: language === 'fa' ? 'جادو' : 'Arcana', description: '', baseValue: 2, minValue: 1, maxValue: 10 },
        { id: 'agility', name: language === 'fa' ? 'چابکی' : 'Agility', description: '', baseValue: 3, minValue: 1, maxValue: 10 },
      ],
      resources: [
        { id: 'health', name: language === 'fa' ? 'سلامت' : 'Health', current: 20, max: 30, min: 0, color: '#EF4444' },
        { id: 'resolve', name: language === 'fa' ? 'عزم' : 'Resolve', current: 10, max: 20, min: 0, color: '#3B82F6' },
      ],
      skills: [],
      startingInventory: [],
      inventoryCapacity: 12,
      archetypes: [],
      backgrounds: [],
    },
    worldBible: {
      worldId: `world_${ts}`,
      worldName: language === 'fa' ? 'جهان بی‌نام' : 'Unnamed Realm',
      summary: language === 'fa' ? 'سرزمینی ناشناخته که منتظر خلق شدن است.' : 'An uncharted realm awaiting creation.',
      themeNotes: language === 'fa' ? 'فضایی تاریک و رازآلود.' : 'Dark and mysterious atmosphere.',
      laws: [],
      factions: [],
      locations: [],
      timeline: [],
      npcs: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      dramaBonds: [],
    },
    initialSceneId: `scene_${ts}_1`,
    initialStoryBeats: [
      {
        sceneId: `scene_${ts}_1`,
        locationId: '',
        narrativeText: language === 'fa' ? 'نقطه شروع داستان. اینجا روایت آغاز می‌شود...' : 'The story begins here. Write the opening narrative...',
        choices: [],
      },
    ],
  };
}
