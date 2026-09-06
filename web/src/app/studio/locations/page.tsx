'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  MapPin,
  X,
  Flame,
  Layers,
  ShieldAlert,
  Compass,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Users,
  Skull,
  Crown,
  Dice5,
  Loader2,
  Check,
  Zap,
  Target,
  FileText,
} from 'lucide-react';
import {
  WorldLocation,
  LocationSubZone,
  PopulateLocationPayload,
  LocationPointOfInterest,
  getLocationBreadcrumb,
  getDescendantLocationIds,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';

const DANGER_MAP: Record<number, { labelEn: string; labelFa: string; badgeClass: string; borderClass: string }> = {
  1: {
    labelEn: 'Safe',
    labelFa: 'امن',
    badgeClass: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    borderClass: 'border-emerald-500/40 hover:border-emerald-400',
  },
  2: {
    labelEn: 'Guarded',
    labelFa: 'محافظت‌شده',
    badgeClass: 'text-teal-300 bg-teal-500/10 border-teal-500/30',
    borderClass: 'border-teal-500/40 hover:border-teal-400',
  },
  3: {
    labelEn: 'Dangerous',
    labelFa: 'خطرناک',
    badgeClass: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    borderClass: 'border-amber-500/40 hover:border-amber-400',
  },
  4: {
    labelEn: 'Perilous',
    labelFa: 'بسیار خطرناک',
    badgeClass: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
    borderClass: 'border-orange-500/40 hover:border-orange-400',
  },
  5: {
    labelEn: 'Lethal',
    labelFa: 'کشنده',
    badgeClass: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
    borderClass: 'border-rose-500/40 hover:border-rose-400',
  },
};

const SUBZONE_TYPE_LABELS: Record<string, { fa: string; en: string; color: string }> = {
  dungeon: { fa: 'سیاه‌چال / دخمه', en: 'Dungeon', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  sanctuary: { fa: 'محراب / پناهگاه', en: 'Sanctuary', color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  ruin: { fa: 'ویرانه باستانی', en: 'Ruin', color: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  vault: { fa: 'خزانه اسرار', en: 'Vault', color: 'text-purple-300 border-purple-500/30 bg-purple-500/10' },
  market: { fa: 'بازار / کاروانسرا', en: 'Market', color: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
  hazard_zone: { fa: 'منطقه مخاطره‌آمیز', en: 'Hazard Zone', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
};

export default function LocationsStudioPage() {
  const {
    story,
    isPersian,
    addLocation,
    editLocation,
    deleteLocation,
    addNpc,
    addCreature,
    addArtifact,
  } = useStudioStory();

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  const [locName, setLocName] = useState('');
  const [locRegion, setLocRegion] = useState('');
  const [locParentLocationId, setLocParentLocationId] = useState('');
  const [locDesc, setLocDesc] = useState('');
  const [locAtmosphere, setLocAtmosphere] = useState('');
  const [locCategory, setLocCategory] = useState('dungeon');
  const [locDangerLevel, setLocDangerLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [locSpecialRules, setLocSpecialRules] = useState('');
  const [locConnectedIds, setLocConnectedIds] = useState<string[]>([]);

  // Sub-zones and Micro-Ecosystem state
  const [openSubZoneLocationId, setOpenSubZoneLocationId] = useState<string | null>(null);
  const [isGeneratingSubZones, setIsGeneratingSubZones] = useState<string | null>(null);
  const [subZonesPreview, setSubZonesPreview] = useState<{
    location: WorldLocation;
    subZones: LocationSubZone[];
  } | null>(null);

  const [isGeneratingEcosystem, setIsGeneratingEcosystem] = useState<string | null>(null);
  const [ecosystemPreview, setEcosystemPreview] = useState<{
    location: WorldLocation;
    payload: PopulateLocationPayload;
  } | null>(null);

  const locations = story.worldBible.locations || [];
  const categories = story.worldBible.ontology?.placeCategories || [];

  // Card collapse state
  const [collapsedLocationIds, setCollapsedLocationIds] = useState<Record<string, boolean>>({});

  const isAllCollapsed =
    locations.length > 0 && locations.every((l) => Boolean(collapsedLocationIds[l.id]));

  const toggleCollapseLocation = (id: string) => {
    setCollapsedLocationIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAllCollapse = () => {
    if (isAllCollapsed) {
      setCollapsedLocationIds({});
    } else {
      const all: Record<string, boolean> = {};
      locations.forEach((l) => {
        all[l.id] = true;
      });
      setCollapsedLocationIds(all);
    }
  };

  const getCategoryMeta = (catId: string) => {
    const found = categories.find((c) => c.id === catId);
    return {
      name: found?.name || catId,
      color: found?.color || '#a1a1aa',
    };
  };

  const eligibleParentLocations = React.useMemo(() => {
    if (!editingLocationId) return locations;
    const invalidIds = new Set<string>([
      editingLocationId,
      ...Array.from(getDescendantLocationIds(locations, editingLocationId)),
    ]);
    return locations.filter((l) => !invalidIds.has(l.id));
  }, [locations, editingLocationId]);

  const handleOpenAddModal = () => {
    setEditingLocationId(null);
    setLocName('');
    setLocRegion('');
    setLocParentLocationId('');
    setLocDesc('');
    setLocAtmosphere('');
    setLocCategory('dungeon');
    setLocDangerLevel(3);
    setLocSpecialRules('');
    setLocConnectedIds([]);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (loc: WorldLocation) => {
    setEditingLocationId(loc.id);
    setLocName(loc.name);
    setLocRegion(loc.region);
    setLocParentLocationId(loc.parentLocationId || '');
    setLocDesc(loc.description);
    setLocAtmosphere(loc.atmosphere);
    setLocCategory(loc.category || 'dungeon');
    setLocDangerLevel(loc.dangerLevel);
    setLocSpecialRules((loc.specialRules || []).join('\n'));
    setLocConnectedIds(loc.connectedLocationIds || []);
    setShowAddModal(true);
  };

  const toggleConnected = (id: string) => {
    setLocConnectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCategoryChange = (catId: string) => {
    setLocCategory(catId);
    const found = categories.find((c) => c.id === catId);
    if (found?.defaultDangerLevel) {
      setLocDangerLevel(found.defaultDangerLevel);
    }
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) {
      notify.error(isPersian ? 'نام مکان الزامی است' : 'Location name is required');
      return;
    }

    const specialRulesArray = locSpecialRules
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const existingLoc = locations.find((l) => l.id === editingLocationId);

    const payload: WorldLocation = {
      id: editingLocationId || `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: locName.trim(),
      region: locRegion.trim() || (isPersian ? 'ناشناخته' : 'Unknown'),
      parentLocationId: locParentLocationId || undefined,
      description: locDesc.trim(),
      atmosphere: locAtmosphere.trim(),
      category: locCategory,
      dangerLevel: locDangerLevel,
      connectedLocationIds: locConnectedIds,
      specialRules: specialRulesArray.length > 0 ? specialRulesArray : undefined,
      subZones: existingLoc?.subZones,
      pointsOfInterest: existingLoc?.pointsOfInterest,
    };

    if (editingLocationId) {
      editLocation(editingLocationId, payload);
    } else {
      addLocation(payload);
    }

    setShowAddModal(false);
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    if (!locName && data.name) setLocName(data.name as string);
    if (!locRegion && data.region) setLocRegion(data.region as string);
    if (data.dangerLevel) setLocDangerLevel(data.dangerLevel as typeof locDangerLevel);
    if (!locDesc && data.description) setLocDesc(data.description as string);
    if (!locAtmosphere && data.atmosphere) setLocAtmosphere(data.atmosphere as string);
    if (!locSpecialRules && Array.isArray(data.specialRules) && (data.specialRules as string[]).length)
      setLocSpecialRules((data.specialRules as string[]).join('\n'));
  };

  // --- Sub-Zones Generator ---
  const handleGenerateSubZones = async (loc: WorldLocation) => {
    setIsGeneratingSubZones(loc.id);
    try {
      const worldContext = `WORLD NAME: ${story.worldBible.worldName || 'Atarion'}\nLOCATION: ${loc.name} (${loc.region})\nATMOSPHERE: ${loc.atmosphere}\nDESCRIPTION: ${loc.description}`;
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'location_subzones',
          prompt: `Create 3 to 5 interconnected sub-zones and exploration sectors for ${loc.name}`,
          anchor: loc.name,
          worldContext,
          isPersian,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const rawSubZones = Array.isArray(json.data.subZones)
          ? json.data.subZones
          : Array.isArray(json.data)
          ? json.data
          : [];
        const normalizedSubZones: LocationSubZone[] = rawSubZones.map(
          (sz: any, i: number) => ({
            id: sz.id || `sz_${Date.now().toString(36)}_${i}`,
            name: sz.name || `Sub-zone ${i + 1}`,
            subType: sz.subType || 'dungeon',
            dangerLevel: (Number(sz.dangerLevel) || loc.dangerLevel || 3) as 1 | 2 | 3 | 4 | 5,
            atmosphere: sz.atmosphere || '',
            explorationHooks: Array.isArray(sz.explorationHooks) ? sz.explorationHooks : [],
            pointsOfInterest: Array.isArray(sz.pointsOfInterest)
              ? sz.pointsOfInterest.map((p: any) => ({
                  name: p.name || 'Point of Interest',
                  description: p.description || '',
                  skillCheck: p.skillCheck
                    ? {
                        attribute: p.skillCheck.attribute || 'Perception',
                        dc: Number(p.skillCheck.dc) || 12,
                        failureConsequence: p.skillCheck.failureConsequence || '',
                      }
                    : undefined,
                }))
              : [],
          })
        );
        setSubZonesPreview({ location: loc, subZones: normalizedSubZones });
      } else {
        notify.error(json.error || (isPersian ? 'تولید زیربخش‌ها ناموفق بود' : 'Failed to generate sub-zones'));
      }
    } catch {
      notify.error(isPersian ? 'خطا در برقراری ارتباط با سرور' : 'Connection error');
    } finally {
      setIsGeneratingSubZones(null);
    }
  };

  const handleSaveSubZonesPreview = () => {
    if (!subZonesPreview) return;
    const { location, subZones } = subZonesPreview;
    const existing = location.subZones || [];
    const merged = [...existing, ...subZones];
    editLocation(location.id, { subZones: merged });
    setOpenSubZoneLocationId(location.id);
    setSubZonesPreview(null);
    notify.success(
      isPersian
        ? `${subZones.length} زیربخش با موفقیت به "${location.name}" افزوده شد`
        : `${subZones.length} sub-zones added to "${location.name}"`
    );
  };

  const handleDeleteSubZone = async (loc: WorldLocation, subZoneId: string) => {
    const conf = await notify.confirm({
      title: isPersian ? 'حذف زیربخش' : 'Delete Sub-Zone',
      message: isPersian
        ? 'آیا از حذف این زیربخش و نقاط تعاملی آن مطمئن هستید؟'
        : 'Are you sure you want to remove this sub-zone and its POIs?',
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (conf) {
      const next = (loc.subZones || []).filter((sz) => sz.id !== subZoneId);
      editLocation(loc.id, { subZones: next });
      notify.info(isPersian ? 'زیربخش حذف شد' : 'Sub-zone removed');
    }
  };

  // --- Populate Micro-Ecosystem Macro ---
  const handleGenerateEcosystem = async (loc: WorldLocation) => {
    setIsGeneratingEcosystem(loc.id);
    try {
      const worldContext = `WORLD NAME: ${story.worldBible.worldName || 'Atarion'}\nLOCATION: ${loc.name} (${loc.region})\nATMOSPHERE: ${loc.atmosphere}\nDESCRIPTION: ${loc.description}`;
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'populate_location',
          prompt: `Populate a complete micro-ecosystem for ${loc.name} (2 resident NPCs, 1 native creature, 1 hidden mythic relic)`,
          anchor: loc.name,
          worldContext,
          isPersian,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const payload = json.data as PopulateLocationPayload;
        // Normalize IDs and tie to current location
        const normalizedNpcs = (payload.npcs || []).map((n: any, i: number) => ({
          ...n,
          id: n.id || `npc_${Date.now().toString(36)}_${i}`,
          currentLocationId: loc.id,
        }));
        const normalizedCreature = {
          ...payload.creature,
          id: payload.creature?.id || `creature_${Date.now().toString(36)}`,
          habitatLocationIds: [loc.id],
          dangerLevel: (Number(payload.creature?.dangerLevel) || 3) as 1 | 2 | 3 | 4 | 5,
        };
        const normalizedRelic = {
          ...payload.hiddenRelic,
          id: payload.hiddenRelic?.id || `artifact_${Date.now().toString(36)}`,
          currentHolderId: loc.id,
          currentHolderType: 'location' as const,
        };
        setEcosystemPreview({
          location: loc,
          payload: {
            locationId: loc.id,
            npcs: normalizedNpcs,
            creature: normalizedCreature,
            hiddenRelic: normalizedRelic,
          },
        });
      } else {
        notify.error(json.error || (isPersian ? 'تولید زیست‌بوم با شکست مواجه شد' : 'Failed to generate ecosystem'));
      }
    } catch {
      notify.error(isPersian ? 'خطا در برقراری ارتباط با سرور' : 'Connection error');
    } finally {
      setIsGeneratingEcosystem(null);
    }
  };

  const handleCommitEcosystem = () => {
    if (!ecosystemPreview) return;
    const { location, payload } = ecosystemPreview;

    // Batch insert into Studio context
    (payload.npcs || []).forEach((npc) => addNpc(npc));
    if (payload.creature) addCreature(payload.creature);
    if (payload.hiddenRelic) addArtifact(payload.hiddenRelic);

    setEcosystemPreview(null);
    notify.success(
      isPersian
        ? `زیست‌بوم کامل "${location.name}" به جهان افزوده شد (۲ شخصیت، ۱ هیولا، ۱ عتیقه)`
        : `Micro-ecosystem for "${location.name}" added to world (2 NPCs, 1 Creature, 1 Relic)`
    );
  };


  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'جغرافیای جهان و مکان‌های داستان' : 'World Geography & Story Locations'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'ثبت و مدیریت قلعه‌ها، سیاه‌چال‌ها، خرابه‌ها، شهرک‌ها و بیابان‌های جهان همراه با سطح خطر، فضاسازی و پیوندهای مکانی.'
              : 'Manage strongholds, dungeons, ruins, settlements and wastes with danger tiers, atmosphere, and spatial connections.'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {locations.length} {isPersian ? 'مکان ثبت‌شده' : 'Registered Locations'}
          </span>
          {locations.length > 0 && (
            <button
              type="button"
              onClick={toggleAllCollapse}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title={
                isAllCollapsed
                  ? isPersian
                    ? 'گسترش تمام کارت‌ها'
                    : 'Expand All Cards'
                  : isPersian
                    ? 'جمع‌کردن تمام کارت‌ها'
                    : 'Collapse All Cards'
              }
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isPersian
                  ? isAllCollapsed
                    ? 'گسترش همه'
                    : 'جمع‌کردن همه'
                  : isAllCollapsed
                    ? 'Expand All'
                    : 'Collapse All'}
              </span>
            </button>
          )}
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? '+ ثبت مکان جدید' : '+ Add Location'}</span>
          </button>
        </div>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {locations.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
            <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">
              {isPersian ? 'هنوز مکانی در این جهان ثبت نشده است' : 'No locations registered in this world yet'}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {isPersian ? 'برای ترسیم نقشه جهان روی دکمه ثبت مکان جدید کلیک کنید.' : 'Click "+ Add Location" to begin charting the world map.'}
            </p>
          </div>
        ) : (
          locations.map((loc) => {
            const danger = DANGER_MAP[loc.dangerLevel] || DANGER_MAP[3];
            const cat = getCategoryMeta(loc.category || '');
            const isCollapsed = Boolean(collapsedLocationIds[loc.id]);

            return (
              <div
                key={loc.id}
                className={`bg-zinc-900/70 border-2 rounded-3xl p-5 md:p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between transition-all duration-200 ${danger.borderClass}`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <span
                      className="px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5"
                      style={{ color: cat.color, borderColor: `${cat.color}55`, backgroundColor: `${cat.color}1a` }}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {cat.name}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleCollapseLocation(loc.id)}
                        className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={
                          isCollapsed
                            ? isPersian
                              ? 'گسترش کارت'
                              : 'Expand card'
                            : isPersian
                              ? 'جمع‌کردن کارت'
                              : 'Collapse card'
                        }
                      >
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(loc)}
                        className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={isPersian ? 'ویرایش' : 'Edit'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const conf = await notify.confirm({
                            title: isPersian ? 'حذف مکان' : 'Delete Location',
                            message: isPersian
                              ? `آیا از حذف مکان "${loc.name}" از جهان مطمئن هستید؟`
                              : `Are you sure you want to remove "${loc.name}" from the world?`,
                            confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
                            cancelText: isPersian ? 'انصراف' : 'Cancel',
                            isDestructive: true,
                          });
                          if (conf) deleteLocation(loc.id);
                        }}
                        className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={isPersian ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Region / Breadcrumb (Clickable to toggle collapse) */}
                  <div
                    onClick={() => toggleCollapseLocation(loc.id)}
                    className="cursor-pointer group select-none"
                    title={isCollapsed ? (isPersian ? 'برای دیدن جزئیات کلیک کنید' : 'Click to expand') : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
                        {loc.name}
                      </h3>
                      {isCollapsed && loc.description && (
                        <span className="text-[11px] text-zinc-500 font-mono italic truncate max-w-[150px]">
                          {loc.description}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                      {loc.parentLocationId ? (
                        <span className="text-amber-300 font-mono text-[11px] flex items-center gap-1">
                          <span>📍 {getLocationBreadcrumb(locations, loc.id)}</span>
                        </span>
                      ) : (
                        <span>{loc.region}</span>
                      )}
                    </p>
                  </div>

                  {/* Collapsible Details Body */}
                  {!isCollapsed && (
                    <div className="space-y-4 pt-1 animate-fadeIn">
                      {loc.description && (
                        <p className="text-xs text-zinc-400 leading-relaxed">{loc.description}</p>
                      )}

                      {/* Atmosphere */}
                      {loc.atmosphere && (
                        <div className="text-[11.5px] text-zinc-400 bg-zinc-950/40 border border-zinc-800/80 rounded-xl px-3 py-2">
                          <span className="text-zinc-300 font-bold flex items-center gap-1 mb-0.5">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            {isPersian ? 'فضاسازی:' : 'Atmosphere:'}
                          </span>
                          {loc.atmosphere}
                        </div>
                      )}

                      {/* Special Rules */}
                      {loc.specialRules && loc.specialRules.length > 0 && (
                        <div className="space-y-1.5 bg-rose-950/10 border border-rose-500/20 rounded-2xl p-3.5">
                          <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            {isPersian ? 'قوانین ویژه مکان:' : 'Site Special Rules:'}
                          </span>
                          <ul className="space-y-1 text-xs text-rose-200/90">
                            {loc.specialRules.map((r, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sub-Zones & Ecosystem Actions */}
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            setOpenSubZoneLocationId(
                              openSubZoneLocationId === loc.id ? null : loc.id
                            )
                          }
                          className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center justify-between transition-all"
                        >
                          <span className="flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isPersian ? 'زیربخش‌ها و سیاه‌چال‌ها' : 'Sub-Zones & Dungeons'}</span>
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[10px]">
                              {loc.subZones?.length || 0}
                            </span>
                          </span>
                          {openSubZoneLocationId === loc.id ? (
                            <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                        </button>

                        <button
                          onClick={() => handleGenerateEcosystem(loc)}
                          disabled={isGeneratingEcosystem === loc.id}
                          className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-amber-500/20 hover:from-purple-500/30 hover:to-amber-500/30 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                          title={isPersian ? 'تولید ۲ شخصیت، ۱ هیولا و ۱ عتیقه بومی این مکان' : 'Populate 2 NPCs, 1 Creature, and 1 Relic native to this place'}
                        >
                          {isGeneratingEcosystem === loc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-purple-400" />
                          )}
                          <span>{isPersian ? 'زیست‌بوم' : 'Populate'}</span>
                        </button>
                      </div>

                      {/* Sub-Zones Collapsible Panel */}
                      {openSubZoneLocationId === loc.id && (
                        <div className="space-y-3 pt-3 border-t border-zinc-800/80 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
                              <Compass className="w-3 h-3 text-amber-400" />
                              {isPersian ? 'زیربخش‌های کشف‌شده:' : 'Discovered Sub-Zones:'}
                            </span>
                            <button
                              onClick={() => handleGenerateSubZones(loc)}
                              disabled={isGeneratingSubZones === loc.id}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                            >
                              {isGeneratingSubZones === loc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-amber-400" />
                              )}
                              <span>{isPersian ? 'تولید با AI' : 'AI Generate'}</span>
                            </button>
                          </div>

                          {loc.subZones && loc.subZones.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {loc.subZones.map((sz) => {
                                const subTypeMeta = SUBZONE_TYPE_LABELS[sz.subType] || SUBZONE_TYPE_LABELS.dungeon;
                                return (
                                  <div
                                    key={sz.id}
                                    className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3 space-y-1.5 text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                                        <span>{sz.name}</span>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] border ${subTypeMeta.color}`}>
                                          {isPersian ? subTypeMeta.fa : subTypeMeta.en}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteSubZone(loc, sz.id)}
                                        className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>

                                    {sz.atmosphere && (
                                      <p className="text-[11px] text-zinc-400 italic">
                                        "{sz.atmosphere}"
                                      </p>
                                    )}

                                    {sz.pointsOfInterest && sz.pointsOfInterest.length > 0 && (
                                      <div className="space-y-1 pt-1">
                                        <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1">
                                          <Target className="w-2.5 h-2.5 text-amber-400" />
                                          {isPersian ? 'نقاط تعاملی و چالش‌ها:' : 'POIs & Skill Gates:'}
                                        </span>
                                        {sz.pointsOfInterest.map((poi, pIdx) => (
                                          <div
                                            key={pIdx}
                                            className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2 text-[11px] space-y-0.5"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-semibold text-zinc-300">{poi.name}</span>
                                              {poi.skillCheck && (
                                                <span
                                                  dir="ltr"
                                                  className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[10px] border border-amber-500/20"
                                                >
                                                  {poi.skillCheck.attribute} DC {poi.skillCheck.dc}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-zinc-400 text-[10.5px] leading-tight">
                                              {poi.description}
                                            </p>
                                            {poi.skillCheck?.failureConsequence && (
                                              <p className="text-rose-300/80 text-[10px]">
                                                ⚠️ {isPersian ? 'پیامد شکست: ' : 'Failure: '}
                                                {poi.skillCheck.failureConsequence}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-4 bg-zinc-950/30 border border-zinc-800/50 rounded-2xl p-3">
                              <p className="text-xs text-zinc-500">
                                {isPersian
                                  ? 'هنوز زیربخشی برای این مکان ساخته نشده است.'
                                  : 'No sub-zones charted for this location yet.'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Danger Tier + Connections */}
                <div className={`pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs ${isCollapsed ? 'mt-3' : 'mt-4'}`}>
                  <span className={`px-2.5 py-1 rounded-xl font-bold border ${danger.badgeClass}`}>
                    {isPersian ? danger.labelFa : danger.labelEn} · {loc.dangerLevel}/5
                  </span>
                  <div className="flex items-center gap-2">
                    {isCollapsed && (loc.subZones?.length || 0) > 0 && (
                      <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                        {loc.subZones?.length} {isPersian ? 'زیربخش' : 'sub-zones'}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-zinc-500" />
                      {(loc.connectedLocationIds || []).filter((id) => id !== loc.id).length}{' '}
                      {isPersian ? 'پیوند' : 'links'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>


      {/* Add / Edit Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {editingLocationId
                  ? isPersian
                    ? 'ویرایش مکان'
                    : 'Edit Location'
                  : isPersian
                    ? 'ثبت مکان جدید در جهان'
                    : 'Add New Location'}
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <AiFillSection type="location" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام مکان:' : 'Location Name:'}
                  </label>
                  <input
                    type="text"
                    value={locName}
                    onChange={(e) => setLocName(e.target.value)}
                    placeholder={isPersian ? 'مثال: برج گوگرد سیاه' : 'e.g. The Black Sulfur Spire'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'ناحیه / منطقه:' : 'Region:'}
                  </label>
                  <input
                    type="text"
                    value={locRegion}
                    onChange={(e) => setLocRegion(e.target.value)}
                    placeholder={isPersian ? 'مثال: اعماق دخمه‌های زیرین' : 'e.g. Subterranean Catacombs'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center justify-between">
                  <span>{isPersian ? 'موقعیت بالادست / در بر گیرنده (Parent Location):' : 'Parent / Enclosing Location:'}</span>
                  {locParentLocationId && (
                    <span className="text-[10px] font-mono text-amber-400">
                      {getLocationBreadcrumb(locations, locParentLocationId)}
                    </span>
                  )}
                </label>
                <select
                  value={locParentLocationId}
                  onChange={(e) => {
                    const nextParentId = e.target.value;
                    setLocParentLocationId(nextParentId);
                    if (nextParentId && !locRegion) {
                      const pLoc = locations.find((l) => l.id === nextParentId);
                      if (pLoc) setLocRegion(pLoc.name);
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="">{isPersian ? '— بدون موقعیت بالادست (سطح ریشه / مستقل) —' : '— None (Root / Independent) —'}</option>
                  {eligibleParentLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {getLocationBreadcrumb(locations, l.id)}
                    </option>
                  ))}
                </select>
                <p className="text-[10.5px] text-zinc-500 mt-1">
                  {isPersian
                    ? 'مثلاً اگر این مکان یک شهر است، موقعیت بالادست آن می‌تواند کویر، دشت یا اقلیم باشد.'
                    : 'e.g. If this location is a city, its enclosing parent can be the surrounding desert or realm.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'دسته‌بندی مکان (Category):' : 'Place Category:'}
                  </label>
                  <select
                    value={locCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    {categories.length === 0 ? (
                      <option value="dungeon">{isPersian ? 'دخمه / سیاه‌چال' : 'Dungeon'}</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'سطح خطر (Danger 1–5):' : 'Danger Tier (1–5):'}
                  </label>
                  <select
                    value={locDangerLevel}
                    onChange={(e) => setLocDangerLevel(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl} · {isPersian ? DANGER_MAP[lvl].labelFa : DANGER_MAP[lvl].labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'شرح مکان و ظاهر:' : 'Description & Appearance:'}
                </label>
                <textarea
                  rows={2}
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  placeholder={isPersian ? 'معماری، متریال و حس کلی مکان...' : 'Architecture, materials and overall feel...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'فضاسازی و لحن (Atmosphere):' : 'Atmosphere & Mood:'}
                </label>
                <input
                  type="text"
                  value={locAtmosphere}
                  onChange={(e) => setLocAtmosphere(e.target.value)}
                  placeholder={isPersian ? 'مثال: بوی تند گوگرد، چککه‌های مداوم آب اسیدی' : 'e.g. Pungent brimstone, dripping acid'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'قوانین ویژه مکان (هر خط یک مورد):' : 'Special Site Rules (One per line):'}
                </label>
                <textarea
                  rows={2}
                  value={locSpecialRules}
                  onChange={(e) => setLocSpecialRules(e.target.value)}
                  placeholder={isPersian ? 'کاهش مقاومت در برابر سموم\nنیاز به چکاپ مداوم' : 'Corrosive air requires fortitude checks\nFlickering light reveals hidden glyphs'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'مکان‌های پیوند خورده (Connected Locations):' : 'Connected Locations:'}
                </label>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 max-h-40 overflow-y-auto space-y-1.5">
                  {locations.filter((l) => l.id !== editingLocationId).length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {isPersian ? 'هنوز مکان دیگری برای پیوند وجود ندارد.' : 'No other locations available to link yet.'}
                    </p>
                  ) : (
                    locations
                      .filter((l) => l.id !== editingLocationId)
                      .map((l) => {
                        const checked = locConnectedIds.includes(l.id);
                        return (
                          <label
                            key={l.id}
                            className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-amber-200 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleConnected(l.id)}
                              className="accent-amber-500"
                            />
                            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{l.name}</span>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {editingLocationId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Location'
                    : isPersian
                      ? 'ثبت در جهان'
                      : 'Save to World'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Zones AI Preview Modal */}
      {subZonesPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Compass className="w-5 h-5" />
                <h3 className="text-sm font-bold">
                  {isPersian
                    ? `پیش‌نمایش زیربخش‌های "${subZonesPreview.location.name}"`
                    : `Sub-Zones Preview for "${subZonesPreview.location.name}"`}
                </h3>
              </div>
              <button
                onClick={() => setSubZonesPreview(null)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              {isPersian
                ? 'زیربخش‌ها و سیاه‌چال‌های زیر توسط هوش مصنوعی بر پایه اتمسفر و جغرافیای این مکان طراحی شده‌اند:'
                : 'The following sub-zones and exploration sectors have been procedurally tailored to this location:'}
            </p>

            <div className="space-y-3">
              {subZonesPreview.subZones.map((sz, idx) => {
                const subTypeMeta = SUBZONE_TYPE_LABELS[sz.subType] || SUBZONE_TYPE_LABELS.dungeon;
                return (
                  <div
                    key={idx}
                    className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-100 text-sm">{sz.name}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10.5px] border ${subTypeMeta.color}`}>
                          {isPersian ? subTypeMeta.fa : subTypeMeta.en}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                        {isPersian ? 'خطر:' : 'Danger:'} {sz.dangerLevel}/5
                      </span>
                    </div>

                    {sz.atmosphere && (
                      <p className="text-zinc-400 text-xs italic bg-zinc-900/60 rounded-xl px-3 py-1.5 border border-zinc-800/60">
                        "{sz.atmosphere}"
                      </p>
                    )}

                    {sz.explorationHooks && sz.explorationHooks.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10.5px] text-zinc-500 font-bold">
                          {isPersian ? 'قلاب‌های اکتشافی:' : 'Exploration Hooks:'}
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-zinc-300 text-[11px]">
                          {sz.explorationHooks.map((hook, hIdx) => (
                            <li key={hIdx}>{hook}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sz.pointsOfInterest && sz.pointsOfInterest.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10.5px] text-amber-400/90 font-bold flex items-center gap-1">
                          <Target className="w-3 h-3 text-amber-400" />
                          {isPersian ? 'نقاط تعاملی و چالش‌ها:' : 'POIs & Skill Gates:'}
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {sz.pointsOfInterest.map((poi, pIdx) => (
                            <div
                              key={pIdx}
                              className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-zinc-200 text-xs">{poi.name}</span>
                                {poi.skillCheck && (
                                  <span
                                    dir="ltr"
                                    className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[10px] border border-amber-500/20"
                                  >
                                    {poi.skillCheck.attribute} DC {poi.skillCheck.dc}
                                  </span>
                                )}
                              </div>
                              <p className="text-zinc-400 text-[11px] leading-tight">
                                {poi.description}
                              </p>
                              {poi.skillCheck?.failureConsequence && (
                                <p className="text-rose-300/80 text-[10px]">
                                  ⚠️ {isPersian ? 'شکست: ' : 'Fail: '}
                                  {poi.skillCheck.failureConsequence}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSubZonesPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveSubZonesPreview}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isPersian
                    ? `تأیید و ذخیره (${subZonesPreview.subZones.length} زیربخش)`
                    : `Save (${subZonesPreview.subZones.length} Sub-Zones)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Populate Micro-Ecosystem Preview Modal */}
      {ecosystemPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-4xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-purple-400">
                <Zap className="w-5 h-5" />
                <h3 className="text-sm font-bold">
                  {isPersian
                    ? `زیست‌بوم کامل مکان "${ecosystemPreview.location.name}"`
                    : `Micro-Ecosystem for "${ecosystemPreview.location.name}"`}
                </h3>
              </div>
              <button
                onClick={() => setEcosystemPreview(null)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              {isPersian
                ? 'یک بسته روایی کامل و همگام شامل ۲ شخصیت با اسرار، ۱ موجود بومی متناسب با اقلیم، و ۱ عتیقه پنهان آماده ثبت در جهان است:'
                : 'A synchronized lore packet containing 2 resident NPCs, 1 native creature, and 1 hidden mythic relic is ready to be added:'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Resident NPCs */}
              <div className="md:col-span-3 space-y-2">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {isPersian ? 'شخصیت‌های مقیم این مکان (۲ نفر):' : 'Resident NPCs (2):'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ecosystemPreview.payload.npcs.map((npc, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-zinc-100 text-sm">{npc.name}</span>
                          {npc.title && (
                            <p className="text-[11px] text-zinc-400">{npc.title}</p>
                          )}
                        </div>
                        {npc.role && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10.5px]">
                            {npc.role}
                          </span>
                        )}
                      </div>



                      {npc.speechStyle && (
                        <p className="text-[11px] text-zinc-400 italic">
                          "{npc.speechStyle}"
                        </p>
                      )}

                      {npc.personalityTraits && npc.personalityTraits.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {npc.personalityTraits.map((trait, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]"
                            >
                              {trait}
                            </span>
                          ))}
                        </div>
                      )}

                      {npc.secrets && npc.secrets.length > 0 && (
                        <div className="text-[10.5px] text-purple-300/90 bg-purple-950/20 border border-purple-500/20 rounded-xl p-2">
                          🔒 {npc.secrets.length} {isPersian ? 'راز فاش‌نشده' : 'hidden secrets'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Native Creature */}
              <div className="md:col-span-2 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Skull className="w-4 h-4" />
                  {isPersian ? 'موجود بومی و وحشی اقلیم:' : 'Native Creature:'}
                </h4>
                {ecosystemPreview.payload.creature && (
                  <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-100 text-sm">
                        {ecosystemPreview.payload.creature.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10.5px]">
                        {ecosystemPreview.payload.creature.speciesCategory} · خطر{' '}
                        {ecosystemPreview.payload.creature.dangerLevel}/5
                      </span>
                    </div>

                    {ecosystemPreview.payload.creature.loreDescription && (
                      <p className="text-zinc-400 text-xs leading-relaxed">
                        {ecosystemPreview.payload.creature.loreDescription}
                      </p>
                    )}

                    {ecosystemPreview.payload.creature.behavioralTactics && (
                      <p className="text-zinc-300 text-[11px] bg-zinc-900/70 rounded-xl p-2 border border-zinc-800/80">
                        ⚔️ <strong className="text-zinc-200">{isPersian ? 'تاکتیک نبرد:' : 'Tactics:'}</strong>{' '}
                        {ecosystemPreview.payload.creature.behavioralTactics}
                      </p>
                    )}

                    {ecosystemPreview.payload.creature.harvestableLoot &&
                      ecosystemPreview.payload.creature.harvestableLoot.length > 0 && (
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          <span className="text-zinc-500">{isPersian ? 'غنایم:' : 'Loot:'}</span>
                          {ecosystemPreview.payload.creature.harvestableLoot.map((loot, lIdx) => (
                            <span
                              key={lIdx}
                              className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300"
                            >
                              {loot.name} ({loot.dropRate})
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Hidden Mythic Relic */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Crown className="w-4 h-4" />
                  {isPersian ? 'عتیقه پنهان مکان:' : 'Hidden Relic:'}
                </h4>
                {ecosystemPreview.payload.hiddenRelic && (
                  <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-zinc-100 text-sm">
                          {ecosystemPreview.payload.hiddenRelic.name}
                        </span>
                        {ecosystemPreview.payload.hiddenRelic.title && (
                          <p className="text-[11px] text-zinc-400">
                            {ecosystemPreview.payload.hiddenRelic.title}
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10.5px]">
                        {ecosystemPreview.payload.hiddenRelic.rarity}
                      </span>
                    </div>

                    <p className="text-zinc-400 text-[11px] leading-tight">
                      {ecosystemPreview.payload.hiddenRelic.description}
                    </p>

                    {ecosystemPreview.payload.hiddenRelic.powers &&
                      ecosystemPreview.payload.hiddenRelic.powers.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-zinc-500 font-bold">
                            {isPersian ? 'قدرت‌ها:' : 'Powers:'}
                          </span>
                          <ul className="list-disc list-inside text-zinc-300 text-[10.5px]">
                            {ecosystemPreview.payload.hiddenRelic.powers.map((p, pIdx) => (
                              <li key={pIdx}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {ecosystemPreview.payload.hiddenRelic.curseOrCost && (
                      <p className="text-rose-300/90 text-[10.5px] bg-rose-950/20 border border-rose-500/20 rounded-xl p-2">
                        🩸 {isPersian ? 'نفرین / بهای استفاده: ' : 'Curse/Cost: '}
                        {ecosystemPreview.payload.hiddenRelic.curseOrCost}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEcosystemPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCommitEcosystem}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-amber-500 hover:from-purple-400 hover:to-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isPersian ? '📥 افزودن همه به جهان' : '📥 Batch Insert into World'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

