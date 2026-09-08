'use client';

import React, { useState, useMemo } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Skull,
  Plus,
  Trash2,
  Edit2,
  Shield,
  MapPin,
  Flame,
  Zap,
  Crosshair,
  Package,
  Layers,
  X,
  Sparkles,
  Leaf,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Check,
  HeartHandshake,
  Ghost,
  AlertTriangle,
  Gem,
  Pickaxe,
} from 'lucide-react';
import { WorldCreature, CreatureAlchemicalYield, EnhancedCreaturePayload } from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

const SPECIES_CATEGORIES = {
  elemental: { labelFa: 'عنصری و سنگی', labelEn: 'Elemental', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  monstrosity: { labelFa: 'هیولا و جهش‌یافته', labelEn: 'Monstrosity', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  undead: { labelFa: 'نامردگان و ارواح', labelEn: 'Undead', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  beast: { labelFa: 'جانور وحشی', labelEn: 'Beast', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  flora: { labelFa: 'گیاهان، قارچ‌ها و رستنی‌ها', labelEn: 'Flora & Botanicals', color: 'text-lime-400 bg-lime-500/10 border-lime-500/30' },
  mineral: { labelFa: 'کانی‌ها، سنگ‌ها و نمک‌های معدنی', labelEn: 'Minerals & Ores', color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  draconic: { labelFa: 'اژدهایی و کهن', labelEn: 'Draconic', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  humanoid: { labelFa: 'انسان‌نما و قبیله‌ای', labelEn: 'Humanoid', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
};

const DANGER_LEVELS: Record<number, { labelEn: string; labelFa: string }> = {
  1: { labelEn: 'Harmless / Common', labelFa: 'بی‌خطر / معمولی' },
  2: { labelEn: 'Guard / Predator', labelFa: 'نگهبان / شکارچی' },
  3: { labelEn: 'Deadly Monster', labelFa: 'هیولای مرگبار' },
  4: { labelEn: 'Apex Threat', labelFa: 'تهدید ویرانگر' },
  5: { labelEn: 'Calamitous / Boss', labelFa: 'فاجعه‌بار / غول نهایی' },
};

const CREATURE_RARITY: Record<string, { labelEn: string; labelFa: string; color: string; badgeClass: string }> = {
  common: { labelEn: 'Common / Abundant', labelFa: 'فراوان / پرشمار', color: 'text-zinc-300 bg-zinc-800/80 border-zinc-700', badgeClass: 'text-zinc-300 bg-zinc-800/80 border-zinc-700' },
  uncommon: { labelEn: 'Uncommon / Scattered', labelFa: 'نامتداول / پراکنده', color: 'text-teal-300 bg-teal-500/10 border-teal-500/30', badgeClass: 'text-teal-300 bg-teal-500/10 border-teal-500/30' },
  rare: { labelEn: 'Rare / Scarce', labelFa: 'کمیاب / انگشت‌شمار', color: 'text-amber-300 bg-amber-500/10 border-amber-500/30', badgeClass: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  legendary: { labelEn: 'Legendary / Solitary', labelFa: 'افسانه‌ای / تک‌نمونه', color: 'text-purple-300 bg-purple-500/10 border-purple-500/30', badgeClass: 'text-purple-300 bg-purple-500/10 border-purple-500/30' },
};

const RARITY_LABELS: Record<string, { en: string; fa: string }> = {
  common: { en: 'COMMON', fa: 'معمولی' },
  uncommon: { en: 'UNCOMMON', fa: 'کمیاب' },
  rare: { en: 'RARE', fa: 'نادر' },
  legendary: { en: 'LEGENDARY', fa: 'افسانه‌ای' },
};

const isFloraName = (str: string) =>
  /گیاه|قارچ|گل|ریشه|نیلوفر|سنبل|گون|گَوَن|خزه|درخت|بوته|پیچک|علف|بذر|برگ|بلوط|کاج|نسترن|پونه|سدر|بابونه|زعفران|lotus|lily|mushroom|fungus|root|moss|bloom|herb|fern|ivy|berry/i.test(str);

const isMineralName = (str: string) =>
  /نمک|گوگرد|بلور|کریستال|ابسیدین|معدنی|سنگ|جیوه|کانی|یاقوت|زمرد|عقیق|خاکستر|شفق|سیلیس|کوارتز|چخماق|آهک|شوره|salt|mineral|ore|crystal|obsidian|sulfur|brimstone|quartz|gem/i.test(str);

const resolveSuggestedCategory = (str: string): 'flora' | 'mineral' | 'beast' => {
  if (isMineralName(str)) return 'mineral';
  if (isFloraName(str)) return 'flora';
  return 'beast';
};

/**
 * Biological and Alchemical Pacification Entity Extractor
 * Extracts missing plant, mineral, animal, or reagent entities from nonCombatPacificationMethod text.
 */
function extractPacificationEntities(text: string): Array<{ name: string; category: 'flora' | 'beast' | 'mineral' }> {
  if (!text || typeof text !== 'string') return [];
  const results: Array<{ name: string; category: 'flora' | 'beast' | 'mineral' }> = [];
  const seen = new Set<string>();

  const add = (rawName: string, explicitCat?: 'flora' | 'beast' | 'mineral') => {
    let clean = rawName
      .replace(/[\u064B-\u065F\u0670]/g, '') // strip diacritics like Fat-ha in گَوَن
      .replace(/[«»"'״]/g, '')
      .trim();

    // Strip common action, preparation, and sensory adjective prefixes iteratively
    const prefixRegex = /^(?:پاشیدن|مالیدن|خوراندن|تعارف|دود کردن|سوزاندن|استخراج|ریختن|آغشتن|عصارهٔ?|روغن|پودر|شیرهٔ?|دم‌کردهٔ?|جوشاندهٔ?|تخم|ریشه(?:های|‌های)?|ریشهٔ?|برگ(?:های|‌های)?|گلبرگ(?:های|‌های)?|بلور(?:های|‌های)?|بلور|گیاه|قارچ|تخمیرشدهٔ?|تخمیرشده|غلیظ شدهٔ?|غلیظ‌شدهٔ?|خشک شدهٔ?|خشک‌شدهٔ?|ساییده شدهٔ?|ساییدهٔ?|پختهٔ?|خام|تازهٔ?|تلخ|غلیظ|شور|تند|خالص|ناخالص|و)\s+/gu;
    let prev = '';
    while (prev !== clean) {
      prev = clean;
      clean = clean.replace(prefixRegex, '').trim();
    }

    // Strip trailing sensory adjectives
    const suffixAdjectives = /\s+(?:خالص|ناخالص|تلخ|شیرین|غلیظ|شور|تند|تازه|کهنه|خام|پخته|ساییده|آسیاب‌شده)$/gu;
    clean = clean.replace(suffixAdjectives, '').trim();

    // Strip trailing prepositional particles and stop words
    clean = clean.replace(/\s+(?:بر روی|روی|در|برای|به|با|که|تا|از|سپس|جهت|را).*$/gu, '').trim();

    if (!clean || clean.length < 2 || clean.length > 35) return;
    const norm = clean.toLowerCase();
    if (seen.has(norm)) return;
    seen.add(norm);

    const category = explicitCat || resolveSuggestedCategory(clean);
    results.push({ name: clean, category });
  };

  // 1. Quoted entities in text (e.g. «نیلوفر مردابی», "Silver Lotus")
  const quotes = text.match(/[«"']([^»"']{2,35})[»"']/g);
  if (quotes) {
    quotes.forEach((q) => add(q));
  }

  // 2. Split clauses on conjunctions (یا / و) and punctuation to prevent bleeding
  const fragments = text.split(/\s+یا\s+|[;؛\n]+/u);
  for (const frag of fragments) {
    // Direct Anchor words followed by regional/descriptive modifiers (e.g. "نمک معدنی", "گون کوهی", "نیلوفر مردابی")
    const directAnchorRegex = /(?:^|[\s«"'(،,;؛])(نیلوفر|سنبل|قارچ|خزه|پیچک|گَ?وَن|گون|گوزن|گرگ|خرس|گراز|شاهین|عقاب|افعی|مانتیکور|نمک|گوگرد|بلور|کوارتز|ابسیدین)\s+([\u0600-\u06FF]{2,20})(?=$|[\s»"')،,;؛])/gu;
    let match;
    while ((match = directAnchorRegex.exec(frag)) !== null) {
      add(`${match[1]} ${match[2]}`);
    }

    // Bio / Mineral prep patterns
    const bioAnchorsRegex = /(?:عصارهٔ?|روغن|پودر|شیرهٔ?|دم‌کردهٔ?|جوشاندهٔ?|ریشه(?:های|‌های)?|ریشهٔ?|برگ(?:های|‌های)?|گلبرگ(?:های|‌های)?|بذر|گوشت|خون|زهر|بلور|سنگ|نمک|کانی)\s+(?:(?:غلیظ شدهٔ?|غلیظ‌شدهٔ?|تخمیرشدهٔ?|تخمیرشده|خشک شدهٔ?|خشک‌شدهٔ?|ساییدهٔ?|پختهٔ?|تازهٔ?|خام|تلخ|غلیظ|شور|تند|خالص|ناخالص|و)\s+)*(?:(?:ریشه(?:های|‌های)?|ریشهٔ?|برگ(?:های|‌های)?|تخم|گیاه|سنگ|بلور)\s+)*([\u0600-\u06FF\s]{2,30}?)(?=\s+(?:بر روی|روی|در|برای|به|با|که|تا|و|از|سپس|جهت|را|[.,،;؛]|$))/gu;
    while ((match = bioAnchorsRegex.exec(frag)) !== null) {
      if (match[1]) {
        add(match[1]);
      }
    }
  }

  return results;
}

/**
 * Generic humanoid collective nouns and victim groups that should not be tracked
 * as missing monsters, beasts, or flora in the bestiary ecology.
 */
const GENERIC_HUMANOID_COLLECTIVES = new Set([
  'مسافران', 'مسافر', 'نیزارنشینان', 'کاروانیان', 'کاروان‌ها', 'کاروانها', 'کاروان', 'روستاییان', 'روستایی',
  'قربانیان', 'قربانی', 'مردم', 'ساکنان', 'ساکنین', 'اهالی', 'انسان‌ها', 'انسانها', 'انسان', 'آدمیان',
  'کودکان', 'فرزندان', 'سربازان', 'سرباز', 'نگهبانان', 'نگهبان', 'گشت‌ها', 'شکارچیان', 'شکارچی', 'شهروندان',
  'غریبه‌ها', 'غریبه ها', 'غریبه', 'بیگانگان', 'بیگانه', 'دریانوردان', 'ملوانان', 'چوپانان', 'چوپان',
  'معدنچیان', 'معدن‌چیان', 'زائران', 'مهاجمان', 'رهگذران', 'رهگذر',
  'travelers', 'traveler', 'humans', 'human', 'mortals', 'mortal', 'victims', 'victim',
  'wanderers', 'wanderer', 'settlers', 'settler', 'citizens', 'citizen', 'locals', 'local',
  'patrols', 'patrol', 'hunters', 'hunter', 'dwellers', 'dweller', 'villagers', 'villager',
  'guards', 'guard', 'soldiers', 'soldier', 'passersby', 'strangers', 'caravans', 'miners',
  'pilgrims', 'shepherds', 'sailors', 'people', 'inhabitants'
]);

function isGenericHumanoidCollective(name: string): boolean {
  if (!name) return false;
  const clean = name.trim().toLowerCase();
  if (GENERIC_HUMANOID_COLLECTIVES.has(clean)) return true;
  return /^(?:مسافران|مسافر|نیزارنشینان|کاروانیان|روستاییان|قربانیان|انسان‌ها|انسانها|آدمیان|اهالی|ساکنان|رهگذران|travelers|humans|mortals|victims)\b/i.test(clean);
}

/**
 * Checks whether an entity name matches an existing creature, alchemical yield, loot item, artifact, or NPC.
 */
function isEntityKnown(
  name: string,
  bestiary: WorldCreature[],
  artifacts: Array<{ name: string }> = [],
  npcs: Array<{ name: string; title?: string }> = []
): boolean {
  if (!name) return false;
  const norm = name.trim().toLowerCase();
  for (const c of bestiary) {
    const cNorm = c.name.trim().toLowerCase();
    if (cNorm === norm || norm.includes(cNorm) || cNorm.includes(norm)) return true;
    for (const y of c.alchemicalYields || []) {
      const yNorm = y.reagentName.trim().toLowerCase();
      if (yNorm === norm || norm.includes(yNorm) || yNorm.includes(norm)) return true;
    }
    for (const l of c.harvestableLoot || []) {
      const lNorm = l.name.trim().toLowerCase();
      if (lNorm === norm || norm.includes(lNorm) || lNorm.includes(norm)) return true;
    }
  }
  for (const a of artifacts) {
    const aNorm = a.name.trim().toLowerCase();
    if (aNorm === norm || norm.includes(aNorm) || aNorm.includes(norm)) return true;
  }
  for (const n of npcs) {
    const nNorm = n.name.trim().toLowerCase();
    if (nNorm === norm || norm.includes(nNorm) || nNorm.includes(norm)) return true;
    if (n.title) {
      const tNorm = n.title.trim().toLowerCase();
      if (tNorm === norm || norm.includes(tNorm) || tNorm.includes(norm)) return true;
    }
  }
  return false;
}

export default function BestiaryStudioPage() {
  const { story, isPersian, addCreature, editCreature, deleteCreature } = useStudioStory();

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingCreatureId, setEditingCreatureId] = useState<string | null>(null);

  // Form states
  const [cName, setCName] = useState('');
  const [cCategory, setCCategory] = useState<'beast' | 'monstrosity' | 'undead' | 'elemental' | 'flora' | 'draconic' | 'humanoid' | 'mineral'>('beast');
  const [cDanger, setCDanger] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [cRarity, setCRarity] = useState<'common' | 'uncommon' | 'rare' | 'legendary'>('common');
  const [cHabitats, setCHabitats] = useState<string[]>([]);
  const [cTactics, setCTactics] = useState('');
  const [cWeaknesses, setCWeaknesses] = useState('');
  const [cResistances, setCResistances] = useState('');
  const [cLoot, setCLoot] = useState<Array<{ itemId: string; name: string; dropRate: string }>>([]);
  const [cDesc, setCDesc] = useState('');

  // Mineral & Specialized properties
  const [cExtractionMethod, setCExtractionMethod] = useState('');
  const [cCraftingProperties, setCCraftingProperties] = useState('');

  // Plan 05 Form states
  const [cNiche, setCNiche] = useState('');
  const [cPacification, setCPacification] = useState('');
  const [cYields, setCYields] = useState<CreatureAlchemicalYield[]>([]);

  // Temp loot row state
  const [newLootName, setNewLootName] = useState('');
  const [newLootRate, setNewLootRate] = useState('50%');

  // Plan 05: Expandable Drawers & AI Generator States
  const [expandedEcologyIds, setExpandedEcologyIds] = useState<Set<string>>(new Set());
  const [generatingEcologyCreatureId, setGeneratingEcologyCreatureId] = useState<string | null>(null);
  const [ecologyPreview, setEcologyPreview] = useState<{
    targetCreature: WorldCreature;
    payload: EnhancedCreaturePayload;
  } | null>(null);

  // Dedicated Ecology Modal states
  const [editingEcologyCreature, setEditingEcologyCreature] = useState<WorldCreature | null>(null);
  const [ecoNiche, setEcoNiche] = useState('');
  const [ecoPacification, setEcoPacification] = useState('');
  const [ecoYields, setEcoYields] = useState<CreatureAlchemicalYield[]>([]);
  const [ecoPrey, setEcoPrey] = useState<string[]>([]);
  const [ecoPredators, setEcoPredators] = useState<string[]>([]);
  const [newReagentName, setNewReagentName] = useState('');
  const [newReagentRarity, setNewReagentRarity] = useState<'common' | 'uncommon' | 'rare' | 'legendary'>('common');
  const [newReagentUse, setNewReagentUse] = useState('');

  const bestiary = story.worldBible.bestiary || [];
  const locations = story.worldBible.locations || [];

  // ----------------------------------------------------------------
  // Ghost Species & Phantom Habitat Detection Engine
  // ----------------------------------------------------------------
  const ghostSpeciesList = useMemo(() => {
    const artifacts = story.worldBible.artifacts || [];
    const npcs = story.worldBible.npcs || [];
    const ghosts: Array<{
      name: string;
      referencedByCreatureId: string;
      referencedByCreatureName: string;
      role: 'prey' | 'predator' | 'niche_mention' | 'pacification_reagent';
      suggestedCategory: 'beast' | 'flora' | 'mineral';
    }> = [];
    const seen = new Set<string>();

    bestiary.forEach((c) => {
      // 1. Structured Prey references
      if (Array.isArray(c.preySpecies)) {
        c.preySpecies.forEach((p) => {
          const clean = p.trim();
          const norm = clean.toLowerCase();
          if (clean && !isEntityKnown(clean, bestiary, artifacts, npcs) && !isGenericHumanoidCollective(clean) && !seen.has(norm)) {
            seen.add(norm);
            ghosts.push({
              name: clean,
              referencedByCreatureId: c.id,
              referencedByCreatureName: c.name,
              role: 'prey',
              suggestedCategory: resolveSuggestedCategory(clean),
            });
          }
        });
      }

      // 2. Structured Predator references
      if (Array.isArray(c.predatorSpecies)) {
        c.predatorSpecies.forEach((p) => {
          const clean = p.trim();
          const norm = clean.toLowerCase();
          if (clean && !isEntityKnown(clean, bestiary, artifacts, npcs) && !isGenericHumanoidCollective(clean) && !seen.has(norm)) {
            seen.add(norm);
            ghosts.push({
              name: clean,
              referencedByCreatureId: c.id,
              referencedByCreatureName: c.name,
              role: 'predator',
              suggestedCategory: 'beast',
            });
          }
        });
      }

      // 3. Quoted / Bracketed entities in predatorPreyNiche text
      if (c.predatorPreyNiche) {
        const quoted = c.predatorPreyNiche.match(/[«"']([^»"']{2,28})[»"']/g);
        if (quoted) {
          quoted.forEach((q) => {
            const clean = q.replace(/[«»"']/g, '').trim();
            const norm = clean.toLowerCase();
            if (clean && !isEntityKnown(clean, bestiary, artifacts, npcs) && !isGenericHumanoidCollective(clean) && !seen.has(norm) && clean !== c.name.trim()) {
              seen.add(norm);
              ghosts.push({
                name: clean,
                referencedByCreatureId: c.id,
                referencedByCreatureName: c.name,
                role: 'niche_mention',
                suggestedCategory: resolveSuggestedCategory(clean),
              });
            }
          });
        }
      }

      // 4. Structured Pacification Reagents
      if (Array.isArray(c.pacificationReagents)) {
        c.pacificationReagents.forEach((r) => {
          const clean = r.trim();
          const norm = clean.toLowerCase();
          if (clean && !isEntityKnown(clean, bestiary, artifacts, npcs) && !isGenericHumanoidCollective(clean) && !seen.has(norm)) {
            seen.add(norm);
            ghosts.push({
              name: clean,
              referencedByCreatureId: c.id,
              referencedByCreatureName: c.name,
              role: 'pacification_reagent',
              suggestedCategory: resolveSuggestedCategory(clean),
            });
          }
        });
      }

      // 5. Non-Combat Pacification Narrative Text Extraction
      if (c.nonCombatPacificationMethod) {
        const extracted = extractPacificationEntities(c.nonCombatPacificationMethod);
        extracted.forEach((ent) => {
          const norm = ent.name.toLowerCase();
          if (!isEntityKnown(ent.name, bestiary, artifacts, npcs) && !isGenericHumanoidCollective(ent.name) && !seen.has(norm)) {
            seen.add(norm);
            ghosts.push({
              name: ent.name,
              referencedByCreatureId: c.id,
              referencedByCreatureName: c.name,
              role: 'pacification_reagent',
              suggestedCategory: ent.category,
            });
          }
        });
      }
    });

    return ghosts;
  }, [bestiary, story.worldBible.artifacts, story.worldBible.npcs]);

  const filteredCreatures = bestiary.filter((c) => {
    if (filterCategory === 'all') return true;
    return c.speciesCategory === filterCategory;
  });

  const toggleEcologyExpand = (id: string) => {
    setExpandedEcologyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenAddModal = (prefill?: {
    name?: string;
    category?: 'beast' | 'monstrosity' | 'undead' | 'elemental' | 'flora' | 'draconic' | 'humanoid' | 'mineral';
    habitatIds?: string[];
    rarity?: 'common' | 'uncommon' | 'rare' | 'legendary';
    danger?: 1 | 2 | 3 | 4 | 5;
    niche?: string;
    extractionMethod?: string;
    craftingProperties?: string;
  }) => {
    setEditingCreatureId(null);
    setCName(prefill?.name || '');
    setCCategory(prefill?.category || 'beast');
    setCDanger(prefill?.danger || 3);
    setCRarity(prefill?.rarity || 'common');
    setCHabitats(prefill?.habitatIds || []);
    setCTactics('');
    setCWeaknesses('');
    setCResistances('');
    setCLoot([]);
    setCDesc('');
    setCNiche(prefill?.niche || '');
    setCPacification('');
    setCYields([]);
    setCExtractionMethod(prefill?.extractionMethod || '');
    setCCraftingProperties(prefill?.craftingProperties || '');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (c: WorldCreature) => {
    setEditingCreatureId(c.id);
    setCName(c.name);
    setCCategory(c.speciesCategory);
    setCDanger(c.dangerLevel);
    setCRarity(c.rarity || 'common');
    setCHabitats(c.habitatLocationIds || []);
    setCTactics(c.behavioralTactics);
    setCWeaknesses(c.weaknesses.join('\n'));
    setCResistances(c.resistances.join('\n'));
    setCLoot(c.harvestableLoot || []);
    setCDesc(c.loreDescription);
    setCNiche(c.predatorPreyNiche || '');
    setCPacification(c.nonCombatPacificationMethod || '');
    setCYields(c.alchemicalYields || []);
    setCExtractionMethod(c.extractionMethod || '');
    setCCraftingProperties(c.craftingProperties || '');
    setShowAddModal(true);
  };

  const handleAddLootItem = () => {
    if (!newLootName.trim()) return;
    const itemId = `loot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    setCLoot((prev) => [...prev, { itemId, name: newLootName.trim(), dropRate: newLootRate.trim() || '50%' }]);
    setNewLootName('');
  };

  const handleRemoveLootItem = (idx: number) => {
    setCLoot((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveCreature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) {
      notify.error(isPersian ? 'نام موجود یا کانی الزامی است' : 'Creature or mineral name is required');
      return;
    }

    const isMineral = cCategory === 'mineral';

    const weaknessesArr = isMineral
      ? []
      : cWeaknesses
          .split('\n')
          .map((w) => w.trim())
          .filter((w) => w.length > 0);

    const resistancesArr = isMineral
      ? []
      : cResistances
          .split('\n')
          .map((r) => r.trim())
          .filter((r) => r.length > 0);

    const payload: WorldCreature = {
      id: editingCreatureId || `creature_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: cName.trim(),
      speciesCategory: cCategory,
      dangerLevel: isMineral ? 1 : cDanger,
      rarity: cRarity,
      habitatLocationIds: cHabitats,
      behavioralTactics: isMineral
        ? (cExtractionMethod.trim() || (isPersian ? 'استخراج با ابزار ویژه معدن‌کاوی' : 'Excavation via mining tools'))
        : (cTactics.trim() || (isPersian ? 'حمله غافلگیرکننده' : 'Ambush and swarm tactics')),
      weaknesses: isMineral ? [] : (weaknessesArr.length > 0 ? weaknessesArr : [isPersian ? 'آسیب آتشین' : 'Fire damage']),
      resistances: resistancesArr,
      harvestableLoot: cLoot,
      loreDescription: cDesc.trim(),
      predatorPreyNiche: isMineral ? undefined : (cNiche.trim() || undefined),
      nonCombatPacificationMethod: isMineral ? undefined : (cPacification.trim() || undefined),
      alchemicalYields: cYields.length > 0 ? cYields : undefined,
      extractionMethod: isMineral ? (cExtractionMethod.trim() || undefined) : undefined,
      craftingProperties: isMineral ? (cCraftingProperties.trim() || undefined) : undefined,
      pacificationReagents: editingCreatureId
        ? bestiary.find((b) => b.id === editingCreatureId)?.pacificationReagents
        : undefined,
    };

    if (editingCreatureId) {
      editCreature(editingCreatureId, payload);
      notify.success(isPersian ? 'اطلاعات با موفقیت به‌روزرسانی شد' : 'Creature updated');
    } else {
      addCreature(payload);
      notify.success(isPersian ? 'گونه یا کانی جدید به زیست‌بوم افزوده شد' : 'Added to bestiary');
    }

    setShowAddModal(false);
  };

  // ----------------------------------------------------------------
  // Plan 05: AI Ecology & Reagents Generator
  // ----------------------------------------------------------------
  const handleGenerateCreatureEcology = async (creature: WorldCreature) => {
    try {
      setGeneratingEcologyCreatureId(creature.id);
      const promptParts = [
        `Generate ecological or supernatural role, non-lethal subdual / pacification / harvesting methods, and 1 to 3 harvestable alchemical / crafting reagents for "${creature.name}" (${creature.speciesCategory}, Danger Level ${creature.dangerLevel}).`,
      ];
      if (creature.loreDescription?.trim()) {
        promptParts.push(`Entity Lore & Physiology: "${creature.loreDescription.trim()}"`);
      }
      if (creature.behavioralTactics?.trim()) {
        promptParts.push(`Behavioral Tactics & Combat: "${creature.behavioralTactics.trim()}"`);
      }
      if (creature.weaknesses?.length) {
        promptParts.push(`Known Weaknesses: ${creature.weaknesses.join(', ')}`);
      }
      if (creature.resistances?.length) {
        promptParts.push(`Known Resistances: ${creature.resistances.join(', ')}`);
      }
      if (creature.habitatLocationIds?.length) {
        const habitatNames = creature.habitatLocationIds
          .map((id) => locations.find((l) => l.id === id)?.name || id)
          .join(', ');
        promptParts.push(`Habitats & Distribution: ${habitatNames}`);
      }
      if (creature.extractionMethod?.trim()) {
        promptParts.push(`Extraction Notes: "${creature.extractionMethod.trim()}"`);
      }
      if (creature.craftingProperties?.trim()) {
        promptParts.push(`Crafting Properties: "${creature.craftingProperties.trim()}"`);
      }

      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'creature_ecology',
          prompt: promptParts.join('\n'),
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate ecology (${res.status})`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data.alchemicalYields)) {
        setEcologyPreview({
          targetCreature: creature,
          payload: json.data,
        });
      } else {
        notify.error(isPersian ? 'قالب اکولوژی معتبر نبود' : 'Invalid creature ecology format');
      }
    } catch (err: any) {
      notify.error(err.message || 'Error generating creature ecology');
    } finally {
      setGeneratingEcologyCreatureId(null);
    }
  };

  const handleCommitEcology = () => {
    if (!ecologyPreview) return;
    const { targetCreature, payload } = ecologyPreview;
    editCreature(targetCreature.id, {
      predatorPreyNiche: payload.predatorPreyNiche,
      nonCombatPacificationMethod: payload.nonCombatPacificationMethod,
      alchemicalYields: payload.alchemicalYields,
      preySpecies: payload.preySpecies,
      predatorSpecies: payload.predatorSpecies,
      pacificationReagents: payload.pacificationReagents,
    });
    setExpandedEcologyIds((prev) => new Set(prev).add(targetCreature.id));
    setEcologyPreview(null);
    notify.success(isPersian ? 'اکولوژی و مواد کیمیاگری ثبت شد' : 'Ecology and alchemical yields saved');
  };

  const handleOpenEcologyModal = (
    c: WorldCreature,
    initial?: { niche?: string; pacification?: string; yields?: CreatureAlchemicalYield[]; prey?: string[]; predators?: string[] }
  ) => {
    setEditingEcologyCreature(c);
    setEcoNiche(initial?.niche ?? c.predatorPreyNiche ?? '');
    setEcoPacification(initial?.pacification ?? c.nonCombatPacificationMethod ?? '');
    setEcoYields(
      initial?.yields
        ? JSON.parse(JSON.stringify(initial.yields))
        : c.alchemicalYields
        ? JSON.parse(JSON.stringify(c.alchemicalYields))
        : []
    );
    setEcoPrey(initial?.prey ?? c.preySpecies ?? []);
    setEcoPredators(initial?.predators ?? c.predatorSpecies ?? []);
    setNewReagentName('');
    setNewReagentRarity('common');
    setNewReagentUse('');
  };

  const handleAddYieldToModal = () => {
    if (!newReagentName.trim()) return;
    setEcoYields((prev) => [
      ...prev,
      {
        reagentName: newReagentName.trim(),
        rarity: newReagentRarity,
        craftingUse: newReagentUse.trim() || (isPersian ? 'کاربرد عمومی در کیمیاگری' : 'General alchemical crafting'),
      },
    ]);
    setNewReagentName('');
    setNewReagentRarity('common');
    setNewReagentUse('');
  };

  const handleRemoveYieldFromModal = (idx: number) => {
    setEcoYields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateYieldInModal = (
    idx: number,
    field: keyof CreatureAlchemicalYield,
    val: string
  ) => {
    setEcoYields((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const handleSaveEcologyModal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingEcologyCreature) return;
    editCreature(editingEcologyCreature.id, {
      predatorPreyNiche: ecoNiche.trim() || undefined,
      nonCombatPacificationMethod: ecoPacification.trim() || undefined,
      alchemicalYields: ecoYields.length > 0 ? ecoYields : undefined,
      preySpecies: ecoPrey.length > 0 ? ecoPrey : undefined,
      predatorSpecies: ecoPredators.length > 0 ? ecoPredators : undefined,
    });
    setExpandedEcologyIds((prev) => new Set(prev).add(editingEcologyCreature.id));
    setEditingEcologyCreature(null);
    notify.success(isPersian ? 'اکولوژی و مواد کیمیاگری به‌روزرسانی شد' : 'Ecology and reagents updated');
  };

  const handleDeleteEcology = async (c: WorldCreature) => {
    const conf = await notify.confirm({
      title: isPersian ? 'حذف داده‌های اکولوژی' : 'Clear Ecology',
      message: isPersian
        ? `آیا از حذف زنجیره غذایی، روش رام‌سازی و مواد کیمیاگری "${c.name}" مطمئن هستید؟`
        : `Are you sure you want to clear ecology and alchemical yields for "${c.name}"?`,
      confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (conf) {
      editCreature(c.id, {
        predatorPreyNiche: undefined,
        nonCombatPacificationMethod: undefined,
        alchemicalYields: undefined,
        preySpecies: undefined,
        predatorSpecies: undefined,
      });
      notify.success(isPersian ? 'داده‌های اکولوژی پاک شد' : 'Ecology data cleared');
    }
  };

  const handleDeleteSingleReagent = async (c: WorldCreature, idx: number) => {
    const reagent = c.alchemicalYields?.[idx];
    if (!reagent) return;
    const conf = await notify.confirm({
      title: isPersian ? 'حذف ماده کیمیاگری' : 'Delete Reagent',
      message: isPersian
        ? `آیا از حذف ماده کیمیاگری "${reagent.reagentName}" مطمئن هستید؟`
        : `Are you sure you want to remove "${reagent.reagentName}"?`,
      confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (conf) {
      const updated = (c.alchemicalYields || []).filter((_, i) => i !== idx);
      editCreature(c.id, {
        alchemicalYields: updated.length > 0 ? updated : undefined,
      });
      notify.success(isPersian ? 'ماده کیمیاگری حذف شد' : 'Reagent removed');
    }
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    if (!cName && data.name) setCName(data.name as string);
    if (data.speciesCategory) setCCategory(data.speciesCategory as typeof cCategory);
    if (data.dangerLevel) setCDanger(data.dangerLevel as typeof cDanger);
    if (data.rarity) setCRarity(data.rarity as typeof cRarity);
    if (Array.isArray(data.habitatLocationIds) && (!cHabitats || cHabitats.length === 0)) {
      setCHabitats(data.habitatLocationIds as string[]);
    }
    if (!cTactics && data.behavioralTactics) setCTactics(data.behavioralTactics as string);
    if (!cDesc && data.loreDescription) setCDesc(data.loreDescription as string);
    if (!cWeaknesses && Array.isArray(data.weaknesses)) setCWeaknesses((data.weaknesses as string[]).join('\n'));
    if (!cResistances && Array.isArray(data.resistances)) setCResistances((data.resistances as string[]).join('\n'));
    if (Array.isArray(data.harvestableLoot) && !cLoot.length) {
      setCLoot(data.harvestableLoot as typeof cLoot);
    }
    if (!cNiche && data.predatorPreyNiche) setCNiche(data.predatorPreyNiche as string);
    if (!cPacification && data.nonCombatPacificationMethod) setCPacification(data.nonCombatPacificationMethod as string);
    if (!cYields.length && Array.isArray(data.alchemicalYields)) setCYields(data.alchemicalYields as CreatureAlchemicalYield[]);
    if (!cExtractionMethod && data.extractionMethod) setCExtractionMethod(data.extractionMethod as string);
    if (!cCraftingProperties && data.craftingProperties) setCCraftingProperties(data.craftingProperties as string);
  };

  const renderDangerStars = (level: number) => {
    return (
      <div className="flex items-center gap-1.5" dir="ltr">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Skull
              key={star}
              className={`w-3.5 h-3.5 ${
                star <= level ? 'text-red-400 fill-red-400/20' : 'text-zinc-700'
              }`}
            />
          ))}
        </div>
        <span className="text-[11px] font-medium text-zinc-400">
          {isPersian ? `سطح ${level}` : `Lvl ${level}`}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Skull className="w-5 h-5 text-red-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'دانشنامه جانوران، گیاهان و زیست‌بوم جهان' : 'Fauna, Flora & Ecological Systems'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'مدیریت گونه‌های جانوری، گیاهان، قارچ‌ها، زنجیره غذایی، روش‌های رام‌سازی، زیستگاه‌ها و مواد کیمیاگری.'
              : 'Catalogue fauna, botanicals, ecological niches, non-lethal pacification, habitats, and alchemical crafting yields.'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {ghostSpeciesList.length > 0 && (
            <button
              onClick={() => setFilterCategory('ghosts')}
              className="text-xs bg-red-500/15 border border-red-500/30 hover:border-red-500/60 text-red-300 px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse cursor-pointer"
            >
              <Ghost className="w-3.5 h-3.5 text-red-400" />
              <span>
                {ghostSpeciesList.length} {isPersian ? 'گونه ناموجود شناسایی شد' : 'Ghost species detected'}
              </span>
            </button>
          )}
          <span className="text-xs bg-red-500/10 border border-red-500/20 text-red-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-red-400" />
            {bestiary.length} {isPersian ? 'گونه ثبت‌شده' : 'Registered Species'}
          </span>
          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-400 text-zinc-950 text-xs font-bold shadow-lg shadow-red-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? '+ ثبت گونه جدید' : '+ Add Creature'}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterCategory === 'all'
              ? 'bg-red-500/10 border border-red-500/30 text-red-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'همه گونه‌ها' : 'All Species'} ({bestiary.length})
        </button>
        {Object.entries(SPECIES_CATEGORIES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setFilterCategory(key)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              filterCategory === key
                ? 'bg-red-500/10 border border-red-500/30 text-red-400 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
            }`}
          >
            {isPersian ? val.labelFa : val.labelEn}
          </button>
        ))}
        {ghostSpeciesList.length > 0 && (
          <button
            onClick={() => setFilterCategory('ghosts')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filterCategory === 'ghosts'
                ? 'bg-red-500/20 border border-red-500/50 text-red-300 shadow-md shadow-red-500/20'
                : 'text-red-400/90 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20'
            }`}
          >
            <Ghost className="w-3.5 h-3.5 text-red-400" />
            <span>{isPersian ? 'گونه‌های ناموجود' : 'Ghost Species'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-red-500/30 text-[10px] font-mono">
              {ghostSpeciesList.length}
            </span>
          </button>
        )}
      </div>

      {/* Bestiary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filterCategory === 'ghosts' ? (
          ghostSpeciesList.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
              <Ghost className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-zinc-300">
                {isPersian ? 'گونه ناموجودی یافت نشد؛ بوم‌سازگان کامل است!' : 'No ghost species found; ecology is complete!'}
              </h4>
            </div>
          ) : (
            ghostSpeciesList.map((ghost, gIdx) => (
              <div
                key={gIdx}
                className="bg-red-950/20 border border-red-500/40 hover:border-red-500/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl shadow-red-950/20 flex flex-col justify-between transition-all space-y-4 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-500/0 via-red-500/60 to-red-500/0" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-red-500/20 pb-3">
                    <span className="px-2.5 py-0.5 rounded-xl text-xs font-bold border text-red-300 bg-red-500/10 border-red-500/30 flex items-center gap-1.5 animate-pulse">
                      <Ghost className="w-3.5 h-3.5 text-red-400" />
                      <span>{isPersian ? 'گونه یا کانی ناموجود در جهان' : 'Ghost / Missing Entity'}</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {ghost.suggestedCategory === 'mineral'
                        ? isPersian
                          ? '💎 کانی / سنگ معدنی'
                          : 'Mineral / Ore'
                        : ghost.suggestedCategory === 'flora'
                        ? isPersian
                          ? '🌿 رستنی / گیاه'
                          : 'Flora'
                        : isPersian
                        ? '🐾 جانور'
                        : 'Fauna'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-red-200 flex items-center gap-2">
                      <span>{ghost.name}</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {ghost.suggestedCategory === 'mineral'
                        ? isPersian
                          ? `این کانی یا نمک معدنی در روش رام‌سازی، ساخت یا اکولوژی «${ghost.referencedByCreatureName}» قید شده است، اما هنوز در کتاب جهان ثبت نشده است.`
                          : `Referenced as a required mineral or alchemical reagent for "${ghost.referencedByCreatureName}", but has no registered entry in the world bible.`
                        : ghost.role === 'pacification_reagent'
                        ? isPersian
                          ? `در روش رام‌سازی بدون خون‌ریزی «${ghost.referencedByCreatureName}» به این ماده یا گیاه نیاز است، ولی هنوز در جهان ثبت نشده است.`
                          : `Required for the non-combat pacification of "${ghost.referencedByCreatureName}", but has no registered entry in the world bible.`
                        : ghost.role === 'prey'
                        ? isPersian
                          ? `این گونه به عنوان منبع غذایی / طعمه توسط «${ghost.referencedByCreatureName}» مصرف می‌شود ولی شناسنامه‌ای در جهان ندارد.`
                          : `Referenced as prey / sustenance by "${ghost.referencedByCreatureName}", but has no entry in the bestiary.`
                        : ghost.role === 'predator'
                        ? isPersian
                          ? `این گونه به عنوان شکارچی و تهدید طبیعی «${ghost.referencedByCreatureName}» ذکر شده ولی در جهان ثبت نشده است.`
                          : `Referenced as a predator / threat to "${ghost.referencedByCreatureName}", but has no entry in the bestiary.`
                        : isPersian
                        ? `در جایگاه بوم‌شناختی «${ghost.referencedByCreatureName}» به نام این گونه اشاره شده ولی ثبت مستقل نشده است.`
                        : `Mentioned in the ecological niche of "${ghost.referencedByCreatureName}", but lacks an independent entry.`}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-red-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">
                    {isPersian ? 'ارجاع‌دهنده:' : 'Referenced by:'} <strong className="text-zinc-300">{ghost.referencedByCreatureName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenAddModal({
                        name: ghost.name,
                        category: ghost.suggestedCategory,
                        niche:
                          ghost.suggestedCategory === 'mineral'
                            ? undefined
                            : ghost.role === 'pacification_reagent'
                            ? isPersian
                              ? `ماده یا گیاه مورد نیاز در روش رام‌سازی ${ghost.referencedByCreatureName}`
                              : `Required for pacifying ${ghost.referencedByCreatureName}`
                            : ghost.role === 'prey'
                            ? isPersian
                              ? `منبع غذایی برای ${ghost.referencedByCreatureName}`
                              : `Sustenance for ${ghost.referencedByCreatureName}`
                            : ghost.role === 'predator'
                            ? isPersian
                              ? `شکارچی طبیعی ${ghost.referencedByCreatureName}`
                              : `Natural predator of ${ghost.referencedByCreatureName}`
                            : undefined,
                        extractionMethod:
                          ghost.suggestedCategory === 'mineral'
                            ? isPersian
                              ? `استخراج رگه‌های ${ghost.name} از صخره‌ها یا غارهای منطقه`
                              : `Mining veins of ${ghost.name} in regional caverns`
                            : undefined,
                        craftingProperties:
                          ghost.suggestedCategory === 'mineral'
                            ? isPersian
                              ? `مورد استفاده در کیمیاگری و روش رام‌سازی «${ghost.referencedByCreatureName}»`
                              : `Used in alchemy and pacification of "${ghost.referencedByCreatureName}"`
                            : undefined,
                      })
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-400 text-zinc-950 text-xs font-bold shadow-md shadow-red-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isPersian ? 'ثبت فوری در جهان' : 'Materialize'}</span>
                  </button>
                </div>
              </div>
            ))
          )
        ) : filteredCreatures.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
            <Skull className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">
              {isPersian ? 'موجودی در این رده زیستی یافت نشد' : 'No creatures found in this category'}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {isPersian ? 'برای ثبت موجود روی دکمه ثبت گونه جدید کلیک کنید.' : 'Click "+ Add Creature" to populate the bestiary.'}
            </p>
          </div>
        ) : (
          filteredCreatures.map((c) => {
            const catMeta = SPECIES_CATEGORIES[c.speciesCategory] || SPECIES_CATEGORIES.beast;
            const isEcologyExpanded = expandedEcologyIds.has(c.id);

            return (
              <div
                key={c.id}
                className="bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all space-y-4"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${catMeta.color}`}>
                        {isPersian ? catMeta.labelFa : catMeta.labelEn}
                      </span>
                      {(() => {
                        const rMeta = CREATURE_RARITY[c.rarity || 'common'] || CREATURE_RARITY.common;
                        return (
                          <span className={`px-2.5 py-0.5 rounded-xl text-[10.5px] font-medium border ${rMeta.badgeClass}`}>
                            {isPersian ? rMeta.labelFa : rMeta.labelEn}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateCreatureEcology(c)}
                        disabled={generatingEcologyCreatureId === c.id}
                        className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                        title={isPersian ? 'تولید اکولوژی و مواد کیمیاگری' : 'Generate Ecology & Reagents'}
                      >
                        <Leaf className="w-3.5 h-3.5" />
                        <span>
                          {generatingEcologyCreatureId === c.id
                            ? isPersian
                              ? 'سنتز...'
                              : 'Synthesizing...'
                            : isPersian
                            ? '🌿 اکولوژی'
                            : '🌿 Ecology'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const conf = await notify.confirm({
                            title: isPersian ? 'حذف موجود' : 'Delete Creature',
                            message: isPersian
                              ? `آیا از حذف "${c.name}" از زیست‌بوم جهان مطمئن هستید؟`
                              : `Are you sure you want to delete "${c.name}"?`,
                            confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
                            cancelText: isPersian ? 'انصراف' : 'Cancel',
                            isDestructive: true,
                          });
                          if (conf) deleteCreature(c.id);
                        }}
                        className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-bold text-zinc-100">{c.name}</h3>
                      {c.speciesCategory === 'mineral' ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1">
                          <Gem className="w-3.5 h-3.5" />
                          <span>{isPersian ? 'رگه معدنی / کانی' : 'Mineral Vein'}</span>
                        </span>
                      ) : (
                        renderDangerStars(c.dangerLevel)
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{c.loreDescription}</p>
                  </div>

                  {c.speciesCategory === 'mineral' ? (
                    <div className="space-y-2">
                      {c.extractionMethod && (
                        <div className="p-3 bg-zinc-950/60 border border-amber-500/20 rounded-2xl text-xs space-y-1">
                          <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                            <Pickaxe className="w-3.5 h-3.5" />
                            <span>{isPersian ? 'شرایط و خطرات استخراج:' : 'Extraction Conditions & Mining Hazards:'}</span>
                          </span>
                          <p className="text-zinc-300 leading-relaxed">{c.extractionMethod}</p>
                        </div>
                      )}
                      {c.craftingProperties && (
                        <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-2xl text-xs space-y-1">
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                            <FlaskConical className="w-3.5 h-3.5" />
                            <span>{isPersian ? 'خواص فیزیکی و کیمیاگری:' : 'Crafting & Alchemical Properties:'}</span>
                          </span>
                          <p className="text-zinc-300 leading-relaxed">{c.craftingProperties}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Tactics */}
                      <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl text-xs space-y-1">
                        <span className="text-[11px] font-bold text-red-400 block">
                          ⚔️ {isPersian ? 'تاکتیک‌های نبرد و رفتار:' : 'Combat Tactics & Behavior:'}
                        </span>
                        <p className="text-zinc-300 leading-relaxed">{c.behavioralTactics}</p>
                      </div>

                      {/* Weaknesses & Resistances */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-2xl bg-zinc-950/40 border border-zinc-800 space-y-1">
                          <span className="text-[10.5px] font-bold text-rose-400 block">
                            🎯 {isPersian ? 'نقاط ضعف:' : 'Weaknesses:'}
                          </span>
                          <ul className="space-y-0.5 text-zinc-300 text-[11px]">
                            {c.weaknesses.map((w, idx) => (
                              <li key={idx}>• {w}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-zinc-950/40 border border-zinc-800 space-y-1">
                          <span className="text-[10.5px] font-bold text-sky-400 block">
                            🛡️ {isPersian ? 'مقاومت‌ها:' : 'Resistances:'}
                          </span>
                          <ul className="space-y-0.5 text-zinc-300 text-[11px]">
                            {c.resistances.length ? (
                              c.resistances.map((r, idx) => <li key={idx}>• {r}</li>)
                            ) : (
                              <li className="text-zinc-500 italic">{isPersian ? 'بدون مقاومت ویژه' : 'None'}</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Plan 05: Ecology & Alchemical Reagents Drawer */}
                  <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => toggleEcologyExpand(c.id)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Leaf className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-zinc-200">
                          {isPersian ? 'اکولوژی و مواد کیمیاگری' : 'Ecology & Alchemical Yields'}
                        </span>
                        {c.alchemicalYields && c.alchemicalYields.length > 0 && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-mono">
                            {c.alchemicalYields.length} {isPersian ? 'ماده' : 'reagents'}
                          </span>
                        )}
                      </div>
                      {isEcologyExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>

                    {isEcologyExpanded && (
                      <div className="p-3.5 pt-0 space-y-2.5 text-xs border-t border-zinc-900 animate-fadeIn">
                        {(c.predatorPreyNiche || c.nonCombatPacificationMethod || (c.alchemicalYields && c.alchemicalYields.length > 0) || (c.preySpecies && c.preySpecies.length > 0) || (c.predatorSpecies && c.predatorSpecies.length > 0)) && (
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                              <Leaf className="w-3.5 h-3.5" />
                              {isPersian ? 'مدیریت اکولوژی و کیمیاگری' : 'Ecology & Yield Controls'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEcologyModal(c)}
                                className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                title={isPersian ? 'ویرایش اکولوژی و مواد' : 'Edit Ecology & Reagents'}
                              >
                                <Edit2 className="w-3 h-3 text-amber-400" />
                                <span>{isPersian ? 'ویرایش' : 'Edit'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEcology(c)}
                                className="px-2.5 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                title={isPersian ? 'حذف داده‌های اکولوژی' : 'Clear Ecology Data'}
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                                <span>{isPersian ? 'حذف' : 'Clear'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {c.predatorPreyNiche && (
                          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px]">
                            <span className="text-[10px] text-zinc-500 block">
                              🦁 {isPersian ? 'جایگاه در زنجیره غذایی:' : 'Ecological Niche:'}
                            </span>
                            <p className="text-zinc-300 mt-0.5">{c.predatorPreyNiche}</p>
                          </div>
                        )}

                        {/* Food Chain Prey & Predator Tags with Ghost Species Tracker */}
                        {((c.preySpecies && c.preySpecies.length > 0) || (c.predatorSpecies && c.predatorSpecies.length > 0)) && (
                          <div className="space-y-2 pt-0.5">
                            {c.preySpecies && c.preySpecies.length > 0 && (
                              <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">
                                  🐰 {isPersian ? 'طعمه‌ها و گیاهان مصرفی:' : 'Prey & Foraged Flora:'}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {c.preySpecies.map((p, pIdx) => {
                                    const pNorm = p.trim().toLowerCase();
                                    const exists = bestiary.some((item) => item.name.trim().toLowerCase() === pNorm);
                                    const matchingNpc = (story.worldBible.npcs || []).find(
                                      (n) => n.name.trim().toLowerCase() === pNorm || n.name.toLowerCase().includes(pNorm) || pNorm.includes(n.name.toLowerCase())
                                    );
                                    const isGeneric = isGenericHumanoidCollective(p);

                                    if (exists) {
                                      return (
                                        <span key={pIdx} className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10.5px]">
                                          {p}
                                        </span>
                                      );
                                    }

                                    if (matchingNpc) {
                                      return (
                                        <span
                                          key={pIdx}
                                          className="px-2 py-0.5 rounded-lg bg-indigo-950/40 border border-indigo-500/40 text-indigo-300 text-[10.5px] flex items-center gap-1"
                                          title={isPersian ? `شخصیت مستقل (NPC): ${matchingNpc.name}` : `NPC: ${matchingNpc.name}`}
                                        >
                                          <span>👤</span>
                                          <span>{p}</span>
                                        </span>
                                      );
                                    }

                                    if (isGeneric) {
                                      return (
                                        <span
                                          key={pIdx}
                                          className="px-2 py-0.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-400 text-[10.5px] flex items-center gap-1"
                                        >
                                          <span>👥</span>
                                          <span>{p}</span>
                                        </span>
                                      );
                                    }

                                    return (
                                      <button
                                        type="button"
                                        key={pIdx}
                                        onClick={() =>
                                          handleOpenAddModal({
                                            name: p,
                                            category: p.includes('گیاه') || p.includes('قارچ') || p.includes('گل') || p.includes('ریشه') ? 'flora' : 'beast',
                                            niche: isPersian ? `منبع غذایی برای ${c.name}` : `Prey of ${c.name}`,
                                          })
                                        }
                                        className="px-2 py-0.5 rounded-lg bg-red-950/40 border border-red-500/50 hover:border-red-400 text-red-300 text-[10.5px] flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse cursor-pointer"
                                        title={isPersian ? 'گونه در جهان ثبت نشده است! برای ثبت کلیک کنید.' : 'Missing species! Click to materialize.'}
                                      >
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                        <span>{p}</span>
                                        <Plus className="w-2.5 h-2.5 text-red-300" />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {c.predatorSpecies && c.predatorSpecies.length > 0 && (
                              <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">
                                  🐺 {isPersian ? 'شکارچیان طبیعی:' : 'Natural Predators:'}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {c.predatorSpecies.map((p, pIdx) => {
                                    const pNorm = p.trim().toLowerCase();
                                    const exists = bestiary.some((item) => item.name.trim().toLowerCase() === pNorm);
                                    const matchingNpc = (story.worldBible.npcs || []).find(
                                      (n) => n.name.trim().toLowerCase() === pNorm || n.name.toLowerCase().includes(pNorm) || pNorm.includes(n.name.toLowerCase())
                                    );
                                    const isGeneric = isGenericHumanoidCollective(p);

                                    if (exists) {
                                      return (
                                        <span key={pIdx} className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10.5px]">
                                          {p}
                                        </span>
                                      );
                                    }

                                    if (matchingNpc) {
                                      return (
                                        <span
                                          key={pIdx}
                                          className="px-2 py-0.5 rounded-lg bg-indigo-950/40 border border-indigo-500/40 text-indigo-300 text-[10.5px] flex items-center gap-1"
                                          title={isPersian ? `شخصیت مستقل (NPC): ${matchingNpc.name}` : `NPC: ${matchingNpc.name}`}
                                        >
                                          <span>👤</span>
                                          <span>{p}</span>
                                        </span>
                                      );
                                    }

                                    if (isGeneric) {
                                      return (
                                        <span
                                          key={pIdx}
                                          className="px-2 py-0.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-400 text-[10.5px] flex items-center gap-1"
                                        >
                                          <span>👥</span>
                                          <span>{p}</span>
                                        </span>
                                      );
                                    }

                                    return (
                                      <button
                                        type="button"
                                        key={pIdx}
                                        onClick={() =>
                                          handleOpenAddModal({
                                            name: p,
                                            category: 'beast',
                                            niche: isPersian ? `شکارچی طبیعی ${c.name}` : `Natural predator of ${c.name}`,
                                          })
                                        }
                                        className="px-2 py-0.5 rounded-lg bg-red-950/40 border border-red-500/50 hover:border-red-400 text-red-300 text-[10.5px] flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse cursor-pointer"
                                        title={isPersian ? 'گونه در جهان ثبت نشده است! برای ثبت کلیک کنید.' : 'Missing species! Click to materialize.'}
                                      >
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                        <span>{p}</span>
                                        <Plus className="w-2.5 h-2.5 text-red-300" />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {c.nonCombatPacificationMethod && (
                          <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300/90 space-y-2">
                            <div>
                              <span className="text-[10px] text-emerald-400 font-bold block">
                                🤝 {isPersian ? 'روش رام‌سازی بدون خون‌ریزی:' : 'Non-Combat Pacification:'}
                              </span>
                              <p className="mt-0.5 leading-relaxed">{c.nonCombatPacificationMethod}</p>
                            </div>

                            {/* Detected Missing Pacification Reagents / Beasts */}
                            {(() => {
                              const artifacts = story.worldBible.artifacts || [];
                              const npcs = story.worldBible.npcs || [];
                              const pacEntities = [
                                ...(Array.isArray(c.pacificationReagents)
                                  ? c.pacificationReagents.map((r) => ({
                                      name: r,
                                      category: resolveSuggestedCategory(r),
                                    }))
                                  : []),
                                ...extractPacificationEntities(c.nonCombatPacificationMethod),
                              ].filter((item, idx, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === item.name.trim().toLowerCase()) === idx);

                              const missingPacEntities = pacEntities.filter(
                                (item) => !isEntityKnown(item.name, bestiary, artifacts, npcs) && !isGenericHumanoidCollective(item.name)
                              );
                              if (missingPacEntities.length === 0) return null;

                              return (
                                <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                                  <span className="text-[10px] font-bold text-red-300 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 animate-pulse" />
                                    {isPersian
                                      ? 'ماده، کانی، گیاه یا گونه مفقود در جهان برای این روش رام‌سازی:'
                                      : 'Unregistered plant / mineral / reagent required for pacification:'}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {missingPacEntities.map((item, mIdx) => (
                                      <button
                                        type="button"
                                        key={mIdx}
                                        onClick={() =>
                                          handleOpenAddModal({
                                            name: item.name,
                                            category: item.category,
                                            niche:
                                              item.category === 'mineral'
                                                ? undefined
                                                : isPersian
                                                ? `ماده یا گیاه مورد استفاده در روش رام‌سازی «${c.name}»`
                                                : `Required for pacifying "${c.name}"`,
                                            extractionMethod:
                                              item.category === 'mineral'
                                                ? isPersian
                                                  ? `استخراج رگه‌های ${item.name} از صخره‌ها یا غارهای منطقه`
                                                  : `Mining veins of ${item.name} in regional caverns`
                                                : undefined,
                                            craftingProperties:
                                              item.category === 'mineral'
                                                ? isPersian
                                                  ? `مورد استفاده در کیمیاگری و روش رام‌سازی «${c.name}»`
                                                  : `Used in alchemy and pacification of "${c.name}"`
                                                : undefined,
                                          })
                                        }
                                        className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-500/60 hover:border-red-400 text-red-200 text-[10.5px] font-medium flex items-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.25)] animate-pulse cursor-pointer transition-all"
                                        title={isPersian ? 'کلیک کنید تا این موجود، گیاه یا کانی فوراً در جهان ثبت شود' : 'Click to materialize this entity'}
                                      >
                                        <span>{item.category === 'mineral' ? '💎' : item.category === 'flora' ? '🌿' : '🐾'}</span>
                                        <strong>{item.name}</strong>
                                        <span className="text-[9px] text-red-400 font-mono">({isPersian ? 'ناموجود' : 'missing'})</span>
                                        <Plus className="w-3 h-3 text-red-300 ml-0.5" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {c.alchemicalYields && c.alchemicalYields.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 block">
                              🧪 {isPersian ? 'مواد قابل استخراج کیمیاگری و ساخت:' : 'Alchemical Harvest Yields:'}
                            </span>
                            {c.alchemicalYields.map((yieldItem, yIdx) => (
                              <div
                                key={yIdx}
                                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] flex items-start justify-between gap-2 group"
                              >
                                <div>
                                  <strong className="text-zinc-200 block">{yieldItem.reagentName}</strong>
                                  <p className="text-[10px] text-zinc-400 mt-0.5">{yieldItem.craftingUse}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[9px] uppercase">
                                    {isPersian ? RARITY_LABELS[yieldItem.rarity]?.fa || yieldItem.rarity : yieldItem.rarity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSingleReagent(c, yIdx)}
                                    title={isPersian ? 'حذف این ماده کیمیاگری' : 'Delete this reagent'}
                                    className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!c.predatorPreyNiche && !c.nonCombatPacificationMethod && (!c.alchemicalYields || c.alchemicalYields.length === 0) && (!c.preySpecies || c.preySpecies.length === 0) && (!c.predatorSpecies || c.predatorSpecies.length === 0) && (
                          <div className="text-center py-4 text-zinc-500 text-xs space-y-2">
                            <p>{isPersian ? 'اکولوژی برای این موجود تعریف نشده است.' : 'No ecology data recorded.'}</p>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleGenerateCreatureEcology(c)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{isPersian ? 'تولید با هوش مصنوعی' : 'Generate with AI'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEcologyModal(c)}
                                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{isPersian ? 'افزودن دستی' : 'Add Manually'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Habitats */}
                <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    {c.habitatLocationIds && c.habitatLocationIds.length > 0 ? (
                      c.habitatLocationIds.map((locId) => {
                        const loc = locations.find((l) => l.id === locId);
                        if (loc) {
                          return (
                            <span
                              key={locId}
                              className="px-2 py-0.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-[10.5px]"
                            >
                              {loc.name}
                            </span>
                          );
                        }
                        return (
                          <span
                            key={locId}
                            className="px-2 py-0.5 rounded-lg bg-red-950/40 border border-red-500/50 text-red-300 text-[10.5px] flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
                            title={isPersian ? 'شناسه مکان در کتاب جهان یافت نشد' : 'Location ID not found in world bible'}
                          >
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <span>{locId}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-zinc-500 italic">
                        {isPersian ? 'زیستگاه نامشخص' : 'Unknown habitat'}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-zinc-500 text-[10px]">ID: {c.id}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Plan 05: Creature Ecology Preview Modal */}
      {ecologyPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-400" />
                {isPersian ? 'پیش‌نمایش اکولوژی و مواد کیمیاگری' : 'Creature Ecology Preview'}
              </h3>
              <button
                onClick={() => setEcologyPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">{isPersian ? 'موجود:' : 'Creature:'}</span>
                <strong className="text-zinc-100 text-sm">{ecologyPreview.targetCreature.name}</strong>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold block">
                  🦁 {isPersian ? 'جایگاه در زنجیره غذایی:' : 'Ecological Niche:'}
                </span>
                <p className="text-zinc-300">{ecologyPreview.payload.predatorPreyNiche}</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1 text-emerald-300/90">
                <span className="text-[10px] text-emerald-400 font-bold block">
                  🤝 {isPersian ? 'روش رام‌سازی بدون مبارزه:' : 'Non-Combat Pacification:'}
                </span>
                <p>{ecologyPreview.payload.nonCombatPacificationMethod}</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-400 font-bold block">
                  🧪 {isPersian ? 'مواد کیمیاگری و ساخت:' : 'Harvestable Reagents:'}
                </span>
                {ecologyPreview.payload.alchemicalYields.map((yieldItem, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start justify-between gap-2"
                  >
                    <div>
                      <strong className="text-zinc-200">{yieldItem.reagentName}</strong>
                      <p className="text-[10.5px] text-zinc-400 mt-0.5">{yieldItem.craftingUse}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[10px] uppercase shrink-0">
                      {isPersian ? RARITY_LABELS[yieldItem.rarity]?.fa || yieldItem.rarity : yieldItem.rarity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEcologyPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = ecologyPreview.targetCreature;
                  const p = ecologyPreview.payload;
                  setEcologyPreview(null);
                  handleOpenEcologyModal(target, {
                    niche: p.predatorPreyNiche,
                    pacification: p.nonCombatPacificationMethod,
                    yields: p.alchemicalYields,
                  });
                }}
                className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isPersian ? 'ویرایش قبل از ثبت' : 'Edit Before Saving'}</span>
              </button>
              <button
                type="button"
                onClick={handleCommitEcology}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت مستقیم' : '📥 Save Ecology'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Creature Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Skull className="w-5 h-5 text-red-400" />
                {editingCreatureId
                  ? cCategory === 'mineral'
                    ? isPersian
                      ? 'ویرایش مشخصات کانی یا رگه معدنی'
                      : 'Edit Mineral / Ore'
                    : isPersian
                    ? 'ویرایش گونه زیستی'
                    : 'Edit Species'
                  : cCategory === 'mineral'
                  ? isPersian
                    ? 'ثبت کانی یا سنگ معدنی جدید'
                    : 'Add New Mineral / Ore'
                  : isPersian
                  ? 'ثبت گونه جدید در زیست‌بوم'
                  : 'Add New Species'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreature} className="space-y-4">
              <AiFillSection type="creature" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={cCategory === 'mineral' ? 'md:col-span-3' : 'md:col-span-2'}>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {cCategory === 'mineral'
                      ? (isPersian ? 'نام کانی یا سنگ معدنی:' : 'Mineral / Ore Name:')
                      : (isPersian ? 'نام موجود:' : 'Creature Name:')}
                  </label>
                  <input
                    type="text"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder={
                      cCategory === 'mineral'
                        ? (isPersian ? 'مثال: نمک معدنی، بلور کوارتز یا گوگرد مذاب' : 'e.g. Mineral Salt, Quartz Crystal')
                        : (isPersian ? 'مثال: گرگ خاکستر' : 'e.g. Ashen Wolf')
                    }
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                    required
                  />
                </div>

                {cCategory !== 'mineral' && (
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                      {isPersian ? 'سطح خطر (۱ تا ۵):' : 'Danger Level (1-5):'}
                    </label>
                    <select
                      value={cDanger}
                      onChange={(e) => setCDanger(Number(e.target.value) as any)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400 font-mono"
                    >
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl} · {isPersian ? DANGER_LEVELS[lvl].labelFa : DANGER_LEVELS[lvl].labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'رده زیستی / ماده:' : 'Category:'}
                  </label>
                  <select
                    value={cCategory}
                    onChange={(e) => setCCategory(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                  >
                    {Object.entries(SPECIES_CATEGORIES).map(([key, val]) => (
                      <option key={key} value={key}>
                        {isPersian ? val.labelFa : val.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {cCategory === 'mineral'
                      ? (isPersian ? 'فراوانی رگه‌های معدنی:' : 'Deposit Abundance / Rarity:')
                      : (isPersian ? 'سطح فراوانی و کمیابی:' : 'Population Rarity:')}
                  </label>
                  <select
                    value={cRarity}
                    onChange={(e) => setCRarity(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                  >
                    {Object.entries(CREATURE_RARITY).map(([k, v]) => (
                      <option key={k} value={k}>
                        {isPersian ? v.labelFa : v.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Habitats Multi-Location Interactive Picker */}
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    {cCategory === 'mineral'
                      ? (isPersian ? 'مکان‌ها و رگه‌های کشف‌شده (چندانتخابی):' : 'Locations & Deposit Veins (Multi-select):')
                      : (isPersian ? 'زیستگاه‌ها و مکان‌های زیست (چندانتخابی):' : 'Habitats & Distribution (Multi-select):')}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {cHabitats.length} {isPersian ? 'مکان انتخاب‌شده' : 'selected'}
                  </span>
                </label>
                {locations.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    {isPersian ? 'هنوز مکانی در جهان ثبت نشده است.' : 'No locations registered in world bible yet.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    {locations.map((loc) => {
                      const isSelected = cHabitats.includes(loc.id);
                      return (
                        <button
                          type="button"
                          key={loc.id}
                          onClick={() => {
                            setCHabitats((prev) =>
                              isSelected ? prev.filter((id) => id !== loc.id) : [...prev, loc.id]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-red-500/20 border border-red-500/50 text-red-300'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <MapPin className="w-3 h-3" />
                          <span>{loc.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {cCategory === 'mineral'
                    ? (isPersian ? 'توصیف زمین‌شناسی، کانی‌شناسی و لور:' : 'Geological Formation & Lore:')
                    : (isPersian ? 'توضیحات و لور موجود:' : 'Lore & Physiology:')}
                </label>
                <textarea
                  rows={2}
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  placeholder={
                    cCategory === 'mineral'
                      ? (isPersian ? 'رگه‌های رسوبی، درخشش در تاریکی، واکنش با عناصر...' : 'Geological origin, crystal luster, elemental reaction...')
                      : (isPersian ? 'توصیف ظاهر، خاستگاه و نحوه تعامل...' : 'Physical traits, origin, behavior...')
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                />
              </div>

              {cCategory === 'mineral' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                      <Pickaxe className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isPersian ? 'شرایط، روش و خطرات استخراج:' : 'Extraction Conditions & Mining Hazards:'}</span>
                    </label>
                    <textarea
                      rows={2}
                      value={cExtractionMethod}
                      onChange={(e) => setCExtractionMethod(e.target.value)}
                      placeholder={
                        isPersian
                          ? 'مثال: نیازمند کلنگ فولادی و دستکش‌های عایق؛ ضربه مستقیم موجب خرد شدن کریستال می‌گردد...'
                          : 'e.g. Requires steel pick and insulated tools; direct concussive force shatters the vein...'
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isPersian ? 'خواص فیزیکی، کیمیاگری و کاربرد در ساخت:' : 'Physical, Crafting & Alchemical Properties:'}</span>
                    </label>
                    <textarea
                      rows={2}
                      value={cCraftingProperties}
                      onChange={(e) => setCCraftingProperties(e.target.value)}
                      placeholder={
                        isPersian
                          ? 'مثال: استفاده در معجون‌های پایداری، تثبیت سنگ‌های طلسم، یا صیقل‌کاری سلاح‌ها...'
                          : 'e.g. Used in stabilization tinctures, rune socketing, or weapon tempering...'
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                      {isPersian ? 'رفتار و تاکتیک‌های نبرد:' : 'Combat Tactics:'}
                    </label>
                    <textarea
                      rows={2}
                      value={cTactics}
                      onChange={(e) => setCTactics(e.target.value)}
                      placeholder={isPersian ? 'الگوی حمله، فریب‌ها و رفتارهای گروهی...' : 'Attack patterns, ambush styles...'}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                        {isPersian ? 'نقاط ضعف (هر سطر یک مورد):' : 'Weaknesses (One per line):'}
                      </label>
                      <textarea
                        rows={2}
                        value={cWeaknesses}
                        onChange={(e) => setCWeaknesses(e.target.value)}
                        placeholder={isPersian ? 'آسیب آتشین\nسلاح‌های نقره‌ای' : 'Fire\nSilver weapons'}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                        {isPersian ? 'مقاومت‌ها (هر سطر یک مورد):' : 'Resistances (One per line):'}
                      </label>
                      <textarea
                        rows={2}
                        value={cResistances}
                        onChange={(e) => setCResistances(e.target.value)}
                        placeholder={isPersian ? 'سموم\nانرژی تاریک' : 'Poison\nNecrotic'}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Ecology & Alchemical Yields in main modal */}
              <div className="p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <Leaf className="w-4 h-4" />
                  <span>
                    {cCategory === 'mineral'
                      ? (isPersian ? 'فراورده‌های کیمیاگری و عصاره‌ها (اختیاری):' : 'Alchemical Extracts & Yields (Optional):')
                      : (isPersian ? 'اکولوژی و مواد کیمیاگری (اختیاری):' : 'Ecology & Alchemical Yields (Optional):')}
                  </span>
                </div>

                {cCategory !== 'mineral' && (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                        🦁 {isPersian ? 'جایگاه در زنجیره غذایی:' : 'Ecological Niche:'}
                      </label>
                      <input
                        type="text"
                        value={cNiche}
                        onChange={(e) => setCNiche(e.target.value)}
                        placeholder={isPersian ? 'مثال: شکارچی رأس هرم، شکار بزهای کوهی...' : 'e.g. Apex predator, feeds on mountain goats...'}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                        🤝 {isPersian ? 'روش رام‌سازی بدون خون‌ریزی:' : 'Non-Combat Pacification:'}
                      </label>
                      <input
                        type="text"
                        value={cPacification}
                        onChange={(e) => setCPacification(e.target.value)}
                        placeholder={isPersian ? 'مثال: تعارف گوشت تازه یا دوری از تماس چشمی...' : 'e.g. Offering fresh meat or avoiding eye contact...'}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </>
                )}

                {cYields.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-zinc-400 block font-bold">
                      🧪 {isPersian ? 'مواد کیمیاگری ثبت‌شده:' : 'Registered Reagents:'}
                    </span>
                    {cYields.map((yieldItem, yIdx) => (
                      <div
                        key={yIdx}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <strong className="text-zinc-200 text-[11px]">{yieldItem.reagentName}</strong>
                          <span className="text-zinc-400 text-[10px] ml-1.5">({yieldItem.craftingUse})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[9px] uppercase">
                            {isPersian ? RARITY_LABELS[yieldItem.rarity]?.fa || yieldItem.rarity : yieldItem.rarity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCYields((prev) => prev.filter((_, i) => i !== yIdx))}
                            className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                            title={isPersian ? 'حذف ماده' : 'Remove reagent'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-zinc-950 text-xs font-bold shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  {editingCreatureId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Creature'
                    : isPersian
                    ? 'ثبت گونه'
                    : 'Save Creature'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan 05: Dedicated Ecology & Alchemical Reagents Edit Modal */}
      {editingEcologyCreature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    {isPersian ? 'ویرایش اکولوژی و مواد کیمیاگری' : 'Edit Ecology & Alchemical Yields'}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {editingEcologyCreature.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingEcologyCreature(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEcologyModal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  🦁 {isPersian ? 'جایگاه در زنجیره غذایی:' : 'Ecological Niche (Predator/Prey):'}
                </label>
                <textarea
                  rows={2}
                  value={ecoNiche}
                  onChange={(e) => setEcoNiche(e.target.value)}
                  placeholder={
                    isPersian
                      ? 'مثال: شکارچی رأس هرم در کوهستان‌های سرد، شکار بزهای وحشی و پرندگان شکاری...'
                      : 'e.g. Apex predator in cold highlands, feeds on mountain goats...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  🤝 {isPersian ? 'روش رام‌سازی بدون خون‌ریزی:' : 'Non-Combat Pacification:'}
                </label>
                <textarea
                  rows={2}
                  value={ecoPacification}
                  onChange={(e) => setEcoPacification(e.target.value)}
                  placeholder={
                    isPersian
                      ? 'مثال: تعارف گوشت تازه آغشته به عسل کوهی یا عدم برقراری تماس چشمی مستقیم...'
                      : 'e.g. Offering fresh meat glazed in honey, or avoiding eye contact...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    🐰 {isPersian ? 'طعمه‌ها و گیاهان مصرفی (با ویرگول جدا کنید):' : 'Prey Species / Foraged Flora (comma-separated):'}
                  </label>
                  <input
                    type="text"
                    value={ecoPrey.join('، ')}
                    onChange={(e) =>
                      setEcoPrey(
                        e.target.value
                          .split(/[,،]/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder={isPersian ? 'بز کوهی، خرگوش، ریشه سرخ' : 'Mountain goat, Hare, Crimson root'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    🐺 {isPersian ? 'شکارچیان طبیعی و تهدیدها (با ویرگول جدا کنید):' : 'Natural Predators (comma-separated):'}
                  </label>
                  <input
                    type="text"
                    value={ecoPredators.join('، ')}
                    onChange={(e) =>
                      setEcoPredators(
                        e.target.value
                          .split(/[,،]/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder={isPersian ? 'اژدهای آتشین، خرس غارنشین' : 'Fire drake, Cave bear'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Alchemical Reagents List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4 text-amber-400" />
                    <span>{isPersian ? 'مواد قابل استخراج کیمیاگری و ساخت:' : 'Harvestable Alchemical Reagents:'}</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {ecoYields.length} {isPersian ? 'ماده' : 'reagents'}
                  </span>
                </div>

                {ecoYields.map((yieldItem, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={yieldItem.reagentName}
                        onChange={(e) => handleUpdateYieldInModal(idx, 'reagentName', e.target.value)}
                        placeholder={isPersian ? 'نام ماده (مثال: زهراب سیاه)' : 'Reagent name'}
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                        required
                      />
                      <select
                        value={yieldItem.rarity}
                        onChange={(e) => handleUpdateYieldInModal(idx, 'rarity', e.target.value as any)}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-emerald-400 font-mono"
                      >
                        {Object.entries(RARITY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {isPersian ? v.fa : v.en}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveYieldFromModal(idx)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                        title={isPersian ? 'حذف این ماده' : 'Remove reagent'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={yieldItem.craftingUse}
                      onChange={(e) => handleUpdateYieldInModal(idx, 'craftingUse', e.target.value)}
                      placeholder={isPersian ? 'کاربرد در ساخت یا پادزهر...' : 'Crafting or alchemical use...'}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                ))}

                {/* Add New Reagent Card */}
                <div className="p-3 bg-zinc-950/40 border border-dashed border-zinc-800 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-zinc-400 block">
                    + {isPersian ? 'افزودن ماده کیمیاگری جدید' : 'Add New Reagent'}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newReagentName}
                      onChange={(e) => setNewReagentName(e.target.value)}
                      placeholder={isPersian ? 'نام ماده جدید...' : 'New reagent name...'}
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                    />
                    <select
                      value={newReagentRarity}
                      onChange={(e) => setNewReagentRarity(e.target.value as any)}
                      className="bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-emerald-400 font-mono"
                    >
                      {Object.entries(RARITY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {isPersian ? v.fa : v.en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newReagentUse}
                      onChange={(e) => setNewReagentUse(e.target.value)}
                      placeholder={isPersian ? 'کاربرد کیمیاگری و داروسازی...' : 'Alchemical crafting usage...'}
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddYieldToModal}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isPersian ? 'افزودن' : 'Add'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingEcologyCreature(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isPersian ? 'ذخیره اکولوژی' : 'Save Ecology'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
