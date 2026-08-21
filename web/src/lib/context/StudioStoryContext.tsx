'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { obsidianCitadelStory } from '@/content/stories/obsidian_citadel';
import { ghaleSiahsangStory } from '@/content/stories/ghale_siahsang';
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
  CustomLoreRelation,
  WorldOntology,
  TimelineEvent,
  WorldArtifact,
  WorldCreature,
  WorldDeity,
  NPCDramaBond,
} from '@/lib/types';
import { notify } from '@/lib/notify';

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
      { id: 'stronghold', name: isPersian ? 'دژ و قلعه باستانی' : 'Stronghold / Citadel', description: isPersian ? 'استحکامات نظامی و مقر فرماندهی' : 'Fortified citadel or military command post', color: '#6366F1', defaultDangerLevel: 3, isDefault: true },
      { id: 'dungeon', name: isPersian ? 'سیاه‌چال و دخمه' : 'Dungeon / Vault', description: isPersian ? 'سلول‌های سنگی، راهروهای تاریک و سرداب' : 'Subterranean cells, torture pits, or vaults', color: '#EC4899', defaultDangerLevel: 4, isDefault: true },
      { id: 'ruins', name: isPersian ? 'خرابه‌ها و معابد کهن' : 'Ancient Ruins & Shrines', description: isPersian ? 'بقایای تمدن‌های پیشین و محراب‌های جادو' : 'Remnants of fallen eras and forgotten altars', color: '#14B8A6', defaultDangerLevel: 4, isDefault: true },
      { id: 'settlement', name: isPersian ? 'شهرک و بازار' : 'Settlement / Outpost', description: isPersian ? 'تجمع مدنی، اسکله بازرگانان یا بازارچه' : 'Civilian hubs, trading posts, or inns', color: '#F59E0B', defaultDangerLevel: 1, isDefault: true },
      { id: 'wilderness', name: isPersian ? 'طبیعت وحشی و بیابان' : 'Wilderness / Wastes', description: isPersian ? 'کویر سوزان، جنگل‌های مه‌آلود و مناطق خطرناک' : 'Uncharted wilds, foggy marshes, or badlands', color: '#10B981', defaultDangerLevel: 5, isDefault: true },
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
  };
}

interface StudioStoryContextType {
  selectedStoryId: string;
  setSelectedStoryId: (id: string) => void;
  story: StoryManifest;
  isPersian: boolean;
  isRtl: boolean;
  toggleLanguage: () => void;
  hasLocalDraft: boolean;
  lastSaved: Date | null;
  isSyncing: boolean;
  lastServerSynced: Date | null;
  saveToServer: (manifestToSave?: StoryManifest) => Promise<boolean>;
  // Updaters
  updateStoryMeta: (updates: Partial<Pick<StoryManifest, 'title' | 'tagline' | 'synopsis' | 'author' | 'version'>>) => void;
  updateWorldBible: (updater: (prev: WorldBible) => WorldBible) => void;
  updateWorldMeta: (meta: Partial<Pick<WorldBible, 'worldName' | 'summary' | 'themeNotes'>>) => void;
  // Laws CRUD
  addWorldLaw: (law: WorldLaw) => void;
  editWorldLaw: (id: string, updated: Partial<WorldLaw>) => void;
  deleteWorldLaw: (id: string) => void;
  // Factions CRUD
  addFaction: (faction: Faction) => void;
  editFaction: (id: string, updated: Partial<Faction>) => void;
  deleteFaction: (id: string) => void;
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
  // Global Actions
  resetToDefault: () => Promise<void>;
  exportStoryJson: () => void;
  importStoryJson: (manifest: StoryManifest) => void;
}

const StudioStoryContext = createContext<StudioStoryContextType | undefined>(undefined);

const CANONICAL_STORIES: Record<string, StoryManifest> = {
  ghale_siahsang: ghaleSiahsangStory,
  obsidian_citadel: obsidianCitadelStory,
};

function getStorageKey(storyId: string) {
  return `storyforge_studio_draft_v1_${storyId}`;
}

