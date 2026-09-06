'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  StoryManifest,
  WorldBible,
  RPGSystemSchema,
  NPCDossier,
  WorldLaw,
  Faction,
  WorldLocation,
  CustomRelationType,
  CustomPlaceCategory,
  CustomLawCategory,
  CustomNPCRole,
  CustomDomain,
  CustomLoreRelation,
  WorldOntology,
  TimelineEvent,
  WorldArtifact,
  WorldCreature,
  WorldDeity,
  NPCDramaBond,
  SagaManifest,
  FactionRelation,
  FactionRelationValue,
  deriveLegacyFactionLinks,
} from '@/lib/types';
import { mergeFactionRelations, syncLegacyFactionLinks } from '@/lib/engines/world/factionRelations';
import type { WorldActionChange } from '@/lib/engines/world/oracleActions';
import { getEmptyStoryInWorld } from '@/lib/storyFactory';
import { notify } from '@/lib/notify';

// Resolve a reference (entity id OR human-readable name) to the canonical
// stored entity id. Used by relation CRUD so links created by the AI adviser
// (which often references entities by name) still bind to the right node.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function resolveEntityRef(wb: WorldBible, ref: string): string {
  if (!ref) return ref;
  const arrays: any[] = [
    wb.locations,
    wb.npcs,
    wb.factions,
    wb.artifacts,
    wb.bestiary,
    wb.religions,
    wb.laws,
    wb.timeline,
  ];
  const nameFields = ['name', 'name', 'name', 'name', 'name', 'name', 'rule', 'title'];
  const low = ref.toLowerCase();
  for (let i = 0; i < arrays.length; i++) {
    const arr: any[] = arrays[i] || [];
    for (const e of arr) {
      if (e.id === ref) return ref;
    }
  }
  for (let i = 0; i < arrays.length; i++) {
    const arr: any[] = arrays[i] || [];
    const nf = nameFields[i];
    for (const e of arr) {
      if ((e[nf] || '').toLowerCase() === low) return e.id;
    }
  }
  return ref;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function getDefaultOntology(isPersian: boolean): WorldOntology {
  return {
    relationTypes: [
      {
        id: 'path',
        name: isPersian ? 'مسیر ارتباطی' : 'Travel Path',
        description: isPersian ? 'مسیر فیزیکی یا رفت‌وآمد متصل میان دو مکان' : 'Direct physical or navigable corridor between locations',
        sourceCategory: 'location',
        targetCategory: 'location',
        color: '#38BDF8',
        isDirected: false,
        isDefault: true,
      },
      {
        id: 'residence',
        name: isPersian ? 'محل استقرار' : 'Stationed At',
        description: isPersian ? 'مکان فعلی حضور یا اقامت شخصیت' : 'Current active residence or post of an NPC',
        sourceCategory: 'npc',
        targetCategory: 'location',
        color: '#F59E0B',
        isDirected: true,
        isDefault: true,
      },
      {
        id: 'faction_ally',
        name: isPersian ? 'هم‌پیمان رسمی' : 'Treaty Alliance',
        description: isPersian ? 'پیمان صلح یا هم‌پیمانی نظامی بین دو جناح' : 'Official mutual treaty or pact between factions',
        sourceCategory: 'faction',
        targetCategory: 'faction',
        color: '#10B981',
        isDirected: false,
        isDefault: true,
      },
      {
        id: 'ally',
        name: isPersian ? 'عضو ارشد جناح' : 'Faction Member',
        description: isPersian ? 'عضویت رسمی یا رهبری شخصیت در یک جناح' : 'Allegiance or leadership of an NPC in a faction',
        sourceCategory: 'npc',
        targetCategory: 'faction',
        color: '#818CF8',
        isDirected: true,
        isDefault: true,
      },
      {
        id: 'territory',
        name: isPersian ? 'قلمرو حاکمیت' : 'Controls Territory',
        description: isPersian ? 'مکان تحت کنترل نظامی یا سیاسی جناح' : 'Location under political control of a faction',
        sourceCategory: 'faction',
        targetCategory: 'location',
        color: '#A855F7',
        isDirected: true,
        isDefault: true,
      },
      {
        id: 'rival',
        name: isPersian ? 'دشمن خونی' : 'Rival Enemy',
        description: isPersian ? 'خصومت آشکار یا جنگ سرد میان دو جناح' : 'Active hostility or blood feud between factions',
        sourceCategory: 'faction',
        targetCategory: 'faction',
        color: '#EF4444',
        isDirected: false,
        isDefault: true,
      },
      {
        id: 'blood_debt',
        name: isPersian ? 'بدهکار خونی / انتقام' : 'Blood Debt / Vendetta',
        description: isPersian ? 'سوگند انتقام یا بدهی مرگبار میان دو موجودیت' : 'Deadly vendetta or unpayable life debt',
        sourceCategory: 'any',
        targetCategory: 'any',
        color: '#E11D48',
        isDirected: true,
      },
      {
        id: 'mentor_apprentice',
        name: isPersian ? 'استاد و شاگرد' : 'Mentor & Apprentice',
        description: isPersian ? 'رابطه انتقال دانش و مهارت‌های کهن' : 'Pedagogical bond of shared esoteric knowledge',
        sourceCategory: 'npc',
        targetCategory: 'npc',
        color: '#F97316',
        isDirected: true,
      },
    ],
    placeCategories: [
      { id: 'stronghold', name: isPersian ? 'دژ و قلعه باستانی' : 'Stronghold / Citadel', description: isPersian ? 'استحکامات نظامی و مقر فرماندهی' : 'Fortified citadel or military command post', color: '#6366F1', isDefault: true },
      { id: 'dungeon', name: isPersian ? 'سیاه‌چال و دخمه' : 'Dungeon / Vault', description: isPersian ? 'سلول‌های سنگی، راهروهای تاریک و سرداب' : 'Subterranean cells, torture pits, or vaults', color: '#EC4899', isDefault: true },
      { id: 'ruins', name: isPersian ? 'خرابه‌ها و معابد کهن' : 'Ancient Ruins & Shrines', description: isPersian ? 'بقایای تمدن‌های پیشین و محراب‌های جادو' : 'Remnants of fallen eras and forgotten altars', color: '#14B8A6', isDefault: true },
      { id: 'settlement', name: isPersian ? 'شهرک و بازار' : 'Settlement / Outpost', description: isPersian ? 'تجمع مدنی، اسکله بازرگانان یا بازارچه' : 'Civilian hubs, trading posts, or inns', color: '#F59E0B', isDefault: true },
      { id: 'wilderness', name: isPersian ? 'طبیعت وحشی و بیابان' : 'Wilderness / Wastes', description: isPersian ? 'کویر سوزان، جنگل‌های مه‌آلود و مناطق خطرناک' : 'Uncharted wilds, foggy marshes, or badlands', color: '#10B981', isDefault: true },
    ],
    lawCategories: [
      { id: 'magic', name: isPersian ? 'جادو و ماوراءالطبیعه' : 'Magic & Metaphysics', description: isPersian ? 'محدودیت‌ها و بهای استفاده از نیروهای جادویی' : 'Costs and limitations of occult or mystical arts', color: '#A855F7', isDefault: true },
      { id: 'physics', name: isPersian ? 'فیزیک و قوانین ماده' : 'Physics & Materials', description: isPersian ? 'ویژگی فلزات، سموم و محدودیت‌های فیزیکی' : 'Physical constants, metallurgy, and natural limits', color: '#38BDF8', isDefault: true },
      { id: 'society', name: isPersian ? 'جامعه و احکام درباری' : 'Society & Decrees', description: isPersian ? 'قوانین طبقاتی، احکام اشرافی و سنت‌ها' : 'Edicts, taboos, and feudal hierarchy', color: '#F59E0B', isDefault: true },
      { id: 'creatures', name: isPersian ? 'موجودات و هیولاها' : 'Creatures & Beasts', description: isPersian ? 'وضعیت بقا و رفتارهای زیستی هیولاها' : 'Extinction status and behavioral laws of monsters', color: '#EF4444', isDefault: true },
      { id: 'technology', name: isPersian ? 'کیمیاگری و فناوری' : 'Alchemy & Tech', description: isPersian ? 'مکانیزم‌های مکانیکی و ترکیب مواد' : 'Clockwork engineering and potion alchemy', color: '#10B981', isDefault: true },
    ],
    npcRoles: [
      { id: 'ruler', name: isPersian ? 'حاکم و اشراف‌زاده' : 'Ruler / Noble', description: isPersian ? 'فرمانروایان، صدراعظم‌ها و صاحبان قدرت' : 'Monarchs, chancellors, and noble heads', color: '#F59E0B', isDefault: true },
      { id: 'guard', name: isPersian ? 'نگهبان و فرمانده نظامی' : 'Guard / Commander', description: isPersian ? 'سربازان، کاپیتان‌ها و محافظان مسلح' : 'Sentries, captains, and military champions', color: '#38BDF8', isDefault: true },
      { id: 'alchemist', name: isPersian ? 'کیمیاگر و ساحر' : 'Alchemist / Mage', description: isPersian ? 'پژوهشگران علوم ممنوعه و داروسازان' : 'Scholars of forbidden arts and brewmasters', color: '#A855F7', isDefault: true },
      { id: 'smuggler', name: isPersian ? 'قاچاقچی و دزد' : 'Smuggler / Rogue', description: isPersian ? 'دلالان بازار سیاه و خرابکاران زیرزمینی' : 'Black market brokers and covert operatives', color: '#EC4899', isDefault: true },
      { id: 'scholar', name: isPersian ? 'مورخ و کاتب' : 'Scholar / Sage', description: isPersian ? 'نگهبانان متون کهن و تاریخ‌نگاران' : 'Keepers of lore, archivists, and advisors', color: '#10B981', isDefault: true },
    ],
    domains: [
      { id: 'light', name: isPersian ? 'نور و داوری' : 'Light & Order', description: isPersian ? 'نظم، حقیقت و قضاوت کیهانی' : 'Order, truth, and cosmic judgment', color: '#F59E0B', isDefault: true },
      { id: 'secrets', name: isPersian ? 'سایه‌ها و اسرار' : 'Shadows & Secrets', description: isPersian ? 'پنهان‌کاری، دانش ممنوعه و رازها' : 'Stealth, forbidden lore, and hidden truths', color: '#A855F7', isDefault: true },
      { id: 'death', name: isPersian ? 'مرگ و ارواح' : 'Death & Rebirth', description: isPersian ? 'گذر روح، میراث و زوال' : 'Soul passage, legacy, and decay', color: '#71717A', isDefault: true },
      { id: 'war', name: isPersian ? 'جنگ و افتخار' : 'War & Conquest', description: isPersian ? 'نبرد، پیروزی و شکوه نظامی' : 'Battle, victory, and martial glory', color: '#EF4444', isDefault: true },
      { id: 'nature', name: isPersian ? 'طبیعت و عناصر' : 'Nature & Elements', description: isPersian ? 'رویش، عناصر خام و چرخه حیات' : 'Growth, raw elements, and the life cycle', color: '#10B981', isDefault: true },
      { id: 'chaos', name: isPersian ? 'آشوب و دگرگونی' : 'Chaos & Change', description: isPersian ? 'دگرگونی، شانس و هرج‌ومرج' : 'Mutation, fortune, and entropy', color: '#EC4899', isDefault: true },
      { id: 'forge', name: isPersian ? 'آهنگری و صنعت' : 'Forge & Metallurgy', description: isPersian ? 'ساخت، فلزکاری و دانش فنی' : 'Craft, smithing, and applied craft', color: '#F97316', isDefault: true },
    ],
  };
}

