'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Route,
  Plus,
  Trash2,
  Edit2,
  X,
  MapPin,
  Package,
  ShieldAlert,
  Eye,
  ArrowRight,
  Skull,
  Sparkles,
  Compass,
  PawPrint,
  Gem,
  Leaf,
} from 'lucide-react';
import {
  WorldTradeRoute,
  WorldTradeRouteSchema,
  TradeRouteStatus,
  TradeFlowDirection,
  TradeCommodity,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { getMarketGoodsForLocation, MarketProvenance } from '@/lib/engines/world/tradeRoutes';
import {
  SearchableCombobox,
  MultiSearchableCombobox,
  ComboboxOption,
} from '@/components/studio/SearchableCombobox';

const STATUSES: TradeRouteStatus[] = ['active', 'raided', 'blockaded', 'seasonal', 'secret'];

const STATUS_META: Record<TradeRouteStatus, { en: string; fa: string; cls: string }> = {
  active: { en: 'Active', fa: 'فعال', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  raided: { en: 'Raided', fa: 'غارت‌شده', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  blockaded: { en: 'Blockaded', fa: 'محاصره‌شده', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  seasonal: { en: 'Seasonal', fa: 'فصلی', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  secret: { en: 'Secret', fa: 'مخفی', cls: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
};

const FLOW_LABEL: Record<TradeFlowDirection, { en: string; fa: string }> = {
  forward: { en: 'Forward', fa: 'رفت' },
  backward: { en: 'Backward', fa: 'برگشت' },
  bilateral: { en: 'Bilateral', fa: 'دوطرفه' },
};

const PROVENANCE_META: Record<MarketProvenance, { en: string; fa: string; cls: string }> = {
  native: { en: 'Native', fa: 'بومی', cls: 'text-emerald-400' },
  imported: { en: 'Imported', fa: 'وارداتی', cls: 'text-sky-400' },
  scarce: { en: 'Scarce', fa: 'کمیاب', cls: 'text-amber-400' },
  shortage: { en: 'Shortage', fa: 'کمبود شدید', cls: 'text-rose-400' },
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

interface CommodityDraft {
  entityId: string;
  name: string;
  flowDirection: TradeFlowDirection;
  significance: string;
}

const EMPTY_COMMODITY: CommodityDraft = {
  entityId: '',
  name: '',
  flowDirection: 'forward',
  significance: '',
};

export default function TradeStudioPage() {
  const { story, isPersian, addTradeRoute, editTradeRoute, deleteTradeRoute } = useStudioStory();

  const routes = story.worldBible.tradeRoutes || [];
  const locations = story.worldBible.locations || [];
  const factions = story.worldBible.factions || [];
  const bestiary = story.worldBible.bestiary || [];
  const artifacts = story.worldBible.artifacts || [];

  // Commodity candidates:
  // - Minerals & flora from the bestiary (raw extraction goods)
  // - All beasts & animals (livestock, mounts, exotic war beasts, falcons, pack beasts)
  // - Rare monstrosities & draconic creatures (exotic traded specimens)
  // - Artifacts & relics for high-value trade or smuggled wares.
  const commodityCandidates = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      source: string;
      type: 'mineral' | 'flora' | 'beast' | 'creature' | 'relic';
      isDomesticated?: boolean;
      subtext?: string;
    }> = [];

    for (const c of bestiary) {
      if (c.speciesCategory === 'mineral') {
        list.push({
          id: c.id,
          name: c.name,
          source: isPersian ? 'معدن' : 'mineral',
          type: 'mineral',
          subtext: c.loreDescription || c.craftingProperties,
        });
      } else if (c.speciesCategory === 'flora') {
        list.push({
          id: c.id,
          name: c.name,
          source: isPersian ? 'گیاه' : 'flora',
          type: 'flora',
          subtext: c.loreDescription || c.craftingProperties,
        });
      } else if (c.speciesCategory === 'beast') {
        list.push({
          id: c.id,
          name: c.name,
          source: isPersian
            ? (c.isDomesticated ? 'دام / حیوان اهلی' : 'حیوان')
            : (c.isDomesticated ? 'domesticated beast' : 'beast'),
          type: 'beast',
          isDomesticated: c.isDomesticated,
          subtext: c.loreDescription || (c.dangerLevel ? `${isPersian ? 'سطح خطر' : 'Danger'}: ${c.dangerLevel}` : undefined),
        });
      } else if (c.speciesCategory === 'monstrosity' || c.speciesCategory === 'draconic') {
        list.push({
          id: c.id,
          name: c.name,
          source: isPersian
            ? (c.speciesCategory === 'draconic' ? 'اژدها' : 'موجود کمیاب')
            : (c.speciesCategory === 'draconic' ? 'draconic' : 'monstrosity'),
          type: 'creature',
          subtext: c.loreDescription,
        });
      }
    }

    for (const a of artifacts) {
      list.push({
        id: a.id,
        name: a.name,
        source: isPersian ? 'عتیقه' : 'relic',
        type: 'relic',
        subtext: a.description,
      });
    }

    return list;
  }, [bestiary, artifacts, isPersian]);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewLocationId, setPreviewLocationId] = useState<string>('');

  // ---- form state ----
  const [fName, setFName] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fOriginId, setFOriginId] = useState('');
  const [fDestinationId, setFDestinationId] = useState('');
  const [fWaypointIds, setFWaypointIds] = useState<string[]>([]);
  const [fCommodities, setFCommodities] = useState<CommodityDraft[]>([{ ...EMPTY_COMMODITY }]);
  const [fControllingId, setFControllingId] = useState('');
  const [fPatrollingId, setFPatrollingId] = useState('');
  const [fRivalId, setFRivalId] = useState('');
  const [fDanger, setFDanger] = useState('2');
  const [fStatus, setFStatus] = useState<TradeRouteStatus>('active');
  const [fDisruption, setFDisruption] = useState('');
  const [fSmugglingDC, setFSmugglingDC] = useState('');
  const [fSecretLore, setFSecretLore] = useState('');

  // Combobox options with rich metadata
  const locationOptions: ComboboxOption[] = useMemo(() => {
    return locations.map((l) => ({
      id: l.id,
      name: l.name,
      subtext: l.description,
      badge: l.region || (l.dangerLevel ? `${isPersian ? 'خطر' : 'Danger'} ${l.dangerLevel}` : undefined),
      badgeColor: l.dangerLevel && l.dangerLevel >= 4 ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30' : undefined,
      icon: MapPin,
    }));
  }, [locations, isPersian]);

  const factionOptions: ComboboxOption[] = useMemo(() => {
    return factions.map((f) => ({
      id: f.id,
      name: f.name,
      subtext: f.description || f.publicGoals,
      badge: f.alignment || undefined,
      badgeColor: 'bg-purple-500/10 text-purple-300 border border-purple-500/30',
      icon: ShieldAlert,
    }));
  }, [factions]);

  const waypointOptions: ComboboxOption[] = useMemo(() => {
    return locations
      .filter((l) => l.id !== fOriginId && l.id !== fDestinationId)
      .map((l) => ({
        id: l.id,
        name: l.name,
        subtext: l.description,
        badge: l.region || undefined,
        icon: MapPin,
      }));
  }, [locations, fOriginId, fDestinationId]);

  const commodityOptions: ComboboxOption[] = useMemo(() => {
    return commodityCandidates.map((cand) => {
      let icon = Package;
      let badgeColor = 'bg-amber-500/10 text-amber-300 border border-amber-500/30';

      if (cand.type === 'beast') {
        icon = PawPrint;
        badgeColor = cand.isDomesticated
          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
          : 'bg-teal-500/10 text-teal-300 border border-teal-500/30';
      } else if (cand.type === 'creature') {
        icon = PawPrint;
        badgeColor = 'bg-rose-500/10 text-rose-300 border border-rose-500/30';
      } else if (cand.type === 'mineral') {
        icon = Gem;
        badgeColor = 'bg-amber-500/10 text-amber-300 border border-amber-500/30';
      } else if (cand.type === 'flora') {
        icon = Leaf;
        badgeColor = 'bg-lime-500/10 text-lime-300 border border-lime-500/30';
      } else if (cand.type === 'relic') {
        icon = Sparkles;
        badgeColor = 'bg-purple-500/10 text-purple-300 border border-purple-500/30';
      }

      return {
        id: cand.id,
        name: cand.name,
        subtext: cand.subtext,
        badge: cand.source,
        badgeColor,
        icon,
      };
    });
  }, [commodityCandidates]);

  const filtered = routes.filter((r) => {
    if (filterStatus !== 'all' && (r.status ?? 'active') !== filterStatus) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!r.name.toLowerCase().includes(s) && !(r.description || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const locName = (id?: string) => locations.find((l) => l.id === id)?.name || id || '—';
  const factionName = (id?: string) => factions.find((f) => f.id === id)?.name || id || '—';

  const resetForm = () => {
    setEditingId(null);
    setFName('');
    setFDescription('');
    setFOriginId('');
    setFDestinationId('');
    setFWaypointIds([]);
    setFCommodities([{ ...EMPTY_COMMODITY }]);
    setFControllingId('');
    setFPatrollingId('');
    setFRivalId('');
    setFDanger('2');
    setFStatus('active');
    setFDisruption('');
    setFSmugglingDC('');
    setFSecretLore('');
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (r: WorldTradeRoute) => {
    setEditingId(r.id);
    setFName(r.name || '');
    setFDescription(r.description || '');
    setFOriginId(r.originLocationId || '');
    setFDestinationId(r.destinationLocationId || '');
    setFWaypointIds([...(r.intermediateLocationIds || [])]);
    setFCommodities(
      (r.commodities || []).map((c) => ({
        entityId: c.entityId,
        name: c.name,
        flowDirection: (c.flowDirection as TradeFlowDirection) || 'forward',
        significance: c.significance || '',
      }))
    );
    setFControllingId(r.controllingFactionId || '');
    setFPatrollingId(r.patrollingFactionId || '');
    setFRivalId(r.rivalRaidingFactionId || '');
    setFDanger(String(r.dangerLevel ?? 2));
    setFStatus((r.status as TradeRouteStatus) || 'active');
    setFDisruption(r.disruptionReason || '');
    setFSmugglingDC(r.smugglingRiskDC !== undefined ? String(r.smugglingRiskDC) : '');
    setFSecretLore(r.secretLore || '');
    setShowModal(true);
  };

  const handleSave = () => {
    if (!fName.trim() || !fOriginId || !fDestinationId) {
      notify.error(
        isPersian
          ? 'نام، مبدأ و مقصد الزامی هستند'
          : 'Name, origin and destination are required'
      );
      return;
    }
    const commodities: TradeCommodity[] = fCommodities
      .filter((c) => c.entityId.trim() && c.name.trim())
      .map((c) => ({
        entityId: c.entityId.trim(),
        name: c.name.trim(),
        flowDirection: c.flowDirection,
        ...(c.significance.trim() ? { significance: c.significance.trim() } : {}),
      }));

    const payload = {
      id: editingId || newId('route'),
      name: fName.trim(),
      description: fDescription.trim(),
      originLocationId: fOriginId,
      destinationLocationId: fDestinationId,
      intermediateLocationIds: fWaypointIds,
      commodities,
      ...(fControllingId ? { controllingFactionId: fControllingId } : {}),
      ...(fPatrollingId ? { patrollingFactionId: fPatrollingId } : {}),
      ...(fRivalId ? { rivalRaidingFactionId: fRivalId } : {}),
      dangerLevel: (Math.min(5, Math.max(1, parseInt(fDanger || '2', 10) || 2)) as 1 | 2 | 3 | 4 | 5),
      status: fStatus,
      ...(fDisruption.trim() ? { disruptionReason: fDisruption.trim() } : {}),
      ...(fSmugglingDC.trim()
        ? { smugglingRiskDC: Math.min(25, Math.max(8, parseInt(fSmugglingDC, 10) || 14)) }
        : {}),
      ...(fSecretLore.trim() ? { secretLore: fSecretLore.trim() } : {}),
    };

    try {
      const parsed = WorldTradeRouteSchema.parse(payload);
      if (editingId) editTradeRoute(editingId, parsed);
      else addTradeRoute(parsed);
      setShowModal(false);
      resetForm();
    } catch {
      notify.error(isPersian ? 'خطا در اعتبارسنجی مسیر تجاری' : 'Trade route validation failed');
    }
  };

  /** Crisis simulator: one-click status flip straight on the card. */
  const quickSetStatus = (route: WorldTradeRoute, status: TradeRouteStatus) => {
    editTradeRoute(route.id, { status });
  };

  const inputCls =
    'w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60';
  const labelCls = 'text-[11px] font-bold text-zinc-400 mb-1 block';

  const previewGoods = previewLocationId
    ? getMarketGoodsForLocation(previewLocationId, story.worldBible)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Route className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-zinc-100">
              {isPersian ? 'شاهراه‌های تجاری و کاروان‌ها' : 'Trade Routes & Caravans'}
            </h1>
            <p className="text-[11px] text-zinc-500">
              {isPersian
                ? `${routes.length} مسیر تجاری • اقتصاد پویا و کمبودهای بازار`
                : `${routes.length} trade routes • dynamic economy & market shortages`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/cartographer"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow-lg shadow-amber-950/20"
            title={isPersian ? 'ترسیم مسیرها روی نقشه جهان' : 'Draw routes on Interactive World Map'}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>{isPersian ? 'نقشه‌نگار تعاملی' : 'World Cartographer'}</span>
          </Link>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isPersian ? 'شاهراه جدید' : 'New Route'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-200 cursor-pointer"
        >
          <option value="all">{isPersian ? 'همه وضعیت‌ها' : 'All statuses'}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {isPersian ? STATUS_META[s].fa : STATUS_META[s].en}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isPersian ? 'جستجو در نام و توضیح…' : 'Search name & description…'}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 min-w-[220px]"
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center">
          <Route className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-300">
            {isPersian ? 'هنوز شاهراهی ثبت نشده' : 'No trade routes yet'}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {isPersian
              ? 'اولین شاهراه را بسازید یا از مشاور هوش مصنوعی بخواهید.'
              : 'Create the first route or ask the Oracle.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((r) => {
            const status = (r.status ?? 'active') as TradeRouteStatus;
            return (
              <div
                key={r.id}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-3 hover:border-amber-500/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-zinc-100 truncate">{r.name}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${STATUS_META[status].cls}`}
                      >
                        {isPersian ? STATUS_META[status].fa : STATUS_META[status].en}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold flex items-center gap-1">
                        <Skull className="w-3 h-3" /> {isPersian ? 'خطر' : 'Danger'} {r.dangerLevel ?? 2}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-all cursor-pointer"
                      title={isPersian ? 'ویرایش' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteTradeRoute(r.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-all cursor-pointer"
                      title={isPersian ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Path: Origin -> waypoints -> Destination */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-3 py-2">
                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-zinc-200 font-semibold">{locName(r.originLocationId)}</span>
                  {(r.intermediateLocationIds || []).map((w, i) => (
                    <React.Fragment key={`${w}-${i}`}>
                      <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span className="text-zinc-400">{locName(w)}</span>
                    </React.Fragment>
                  ))}
                  <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                  <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                  <span className="text-zinc-200 font-semibold">{locName(r.destinationLocationId)}</span>
                </div>

                {/* Commodities & Animals */}
                {(r.commodities || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(r.commodities || []).map((c, i) => {
                      const matchedBeast = bestiary.find((b) => b.id === c.entityId);
                      const isBeast = matchedBeast && (matchedBeast.speciesCategory === 'beast' || matchedBeast.speciesCategory === 'monstrosity');
                      const isFlora = matchedBeast?.speciesCategory === 'flora';
                      const isMineral = matchedBeast?.speciesCategory === 'mineral';
                      const isRelic = artifacts.some((a) => a.id === c.entityId);

                      const IconComp = isBeast
                        ? PawPrint
                        : isFlora
                        ? Leaf
                        : isMineral
                        ? Gem
                        : isRelic
                        ? Sparkles
                        : Package;

                      const badgeCls = isBeast
                        ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
                        : isFlora
                        ? 'bg-lime-500/10 text-lime-200 border-lime-500/20'
                        : isMineral
                        ? 'bg-amber-500/10 text-amber-200 border-amber-500/20'
                        : isRelic
                        ? 'bg-purple-500/10 text-purple-200 border-purple-500/20'
                        : 'bg-zinc-800 text-zinc-200 border-zinc-700/60';

                      return (
                        <span
                          key={`${c.entityId}-${i}`}
                          className={`text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1 ${badgeCls}`}
                          title={c.significance || ''}
                        >
                          <IconComp className="w-3 h-3 shrink-0" />
                          {c.name}
                          <span className="opacity-70">
                            ({isPersian ? FLOW_LABEL[c.flowDirection || 'forward'].fa : FLOW_LABEL[c.flowDirection || 'forward'].en})
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Factions */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                  {r.controllingFactionId && (
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> {factionName(r.controllingFactionId)}
                    </span>
                  )}
                  {r.patrollingFactionId && (
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-sky-400" /> {factionName(r.patrollingFactionId)}
                    </span>
                  )}
                  {r.rivalRaidingFactionId && (
                    <span className="flex items-center gap-1">
                      <Skull className="w-3 h-3 text-rose-400" /> {factionName(r.rivalRaidingFactionId)}
                    </span>
                  )}
                  {r.smugglingRiskDC !== undefined && (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> DC {r.smugglingRiskDC}
                    </span>
                  )}
                </div>

                {r.disruptionReason && (
                  <p className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
                    ⚠ {r.disruptionReason}
                  </p>
                )}
                {r.secretLore && (
                  <p className="text-[11px] text-violet-300/90 bg-violet-500/5 border border-violet-500/20 rounded-xl px-3 py-2">
                    🤫 {r.secretLore}
                  </p>
                )}

                {/* Crisis Simulator: one-click status flip */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-zinc-800/60">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => quickSetStatus(r, s)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        status === s
                          ? STATUS_META[s].cls
                          : 'bg-zinc-950/60 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                      }`}
                      title={isPersian ? 'تغییر وضعیت مسیر' : 'Toggle route status'}
                    >
                      {isPersian ? STATUS_META[s].fa : STATUS_META[s].en}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Market Preview (Route Health & Crisis Simulator) */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-black text-zinc-100">
            {isPersian ? 'شبیه‌ساز بازار: موجودی کالاها' : 'Market Simulator: Goods Availability'}
          </h2>
        </div>
        <p className="text-[11px] text-zinc-500">
          {isPersian
            ? 'یک شهر را انتخاب کنید تا ببینید چه کالاهایی بومی، وارداتی، کمیاب یا قطع شده‌اند.'
            : 'Pick a settlement to see which goods are native, imported, scarce or cut off.'}
        </p>
        <div className="max-w-xs">
          <SearchableCombobox
            value={previewLocationId}
            onChange={setPreviewLocationId}
            options={locationOptions}
            placeholder={isPersian ? 'انتخاب مکان…' : 'Select a location…'}
            searchPlaceholder={isPersian ? 'جستجوی نام شهر یا پایگاه…' : 'Search settlement or outpost…'}
            emptyMessage={isPersian ? 'مکانی یافت نشد' : 'No locations found'}
            isPersian={isPersian}
            icon={MapPin}
          />
        </div>
        {previewLocationId && (
          <div className="flex flex-wrap gap-1.5">
            {previewGoods.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                {isPersian ? 'کالایی در این بازار یافت نشد.' : 'No goods resolve in this market.'}
              </p>
            ) : (
              previewGoods.map((g) => {
                const meta = PROVENANCE_META[g.provenance];
                return (
                  <span
                    key={g.entityId}
                    className={`text-[10px] px-2 py-1 rounded-lg bg-zinc-950/70 border border-zinc-800 font-semibold ${meta.cls}`}
                    title={g.routeName ? `${g.routeName}` : undefined}
                  >
                    {g.name} · {isPersian ? meta.fa : meta.en}
                  </span>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-[#0d0e15] border border-zinc-800 p-6 space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-zinc-100">
                {editingId
                  ? isPersian
                    ? 'ویرایش شاهراه'
                    : 'Edit Trade Route'
                  : isPersian
                    ? 'شاهراه جدید'
                    : 'New Trade Route'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className={labelCls}>{isPersian ? 'نام شاهراه' : 'Route name'}</label>
                <input
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  className={inputCls}
                  placeholder={isPersian ? 'شاهراه زمهریر' : 'The Frost-Peak Highway'}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{isPersian ? 'توضیح' : 'Description'}</label>
                <textarea
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                  rows={2}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {isPersian ? 'مبدأ' : 'Origin'} <span className="text-amber-400">*</span>
                </label>
                <SearchableCombobox
                  value={fOriginId}
                  onChange={setFOriginId}
                  options={locationOptions}
                  placeholder={isPersian ? 'انتخاب مکان مبدأ…' : 'Select origin location…'}
                  searchPlaceholder={isPersian ? 'جستجوی نام یا اقلیم مبدأ…' : 'Search origin name or region…'}
                  emptyMessage={isPersian ? 'مکانی یافت نشد' : 'No locations found'}
                  isPersian={isPersian}
                  icon={MapPin}
                />
              </div>

              <div>
                <label className={labelCls}>
                  {isPersian ? 'مقصد' : 'Destination'} <span className="text-amber-400">*</span>
                </label>
                <SearchableCombobox
                  value={fDestinationId}
                  onChange={setFDestinationId}
                  options={locationOptions}
                  placeholder={isPersian ? 'انتخاب مکان مقصد…' : 'Select destination location…'}
                  searchPlaceholder={isPersian ? 'جستجوی نام یا اقلیم مقصد…' : 'Search destination name or region…'}
                  emptyMessage={isPersian ? 'مکانی یافت نشد' : 'No locations found'}
                  isPersian={isPersian}
                  icon={MapPin}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>
                  {isPersian ? 'ایستگاه‌های میانی (جستجو و انتخاب چندگانه با پیشنهاد خودکار)' : 'Intermediate waypoints'}
                </label>
                <MultiSearchableCombobox
                  values={fWaypointIds}
                  onChange={setFWaypointIds}
                  options={waypointOptions}
                  placeholder={
                    isPersian
                      ? 'چند حرف برای جستجو و افزودن ایستگاه میانی تایپ کنید…'
                      : 'Type a few letters to search & add waypoints…'
                  }
                  searchPlaceholder={
                    isPersian
                      ? 'جستجوی ایستگاه‌های بین راه…'
                      : 'Search intermediate waystations…'
                  }
                  emptyMessage={isPersian ? 'مکان دیگری برای افزودن یافت نشد' : 'No more waypoints found'}
                  isPersian={isPersian}
                  icon={MapPin}
                />
              </div>

              <div>
                <label className={labelCls}>{isPersian ? 'سازمان کنترل‌کننده' : 'Controlling faction'}</label>
                <SearchableCombobox
                  value={fControllingId}
                  onChange={setFControllingId}
                  options={factionOptions}
                  placeholder={isPersian ? 'انتخاب فکشن/سازمان…' : 'Select controlling faction…'}
                  searchPlaceholder={isPersian ? 'جستجو در فکشن‌ها…' : 'Search factions…'}
                  emptyMessage={isPersian ? 'فکشنی یافت نشد' : 'No factions found'}
                  isPersian={isPersian}
                  icon={ShieldAlert}
                />
              </div>

              <div>
                <label className={labelCls}>{isPersian ? 'نیروی گشتی/محافظ' : 'Patrolling faction'}</label>
                <SearchableCombobox
                  value={fPatrollingId}
                  onChange={setFPatrollingId}
                  options={factionOptions}
                  placeholder={isPersian ? 'انتخاب نیروی گشتی…' : 'Select patrolling faction…'}
                  searchPlaceholder={isPersian ? 'جستجو در نیروهای گشتی…' : 'Search patrolling forces…'}
                  emptyMessage={isPersian ? 'فکشنی یافت نشد' : 'No factions found'}
                  isPersian={isPersian}
                  icon={ShieldAlert}
                />
              </div>

              <div>
                <label className={labelCls}>{isPersian ? 'فکشن غارتگر رقیب' : 'Rival raiding faction'}</label>
                <SearchableCombobox
                  value={fRivalId}
                  onChange={setFRivalId}
                  options={factionOptions}
                  placeholder={isPersian ? 'انتخاب فکشن غارتگر…' : 'Select raiding faction…'}
                  searchPlaceholder={isPersian ? 'جستجو در راهزنان و رقبا…' : 'Search raiders and rivals…'}
                  emptyMessage={isPersian ? 'فکشنی یافت نشد' : 'No factions found'}
                  isPersian={isPersian}
                  icon={Skull}
                />
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'سطح خطر' : 'Danger level'}</label>
                <select value={fDanger} onChange={(e) => setFDanger(e.target.value)} className={inputCls}>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'وضعیت' : 'Status'}</label>
                <select
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value as TradeRouteStatus)}
                  className={inputCls}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {isPersian ? STATUS_META[s].fa : STATUS_META[s].en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>
                  {isPersian ? 'علت اختلال (برای وضعیت‌های بحرانی)' : 'Disruption reason'}
                </label>
                <input
                  value={fDisruption}
                  onChange={(e) => setFDisruption(e.target.value)}
                  className={inputCls}
                  placeholder={
                    isPersian
                      ? 'کولاک زمستانی گذرگاه بلند را دفن کرده است'
                      : 'Winter blizzards have buried the High Pass'
                  }
                />
              </div>
              <div>
                <label className={labelCls}>
                  {isPersian ? 'DC قاچاق (۸ تا ۲۵)' : 'Smuggling risk DC (8–25)'}
                </label>
                <input
                  value={fSmugglingDC}
                  onChange={(e) => setFSmugglingDC(e.target.value)}
                  type="number"
                  min={8}
                  max={25}
                  className={inputCls}
                  placeholder="14"
                />
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'راز مسیر مخفی' : 'Secret lore'}</label>
                <input
                  value={fSecretLore}
                  onChange={(e) => setFSecretLore(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Commodities & Animals editor */}
            <div className="rounded-2xl border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-300">
                  {isPersian ? 'کالاها و حیوانات کاروان' : 'Caravan Goods & Animals'}
                </span>
                <button
                  onClick={() => setFCommodities((p) => [...p, { ...EMPTY_COMMODITY }])}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {isPersian ? 'افزودن کالا یا حیوان' : 'Add commodity / animal'}
                </button>
              </div>
              {fCommodities.map((c, idx) => (
                <div key={idx} className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={c.name}
                      onChange={(e) =>
                        setFCommodities((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                      }
                      className={inputCls}
                      placeholder={isPersian ? 'نام کالا یا حیوان…' : 'Commodity / animal name…'}
                    />
                    <button
                      onClick={() => setFCommodities((p) => p.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <SearchableCombobox
                      value={c.entityId}
                      onChange={(id) => {
                        const cand = commodityCandidates.find((x) => x.id === id);
                        setFCommodities((p) =>
                          p.map((x, i) =>
                            i === idx
                              ? { ...x, entityId: id, name: cand ? cand.name : x.name }
                              : x
                          )
                        );
                      }}
                      options={commodityOptions}
                      placeholder={isPersian ? 'انتخاب کالا، حیوان یا عتیقه…' : 'Select good, animal, or relic…'}
                      searchPlaceholder={isPersian ? 'جستجو در کالاها و حیوانات…' : 'Search goods & animals…'}
                      emptyMessage={isPersian ? 'موردی یافت نشد' : 'No match found'}
                      isPersian={isPersian}
                      icon={Package}
                    />
                    <select
                      value={c.flowDirection}
                      onChange={(e) =>
                        setFCommodities((p) =>
                          p.map((x, i) =>
                            i === idx ? { ...x, flowDirection: e.target.value as TradeFlowDirection } : x
                          )
                        )
                      }
                      className={inputCls}
                    >
                      {(['forward', 'backward', 'bilateral'] as TradeFlowDirection[]).map((d) => (
                        <option key={d} value={d}>
                          {isPersian ? FLOW_LABEL[d].fa : FLOW_LABEL[d].en}
                        </option>
                      ))}
                    </select>
                    <input
                      value={c.significance}
                      onChange={(e) =>
                        setFCommodities((p) =>
                          p.map((x, i) => (i === idx ? { ...x, significance: e.target.value } : x))
                        )
                      }
                      className={inputCls}
                      placeholder={
                        isPersian ? 'اهمیت (اختیاری)…' : 'Significance (optional)…'
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black cursor-pointer"
              >
                {isPersian ? 'ذخیره شاهراه' : 'Save Route'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}