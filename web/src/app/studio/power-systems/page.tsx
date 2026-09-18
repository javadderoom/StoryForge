'use client';

import React, { useMemo, useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Zap,
  Plus,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Flame,
  Sparkles,
  Layers,
  Search,
} from 'lucide-react';
import {
  PowerSchool,
  PowerRank,
} from '@/lib/types';
import { notify } from '@/lib/notify';

type SchoolCategory = PowerSchool['category'];
type ScopeTier = NonNullable<PowerRank['narrativeScope']>;

// Preset templates for quick-start authoring
const PRESET_TEMPLATES: Array<{
  id: string;
  nameEn: string;
  nameFa: string;
  descEn: string;
  descFa: string;
  school: Omit<PowerSchool, 'id'>;
}> = [
  {
    id: 'preset_xianxia_7',
    nameEn: 'Celestial Dao Cultivation (7 Tiers)',
    nameFa: 'کشتگری تائو آسمانی (۷ درجه)',
    descEn: 'Traditional Xianxia internal cultivation from Qi Condensation to Void Tribulation and Immortal Ascension.',
    descFa: 'کشتگری سنتی ژیان‌شیا از تراکم چی تا آزمون خلاء و عروج جاودانه.',
    school: {
      name: 'Celestial Dao Cultivation',
      nameEn: 'Celestial Dao Cultivation',
      description: 'The ancient art of breathing cosmic qi, purifying spiritual roots, and forming the Golden Core to transcend mortal limits.',
      category: 'spiritual',
      sourceOfPower: 'Heavenly Ley-Qi & Celestial Alignments',
      linkedStatId: 'wisdom',
      linkedResourceId: 'qi',
      taboosAndCosts: 'Heart demons and heavenly tribulation lightning strikes during breakthroughs.',
      ranks: [
        {
          rank: 1,
          name: 'Qi Condensation',
          nameEn: 'Qi Condensation',
          title: 'Seeker of the Breath',
          narrativeScope: 'mortal',
          description: 'A faint swirl of crystalline white mist around the fingertips and quiet, stabilized pulse.',
          unlockedAbilityIds: ['Spiritual Sense Detection', 'Qi Dart', 'Featherstep'],
          statBonuses: { wisdom: 1, agility: 1 },
          resourceBonuses: { qi: 30 },
          advancementCost: {
            masteryPointsRequired: 100,
            resourceCosts: { qi: 50 },
            narrativeMilestoneRequirement: 'Attune meridians through unbroken 7-day meditation in a spirit-rich sanctuary.',
          },
        },
        {
          rank: 2,
          name: 'Foundation Establishment',
          nameEn: 'Foundation Establishment',
          title: 'Adept of Earth and Sky',
          narrativeScope: 'seasoned',
          description: 'Spiritual pressure creates ripples in standing water; eyes glow faintly with jade luminescence.',
          unlockedAbilityIds: ['Flying Sword Ward', 'Earthwall Bulwark', 'Minor Cleansing Flame'],
          statBonuses: { constitution: 2, wisdom: 2 },
          resourceBonuses: { qi: 80 },
          advancementCost: {
            masteryPointsRequired: 250,
            resourceCosts: { qi: 150 },
            requiredItemIds: ['Foundation Establishment Pill'],
            narrativeMilestoneRequirement: 'Survive the internal meridian fire purification without breaking concentration.',
          },
        },
        {
          rank: 3,
          name: 'Golden Core Formation',
          nameEn: 'Golden Core Formation',
          title: 'Core Sovereign',
          narrativeScope: 'heroic',
          description: 'Golden aura radiates several yards outward, radiating ambient warmth; speech carries a soft resonant echo.',
          unlockedAbilityIds: ['True Dragon Roar', 'Cloud Sovereign Flight', 'Golden Aegis'],
          statBonuses: { wisdom: 3, charisma: 2, constitution: 2 },
          resourceBonuses: { qi: 180 },
          advancementCost: {
            masteryPointsRequired: 600,
            resourceCosts: { qi: 350 },
            requiredItemIds: ['Heavenly Spirit Lotus'],
            narrativeMilestoneRequirement: 'Condense the 9-pattern spiritual core under the scrutiny of celestial lightning.',
          },
        },
        {
          rank: 4,
          name: 'Nascent Soul',
          nameEn: 'Nascent Soul',
          title: 'Primordial Avatar',
          narrativeScope: 'superhuman',
          description: 'The sky darkens above the cultivator; spectral avatar mirrors their gestures in the sky.',
          unlockedAbilityIds: ['Avatar Projection', 'Spatial Tear Slice', 'Soul Severing Curse'],
          statBonuses: { wisdom: 5, intelligence: 3 },
          resourceBonuses: { qi: 350 },
          advancementCost: {
            masteryPointsRequired: 1400,
            resourceCosts: { qi: 700 },
            narrativeMilestoneRequirement: 'Sever earthly karmic entanglements and allow the soul child to step outside the physical shell.',
          },
        },
        {
          rank: 5,
          name: 'Soul Transformation',
          nameEn: 'Soul Transformation',
          title: 'Domain Arbiter',
          narrativeScope: 'superhuman',
          description: 'Aura creates an absolute sovereign domain; elements bend involuntarily to their will.',
          unlockedAbilityIds: ['Absolute Dao Domain', 'Void Stride', 'Sundering of Elements'],
          statBonuses: { wisdom: 7, constitution: 4 },
          resourceBonuses: { qi: 700 },
          advancementCost: {
            masteryPointsRequired: 3000,
            resourceCosts: { qi: 1500 },
            narrativeMilestoneRequirement: 'Master life and death intent in a mortal realm trial.',
          },
        },
        {
          rank: 6,
          name: 'Void Tribulation',
          nameEn: 'Void Tribulation',
          title: 'Heaven Defier',
          narrativeScope: 'mythic',
          description: 'Spatial fractures follow every footstep; celestial thunder rumbles upon their emotional fluctuations.',
          unlockedAbilityIds: ['Worldrend Palm', 'Celestial Lightning Absorption', 'Time Dilation Shroud'],
          statBonuses: { wisdom: 10, intelligence: 6, strength: 5 },
          resourceBonuses: { qi: 1500 },
          advancementCost: {
            masteryPointsRequired: 7000,
            resourceCosts: { qi: 3500 },
            narrativeMilestoneRequirement: 'Endure the 9 Heavenly Tribulation lightning strikes.',
          },
        },
        {
          rank: 7,
          name: 'Mahayana Ascension',
          nameEn: 'Mahayana Ascension',
          title: 'Immortal Ascendant',
          narrativeScope: 'mythic',
          description: 'Golden heavenly gates manifest in the clouds; physical form becomes half-light, half-matter.',
          unlockedAbilityIds: ['Ascension Gate Manifestation', 'Universal Palm', 'Karmic Reversal'],
          statBonuses: { wisdom: 15, charisma: 10, constitution: 10 },
          resourceBonuses: { qi: 4000 },
          advancementCost: {
            masteryPointsRequired: 15000,
            narrativeMilestoneRequirement: 'Transcend the mortal plane into the higher celestial court.',
          },
        },
      ],
    },
  },
  {
    id: 'preset_martial_5',
    nameEn: 'Iron Body Martial Art (5 Tiers)',
    nameFa: 'هنر رزمی تن‌آهنین (۵ درجه)',
    descEn: 'Discipline-based physical & internal martial arts ascending from initiate to transcendent sovereign.',
    descFa: 'رزمی انضباطی و درونی از نوآموز تا شهریار فرانمود.',
    school: {
      name: 'Nine Dragons Iron Fist',
      nameEn: 'Nine Dragons Iron Fist',
      description: 'A punishing martial discipline that hardens bones like tempered black iron and weaves explosive kinetic force.',
      category: 'martial',
      sourceOfPower: 'Physical rigor, bone tempering, and dragon breath techniques',
      linkedStatId: 'might',
      linkedResourceId: 'stamina',
      ranks: [
        {
          rank: 1,
          name: 'Iron Skin Apprentice',
          nameEn: 'Iron Skin Apprentice',
          title: 'Iron Initiate',
          narrativeScope: 'mortal',
          description: 'Bruises fade rapidly; skin takes on the dull sheen of burnished bronze under heavy impact.',
          unlockedAbilityIds: ['Iron Guard', 'Crushing Palm'],
          statBonuses: { might: 1, constitution: 1 },
          resourceBonuses: { stamina: 25 },
          advancementCost: {
            masteryPointsRequired: 100,
            narrativeMilestoneRequirement: 'Strike the iron sand bag 10,000 times without fracture.',
          },
        },
        {
          rank: 2,
          name: 'Tempered Bone Adept',
          nameEn: 'Tempered Bone Adept',
          title: 'Bone Breaker',
          narrativeScope: 'seasoned',
          description: 'Every strike produces a metallic ringing sound like hammers on an anvil.',
          unlockedAbilityIds: ['Hammer Fist Shatter', 'Iron Body Counter'],
          statBonuses: { might: 2, constitution: 2 },
          resourceBonuses: { stamina: 50 },
          advancementCost: {
            masteryPointsRequired: 250,
            resourceCosts: { stamina: 80 },
            narrativeMilestoneRequirement: 'Defeat three senior hall fighters unarmed in single combat.',
          },
        },
        {
          rank: 3,
          name: 'Flowing Force Master',
          nameEn: 'Flowing Force Master',
          title: 'Dragon Strike Master',
          narrativeScope: 'heroic',
          description: 'Shockwaves shatter paving stones yards ahead of actual physical contact.',
          unlockedAbilityIds: ['Dragon Shockwave', 'Tremor Stomp', 'Adamantine Flesh'],
          statBonuses: { might: 4, constitution: 3, agility: 1 },
          resourceBonuses: { stamina: 100 },
          advancementCost: {
            masteryPointsRequired: 700,
            resourceCosts: { stamina: 150 },
            narrativeMilestoneRequirement: 'Meditate under the frozen mountain waterfall for 100 days.',
          },
        },
        {
          rank: 4,
          name: 'Mountain Sundering Grandmaster',
          nameEn: 'Mountain Sundering Grandmaster',
          title: 'Iron Sovereign',
          narrativeScope: 'superhuman',
          description: 'The earth shakes with their footsteps; arrows and blades snap upon touching their kinetic mantle.',
          unlockedAbilityIds: ['Mountain Sundering Roar', 'Fist of Calamity', 'Indomitable Wall'],
          statBonuses: { might: 6, constitution: 5 },
          resourceBonuses: { stamina: 200 },
          advancementCost: {
            masteryPointsRequired: 1800,
            narrativeMilestoneRequirement: 'Shatter a natural boulder monolith in a single focused blow.',
          },
        },
        {
          rank: 5,
          name: 'Transcendent Dragon Emperor',
          nameEn: 'Transcendent Dragon Emperor',
          title: 'Divine Martial Sovereign',
          narrativeScope: 'mythic',
          description: 'Spectral draconic coils of compressed kinetic energy surround their silhouette; air scorches.',
          unlockedAbilityIds: ['Nine Dragon Annihilation', 'World-Ending Punch', 'Invulnerable Titan Form'],
          statBonuses: { might: 10, constitution: 8, charisma: 4 },
          resourceBonuses: { stamina: 400 },
          advancementCost: {
            masteryPointsRequired: 4500,
            narrativeMilestoneRequirement: 'Ascend the Martial Peak and defeat the mountain spirit guardian.',
          },
        },
      ],
    },
  },
  {
    id: 'preset_occult_3',
    nameEn: 'Sanguine Occultism (3 Tiers)',
    nameFa: 'کیمیای خونین غیبی (۳ درجه)',
    descEn: 'Dark forbidden arts manipulating life essence and taboo flesh weaving.',
    descFa: 'هنرهای سیاه و ممنوع دستکاری جوهره حیات و بافتن گوشت.',
    school: {
      name: 'Order of the Crimson Weave',
      nameEn: 'Order of the Crimson Weave',
      description: 'A forbidden school extracting arcane power directly from bloodlines, vitae sacrifices, and forbidden anatomical sigils.',
      category: 'occult',
      sourceOfPower: 'Sacrificial vitae, anatomical sigils, and abyssal bloodlines',
      linkedStatId: 'intellect',
      linkedResourceId: 'mana',
      taboosAndCosts: 'Practitioners are actively hunted by inquisitors. Excessive usage mutates user flesh into crimson chitin.',
      ranks: [
        {
          rank: 1,
          name: 'Acolyte of the Flayed Path',
          nameEn: 'Acolyte of the Flayed Path',
          title: 'Blood Scrivener',
          narrativeScope: 'mortal',
          description: 'Smell of ozone and fresh copper; blood drawn from fingertips moves like living tendrils.',
          unlockedAbilityIds: ['Blood Needle', 'Hemorrhage Curse', 'Vitality Siphon'],
          statBonuses: { intellect: 1, constitution: 1 },
          resourceBonuses: { mana: 25 },
          advancementCost: {
            masteryPointsRequired: 100,
            requiredItemIds: ['Vial of Desecrated Vitae'],
            narrativeMilestoneRequirement: 'Perform the Midnight Blood Pact beneath the eclipsing moon.',
          },
        },
        {
          rank: 2,
          name: 'Flesh-Weaver Hierophant',
          nameEn: 'Flesh-Weaver Hierophant',
          title: 'Crimson Sculptor',
          narrativeScope: 'seasoned',
          description: 'Shadows take on deep scarlet hues; surrounding flora wilts and bleeds dark sap.',
          unlockedAbilityIds: ['Gore Golem Forging', 'Sanguine Puppet Strings', 'Transfusion Surge'],
          statBonuses: { intellect: 3, constitution: 2 },
          resourceBonuses: { mana: 70 },
          advancementCost: {
            masteryPointsRequired: 400,
            resourceCosts: { mana: 120 },
            requiredItemIds: ['Heart of an Abyssal Beast'],
            narrativeMilestoneRequirement: 'Survive the bloodline purge ritual and weave crimson sigils onto the ribs.',
          },
        },
        {
          rank: 3,
          name: 'Primordial Blood Primarch',
          nameEn: 'Primordial Blood Primarch',
          title: 'Lord of the Sanguine Tide',
          narrativeScope: 'heroic',
          description: 'Ambient air turns humid with red mist; the hearts of all lesser creatures nearby beat in forced unison with the Primarch.',
          unlockedAbilityIds: ['Boiling Bloodfield', 'Immortality of the Crimson Pool', 'Tear the Living Vessel'],
          statBonuses: { intellect: 6, charisma: 3, constitution: 5 },
          resourceBonuses: { mana: 200 },
          advancementCost: {
            masteryPointsRequired: 1200,
            narrativeMilestoneRequirement: 'Bathe in the Primordial Blood Cauldron and bind an ancient demon of the red veil.',
          },
        },
      ],
    },
  },
  {
    id: 'preset_wizardry_4',
    nameEn: 'Arcane Leyline Evocation (4 Tiers)',
    nameFa: 'احضار خطوط آسترال جادوگری (۴ درجه)',
    descEn: 'Scholarly high wizardry harnessing geographic arcane currents.',
    descFa: 'جادوگری پژوهشی آکادمیک با مهار جریان‌های آسترال جهان.',
    school: {
      name: 'High Arcane Leyline College',
      nameEn: 'High Arcane Leyline College',
      description: 'Scholarly pursuit of geometric spellcraft, tapping into geomantic ley lines for devastating arcane evocation.',
      category: 'arcane',
      sourceOfPower: 'Subterranean geomantic ley line nodes and celestial geometry',
      linkedStatId: 'intellect',
      linkedResourceId: 'mana',
      taboosAndCosts: 'Mana burnout and crystallization of nervous system upon catastrophic miscast.',
      ranks: [
        {
          rank: 1,
          name: 'Ley-Attuned Neophyte',
          nameEn: 'Ley-Attuned Neophyte',
          title: 'Cantrip Scholar',
          narrativeScope: 'mortal',
          description: 'Sparks of azure light crackle across fingertips; hair floats slightly due to static charge.',
          unlockedAbilityIds: ['Arcane Missile Barrage', 'Ley Detection', 'Mage Hand Ward'],
          statBonuses: { intellect: 2 },
          resourceBonuses: { mana: 40 },
          advancementCost: {
            masteryPointsRequired: 100,
            narrativeMilestoneRequirement: 'Pass the Grand Academy Theoretical Examination with distinction.',
          },
        },
        {
          rank: 2,
          name: 'Resonant Evoker',
          nameEn: 'Resonant Evoker',
          title: 'Arcanist',
          narrativeScope: 'seasoned',
          description: 'Geomantic circles ignite in glowing azure glyphs upon the ground; air hums with harmonic tone.',
          unlockedAbilityIds: ['Chain Lightning Overload', 'Counterspell Fracture', 'Arcane Teleportation'],
          statBonuses: { intellect: 4, wisdom: 1 },
          resourceBonuses: { mana: 100 },
          advancementCost: {
            masteryPointsRequired: 350,
            resourceCosts: { mana: 120 },
            requiredItemIds: ['Arcane Focus Crystal'],
            narrativeMilestoneRequirement: 'Align with a subterranean ley confluence without suffering mana burnout.',
          },
        },
        {
          rank: 3,
          name: 'Archmage of the Confluence',
          nameEn: 'Archmage of the Confluence',
          title: 'Grand Arcanist',
          narrativeScope: 'heroic',
          description: 'Sky tints indigo; clouds spiral around their casting locus like a storm eye.',
          unlockedAbilityIds: ['Planar Ley Bombardment', 'Time Stop Shard', 'Greater Spell Ward'],
          statBonuses: { intellect: 7, wisdom: 3 },
          resourceBonuses: { mana: 250 },
          advancementCost: {
            masteryPointsRequired: 1000,
            resourceCosts: { mana: 300 },
            narrativeMilestoneRequirement: 'Construct an attuned wizard tower at the intersection of three major ley lines.',
          },
        },
        {
          rank: 4,
          name: 'Planar Ley Sovereign',
          nameEn: 'Planar Ley Sovereign',
          title: 'Weaver of the Weave',
          narrativeScope: 'superhuman',
          description: 'The fabric of reality visibly ripples like disturbed silk; spells cast require no incantation, responding purely to thought.',
          unlockedAbilityIds: ['Wish of Creation', 'Leyline Convergence Apocalypse', 'Dimension Gate Sovereign'],
          statBonuses: { intellect: 12, wisdom: 6 },
          resourceBonuses: { mana: 600 },
          advancementCost: {
            masteryPointsRequired: 2800,
            narrativeMilestoneRequirement: 'Survive passage through the Astral Rift and imprint personal signature on the Cosmic Weave.',
          },
        },
      ],
    },
  },
];