/**
 * Guarantees every ontology array is present, falling back to defaults for any
 * field missing from persisted/legacy data (e.g. a story saved before `domains`
 * existed would otherwise have `ontology.domains === undefined`).
 */
function normalizeOntology(ont: WorldOntology | undefined, isPersian: boolean): WorldOntology {
  const base = getDefaultOntology(isPersian);
  return {
    relationTypes: ont?.relationTypes ?? base.relationTypes,
    placeCategories: ont?.placeCategories ?? base.placeCategories,
    lawCategories: ont?.lawCategories ?? base.lawCategories,
    npcRoles: ont?.npcRoles ?? base.npcRoles,
    domains: ont?.domains ?? base.domains,
  };
}

export interface StoryListItem {
  id: string;
  title: string;
  tagline: string;
  language: 'en' | 'fa';
  genres: string[];
  coverImageUrl?: string;
  author: string;
  version: string;
  published?: boolean;
  updatedAt?: string;
  /** Shared-world link (many stories per world). Absent = legacy solo story. */
  worldId?: string;
  worldName?: string;
}

export interface WorldListItem {
  id: string;
  name: string;
  summary: string;
  storyCount: number;
  worldBibleVersion: number;
}

interface StudioStoryContextType {
  selectedStoryId: string;
  setSelectedStoryId: (id: string) => void;
  storiesList: StoryListItem[];
  story: StoryManifest;
  isPersian: boolean;
  isRtl: boolean;
  toggleLanguage: () => void;
  hasLocalDraft: boolean;
  lastSaved: Date | null;
  isSyncing: boolean;
  lastServerSynced: Date | null;
  saveToServer: (manifestToSave?: StoryManifest) => Promise<boolean>;
  // Story Registry CRUD
  createStory: (manifest: StoryManifest) => void;
  /** New story shell inside an existing shared world (lore + RPG inherited live). */
  createStoryInWorld: (worldId: string, language?: 'en' | 'fa') => void;
  duplicateStory: (storyId: string) => void;
  deleteStory: (storyId: string) => Promise<void>;
  setStoryPublished: (id: string, published: boolean) => void;
  // Shared worlds
  worldsList: WorldListItem[];
  /** World id of the currently selected story (falls back to story id for legacy). */
  selectedWorldId: string;
  refreshWorlds: () => Promise<void>;
  // Updaters
  updateStoryMeta: (updates: Partial<Pick<StoryManifest, 'title' | 'tagline' | 'synopsis' | 'author' | 'version' | 'genres' | 'language' | 'coverImageUrl' | 'activeMilestoneGoal'>>) => void;
  updateWorldBible: (updater: (prev: WorldBible) => WorldBible) => void;
  updateWorldMeta: (meta: Partial<Pick<WorldBible, 'worldName' | 'summary' | 'themeNotes' | 'aiSystemPrompt'>>) => void;
  // Laws CRUD
  addWorldLaw: (law: WorldLaw) => void;
  editWorldLaw: (id: string, updated: Partial<WorldLaw>) => void;
  deleteWorldLaw: (id: string) => void;
  // Factions CRUD
  addFaction: (faction: Faction & { relations?: any; factionRelations?: any }) => void;
  editFaction: (id: string, updated: Partial<Faction> & { relations?: any; factionRelations?: any }) => void;
  deleteFaction: (id: string) => void;
  setFactionRelation: (
    sourceFactionId: string,
    targetFactionId: string,
    value: FactionRelationValue,
    note?: string,
    isPublic?: boolean
  ) => void;
  deleteFactionRelation: (sourceFactionId: string, targetFactionId: string) => void;
  batchApplyWorldChanges: (changes: WorldActionChange[]) => void;
  // RPG System CRUD
  updateRpgSystem: (updater: (prev: RPGSystemSchema) => RPGSystemSchema) => void;
  // NPCs CRUD
  updateNpcs: (updater: (prev: NPCDossier[]) => NPCDossier[]) => void;
  addNpc: (npc: NPCDossier) => void;
  editNpc: (id: string, updated: Partial<NPCDossier>) => void;
  deleteNpc: (id: string) => void;
  // Locations CRUD
  addLocation: (location: WorldLocation) => void;
  editLocation: (id: string, updated: Partial<WorldLocation>) => void;
  deleteLocation: (id: string) => void;
  // Relations CRUD
  addRelation: (relation: { sourceId: string; targetId: string; relationType: string }) => void;
  deleteRelation: (sourceId: string, targetId: string, relationType: string) => void;
  // Ontology CRUD
  addCustomRelationType: (relType: CustomRelationType) => void;
  editCustomRelationType: (id: string, updated: Partial<CustomRelationType>) => void;
  deleteCustomRelationType: (id: string) => void;
  addPlaceCategory: (category: CustomPlaceCategory) => void;
  editPlaceCategory: (id: string, updated: Partial<CustomPlaceCategory>) => void;
  deletePlaceCategory: (id: string) => void;
  addLawCategory: (category: CustomLawCategory) => void;
  editLawCategory: (id: string, updated: Partial<CustomLawCategory>) => void;
  deleteLawCategory: (id: string) => void;
  addNpcRole: (role: CustomNPCRole) => void;
  editNpcRole: (id: string, updated: Partial<CustomNPCRole>) => void;
  deleteNpcRole: (id: string) => void;
  addDomain: (domain: CustomDomain) => void;
  editDomain: (id: string, updated: Partial<CustomDomain>) => void;
  deleteDomain: (id: string) => void;
  // Timeline CRUD
  addTimelineEvent: (event: TimelineEvent) => void;
  editTimelineEvent: (id: string, updated: Partial<TimelineEvent>) => void;
  deleteTimelineEvent: (id: string) => void;
  // Artifacts CRUD
  addArtifact: (artifact: WorldArtifact) => void;
  editArtifact: (id: string, updated: Partial<WorldArtifact>) => void;
  deleteArtifact: (id: string) => void;
  // Bestiary CRUD
  addCreature: (creature: WorldCreature) => void;
  editCreature: (id: string, updated: Partial<WorldCreature>) => void;
  deleteCreature: (id: string) => void;
  // Religion CRUD
  addDeity: (deity: WorldDeity) => void;
  editDeity: (id: string, updated: Partial<WorldDeity>) => void;
  deleteDeity: (id: string) => void;
  // Drama Bonds CRUD
  addDramaBond: (bond: NPCDramaBond) => void;
  editDramaBond: (id: string, updated: Partial<NPCDramaBond>) => void;
  deleteDramaBond: (id: string) => void;
  // Story Beats CRUD
  updateStoryBeats: (updater: (prev: StoryManifest['initialStoryBeats']) => StoryManifest['initialStoryBeats']) => void;
  // Plan 07: Saga / Multi-Chapter Campaign CRUD
  updateSaga: (updater: (prev?: SagaManifest) => SagaManifest) => void;
  // Global Actions
  resetToDefault: () => Promise<void>;
  exportStoryJson: () => void;
  importStoryJson: (manifest: StoryManifest) => void;
}

const StudioStoryContext = createContext<StudioStoryContextType | undefined>(undefined);

const SELECTED_STORY_KEY = 'storyforge_studio_selected_story_v1';

// Stories that previously shipped as built-in "canonical" samples. They no longer
// exist, but old localStorage selections may still reference their ids.
const REMOVED_CANONICAL_IDS = ['ghale_siahsang', 'obsidian_citadel'];