export function StudioStoryProvider({ children }: { children: ReactNode }) {
  const [selectedStoryId, setSelectedStoryId] = useState<string>('ghale_siahsang');
  const [story, setStory] = useState<StoryManifest>(ghaleSiahsangStory);
  const [hasLocalDraft, setHasLocalDraft] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastServerSynced, setLastServerSynced] = useState<Date | null>(null);

  const isPersian = selectedStoryId === 'ghale_siahsang';
  const isRtl = isPersian;

  // Load from localStorage on story change
  useEffect(() => {
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
      } else {
        const canonical = CANONICAL_STORIES[selectedStoryId] || ghaleSiahsangStory;
        const normalized = {
          ...canonical,
          worldBible: {
            ...canonical.worldBible,
            ontology: canonical.worldBible.ontology || getDefaultOntology(canonical.language === 'fa'),
          },
        };
        setStory(normalized);
        setHasLocalDraft(false);
      }
    } catch {
      const canonical = CANONICAL_STORIES[selectedStoryId] || ghaleSiahsangStory;
      setStory(canonical);
      setHasLocalDraft(false);
    }
  }, [selectedStoryId]);

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
    setSelectedStoryId((prev) => (prev === 'ghale_siahsang' ? 'obsidian_citadel' : 'ghale_siahsang'));
  };

  // Story Meta updater
  const updateStoryMeta = useCallback(
    (updates: Partial<Pick<StoryManifest, 'title' | 'tagline' | 'synopsis' | 'author' | 'version'>>) => {
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
    (faction: Faction) => {
      updateWorldBible((prev) => {
        if (prev.factions.some((f) => f.id === faction.id)) return prev;
        return {
          ...prev,
          factions: [...prev.factions, faction],
        };
      });
      notify.success(isPersian ? 'جناح جدید افزوده شد' : 'New faction registered');
    },
    [isPersian, updateWorldBible]
  );

  const editFaction = useCallback(
    (id: string, updated: Partial<Faction>) => {
      updateWorldBible((prev) => ({
        ...prev,
        factions: prev.factions.map((f) => (f.id === id ? { ...f, ...updated } : f)),
      }));
      notify.success(isPersian ? 'مشخصات جناح ذخیره شد' : 'Faction updated');
    },
    [isPersian, updateWorldBible]
  );

  const deleteFaction = useCallback(
    (id: string) => {
      updateWorldBible((prev) => ({
        ...prev,
        factions: prev.factions.filter((f) => f.id !== id),
      }));
      notify.info(isPersian ? 'جناح حذف شد' : 'Faction removed');
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
      updateLocations((prev) => prev.filter((l) => l.id !== id));
      notify.info(isPersian ? 'مکان حذف شد' : 'Location removed');
    },
    [isPersian, updateLocations]
  );

  // Relations CRUD
  const addRelation = useCallback(
    (relation: { sourceId: string; targetId: string; relationType: string }) => {
      const { sourceId, targetId, relationType } = relation;
      if (!sourceId || !targetId || sourceId === targetId) return;

      const npcs = story.worldBible.npcs || [];
      const locations = story.worldBible.locations || [];
      const factions = story.worldBible.factions || [];

      const isNpc = (id: string) => npcs.some((n) => n.id === id);
      const isLocation = (id: string) => locations.some((l) => l.id === id);
      const isFaction = (id: string) => factions.some((f) => f.id === id);

      if (relationType === 'path' || (isLocation(sourceId) && isLocation(targetId))) {
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
      } else if (relationType === 'faction_ally' || (relationType === 'ally' && isFaction(sourceId) && isFaction(targetId))) {
        const fac1 = factions.find((f) => f.id === sourceId);
        const fac2 = factions.find((f) => f.id === targetId);
        if (fac1) {
          editFaction(sourceId, {
            alliedFactionIds: Array.from(new Set([...(fac1.alliedFactionIds || []), targetId])),
          });
        }
        if (fac2) {
          editFaction(targetId, {
            alliedFactionIds: Array.from(new Set([...(fac2.alliedFactionIds || []), sourceId])),
          });
        }
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
      } else if (relationType === 'rival' || (isFaction(sourceId) && isFaction(targetId))) {
        const fac1 = factions.find((f) => f.id === sourceId);
        const fac2 = factions.find((f) => f.id === targetId);
        if (fac1) {
          editFaction(sourceId, {
            rivalFactionIds: Array.from(new Set([...(fac1.rivalFactionIds || []), targetId])),
          });
        }
        if (fac2) {
          editFaction(targetId, {
            rivalFactionIds: Array.from(new Set([...(fac2.rivalFactionIds || []), sourceId])),
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
    [isPersian, updateLocations, editNpc, editFaction, updateWorldBible, story.worldBible]
  );

  const deleteRelation = useCallback(
    (sourceId: string, targetId: string, relationType: string) => {
      const npcs = story.worldBible.npcs || [];
      const locations = story.worldBible.locations || [];
      const factions = story.worldBible.factions || [];

      const isNpc = (id: string) => npcs.some((n) => n.id === id);
      const isLocation = (id: string) => locations.some((l) => l.id === id);
      const isFaction = (id: string) => factions.some((f) => f.id === id);

      if (relationType.includes('مسیر') || relationType.includes('Path') || relationType === 'path' || (isLocation(sourceId) && isLocation(targetId))) {
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
      } else if (relationType.includes('هم‌پیمان') || relationType.includes('Treaty') || relationType === 'faction_ally') {
        const fac1 = factions.find((f) => f.id === sourceId);
        const fac2 = factions.find((f) => f.id === targetId);
        if (fac1) editFaction(sourceId, { alliedFactionIds: (fac1.alliedFactionIds || []).filter((id) => id !== targetId) });
        if (fac2) editFaction(targetId, { alliedFactionIds: (fac2.alliedFactionIds || []).filter((id) => id !== sourceId) });
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
      } else if (relationType.includes('دشمن') || relationType.includes('Rival') || relationType === 'rival' || (isFaction(sourceId) && isFaction(targetId))) {
        const fac1 = factions.find((f) => f.id === sourceId);
        const fac2 = factions.find((f) => f.id === targetId);
        if (fac1) editFaction(sourceId, { rivalFactionIds: (fac1.rivalFactionIds || []).filter((id) => id !== targetId) });
        if (fac2) editFaction(targetId, { rivalFactionIds: (fac2.rivalFactionIds || []).filter((id) => id !== sourceId) });
      } else {
        // Remove from customRelations
        updateWorldBible((prev) => ({
          ...prev,
          customRelations: (prev.customRelations || []).filter(
            (r) => !(r.sourceId === sourceId && r.targetId === targetId) && !(r.sourceId === targetId && r.targetId === sourceId)
          ),
        }));
      }

      notify.info(isPersian ? 'پیوند حذف شد' : 'Lore connection removed');
    },
    [isPersian, updateLocations, editNpc, editFaction, updateWorldBible, story.worldBible]
  );

  // ----------------------------------------------------
  // Ontology CRUD
  // ----------------------------------------------------
  const addCustomRelationType = useCallback(
    (relType: CustomRelationType) => {
      updateWorldBible((prev) => {
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
        const ont = prev.ontology || getDefaultOntology(isPersian);
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
      const canonical = CANONICAL_STORIES[selectedStoryId] || ghaleSiahsangStory;
      setStory(canonical);
      setHasLocalDraft(false);
      setLastSaved(null);
      notify.success(isPersian ? 'تنظیمات به حالت پیش‌فرض بازگشت' : 'Draft reset to canonical default');
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
        story,
        isPersian,
        isRtl,
        toggleLanguage,
        hasLocalDraft,
        lastSaved,
        isSyncing,
        lastServerSynced,
        saveToServer,
        updateStoryMeta,
        updateWorldBible,
        updateWorldMeta,
        addWorldLaw,
        editWorldLaw,
        deleteWorldLaw,
        addFaction,
        editFaction,
        deleteFaction,
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
        resetToDefault,
        exportStoryJson,
        importStoryJson,
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