const CATEGORY_META: Record<SchoolCategory, { en: string; fa: string; color: string }> = {
  arcane: { en: 'Arcane', fa: 'آسترال / جادویی', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  martial: { en: 'Martial', fa: 'هنرهای رزمی', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  divine: { en: 'Divine', fa: 'ایمان و الوهیت', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  occult: { en: 'Occult', fa: 'علوم غیبی و سیاه', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  technological: { en: 'Technological', fa: 'فناوری و سایبر', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  spiritual: { en: 'Spiritual / Dao', fa: 'معنوی و تائو', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  alchemical: { en: 'Alchemical', fa: 'کیمیاگری', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  psionic: { en: 'Psionic', fa: 'ذهنی و روانی', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  custom: { en: 'Custom', fa: 'سفارشی', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
};

const SCOPE_META: Record<ScopeTier, { en: string; fa: string; color: string }> = {
  mortal: { en: 'Mortal (Tier 1)', fa: 'فانی (سطح ۱)', color: 'text-zinc-300 bg-zinc-800/80 border-zinc-700' },
  seasoned: { en: 'Seasoned (Tier 2)', fa: 'ورزیده (سطح ۲)', color: 'text-sky-300 bg-sky-950/40 border-sky-800/60' },
  heroic: { en: 'Heroic (Tier 3)', fa: 'قهرمانی (سطح ۳)', color: 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60' },
  superhuman: { en: 'Superhuman (Tier 4)', fa: 'فراانسانی (سطح ۴)', color: 'text-amber-300 bg-amber-950/40 border-amber-800/60' },
  mythic: { en: 'Mythic (Tier 5)', fa: 'اسطوره‌ای (سطح ۵)', color: 'text-purple-300 bg-purple-950/40 border-purple-800/60' },
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function PowerSystemsPage() {
  const { story, isPersian, addPowerSchool, editPowerSchool, deletePowerSchool } = useStudioStory();

  const schools: PowerSchool[] = story.worldBible.powerSchools || [];
  const rpgStats = story.rpgSystem.stats || [];
  const resourcePools = story.rpgSystem.resources || [];

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedSchoolIds, setExpandedSchoolIds] = useState<Set<string>>(new Set());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formCategory, setFormCategory] = useState<SchoolCategory>('spiritual');
  const [formDescription, setFormDescription] = useState('');
  const [formSourceOfPower, setFormSourceOfPower] = useState('');
  const [formLinkedStatId, setFormLinkedStatId] = useState<string>('');
  const [formLinkedResourceId, setFormLinkedResourceId] = useState<string>('');
  const [formTaboosAndCosts, setFormTaboosAndCosts] = useState('');
  const [formRanks, setFormRanks] = useState<PowerRank[]>([]);

  // Active rank being edited inside modal
  const [activeRankIndex, setActiveRankIndex] = useState<number>(0);

  // Filtered schools
  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const matchCat = selectedCategory === 'all' || school.category === selectedCategory;
      const matchText =
        searchQuery.trim() === '' ||
        school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (school.nameEn && school.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        school.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        school.ranks.some(
          (r) =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.title && r.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (r.unlockedAbilityIds && r.unlockedAbilityIds.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase())))
        );
      return matchCat && matchText;
    });
  }, [schools, selectedCategory, searchQuery]);

  // Expand / collapse all
  const toggleSchoolExpanded = (id: string) => {
    setExpandedSchoolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateModal = () => {
    setEditingSchoolId(null);
    setFormName('');
    setFormNameEn('');
    setFormCategory('spiritual');
    setFormDescription('');
    setFormSourceOfPower('');
    setFormLinkedStatId('');
    setFormLinkedResourceId('');
    setFormTaboosAndCosts('');
    setFormRanks([
      {
        rank: 1,
        name: isPersian ? 'مرحله اول: نوآموز' : 'Rank 1: Initiate',
        nameEn: 'Rank 1: Initiate',
        title: isPersian ? 'رهرو تازه' : 'Seeker',
        narrativeScope: 'mortal',
        description: '',
        unlockedAbilityIds: [],
        statBonuses: {},
        resourceBonuses: {},
        advancementCost: {
          masteryPointsRequired: 100,
        },
      },
    ]);
    setActiveRankIndex(0);
    setIsModalOpen(true);
  };

  const openEditModal = (school: PowerSchool) => {
    setEditingSchoolId(school.id);
    setFormName(school.name);
    setFormNameEn(school.nameEn || '');
    setFormCategory(school.category);
    setFormDescription(school.description);
    setFormSourceOfPower(school.sourceOfPower || '');
    setFormLinkedStatId(school.linkedStatId || '');
    setFormLinkedResourceId(school.linkedResourceId || '');
    setFormTaboosAndCosts(school.taboosAndCosts || '');
    setFormRanks(JSON.parse(JSON.stringify(school.ranks || [])));
    setActiveRankIndex(0);
    setIsModalOpen(true);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (!preset) return;

    const newSchool: PowerSchool = {
      ...preset.school,
      id: generateId('school'),
    };
    addPowerSchool(newSchool);
    setExpandedSchoolIds((prev) => new Set([...prev, newSchool.id]));
  };

  const handleSaveModal = () => {
    if (!formName.trim()) {
      notify.error(isPersian ? 'نام مکتب قدرت الزامی است' : 'School name is required');
      return;
    }

    if (formRanks.length === 0) {
      notify.error(isPersian ? 'حداقل یک رتبه/درجه باید برای مکتب تعریف شود' : 'At least one rank must be defined');
      return;
    }

    // Re-index ranks 1..N
    const cleanRanks: PowerRank[] = formRanks.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      name: r.name.trim() || `Rank ${idx + 1}`,
      description: r.description || '',
      unlockedAbilityIds: (r.unlockedAbilityIds || []).filter((a) => a.trim().length > 0),
    }));

    const schoolPayload: PowerSchool = {
      id: editingSchoolId || generateId('school'),
      name: formName.trim(),
      nameEn: formNameEn.trim() || undefined,
      category: formCategory,
      description: formDescription.trim(),
      sourceOfPower: formSourceOfPower.trim(),
      linkedStatId: formLinkedStatId || undefined,
      linkedResourceId: formLinkedResourceId || undefined,
      taboosAndCosts: formTaboosAndCosts.trim() || undefined,
      ranks: cleanRanks,
    };

    if (editingSchoolId) {
      editPowerSchool(editingSchoolId, schoolPayload);
    } else {
      addPowerSchool(schoolPayload);
      setExpandedSchoolIds((prev) => new Set([...prev, schoolPayload.id]));
    }

    setIsModalOpen(false);
  };

  const handleDeleteSchool = async (school: PowerSchool) => {
    const ok = await notify.confirm({
      title: isPersian ? 'حذف مکتب قدرت' : 'Delete Power School',
      message: isPersian
        ? `آیا از حذف مکتب "${school.name}" و تمام ${school.ranks.length} رتبه آن اطمینان دارید؟`
        : `Are you sure you want to delete "${school.name}" and all ${school.ranks.length} associated rank tiers?`,
      confirmText: isPersian ? 'حذف دائمی' : 'Delete School',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (ok) {
      deletePowerSchool(school.id);
    }
  };

  // Rank array manipulation in modal
  const handleAddRank = () => {
    const nextRankNum = formRanks.length + 1;
    const newRank: PowerRank = {
      rank: nextRankNum,
      name: isPersian ? `مرتبه ${nextRankNum}` : `Rank ${nextRankNum}`,
      nameEn: `Rank ${nextRankNum}`,
      narrativeScope: 'seasoned',
      description: '',
      unlockedAbilityIds: [],
      statBonuses: {},
      resourceBonuses: {},
      advancementCost: {
        masteryPointsRequired: nextRankNum * 150,
      },
    };
    setFormRanks([...formRanks, newRank]);
    setActiveRankIndex(formRanks.length);
  };

  const handleRemoveRank = (index: number) => {
    if (formRanks.length <= 1) {
      notify.info(isPersian ? 'مکتب باید حداقل یک رتبه داشته باشد' : 'School must have at least one rank tier');
      return;
    }
    const updated = formRanks.filter((_, idx) => idx !== index);
    setFormRanks(updated);
    setActiveRankIndex(Math.max(0, index - 1));
  };

  const handleMoveRank = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= formRanks.length) return;
    const copy = [...formRanks];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setFormRanks(copy);
    setActiveRankIndex(targetIdx);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-indigo-950/20 to-zinc-900 p-6 md:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Zap className="w-3.5 h-3.5" />
              <span>{isPersian ? 'سیستم مکاتب و درجات قدرت' : 'Flexible Power System & Schools'}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              {isPersian ? 'مکاتب و درجات تعالی قدرت' : 'Power Schools & Progression Ranks'}
            </h1>
            <p className="text-sm md:text-base text-zinc-400 max-w-2xl leading-relaxed">
              {isPersian
                ? 'تعریف مکاتب جادو، کشتگری تائو (Xianxia)، هنرهای رزمی تن و چی، یا علوم غیبی. با پشتیبانی از هر تعداد درجات دلخواه و پیشرفت دوگانه (روایی توسط راوی داستان + سیستم مکانیکی امتیاز و معجون).'
                : 'Author magical traditions, Xianxia cultivation realms, martial arts, or forbidden occult disciplines. Features flexible tier counts (1 to 10+) and dual-advancement (narrative event breakthroughs + point/reagent spending).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Presets Dropdown */}
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{isPersian ? 'الگوهای آماده (Presets)' : 'Quick Presets'}</span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
              <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 hidden group-hover:block z-50">
                <div className="text-xs font-bold text-zinc-400 px-3 py-2 border-b border-zinc-800">
                  {isPersian ? 'افزودن الگو به جهان' : 'Add Archetype to World'}
                </div>
                {PRESET_TEMPLATES.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.id)}
                    type="button"
                    className="w-full text-left p-2.5 rounded-lg hover:bg-zinc-800/80 transition-colors flex flex-col gap-1 group/btn"
                  >
                    <div className="text-sm font-semibold text-zinc-200 group-hover/btn:text-indigo-400 flex items-center justify-between">
                      <span>{isPersian ? preset.nameFa : preset.nameEn}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {preset.school.ranks.length} {isPersian ? 'رتبه' : 'Ranks'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 line-clamp-2">
                      {isPersian ? preset.descFa : preset.descEn}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={openCreateModal}
              type="button"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isPersian ? 'مکتب جدید' : 'New Power School'}</span>
            </button>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-zinc-800/80">
          <div className="space-y-1">
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
              {isPersian ? 'مکاتب ثبت‌شده' : 'Active Schools'}
            </div>
            <div className="text-2xl font-black text-white">{schools.length}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
              {isPersian ? 'مجموع سطوح و رتبه‌ها' : 'Total Power Ranks'}
            </div>
            <div className="text-2xl font-black text-indigo-400">
              {schools.reduce((sum, s) => sum + (s.ranks?.length || 0), 0)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
              {isPersian ? 'مکاتب دارای هزینه و تابو' : 'Disciplines with Taboo/Cost'}
            </div>
            <div className="text-2xl font-black text-rose-400">
              {schools.filter((s) => Boolean(s.taboosAndCosts)).length}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
              {isPersian ? 'سازوکار پیشرفت' : 'Advancement Mode'}
            </div>
            <div className="text-sm font-bold text-amber-400 flex items-center gap-1.5 pt-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isPersian ? 'روایی + امتیازی' : 'Narrative & Point-Driven'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Category Filter */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isPersian ? 'جستجو در نام مکتب، قابلیت‌ها، درجات...' : 'Search schools, abilities, ranks...'}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isPersian ? 'همه مکاتب' : 'All Categories'}
          </button>
          {(Object.keys(CATEGORY_META) as SchoolCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-zinc-200 text-zinc-900 font-bold'
                  : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isPersian ? CATEGORY_META[cat].fa : CATEGORY_META[cat].en}
            </button>
          ))}
        </div>
      </div>

      {/* Schools List */}
      {filteredSchools.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 space-y-4">
          <Zap className="w-12 h-12 text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-zinc-300">
              {isPersian ? 'هیچ مکتب قدرتی یافت نشد' : 'No Power Schools Found'}
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              {isPersian
                ? 'یک مکتب جدید بسازید یا یکی از الگوهای آماده (Xianxia، رزمی، جادو یا علوم غیبی) را انتخاب کنید.'
                : 'Create a custom power school or load one of the archetypal presets to kickstart your world system.'}
            </p>
          </div>
          <button
            onClick={openCreateModal}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? 'افزودن نخستین مکتب' : 'Create First School'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSchools.map((school) => {
            const isExpanded = expandedSchoolIds.has(school.id);
            const catMeta = CATEGORY_META[school.category] || CATEGORY_META.custom;

            return (
              <div
                key={school.id}
                className={`rounded-2xl border transition-all ${
                  school.taboosAndCosts
                    ? 'border-rose-900/40 bg-gradient-to-b from-rose-950/10 to-zinc-900/80 shadow-rose-950/10 shadow-lg'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700/80 shadow-lg'
                }`}
              >
                {/* School Card Header */}
                <div className="p-5 md:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${catMeta.color}`}>
                          {isPersian ? catMeta.fa : catMeta.en}
                        </span>
                        {school.taboosAndCosts && (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>{isPersian ? 'دارای تابو / هزینه سنگین' : 'Taboo / Corruption Cost'}</span>
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-zinc-800 text-zinc-400">
                          {school.ranks.length} {isPersian ? 'رتبه / Tier' : 'Tiers'}
                        </span>
                      </div>

                      <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <span>{school.name}</span>
                        {school.nameEn && school.nameEn !== school.name && (
                          <span className="text-sm font-normal text-zinc-400 italic">({school.nameEn})</span>
                        )}
                      </h2>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(school)}
                        type="button"
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                        title={isPersian ? 'ویرایش مکتب' : 'Edit School'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSchool(school)}
                        type="button"
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 transition-colors"
                        title={isPersian ? 'حذف مکتب' : 'Delete School'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleSchoolExpanded(school.id)}
                        type="button"
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1 text-xs font-semibold"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-zinc-300 leading-relaxed max-w-4xl">
                    {school.description}
                  </p>

                  {/* Source of Power & Taboos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {school.sourceOfPower && (
                      <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/60 text-xs text-zinc-300 flex items-start gap-2">
                        <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-zinc-400">{isPersian ? 'منشأ قدرت: ' : 'Power Source: '}</strong>
                          <span>{school.sourceOfPower}</span>
                        </div>
                      </div>
                    )}
                    {school.taboosAndCosts && (
                      <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                        <div>
                          <strong className="text-rose-400">{isPersian ? 'عواقب و خطرات: ' : 'Taboos & Costs: '}</strong>
                          <span>{school.taboosAndCosts}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Associated RPG Mechanics Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                    {school.linkedStatId && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">{isPersian ? 'شاخص اصلی RPG:' : 'Linked Stat:'}</span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-mono">
                          {school.linkedStatId}
                        </span>
                      </div>
                    )}

                    {school.linkedResourceId && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">{isPersian ? 'مخزن انرژی مصرفی:' : 'Linked Resource:'}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-900/40 font-mono">
                          {school.linkedResourceId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Ranks Timeline Ladder */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/60 p-5 md:p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        <span>{isPersian ? 'نردبان مراتب و درجات تعالی' : 'Progression Rank Ladder'}</span>
                      </h3>
                      <button
                        onClick={() => openEditModal(school)}
                        type="button"
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isPersian ? 'مدیریت رتبه‌ها' : 'Manage Ranks'}</span>
                      </button>
                    </div>

                    <div className="relative space-y-4 before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-zinc-800/80">
                      {school.ranks.map((rank) => {
                        const scopeMeta = SCOPE_META[rank.narrativeScope || 'seasoned'] || SCOPE_META.seasoned;

                        return (
                          <div key={rank.rank} className="relative pl-10 space-y-2">
                            {/* Rank Node Dot */}
                            <div className="absolute left-2.5 top-1 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-indigo-500 bg-zinc-950 ring-4 ring-zinc-900" />

                            <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-black flex items-center justify-center">
                                    {rank.rank}
                                  </span>
                                  <h4 className="text-base font-bold text-white">{rank.name}</h4>
                                  {rank.title && (
                                    <span className="text-xs italic text-zinc-400">
                                      «{rank.title}»
                                    </span>
                                  )}
                                </div>

                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${scopeMeta.color}`}>
                                  {isPersian ? scopeMeta.fa : scopeMeta.en}
                                </span>
                              </div>

                              {rank.description && (
                                <p className="text-xs text-zinc-300 italic bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60 leading-relaxed">
                                  «{rank.description}»
                                </p>
                              )}

                              {/* Unlocked Abilities */}
                              {rank.unlockedAbilityIds && rank.unlockedAbilityIds.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                                    {isPersian ? 'قابلیت‌ها و فنون بازشده:' : 'Unlocked Techniques & Spells:'}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {rank.unlockedAbilityIds.map((ab: string, abIdx: number) => (
                                      <span
                                        key={abIdx}
                                        className="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/50 text-xs font-medium"
                                      >
                                        {ab}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Stat & Resource Passive Bonuses */}
                              {((rank.statBonuses && Object.keys(rank.statBonuses).length > 0) ||
                                (rank.resourceBonuses && Object.keys(rank.resourceBonuses).length > 0)) && (
                                <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-zinc-800/60">
                                  <span className="text-zinc-500">{isPersian ? 'پاداش‌های غیرفعال (Passive):' : 'Passives:'}</span>
                                  {rank.statBonuses &&
                                    Object.entries(rank.statBonuses).map(([k, v]) => (
                                      <span
                                        key={k}
                                        dir="ltr"
                                        className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 font-mono text-[11px]"
                                      >
                                        +{String(v)} {k}
                                      </span>
                                    ))}
                                  {rank.resourceBonuses &&
                                    Object.entries(rank.resourceBonuses).map(([k, v]) => (
                                      <span
                                        key={k}
                                        dir="ltr"
                                        className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/50 font-mono text-[11px]"
                                      >
                                        +{String(v)} {k}
                                      </span>
                                    ))}
                                </div>
                              )}

                              {/* Advancement Requirements (Dual: Points + Narrative) */}
                              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-1.5 text-xs">
                                <div className="font-semibold text-zinc-400 flex items-center justify-between">
                                  <span>{isPersian ? 'شرایط ارتقاء به این مرتبه (Dual Advancement):' : 'Advancement Requirements:'}</span>
                                  {rank.advancementCost?.masteryPointsRequired && (
                                    <span dir="ltr" className="text-indigo-400 font-mono font-bold">
                                      {rank.advancementCost.masteryPointsRequired} MP
                                    </span>
                                  )}
                                </div>

                                {rank.advancementCost?.narrativeMilestoneRequirement && (
                                  <div className="text-amber-300/90 text-xs flex items-start gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                                    <span>
                                      <strong>{isPersian ? 'شرط روایی / رویداد ویژه:' : 'Story Milestone:'}</strong>{' '}
                                      {rank.advancementCost.narrativeMilestoneRequirement}
                                    </span>
                                  </div>
                                )}

                                {((rank.advancementCost?.resourceCosts && Object.keys(rank.advancementCost.resourceCosts).length > 0) ||
                                  (rank.advancementCost?.requiredItemIds && rank.advancementCost.requiredItemIds.length > 0)) && (
                                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-zinc-400">
                                    <span>{isPersian ? 'هزینه منابع و معجون‌ها:' : 'Cost & Reagents:'}</span>
                                    {rank.advancementCost?.resourceCosts &&
                                      Object.entries(rank.advancementCost.resourceCosts).map(([k, v]) => (
                                        <span key={k} dir="ltr" className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                                          {String(v)} {k}
                                        </span>
                                      ))}
                                    {rank.advancementCost?.requiredItemIds?.map((item: string, itIdx: number) => (
                                      <span key={itIdx} className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono">
                                        [{item}]
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit School Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingSchoolId
                      ? isPersian ? 'ویرایش مکتب قدرت' : 'Edit Power School'
                      : isPersian ? 'ثبت مکتب قدرت جدید' : 'New Power School'}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {isPersian
                      ? 'پیکربندی هویت، دسته‌بندی و مراتب چندگانه پیشرفت'
                      : 'Configure school lore, mechanics, and flexible rank progression tiers'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                type="button"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Basic Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isPersian ? 'نام مکتب قدرت' : 'School Name'} *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={isPersian ? 'مثلاً: آکادمی خطوط آسترال، هنر مشت اژدها...' : 'e.g., Nine Dragons Fist'}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isPersian ? 'نام انگلیسی (لاتین)' : 'English Name'}
                  </label>
                  <input
                    type="text"
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    placeholder="e.g., Nine Dragons Fist"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isPersian ? 'دسته‌بندی قدرت' : 'Discipline Category'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as SchoolCategory)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    {(Object.keys(CATEGORY_META) as SchoolCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {isPersian ? CATEGORY_META[cat].fa : CATEGORY_META[cat].en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {isPersian ? 'شرح و جهان‌بینی مکتب' : 'School Philosophy & Lore'}
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={isPersian ? 'منشأ این قدرت، نحوه استفاده و جایگاه آن در جهان...' : 'Origin, philosophy, and cosmological foundation...'}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Source of Power & Taboos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isPersian ? 'منشأ یا سوخت قدرت (Source of Power)' : 'Source of Power'}
                  </label>
                  <input
                    type="text"
                    value={formSourceOfPower}
                    onChange={(e) => setFormSourceOfPower(e.target.value)}
                    placeholder={isPersian ? 'خطوط آسترال، هسته اژدها، قربانی خون...' : 'Ancient ruins, blood sacrifice, stellar leylines...'}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isPersian ? 'تابوها، هزینه‌ها یا عواقب فساد' : 'Taboos, Costs & Corruption'}
                  </label>
                  <input
                    type="text"
                    value={formTaboosAndCosts}
                    onChange={(e) => setFormTaboosAndCosts(e.target.value)}
                    placeholder={isPersian ? 'پیگرد توسط مفتشان، فساد گوشت، فرسایش عقل...' : 'Hunted by inquisitors, flesh decay, insanity...'}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Linked RPG Mechanics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isPersian ? 'شاخص مرتبط (Linked RPG Stat)' : 'Linked Primary Stat'}
                  </label>
                  <select
                    value={formLinkedStatId}
                    onChange={(e) => setFormLinkedStatId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">{isPersian ? '-- بدون شاخص مستقیم --' : '-- None --'}</option>
                    {rpgStats.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name || st.id} ({st.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isPersian ? 'مخزن انرژی مصرفی (Linked Resource Pool)' : 'Linked Resource Pool'}
                  </label>
                  <select
                    value={formLinkedResourceId}
                    onChange={(e) => setFormLinkedResourceId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">{isPersian ? '-- بدون مخزن مستقیم --' : '-- None --'}</option>
                    {resourcePools.map((pool: { id: string; name?: string }) => (
                      <option key={pool.id} value={pool.id}>
                        {pool.name || pool.id} ({pool.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Flexible Ranks Section */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>{isPersian ? 'مراتب و درجات تعالی (Flexible Rank Ladder)' : 'Progression Tiers & Ranks'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        {formRanks.length}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {isPersian
                        ? 'می‌توانید هر تعداد رتبه دلخواه (از ۱ تا بیش از ۱۰ درجه) تعریف و مدیریت کنید.'
                        : 'Define any number of ranks from 1 to 10+ tiers with custom breakthrough costs.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddRank}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isPersian ? 'افزودن رتبه بعدی' : 'Add Next Tier'}</span>
                  </button>
                </div>

                {/* Rank Selector Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-800">
                  {formRanks.map((r, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveRankIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                        activeRankIndex === idx
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span>Tier {idx + 1}: {r.name || `Rank ${idx + 1}`}</span>
                    </button>
                  ))}
                </div>

                {/* Active Rank Editor Panel */}
                {formRanks[activeRankIndex] && (
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                        {isPersian ? `پیکربندی رتبه ${activeRankIndex + 1}` : `Editing Rank Tier ${activeRankIndex + 1}`}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={activeRankIndex === 0}
                          onClick={() => handleMoveRank(activeRankIndex, 'up')}
                          className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40"
                          title="Move Rank Earlier"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={activeRankIndex === formRanks.length - 1}
                          onClick={() => handleMoveRank(activeRankIndex, 'down')}
                          className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40"
                          title="Move Rank Later"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRank(activeRankIndex)}
                          className="p-1 rounded bg-zinc-800 text-rose-400 hover:bg-rose-950/50"
                          title="Delete Rank"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400">
                          {isPersian ? 'عنوان درجه' : 'Rank Name'} *
                        </label>
                        <input
                          type="text"
                          value={formRanks[activeRankIndex].name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormRanks((prev) =>
                              prev.map((r, i) => (i === activeRankIndex ? { ...r, name: val } : r))
                            );
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400">
                          {isPersian ? 'لقب یا افتخار' : 'Title / Epithet'}
                        </label>
                        <input
                          type="text"
                          value={formRanks[activeRankIndex].title || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormRanks((prev) =>
                              prev.map((r, i) => (i === activeRankIndex ? { ...r, title: val } : r))
                            );
                          }}
                          placeholder="e.g. Master of Iron"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400">
                          {isPersian ? 'دامنه قدرت در جهان (Scope)' : 'Narrative Scope Tier'}
                        </label>
                        <select
                          value={formRanks[activeRankIndex].narrativeScope || 'seasoned'}
                          onChange={(e) => {
                            const val = e.target.value as ScopeTier;
                            setFormRanks((prev) =>
                              prev.map((r, i) => (i === activeRankIndex ? { ...r, narrativeScope: val } : r))
                            );
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                        >
                          {(Object.keys(SCOPE_META) as ScopeTier[]).map((sc) => (
                            <option key={sc} value={sc}>
                              {isPersian ? SCOPE_META[sc].fa : SCOPE_META[sc].en}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">
                        {isPersian ? 'توصیف حسی و نشانه‌های ظهور قدرت' : 'Sensory Manifestation & Capabilities'}
                      </label>
                      <input
                        type="text"
                        value={formRanks[activeRankIndex].description || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormRanks((prev) =>
                            prev.map((r, i) => (i === activeRankIndex ? { ...r, description: val } : r))
                          );
                        }}
                        placeholder="e.g., Golden aura radiates warmth; voice carries a resonant harmonic echo..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">
                        {isPersian ? 'قابلیت‌ها و فنون بازشده (با کاما جدا کنید)' : 'Unlocked Abilities (comma-separated)'}
                      </label>
                      <input
                        type="text"
                        value={(formRanks[activeRankIndex].unlockedAbilityIds || []).join(', ')}
                        onChange={(e) => {
                          const val = e.target.value.split(',').map((s) => s.trim());
                          setFormRanks((prev) =>
                            prev.map((r, i) => (i === activeRankIndex ? { ...r, unlockedAbilityIds: val } : r))
                          );
                        }}
                        placeholder="e.g., Dragon Shockwave, Tremor Stomp, Adamantine Flesh"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Breakthrough Requirements Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-indigo-300">
                          {isPersian ? 'امتیاز تسلط مورد نیاز (Mastery Points):' : 'Mastery Points Cost (Fallback):'}
                        </label>
                        <input
                          type="number"
                          value={formRanks[activeRankIndex].advancementCost?.masteryPointsRequired ?? 100}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setFormRanks((prev) =>
                              prev.map((r, i) =>
                                i === activeRankIndex
                                  ? {
                                      ...r,
                                      advancementCost: {
                                        ...r.advancementCost,
                                        masteryPointsRequired: val,
                                      },
                                    }
                                  : r
                              )
                            );
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-amber-300">
                          {isPersian ? 'اقلام یا معجون‌های ضروری (با کاما):' : 'Required Reagents / Items:'}
                        </label>
                        <input
                          type="text"
                          value={(formRanks[activeRankIndex].advancementCost?.requiredItemIds || []).join(', ')}
                          onChange={(e) => {
                            const items = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                            setFormRanks((prev) =>
                              prev.map((r, i) =>
                                i === activeRankIndex
                                  ? {
                                      ...r,
                                      advancementCost: {
                                        ...r.advancementCost,
                                        requiredItemIds: items,
                                      },
                                    }
                                  : r
                              )
                            );
                          }}
                          placeholder="e.g., Foundation Establishment Pill"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-semibold text-amber-400">
                          {isPersian ? 'رویداد و تحول روایی ویژه (Narrative Milestone):' : 'Narrative Milestone Event (Story Breakthrough):'}
                        </label>
                        <input
                          type="text"
                          value={formRanks[activeRankIndex].advancementCost?.narrativeMilestoneRequirement || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormRanks((prev) =>
                              prev.map((r, i) =>
                                i === activeRankIndex
                                  ? {
                                      ...r,
                                      advancementCost: {
                                        ...r.advancementCost,
                                        narrativeMilestoneRequirement: val,
                                      },
                                    }
                                  : r
                              )
                            );
                          }}
                          placeholder="e.g., Survive the heavenly thunder tribulation or cleanse personal meridians."
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
              >
                {isPersian ? 'ذخیره مکتب قدرت' : 'Save Power School'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