// Non-persisted placeholder used when no story is selected, so the Studio shell
// (which reads many `story.*` fields) keeps rendering without crashing.
const EMPTY_STORY_PLACEHOLDER: StoryManifest = {
  id: '',
  title: '',
  tagline: '',
  synopsis: '',
  genres: [],
  language: 'en',
  coverImageUrl: '',
  author: '',
  version: '0.0.0',
  published: false,
  rpgSystem: {
    hasCombat: true,
    diceType: 'd20',
    inventoryCapacity: 12,
    stats: [],
    resources: [],
    skills: [],
    startingInventory: [],
    archetypes: [],
    backgrounds: [],
  },
  worldBible: {
    worldId: '',
    worldName: '',
    summary: '',
    themeNotes: '',
    laws: [],
    factions: [],
    locations: [],
    npcs: [],
    timeline: [],
    artifacts: [],
    bestiary: [],
    religions: [],
    dramaBonds: [],
    ontology: getDefaultOntology(false),
  },
  initialSceneId: '',
  initialStoryBeats: [],
};

function getStorageKey(storyId: string) {
  return `storyforge_studio_draft_v1_${storyId}`;
}

export function StudioStoryProvider({ children }: { children: ReactNode }) {
  const [selectedStoryId, setSelectedStoryId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(SELECTED_STORY_KEY);
      if (stored && !REMOVED_CANONICAL_IDS.includes(stored)) return stored;
    } catch {
      // Ignore
    }
    return '';
  });
  const [story, setStory] = useState<StoryManifest>(EMPTY_STORY_PLACEHOLDER);
  const [hasLocalDraft, setHasLocalDraft] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastServerSynced, setLastServerSynced] = useState<Date | null>(null);
  const [customStories, setCustomStories] = useState<StoryListItem[]>([]);
  const [worldsList, setWorldsList] = useState<WorldListItem[]>([]);

  const refreshWorlds = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/worlds');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        setWorldsList(data.data as WorldListItem[]);
      }
    } catch {
      // Server unreachable: worlds grouping falls back to per-story display.
    }
  }, []);

  // Client-only mount gate. The server can't read localStorage, so without this
  // the first paint would show the empty placeholder before the client restores
  // the saved selection — a visible flash on refresh.
  const [mounted, setMounted] = useState<boolean>(false);

  const isPersian = story?.language === 'fa';
  const isRtl = isPersian;

  // Persist the active story selection
  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_STORY_KEY, selectedStoryId);
    } catch {
      // Ignore
    }
  }, [selectedStoryId]);

  // Client-only mount gate (see `mounted` declaration above).
  // Intentional setState-in-effect: flips to true only after the client mounts,
  // so SSR/first paint renders a neutral skeleton instead of the default story.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load custom stories + shared worlds from the server (DB is the source of
  // truth for discovery). Worlds power the library grouping and the
  // "new story in this world" flow; failures fall back to per-story display.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) refreshWorlds();
      try {
        const res = await fetch('/api/studio/stories');
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.success || !Array.isArray(data.data) || cancelled) return;
        const custom = (data.data as any[]).map((s) => ({
          id: s.id,
          title: s.title,
          tagline: s.tagline,
          language: s.language,
          genres: s.genres,
          coverImageUrl: s.coverImageUrl,
          author: s.author,
          version: s.version || '1.0.0',
          published: s.published ?? false,
          worldId: s.worldId || undefined,
          worldName: s.worldName || undefined,
        }));
        if (!cancelled) setCustomStories(custom);
      } catch {
        // Server unreachable: keep empty; localStorage drafts still work.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshWorlds]);

  // Compute unified stories list (server is the source of truth for discovery).
  const storiesList: StoryListItem[] = customStories;

  // World of the currently open story (legacy stories fall back to their own id).
  const selectedWorldId: string =
    story.worldId || story.worldBible?.worldId || selectedStoryId;

  // Load from localStorage on story change.
  // Intentional setState-in-effect: `story` is also mutated in place by ~40 CRUD
  // updaters, so a pure useSyncExternalStore/external-store pattern is impractical.
  // This only fires when `selectedStoryId` changes, not on every commit.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;

    // No story selected → show the empty placeholder (friendly empty state).
    if (!selectedStoryId) {
      setStory(EMPTY_STORY_PLACEHOLDER);
      setHasLocalDraft(false);
      setLastSaved(null);
      return;
    }

    try {
      const key = getStorageKey(selectedStoryId);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.worldBible.ontology) {
          parsed.worldBible.ontology = getDefaultOntology(parsed.language === 'fa');
        }
        setStory(parsed);
        setHasLocalDraft(true);
        setLastSaved(new Date());
        return;
      }
    } catch {
      // fall through to server load
    }

    // No local draft → load from server (DB is the source of truth; enables
    // cross-browser sharing of stories created on another device).
    (async () => {
      try {
        const res = await fetch(
          `/api/studio/story?storyId=${encodeURIComponent(selectedStoryId)}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.success && data?.data && !cancelled) {
          const m = data.data as StoryManifest;
          if (!m.worldBible?.ontology) {
            m.worldBible = m.worldBible || ({} as any);
            m.worldBible.ontology = getDefaultOntology(m.language === 'fa');
          }
          setStory(m);
          setHasLocalDraft(false);
          setLastSaved(null);
        }
      } catch {
        if (!cancelled) {
          setStory(EMPTY_STORY_PLACEHOLDER);
          setHasLocalDraft(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedStoryId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Create New Story
  const createStory = useCallback(
    (newStory: StoryManifest) => {
      const key = getStorageKey(newStory.id);
      localStorage.setItem(key, JSON.stringify(newStory));

      const newListItem: StoryListItem = {
        id: newStory.id,
        title: newStory.title,
        tagline: newStory.tagline,
        language: newStory.language,
        genres: newStory.genres,
        coverImageUrl: newStory.coverImageUrl,
        author: newStory.author,
        version: newStory.version,
        published: false,
        updatedAt: new Date().toISOString(),
        worldId: newStory.worldId || newStory.worldBible?.worldId || undefined,
      };

      // Persist to the server (DB is the source of truth).
      saveToServer(newStory);
      refreshWorlds();

      // Keep the in-memory custom list in sync without a round-trip.
      setCustomStories((prev) => [...prev.filter((s) => s.id !== newStory.id), newListItem]);

      setSelectedStoryId(newStory.id);
      setStory(newStory);
      setHasLocalDraft(true);
      setLastSaved(new Date());
      notify.success(isPersian ? `داستان "${newStory.title}" با موفقیت ایجاد شد` : `Story "${newStory.title}" created`);
    },
    [isPersian, refreshWorlds]
  );

  // Duplicate Story
  const duplicateStory = useCallback(
    async (targetStoryId: string) => {
      let sourceManifest: StoryManifest | null = null;
      try {
        const stored = localStorage.getItem(getStorageKey(targetStoryId));
        if (stored) {
          sourceManifest = JSON.parse(stored);
        }
      } catch {
        sourceManifest = null;
      }

      if (!sourceManifest) {
        // Fall back to fetching the manifest from the server.
        try {
          const res = await fetch(
            `/api/studio/story?storyId=${encodeURIComponent(targetStoryId)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.data) {
              sourceManifest = data.data as StoryManifest;
            }
          }
        } catch {
          sourceManifest = null;
        }
      }

      if (!sourceManifest) {
        notify.error(isPersian ? 'داستان مورد نظر یافت نشد' : 'Target story not found');
        return;
      }

      const timestamp = Date.now().toString(36);
      const newId = `story_${timestamp}`;
      // Shared live world: the duplicate stays on the SAME world (lore + RPG
      // inherited live). Only the story shell (beats/saga/meta) is copied.
      // Use world fork (API /api/studio/worlds) to diverge the universe itself.
      const worldId =
        sourceManifest.worldId || sourceManifest.worldBible.worldId;
      const cloned: StoryManifest = {
        ...sourceManifest,
        id: newId,
        worldId,
        title: `${sourceManifest.title} (${isPersian ? 'رونوشت' : 'Copy'})`,
        published: false,
        worldBibleVersion: sourceManifest.worldBibleVersion,
        worldBibleHistory: sourceManifest.worldBibleHistory,
        initialSceneId: `scene_${timestamp}_1`,
      };

      createStory(cloned);
      notify.success(isPersian ? 'رونوشت داستان با موفقیت ایجاد شد' : 'Story duplicated successfully');
    },
    [createStory, isPersian]
  );

  // New story shell inside an existing shared world (lore + RPG inherited live).
  const createStoryInWorld = useCallback(
    async (worldId: string, language?: 'en' | 'fa') => {
      const lang = language || story.language || 'en';
      // Prefer the in-memory world when it is already open; otherwise fetch it.
      let worldBible = story.worldBible;
      let rpgSystem = story.rpgSystem;
      const openWorldId = story.worldId || story.worldBible?.worldId;
      if (openWorldId !== worldId || !worldBible?.worldName) {
        try {
          const res = await fetch(
            `/api/studio/worlds?worldId=${encodeURIComponent(worldId)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.data?.worldBible) {
              const manifest = await (async () => {
                // Reuse the composed story fetch so RPG comes along for free.
                const stories: StoryListItem[] = storiesList;
                const sibling = stories.find(
                  (s) => s.worldId === worldId || s.id === worldId
                );
                if (!sibling) return null;
                const r = await fetch(
                  `/api/studio/story?storyId=${encodeURIComponent(sibling.id)}`
                );
                if (!r.ok) return null;
                const d = await r.json();
                return (d?.success ? d.data : null) as StoryManifest | null;
              })();
              worldBible = data.data.worldBible;
              rpgSystem = manifest?.rpgSystem || rpgSystem;
            }
          }
        } catch {
          // fall through to in-memory world below
        }
      }
      if (!worldBible?.worldName) {
        notify.error(isPersian ? 'جهان مورد نظر یافت نشد' : 'Target world not found');
        return;
      }
      const shell = getEmptyStoryInWorld(
        { worldId, worldBible, rpgSystem },
        lang
      );
      createStory(shell);
    },
    [createStory, isPersian, storiesList, story]
  );

  // Delete Story
  const deleteStory = useCallback(
    async (targetStoryId: string) => {
      const confirmed = await notify.confirm({
        title: isPersian ? 'حذف داستان از استودیو' : 'Delete Story Manifest',
        message: isPersian
          ? 'آیا از حذف کامل این داستان اطمینان دارید؟ (جهان مشترک و داستان‌های دیگر حفظ می‌شوند.)'
          : 'Permanently delete this story? (The shared world and sibling stories are kept.)',
        confirmText: isPersian ? 'بله، حذف شود' : 'Delete Permanently',
        cancelText: isPersian ? 'انصراف' : 'Cancel',
        isDestructive: true,
      });

      if (confirmed) {
        localStorage.removeItem(getStorageKey(targetStoryId));

        // Remove from the server (DB is the source of truth).
        // Note: only the story shell is deleted — the shared world survives.
        try {
          await fetch(`/api/studio/story?storyId=${encodeURIComponent(targetStoryId)}`, {
            method: 'DELETE',
          });
        } catch {
          // ignore network errors; local state updated below regardless
        }

        // Keep the in-memory custom list in sync.
        setCustomStories((prev) => prev.filter((s) => s.id !== targetStoryId));
        refreshWorlds();

        if (selectedStoryId === targetStoryId) {
          setSelectedStoryId('');
        }
        notify.info(isPersian ? 'داستان با موفقیت حذف شد' : 'Story deleted');
      }
    },
    [isPersian, selectedStoryId, refreshWorlds]
  );

  // Direct backend sync helper
  const saveToServer = useCallback(
    async (manifestToSave?: StoryManifest) => {
      const target = manifestToSave || story;
      if (!target || !target.id) return false;
      setIsSyncing(true);
      try {
        const res = await fetch('/api/studio/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyManifest: target }),
        });
        const data = await res.json();
        if (data.success) {
          setLastServerSynced(new Date());
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to sync story to backend API:', err);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [story]
  );

  const setStoryPublished = useCallback(
    (id: string, published: boolean) => {
      // Keep the in-memory list in sync immediately.
      setCustomStories((prev) =>
        prev.map((s) => (s.id === id ? { ...s, published } : s))
      );

      // Persist the published flag on the full manifest (DB is the source of truth).
      (async () => {
        let manifest: StoryManifest | null = null;
        try {
          const stored = localStorage.getItem(getStorageKey(id));
          if (stored) manifest = JSON.parse(stored);
        } catch {
          manifest = null;
        }
        if (!manifest) {
          try {
            const res = await fetch(
              `/api/studio/story?storyId=${encodeURIComponent(id)}`
            );
            if (res.ok) {
              const data = await res.json();
              if (data?.success && data?.data) {
                manifest = data.data as StoryManifest;
              }
            }
          } catch {
            manifest = null;
          }
        }
        if (manifest) {
          saveToServer({ ...manifest, published });
        }
      })();
    },
    [saveToServer]
  );

  // Persist helper (writes to localStorage and syncs with server API)
  const persistToStorage = useCallback(
    (newStory: StoryManifest) => {
      try {
        const key = getStorageKey(newStory.id || selectedStoryId);
        localStorage.setItem(key, JSON.stringify(newStory));
        setHasLocalDraft(true);
        setLastSaved(new Date());
        // Fire network request to backend API
        saveToServer(newStory);
      } catch (e) {
        console.error('Failed to auto-save story draft', e);
      }
    },
    [selectedStoryId, saveToServer]
  );

  const toggleLanguage = () => {
    setStory((prev) => ({ ...prev, language: prev.language === 'fa' ? 'en' : 'fa' } as StoryManifest));
  };

  // Story Meta updater
  const updateStoryMeta = useCallback(
    (
      updates: Partial<
        Pick<
          StoryManifest,
          'title' | 'tagline' | 'synopsis' | 'author' | 'version' | 'genres' | 'language' | 'coverImageUrl' | 'activeMilestoneGoal'
        >
      >
    ) => {
      setStory((prev) => {
        const updated = { ...prev, ...updates };
        persistToStorage(updated);
        return updated;
      });
      notify.success(isPersian ? 'اطلاعات داستان ذخیره شد' : 'Story metadata updated');
    },
    [isPersian, persistToStorage]
  );

  // World Bible updater
  const updateWorldBible = useCallback(
    (updater: (prev: WorldBible) => WorldBible) => {
      setStory((prev) => {
        const updatedWorld = updater(prev.worldBible);
        const updated = { ...prev, worldBible: updatedWorld };
        persistToStorage(updated);
        return updated;
      });
    },
    [persistToStorage]
  );

  const updateWorldMeta = useCallback(
    (meta: Partial<Pick<WorldBible, 'worldName' | 'summary' | 'themeNotes'>>) => {
      updateWorldBible((prev) => ({ ...prev, ...meta }));
      notify.success(isPersian ? 'مشخصات جهان به‌روز شد' : 'World metadata updated');
    },
    [isPersian, updateWorldBible]
  );

  // Laws CRUD
  const addWorldLaw = useCallback(
    (law: WorldLaw) => {
      updateWorldBible((prev) => {
        if (prev.laws.some((l) => l.id === law.id)) return prev;
        return {
          ...prev,
          laws: [...prev.laws, law],
        };
      });
      notify.success(isPersian ? 'قانون جدید با موفقیت اضافه شد' : 'New world law added');
    },
    [isPersian, updateWorldBible]
  );

  const editWorldLaw = useCallback(
    (id: string, updated: Partial<WorldLaw>) => {
      updateWorldBible((prev) => ({
        ...prev,
        laws: prev.laws.map((l) => (l.id === id ? { ...l, ...updated } : l)),
      }));
      notify.success(isPersian ? 'قانون جهان به‌روزرسانی شد' : 'World law updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteWorldLaw = useCallback(
    (id: string) => {
      updateWorldBible((prev) => ({
        ...prev,
        laws: prev.laws.filter((l) => l.id !== id),
      }));
      notify.info(isPersian ? 'قانون حذف شد' : 'World law deleted');
    },
    [isPersian, updateWorldBible]
  );

  // Factions CRUD
  const addFaction = useCallback(
    (faction: Faction & { relations?: any; factionRelations?: any }) => {
      updateWorldBible((prev) => {
        if (prev.factions.some((f) => f.id === faction.id)) return prev;

        const cleanFaction = { ...faction };
        delete (cleanFaction as any).relations;
        delete (cleanFaction as any).factionRelations;

        const allFactionsWithNew = [...prev.factions, cleanFaction];
        const nextRelations = mergeFactionRelations(
          faction.id,
          faction,
          allFactionsWithNew,
          prev.factionRelations || [],
          { deities: prev.religions, autoProvision: true }
        );
        const autoCreated = ((nextRelations as any).autoCreatedFactions as Faction[]) || [];
        const combinedFactions = autoCreated.length > 0 ? [...allFactionsWithNew, ...autoCreated] : allFactionsWithNew;
        const syncedFactions = syncLegacyFactionLinks(combinedFactions, nextRelations);

        return {
          ...prev,
          factions: syncedFactions,
          factionRelations: nextRelations,
        };
      });
      notify.success(isPersian ? 'جناح جدید افزوده شد' : 'New faction registered');
    },
    [isPersian, updateWorldBible]
  );

  const editFaction = useCallback(
    (id: string, updated: Partial<Faction> & { relations?: any; factionRelations?: any }) => {
      updateWorldBible((prev) => {
        const nextRelations = mergeFactionRelations(
          id,
          updated,
          prev.factions,
          prev.factionRelations || [],
          { deities: prev.religions, autoProvision: true }
        );
        const autoCreated = ((nextRelations as any).autoCreatedFactions as Faction[]) || [];

        const updatedFactions = prev.factions.map((f) => {
          if (f.id === id) {
            const merged = { ...f, ...updated };
            delete (merged as any).relations;
            delete (merged as any).factionRelations;
            return merged;
          }
          return f;
        });

        const combinedFactions = autoCreated.length > 0 ? [...updatedFactions, ...autoCreated] : updatedFactions;
        const syncedFactions = syncLegacyFactionLinks(combinedFactions, nextRelations);

        return {
          ...prev,
          factions: syncedFactions,
          factionRelations: nextRelations,
        };
      });
      notify.success(isPersian ? 'مشخصات جناح ذخیره شد' : 'Faction updated');
    },
    [isPersian, updateWorldBible]
  );

  const editDeity = useCallback(
    (id: string, updated: Partial<WorldDeity>) => {
      updateWorldBible((prev) => ({
        ...prev,
        religions: (prev.religions || []).map((d) => (d.id === id ? { ...d, ...updated } : d)),
      }));
      notify.success(isPersian ? 'مشخصات ایزد به‌روز شد' : 'Deity updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteFaction = useCallback(
    (id: string) => {
      updateWorldBible((prev) => {
        const remainingFactions = prev.factions.filter((f) => f.id !== id);
        const updatedRelations = (prev.factionRelations || []).filter(
          (r) => r.sourceFactionId !== id && r.targetFactionId !== id
        );
        const links = deriveLegacyFactionLinks(updatedRelations);
        const syncedFactions = remainingFactions.map((f) => {
          const link = links.get(f.id);
          return {
            ...f,
            alliedFactionIds: link ? Array.from(new Set(link.allies)) : (f.alliedFactionIds || []).filter((aid) => aid !== id),
            rivalFactionIds: link ? Array.from(new Set(link.rivals)) : (f.rivalFactionIds || []).filter((rid) => rid !== id),
          };
        });

        return {
          ...prev,
          factions: syncedFactions,
          factionRelations: updatedRelations,
        };
      });
      notify.info(isPersian ? 'جناح حذف شد' : 'Faction removed');
    },
    [isPersian, updateWorldBible]
  );

  const setFactionRelation = useCallback(
    (
      sourceFactionId: string,
      targetFactionId: string,
      value: FactionRelationValue,
      note?: string,
      isPublic: boolean = true
    ) => {
      updateWorldBible((prev) => {
        const existingRelations = prev.factionRelations || [];
        const matchIdx = existingRelations.findIndex(
          (r) =>
            (r.sourceFactionId === sourceFactionId && r.targetFactionId === targetFactionId) ||
            (r.sourceFactionId === targetFactionId && r.targetFactionId === sourceFactionId)
        );

        let updatedRelations: FactionRelation[];
        if (matchIdx >= 0) {
          const updatedItem: FactionRelation = {
            ...existingRelations[matchIdx],
            sourceFactionId,
            targetFactionId,
            value,
            note: note !== undefined ? note : existingRelations[matchIdx].note,
            isPublic: isPublic !== undefined ? isPublic : existingRelations[matchIdx].isPublic ?? true,
          };
          updatedRelations = [...existingRelations];
          updatedRelations[matchIdx] = updatedItem;
        } else {
          const newItem: FactionRelation = {
            id: `frel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            sourceFactionId,
            targetFactionId,
            value,
            note: note || '',
            isPublic,
          };
          updatedRelations = [...existingRelations, newItem];
        }

        const links = deriveLegacyFactionLinks(updatedRelations);
        const syncedFactions = prev.factions.map((f) => {
          const link = links.get(f.id);
          return {
            ...f,
            alliedFactionIds: link ? Array.from(new Set(link.allies)) : [],
            rivalFactionIds: link ? Array.from(new Set(link.rivals)) : [],
          };
        });

        return {
          ...prev,
          factions: syncedFactions,
          factionRelations: updatedRelations,
        };
      });
    },
    [updateWorldBible]
  );

  const deleteFactionRelation = useCallback(
    (sourceFactionId: string, targetFactionId: string) => {
      updateWorldBible((prev) => {
        const updatedRelations = (prev.factionRelations || []).filter(
          (r) =>
            !(
              (r.sourceFactionId === sourceFactionId && r.targetFactionId === targetFactionId) ||
              (r.sourceFactionId === targetFactionId && r.targetFactionId === sourceFactionId)
            )
        );
        const links = deriveLegacyFactionLinks(updatedRelations);
        const syncedFactions = prev.factions.map((f) => {
          const link = links.get(f.id);
          return {
            ...f,
            alliedFactionIds: link ? Array.from(new Set(link.allies)) : [],
            rivalFactionIds: link ? Array.from(new Set(link.rivals)) : [],
          };
        });

        return {
          ...prev,
          factions: syncedFactions,
          factionRelations: updatedRelations,
        };
      });
    },
    [updateWorldBible]
  );

  const batchApplyWorldChanges = useCallback(
    (changes: WorldActionChange[]) => {
      if (!changes.length) return;
      updateWorldBible((prev) => {
        const laws = [...(prev.laws || [])];
        let factions = [...(prev.factions || [])];
        let factionRelations = [...(prev.factionRelations || [])];
        let locations = [...(prev.locations || [])];
        let npcs = [...(prev.npcs || [])];
        let artifacts = [...(prev.artifacts || [])];
        let bestiary = [...(prev.bestiary || [])];
        let religions = [...(prev.religions || [])];
        let timeline = [...(prev.timeline || [])];

        for (const c of changes) {
          if (c.entity === 'faction') {
            if (c.op === 'create') {
              const clean = { ...c.newData };
              delete (clean as any).relations;
              delete (clean as any).factionRelations;
              if (!factions.some((f) => f.id === clean.id)) {
                factions.push(clean);
              }
              const nextRelations = mergeFactionRelations(
                clean.id,
                c.newData,
                factions,
                factionRelations,
                { deities: religions, autoProvision: true }
              );
              factionRelations = nextRelations;
              const autoCreated = ((nextRelations as any).autoCreatedFactions as Faction[]) || [];
              if (autoCreated.length > 0) {
                factions.push(...autoCreated);
              }
            } else if (c.op === 'delete') {
              factions = factions.filter((f) => f.id !== c.targetId);
              factionRelations = factionRelations.filter(
                (r) => r.sourceFactionId !== c.targetId && r.targetFactionId !== c.targetId
              );
            } else if (c.op === 'update') {
              const nextRelations = mergeFactionRelations(
                c.targetId!,
                c.newData,
                factions,
                factionRelations,
                { deities: religions, autoProvision: true }
              );
              factionRelations = nextRelations;
              const autoCreated = ((nextRelations as any).autoCreatedFactions as Faction[]) || [];

              factions = factions.map((f) => {
                if (f.id === c.targetId) {
                  const merged = { ...f, ...c.newData };
                  delete (merged as any).relations;
                  delete (merged as any).factionRelations;
                  return merged;
                }
                return f;
              });
              if (autoCreated.length > 0) {
                factions.push(...autoCreated);
              }
            }
            factions = syncLegacyFactionLinks(factions, factionRelations);
          } else if (c.entity === 'location') {
            if (c.op === 'create') {
              if (!locations.some((l) => l.id === c.newData.id)) locations.push(c.newData);
            } else if (c.op === 'delete') {
              locations = locations
                .filter((l) => l.id !== c.targetId)
                .map((l) => (l.parentLocationId === c.targetId ? { ...l, parentLocationId: undefined } : l));
            } else if (c.op === 'update') {
              locations = locations.map((l) => (l.id === c.targetId ? { ...l, ...c.newData } : l));
            }
          } else if (c.entity === 'npc') {
            if (c.op === 'create') {
              if (!npcs.some((n) => n.id === c.newData.id)) npcs.push(c.newData);
            } else if (c.op === 'delete') {
              npcs = npcs.filter((n) => n.id !== c.targetId);
            } else if (c.op === 'update') {
              npcs = npcs.map((n) => (n.id === c.targetId ? { ...n, ...c.newData } : n));
            }
          } else if (c.entity === 'artifact') {
            if (c.op === 'create') {
              if (!artifacts.some((a) => a.id === c.newData.id)) artifacts.push(c.newData);
            } else if (c.op === 'delete') {
              artifacts = artifacts.filter((a) => a.id !== c.targetId);
            } else if (c.op === 'update') {
              artifacts = artifacts.map((a) => (a.id === c.targetId ? { ...a, ...c.newData } : a));
            }
          } else if (c.entity === 'creature') {
            if (c.op === 'create') {
              if (!bestiary.some((b) => b.id === c.newData.id)) bestiary.push(c.newData);
            } else if (c.op === 'delete') {
              bestiary = bestiary.filter((b) => b.id !== c.targetId);
            } else if (c.op === 'update') {
              bestiary = bestiary.map((b) => (b.id === c.targetId ? { ...b, ...c.newData } : b));
            }
          } else if (c.entity === 'deity') {
            if (c.op === 'create') {
              if (!religions.some((r) => r.id === c.newData.id)) religions.push(c.newData);
            } else if (c.op === 'delete') {
              religions = religions.filter((r) => r.id !== c.targetId);
            } else if (c.op === 'update') {
              religions = religions.map((r) => (r.id === c.targetId ? { ...r, ...c.newData } : r));
            }
          } else if (c.entity === 'timeline_event') {
            if (c.op === 'create') {
              if (!timeline.some((t) => t.id === c.newData.id)) timeline.push(c.newData);
            } else if (c.op === 'delete') {
              timeline = timeline.filter((t) => t.id !== c.targetId);
            } else if (c.op === 'update') {
              timeline = timeline.map((t) => (t.id === c.targetId ? { ...t, ...c.newData } : t));
            }
          } else if (c.entity === 'world_law') {
            if (c.op === 'create') {
              if (!laws.some((l) => l.id === c.newData.id)) laws.push(c.newData);
            } else if (c.op === 'delete') {
              const targetIdx = laws.findIndex((l) => l.id === c.targetId);
              if (targetIdx >= 0) laws.splice(targetIdx, 1);
            } else if (c.op === 'update') {
              const targetIdx = laws.findIndex((l) => l.id === c.targetId);
              if (targetIdx >= 0) laws[targetIdx] = { ...laws[targetIdx], ...c.newData };
            }
          }
        }

        return {
          ...prev,
          laws,
          factions,
          factionRelations,
          locations,
          npcs,
          artifacts,
          bestiary,
          religions,
          timeline,
        };
      });
      notify.success(
        isPersian ? `${changes.length} تغییر با موفقیت اعمال شد` : `Applied ${changes.length} change(s)`
      );
    },
    [isPersian, updateWorldBible]
  );

  // RPG System CRUD
  const updateRpgSystem = useCallback(
    (updater: (prev: RPGSystemSchema) => RPGSystemSchema) => {
      setStory((prev) => {
        const updatedRpg = updater(prev.rpgSystem);
        const updated = { ...prev, rpgSystem: updatedRpg };
        persistToStorage(updated);
        return updated;
      });
    },
    [persistToStorage]
  );

  // NPCs CRUD
  const updateNpcs = useCallback(
    (updater: (prev: NPCDossier[]) => NPCDossier[]) => {
      updateWorldBible((prev) => ({
        ...prev,
        npcs: updater(prev.npcs),
      }));
    },
    [updateWorldBible]
  );

  const addNpc = useCallback(
    (npc: NPCDossier) => {
      updateNpcs((prev) => {
        if (prev.some((n) => n.id === npc.id)) return prev;
        return [...prev, npc];
      });
      notify.success(isPersian ? 'شخصیت جدید با موفقیت ثبت شد' : 'New NPC dossier added');
    },
    [isPersian, updateNpcs]
  );

  const editNpc = useCallback(
    (id: string, updated: Partial<NPCDossier>) => {
      updateNpcs((prev) => prev.map((n) => (n.id === id ? { ...n, ...updated } : n)));
      notify.success(isPersian ? 'پرونده شخصیت ذخیره شد' : 'NPC dossier updated');
    },
    [isPersian, updateNpcs]
  );

  const deleteNpc = useCallback(
    (id: string) => {
      updateNpcs((prev) => prev.filter((n) => n.id !== id));
      notify.info(isPersian ? 'شخصیت حذف شد' : 'NPC removed');
    },
    [isPersian, updateNpcs]
  );

  // Locations CRUD
  const updateLocations = useCallback(
    (updater: (prev: WorldLocation[]) => WorldLocation[]) => {
      updateWorldBible((prev) => ({
        ...prev,
        locations: updater(prev.locations || []),
      }));
    },
    [updateWorldBible]
  );

  const addLocation = useCallback(
    (location: WorldLocation) => {
      updateLocations((prev) => {
        if (prev.some((l) => l.id === location.id)) return prev;
        return [...prev, location];
      });
      notify.success(isPersian ? 'مکان جدید با موفقیت ثبت شد' : 'New location registered');
    },
    [isPersian, updateLocations]
  );

  const editLocation = useCallback(
    (id: string, updated: Partial<WorldLocation>) => {
      updateLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
      notify.success(isPersian ? 'مشخصات مکان ذخیره شد' : 'Location updated');
    },
    [isPersian, updateLocations]
  );

  const deleteLocation = useCallback(
    (id: string) => {
      updateLocations((prev) =>
        prev
          .filter((l) => l.id !== id)
          .map((l) => (l.parentLocationId === id ? { ...l, parentLocationId: undefined } : l))
      );
      notify.info(isPersian ? 'مکان حذف شد' : 'Location removed');
    },
    [isPersian, updateLocations]
  );

  // Relations CRUD
  const addRelation = useCallback(
    (relation: { sourceId: string; targetId: string; relationType: string }) => {
      const { relationType } = relation;
      const sourceId = resolveEntityRef(story.worldBible, relation.sourceId);
      const targetId = resolveEntityRef(story.worldBible, relation.targetId);
      if (!sourceId || !targetId || sourceId === targetId) return;

      const npcs = story.worldBible.npcs || [];
      const locations = story.worldBible.locations || [];
      const factions = story.worldBible.factions || [];
      const deities = story.worldBible.religions || [];

      const isNpc = (id: string) => npcs.some((n) => n.id === id);
      const isLocation = (id: string) => locations.some((l) => l.id === id);
      const isFaction = (id: string) => factions.some((f) => f.id === id);
      const isDeity = (id: string) => deities.some((d) => d.id === id);

      // Deity links are mirrored onto the deity entity (holyLocationIds /
      // affiliatedFactionIds) so the Religions page reflects them. Checked first
      // so an explicit type label (e.g. "path") can't shadow the deity binding.
      if (isDeity(sourceId) && isLocation(targetId)) {
        const deity = deities.find((d) => d.id === sourceId);
        if (deity) {
          editDeity(sourceId, {
            holyLocationIds: Array.from(new Set([...(deity.holyLocationIds || []), targetId])),
          });
        }
      } else if (isDeity(targetId) && isLocation(sourceId)) {
        const deity = deities.find((d) => d.id === targetId);
        if (deity) {
          editDeity(targetId, {
            holyLocationIds: Array.from(new Set([...(deity.holyLocationIds || []), sourceId])),
          });
        }
      } else if (isDeity(sourceId) && isFaction(targetId)) {
        const deity = deities.find((d) => d.id === sourceId);
        if (deity) {
          editDeity(sourceId, {
            affiliatedFactionIds: Array.from(new Set([...(deity.affiliatedFactionIds || []), targetId])),
          });
        }
      } else if (isDeity(targetId) && isFaction(sourceId)) {
        const deity = deities.find((d) => d.id === targetId);
        if (deity) {
          editDeity(targetId, {
            affiliatedFactionIds: Array.from(new Set([...(deity.affiliatedFactionIds || []), sourceId])),
          });
        }
      } else if (relationType === 'path' || (isLocation(sourceId) && isLocation(targetId))) {
        // Connect 2 locations bidirectionally
        updateLocations((prev) =>
          prev.map((loc) => {
            if (loc.id === sourceId && !loc.connectedLocationIds?.includes(targetId)) {
              return { ...loc, connectedLocationIds: [...(loc.connectedLocationIds || []), targetId] };
            }
            if (loc.id === targetId && !loc.connectedLocationIds?.includes(sourceId)) {
              return { ...loc, connectedLocationIds: [...(loc.connectedLocationIds || []), sourceId] };
            }
            return loc;
          })
        );
      } else if (relationType === 'residence' || (isNpc(sourceId) && isLocation(targetId)) || (isLocation(sourceId) && isNpc(targetId))) {
        const npcId = isNpc(sourceId) ? sourceId : targetId;
        const locId = isLocation(sourceId) ? sourceId : targetId;
        editNpc(npcId, { currentLocationId: locId });
      } else if (
        relationType === 'faction_allied' ||
        relationType === 'faction_ally' ||
        (relationType === 'ally' && isFaction(sourceId) && isFaction(targetId))
      ) {
        setFactionRelation(sourceId, targetId, 'allied');
      } else if (relationType === 'faction_favorable') {
        setFactionRelation(sourceId, targetId, 'favorable');
      } else if (relationType === 'faction_neutral') {
        setFactionRelation(sourceId, targetId, 'neutral');
      } else if (relationType === 'faction_rival') {
        setFactionRelation(sourceId, targetId, 'rival');
      } else if (
        relationType === 'faction_hostile' ||
        (relationType === 'rival' && isFaction(sourceId) && isFaction(targetId))
      ) {
        setFactionRelation(sourceId, targetId, 'hostile');
      } else if (relationType === 'ally' || (isNpc(sourceId) && isFaction(targetId)) || (isFaction(sourceId) && isNpc(targetId))) {
        const npcId = isNpc(sourceId) ? sourceId : targetId;
        const facId = isFaction(sourceId) ? sourceId : targetId;
        editNpc(npcId, { factionId: facId });
      } else if (relationType === 'territory' || (isFaction(sourceId) && isLocation(targetId)) || (isLocation(sourceId) && isFaction(targetId))) {
        const facId = isFaction(sourceId) ? sourceId : targetId;
        const locId = isLocation(sourceId) ? sourceId : targetId;
        const fac = factions.find((f) => f.id === facId);
        if (fac) {
          editFaction(facId, {
            territoryIds: Array.from(new Set([...(fac.territoryIds || []), locId])),
          });
        }
      } else {
        // Custom arbitrary relation
        updateWorldBible((prev) => {
          const newRel: CustomLoreRelation = {
            id: `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            sourceId,
            targetId,
            relationTypeId: relationType,
          };
          const prevCustom = prev.customRelations || [];
          return {
            ...prev,
            customRelations: [...prevCustom, newRel],
          };
        });
      }

      notify.success(isPersian ? 'پیوند جدید با موفقیت برقرار شد' : 'New lore connection established');
    },
    [isPersian, updateLocations, editNpc, editFaction, editDeity, updateWorldBible, story.worldBible]
  );

  const deleteRelation = useCallback(
    (_sourceId: string, _targetId: string, relationType: string) => {
      const sourceId = resolveEntityRef(story.worldBible, _sourceId);
      const targetId = resolveEntityRef(story.worldBible, _targetId);
      const npcs = story.worldBible.npcs || [];
      const locations = story.worldBible.locations || [];
      const factions = story.worldBible.factions || [];
      const deities = story.worldBible.religions || [];

      const isNpc = (id: string) => npcs.some((n) => n.id === id);
      const isLocation = (id: string) => locations.some((l) => l.id === id);
      const isFaction = (id: string) => factions.some((f) => f.id === id);
      const isDeity = (id: string) => deities.some((d) => d.id === id);

      // Deity links mirror onto the deity entity — handled first so the
      // Religions page stays in sync and type-string checks can't shadow them.
      if ((isDeity(sourceId) && isLocation(targetId)) || (isDeity(targetId) && isLocation(sourceId))) {
        const deityId = isDeity(sourceId) ? sourceId : targetId;
        const locId = isLocation(sourceId) ? sourceId : targetId;
        const deity = deities.find((d) => d.id === deityId);
        if (deity) {
          editDeity(deityId, {
            holyLocationIds: (deity.holyLocationIds || []).filter((id) => id !== locId),
          });
        }
      } else if ((isDeity(sourceId) && isFaction(targetId)) || (isDeity(targetId) && isFaction(sourceId))) {
        const deityId = isDeity(sourceId) ? sourceId : targetId;
        const facId = isFaction(sourceId) ? sourceId : targetId;
        const deity = deities.find((d) => d.id === deityId);
        if (deity) {
          editDeity(deityId, {
            affiliatedFactionIds: (deity.affiliatedFactionIds || []).filter((id) => id !== facId),
          });
        }
      } else if (relationType.includes('مسیر') || relationType.includes('Path') || relationType === 'path' || (isLocation(sourceId) && isLocation(targetId))) {
        updateLocations((prev) =>
          prev.map((loc) => {
            if (loc.id === sourceId) {
              return { ...loc, connectedLocationIds: (loc.connectedLocationIds || []).filter((id) => id !== targetId) };
            }
            if (loc.id === targetId) {
              return { ...loc, connectedLocationIds: (loc.connectedLocationIds || []).filter((id) => id !== sourceId) };
            }
            return loc;
          })
        );
      } else if (relationType.includes('استقرار') || relationType.includes('Stationed') || relationType === 'residence' || (isNpc(sourceId) && isLocation(targetId))) {
        const npcId = isNpc(sourceId) ? sourceId : targetId;
        editNpc(npcId, { currentLocationId: '' });
      } else if (
        relationType.includes('هم‌پیمان') ||
        relationType.includes('متحد') ||
        relationType.includes('Allied') ||
        relationType.includes('Treaty') ||
        relationType === 'faction_allied' ||
        relationType === 'faction_favorable' ||
        relationType === 'faction_ally' ||
        relationType.includes('دشمن') ||
        relationType.includes('رقیب') ||
        relationType.includes('Rival') ||
        relationType.includes('Hostile') ||
        relationType === 'faction_rival' ||
        relationType === 'faction_hostile' ||
        (isFaction(sourceId) && isFaction(targetId))
      ) {
        deleteFactionRelation(sourceId, targetId);
      } else if (relationType.includes('جناح') || relationType.includes('Member') || relationType === 'ally') {
        const npcId = isNpc(sourceId) ? sourceId : targetId;
        editNpc(npcId, { factionId: undefined });
      } else if (relationType.includes('قلمرو') || relationType.includes('Territory') || relationType === 'territory') {
        const facId = isFaction(sourceId) ? sourceId : targetId;
        const locId = isLocation(sourceId) ? sourceId : targetId;
        const fac = factions.find((f) => f.id === facId);
        if (fac) {
          editFaction(facId, { territoryIds: (fac.territoryIds || []).filter((id) => id !== locId) });
        }
      } else {
        // Remove from customRelations (resolve stored refs too, so links the
        // AI adviser authored by name can still be deleted).
        updateWorldBible((prev) => ({
          ...prev,
          customRelations: (prev.customRelations || []).filter((r) => {
            const rs = resolveEntityRef(prev, r.sourceId);
            const rt = resolveEntityRef(prev, r.targetId);
            const match =
              (rs === sourceId && rt === targetId) || (rs === targetId && rt === sourceId);
            return !match;
          }),
        }));
      }

      notify.info(isPersian ? 'پیوند حذف شد' : 'Lore connection removed');
    },
    [isPersian, updateLocations, editNpc, editFaction, editDeity, updateWorldBible, story.worldBible]
  );

  // ----------------------------------------------------
  // Ontology CRUD
  // ----------------------------------------------------
  const addCustomRelationType = useCallback(
    (relType: CustomRelationType) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        if (ont.relationTypes.some((r) => r.id === relType.id)) return prev;
        return {
          ...prev,
          ontology: {
            ...ont,
            relationTypes: [...ont.relationTypes, relType],
          },
        };
      });
      notify.success(isPersian ? 'نوع پیوند جدید ثبت شد' : 'Custom relation type registered');
    },
    [isPersian, updateWorldBible]
  );

  const editCustomRelationType = useCallback(
    (id: string, updated: Partial<CustomRelationType>) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            relationTypes: ont.relationTypes.map((r) => (r.id === id ? { ...r, ...updated } : r)),
          },
        };
      });
      notify.success(isPersian ? 'نوع پیوند به‌روز شد' : 'Relation type updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteCustomRelationType = useCallback(
    (id: string) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            relationTypes: ont.relationTypes.filter((r) => r.id !== id),
          },
        };
      });
      notify.info(isPersian ? 'نوع پیوند حذف شد' : 'Relation type removed');
    },
    [isPersian, updateWorldBible]
  );

  const addPlaceCategory = useCallback(
    (category: CustomPlaceCategory) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        if (ont.placeCategories.some((p) => p.id === category.id)) return prev;
        return {
          ...prev,
          ontology: {
            ...ont,
            placeCategories: [...ont.placeCategories, category],
          },
        };
      });
      notify.success(isPersian ? 'دسته‌بندی مکان جدید اضافه شد' : 'Place category added');
    },
    [isPersian, updateWorldBible]
  );

  const editPlaceCategory = useCallback(
    (id: string, updated: Partial<CustomPlaceCategory>) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            placeCategories: ont.placeCategories.map((p) => (p.id === id ? { ...p, ...updated } : p)),
          },
        };
      });
      notify.success(isPersian ? 'دسته‌بندی مکان به‌روز شد' : 'Place category updated');
    },
    [isPersian, updateWorldBible]
  );

  const deletePlaceCategory = useCallback(
    (id: string) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            placeCategories: ont.placeCategories.filter((p) => p.id !== id),
          },
        };
      });
      notify.info(isPersian ? 'دسته‌بندی مکان حذف شد' : 'Place category removed');
    },
    [isPersian, updateWorldBible]
  );

  const addLawCategory = useCallback(
    (category: CustomLawCategory) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        if (ont.lawCategories.some((l) => l.id === category.id)) return prev;
        return {
          ...prev,
          ontology: {
            ...ont,
            lawCategories: [...ont.lawCategories, category],
          },
        };
      });
      notify.success(isPersian ? 'دسته‌بندی قانون جدید اضافه شد' : 'Law category added');
    },
    [isPersian, updateWorldBible]
  );

  const editLawCategory = useCallback(
    (id: string, updated: Partial<CustomLawCategory>) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            lawCategories: ont.lawCategories.map((l) => (l.id === id ? { ...l, ...updated } : l)),
          },
        };
      });
      notify.success(isPersian ? 'دسته‌بندی قانون به‌روز شد' : 'Law category updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteLawCategory = useCallback(
    (id: string) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            lawCategories: ont.lawCategories.filter((l) => l.id !== id),
          },
        };
      });
      notify.info(isPersian ? 'دسته‌بندی قانون حذف شد' : 'Law category removed');
    },
    [isPersian, updateWorldBible]
  );

  const addNpcRole = useCallback(
    (role: CustomNPCRole) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        if (ont.npcRoles.some((r) => r.id === role.id)) return prev;
        return {
          ...prev,
          ontology: {
            ...ont,
            npcRoles: [...ont.npcRoles, role],
          },
        };
      });
      notify.success(isPersian ? 'نقش شخصیتی جدید ثبت شد' : 'NPC role registered');
    },
    [isPersian, updateWorldBible]
  );

  const editNpcRole = useCallback(
    (id: string, updated: Partial<CustomNPCRole>) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            npcRoles: ont.npcRoles.map((r) => (r.id === id ? { ...r, ...updated } : r)),
          },
        };
      });
      notify.success(isPersian ? 'نقش شخصیتی به‌روز شد' : 'NPC role updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteNpcRole = useCallback(
    (id: string) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            npcRoles: ont.npcRoles.filter((r) => r.id !== id),
          },
        };
      });
      notify.info(isPersian ? 'نقش شخصیتی حذف شد' : 'NPC role removed');
    },
    [isPersian, updateWorldBible]
  );

  const addDomain = useCallback(
    (domain: CustomDomain) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        if (ont.domains.some((d) => d.id === domain.id)) return prev;
        return {
          ...prev,
          ontology: {
            ...ont,
            domains: [...ont.domains, domain],
          },
        };
      });
      notify.success(isPersian ? 'حوزه کیهانی جدید ثبت شد' : 'Divine domain registered');
    },
    [isPersian, updateWorldBible]
  );

  const editDomain = useCallback(
    (id: string, updated: Partial<CustomDomain>) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            domains: ont.domains.map((d) => (d.id === id ? { ...d, ...updated } : d)),
          },
        };
      });
      notify.success(isPersian ? 'حوزه کیهانی به‌روز شد' : 'Divine domain updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteDomain = useCallback(
    (id: string) => {
      updateWorldBible((prev) => {
        const ont = normalizeOntology(prev.ontology, isPersian);
        return {
          ...prev,
          ontology: {
            ...ont,
            domains: ont.domains.filter((d) => d.id !== id),
          },
        };
      });
      notify.info(isPersian ? 'حوزه کیهانی حذف شد' : 'Divine domain removed');
    },
    [isPersian, updateWorldBible]
  );

  // ----------------------------------------------------
  // Timeline CRUD
  // ----------------------------------------------------
  const addTimelineEvent = useCallback(
    (event: TimelineEvent) => {
      updateWorldBible((prev) => {
        const prevTimeline = prev.timeline || [];
        if (prevTimeline.some((t) => t.id === event.id)) return prev;
        return {
          ...prev,
          timeline: [...prevTimeline, event],
        };
      });
      notify.success(isPersian ? 'رویداد تاریخی جدید ثبت شد' : 'Historical event added');
    },
    [isPersian, updateWorldBible]
  );

  const editTimelineEvent = useCallback(
    (id: string, updated: Partial<TimelineEvent>) => {
      updateWorldBible((prev) => ({
        ...prev,
        timeline: (prev.timeline || []).map((t) => (t.id === id ? { ...t, ...updated } : t)),
      }));
      notify.success(isPersian ? 'رویداد تاریخی به‌روز شد' : 'Timeline event updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteTimelineEvent = useCallback(
    (id: string) => {
      updateWorldBible((prev) => ({
        ...prev,
        timeline: (prev.timeline || []).filter((t) => t.id !== id),
      }));
      notify.info(isPersian ? 'رویداد تاریخی حذف شد' : 'Timeline event removed');
    },
    [isPersian, updateWorldBible]
  );

  // ----------------------------------------------------
  // Artifacts CRUD
  // ----------------------------------------------------
  const addArtifact = useCallback(
    (artifact: WorldArtifact) => {
      updateWorldBible((prev) => {
        const prevArtifacts = prev.artifacts || [];
        if (prevArtifacts.some((a) => a.id === artifact.id)) return prev;
        return {
          ...prev,
          artifacts: [...prevArtifacts, artifact],
        };
      });
      notify.success(isPersian ? 'عتیقه و یادگار باستانی جدید ثبت شد' : 'Mythic artifact registered');
    },
    [isPersian, updateWorldBible]
  );

  const editArtifact = useCallback(
    (id: string, updated: Partial<WorldArtifact>) => {
      updateWorldBible((prev) => ({
        ...prev,
        artifacts: (prev.artifacts || []).map((a) => (a.id === id ? { ...a, ...updated } : a)),
      }));
      notify.success(isPersian ? 'مشخصات یادگار باستانی به‌روز شد' : 'Artifact updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteArtifact = useCallback(
    (id: string) => {
      updateWorldBible((prev) => ({
        ...prev,
        artifacts: (prev.artifacts || []).filter((a) => a.id !== id),
      }));
      notify.info(isPersian ? 'یادگار باستانی حذف شد' : 'Artifact removed');
    },
    [isPersian, updateWorldBible]
  );

  // ----------------------------------------------------
  // Bestiary CRUD
  // ----------------------------------------------------
  const addCreature = useCallback(
    (creature: WorldCreature) => {
      updateWorldBible((prev) => {
        const prevBestiary = prev.bestiary || [];
        if (prevBestiary.some((c) => c.id === creature.id)) return prev;
        return {
          ...prev,
          bestiary: [...prevBestiary, creature],
        };
      });
      notify.success(isPersian ? 'موجود و هیولای جدید به دانشنامه اضافه شد' : 'Bestiary creature registered');
    },
    [isPersian, updateWorldBible]
  );

  const editCreature = useCallback(
    (id: string, updated: Partial<WorldCreature>) => {
      updateWorldBible((prev) => ({
        ...prev,
        bestiary: (prev.bestiary || []).map((c) => (c.id === id ? { ...c, ...updated } : c)),
      }));
      notify.success(isPersian ? 'پرونده زیستی موجود به‌روز شد' : 'Bestiary dossier updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteCreature = useCallback(
    (id: string) => {
      updateWorldBible((prev) => ({
        ...prev,
        bestiary: (prev.bestiary || []).filter((c) => c.id !== id),
      }));
      notify.info(isPersian ? 'موجود از دانشنامه حذف شد' : 'Creature removed from bestiary');
    },
    [isPersian, updateWorldBible]
  );

  // ----------------------------------------------------
  // Religion CRUD
  // ----------------------------------------------------
  const addDeity = useCallback(
    (deity: WorldDeity) => {
      updateWorldBible((prev) => {
        const prevRel = prev.religions || [];
        if (prevRel.some((d) => d.id === deity.id)) return prev;
        return {
          ...prev,
          religions: [...prevRel, deity],
        };
      });
      notify.success(isPersian ? 'ایزد و نظام عقیدتی جدید ثبت شد' : 'Deity registered');
    },
    [isPersian, updateWorldBible]
  );

  const deleteDeity = useCallback(
    (id: string) => {
      updateWorldBible((prev) => ({
        ...prev,
        religions: (prev.religions || []).filter((d) => d.id !== id),
      }));
      notify.info(isPersian ? 'ایزد از نظام اعتقادی حذف شد' : 'Deity removed');
    },
    [isPersian, updateWorldBible]
  );

  // ----------------------------------------------------
  // Drama Bonds CRUD
  // ----------------------------------------------------
  const addDramaBond = useCallback(
    (bond: NPCDramaBond) => {
      updateWorldBible((prev) => {
        const prevBonds = prev.dramaBonds || [];
        if (prevBonds.some((b) => b.id === bond.id)) return prev;
        return {
          ...prev,
          dramaBonds: [...prevBonds, bond],
        };
      });
      notify.success(isPersian ? 'پیوند درام و تنش شخصیتی ثبت شد' : 'Drama bond registered');
    },
    [isPersian, updateWorldBible]
  );

  const editDramaBond = useCallback(
    (id: string, updated: Partial<NPCDramaBond>) => {
      updateWorldBible((prev) => ({
        ...prev,
        dramaBonds: (prev.dramaBonds || []).map((b) => (b.id === id ? { ...b, ...updated } : b)),
      }));
      notify.success(isPersian ? 'پیوند درام شخصیتی به‌روز شد' : 'Drama bond updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteDramaBond = useCallback(
    (id: string) => {
      updateWorldBible((prev) => ({
        ...prev,
        dramaBonds: (prev.dramaBonds || []).filter((b) => b.id !== id),
      }));
      notify.info(isPersian ? 'پیوند درام شخصیتی حذف شد' : 'Drama bond removed');
    },
    [isPersian, updateWorldBible]
  );

  // Story Beats CRUD
  const updateStoryBeats = useCallback(
    (updater: (prev: StoryManifest['initialStoryBeats']) => StoryManifest['initialStoryBeats']) => {
      setStory((prev) => {
        const updatedBeats = updater(prev.initialStoryBeats);
        const updated = { ...prev, initialStoryBeats: updatedBeats };
        persistToStorage(updated);
        return updated;
      });
    },
    [persistToStorage]
  );

  // Plan 07: Saga / Multi-Chapter Campaign CRUD
  const updateSaga = useCallback(
    (updater: (prev?: SagaManifest) => SagaManifest) => {
      setStory((prev) => {
        const updatedSaga = updater(prev.saga);
        const updated = { ...prev, saga: updatedSaga };
        persistToStorage(updated);
        return updated;
      });
    },
    [persistToStorage]
  );

  // Reset to default
  const resetToDefault = async () => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'بازنشانی پیش‌نویس استودیو' : 'Reset Studio Draft',
      message: isPersian
        ? 'آیا مطمئن هستید که می‌خواهید تمام تغییرات ذخیره شده در مرورگر را لغو کرده و به نسخه اصلی بازگردید؟'
        : 'Are you sure you want to discard all local draft edits and restore the original story manifest?',
      confirmText: isPersian ? 'بله، بازنشانی شود' : 'Reset to Default',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      const key = getStorageKey(selectedStoryId);
      localStorage.removeItem(key);

      if (selectedStoryId) {
        try {
          const res = await fetch(
            `/api/studio/story?storyId=${encodeURIComponent(selectedStoryId)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.data) {
              const m = data.data as StoryManifest;
              if (!m.worldBible?.ontology) {
                m.worldBible = m.worldBible || ({} as any);
                m.worldBible.ontology = getDefaultOntology(m.language === 'fa');
              }
              setStory(m);
              setHasLocalDraft(false);
              setLastSaved(null);
              notify.success(
                isPersian
                  ? 'پیش‌نویس محلی حذف و نسخه سرور بارگذاری شد'
                  : 'Local draft discarded; server version restored'
              );
              return;
            }
          }
        } catch {
          // fall through to placeholder
        }
      }

      setStory(EMPTY_STORY_PLACEHOLDER);
      setHasLocalDraft(false);
      setLastSaved(null);
      notify.success(isPersian ? 'پیش‌نویس بازنشانی شد' : 'Draft reset');
    }
  };

  // Export JSON
  const exportStoryJson = () => {
    const jsonStr = JSON.stringify(story, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${story.id || 'storyforge_story'}_manifest.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify.success(isPersian ? 'فایل JSON با موفقیت دریافت شد' : 'Story Manifest JSON exported');
  };

  // Import JSON
  const importStoryJson = (manifest: StoryManifest) => {
    if (!manifest.id || !manifest.title || !manifest.worldBible || !manifest.rpgSystem) {
      notify.error(isPersian ? 'فایل JSON معتبر نمی‌باشد' : 'Invalid Story Manifest JSON schema');
      return;
    }
    setStory(manifest);
    persistToStorage(manifest);
    notify.success(isPersian ? 'داستان با موفقیت بارگذاری شد' : 'Story Manifest successfully loaded');
  };

  return (
    <StudioStoryContext.Provider
      value={{
        selectedStoryId,
        setSelectedStoryId,
        storiesList,
        story,
        isPersian,
        isRtl,
        toggleLanguage,
        hasLocalDraft,
        lastSaved,
        isSyncing,
        lastServerSynced,
        saveToServer,
        createStory,
        createStoryInWorld,
        duplicateStory,
        deleteStory,
        setStoryPublished,
        worldsList,
        selectedWorldId,
        refreshWorlds,
        updateStoryMeta,
        updateWorldBible,
        updateWorldMeta,
        addWorldLaw,
        editWorldLaw,
        deleteWorldLaw,
        addFaction,
        editFaction,
        deleteFaction,
        setFactionRelation,
        deleteFactionRelation,
        batchApplyWorldChanges,
        updateRpgSystem,
        updateNpcs,
        addNpc,
        editNpc,
        deleteNpc,
        addLocation,
        editLocation,
        deleteLocation,
        addRelation,
        deleteRelation,
        addCustomRelationType,
        editCustomRelationType,
        deleteCustomRelationType,
        addPlaceCategory,
        editPlaceCategory,
        deletePlaceCategory,
        addLawCategory,
        editLawCategory,
        deleteLawCategory,
        addNpcRole,
        editNpcRole,
        deleteNpcRole,
        addDomain,
        editDomain,
        deleteDomain,
        addTimelineEvent,
        editTimelineEvent,
        deleteTimelineEvent,
        addArtifact,
        editArtifact,
        deleteArtifact,
        addCreature,
        editCreature,
        deleteCreature,
        addDeity,
        editDeity,
        deleteDeity,
        addDramaBond,
        editDramaBond,
        deleteDramaBond,
        updateStoryBeats,
        updateSaga,
        resetToDefault,
        exportStoryJson,
        importStoryJson,
      }}
    >
      <div dir={isRtl ? 'rtl' : 'ltr'} className={isRtl ? 'font-[Vazirmatn]' : ''}>
        {mounted ? (
          children
        ) : (
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-400 border-t-gray-700" />
          </div>
        )}
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
