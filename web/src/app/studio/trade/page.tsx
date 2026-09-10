'use client';

import React, { useMemo, useState } from 'react';
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

  // Commodity candidates: minerals & flora from the bestiary (extraction goods),
  // plus mythic relics for high-value smuggled wares.
  const commodityCandidates = useMemo(() => {
    const list: Array<{ id: string; name: string; source: string }> = bestiary
      .filter((c) => c.speciesCategory === 'mineral' || c.speciesCategory === 'flora')
      .map((c) => ({
        id: c.id,
        name: c.name,
        source: c.speciesCategory === 'mineral' ? (isPersian ? 'معدن' : 'mineral') : (isPersian ? 'گیاه' : 'flora'),
      }));
    for (const a of artifacts) {
      list.push({ id: a.id, name: a.name, source: isPersian ? 'عتیقه' : 'relic' });
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
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {isPersian ? 'شاهراه جدید' : 'New Route'}
        </button>
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

                {/* Commodities */}
                {(r.commodities || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(r.commodities || []).map((c, i) => (
                      <span
                        key={`${c.entityId}-${i}`}
                        className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-200 border border-amber-500/20 flex items-center gap-1"
                        title={c.significance || ''}
                      >
                        <Package className="w-3 h-3" />
                        {c.name}
                        <span className="text-amber-400/70">
                          ({isPersian ? FLOW_LABEL[c.flowDirection || 'forward'].fa : FLOW_LABEL[c.flowDirection || 'forward'].en})
                        </span>
                      </span>
                    ))}
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
        <select
          value={previewLocationId}
          onChange={(e) => setPreviewLocationId(e.target.value)}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-200 cursor-pointer max-w-xs"
        >
          <option value="">{isPersian ? 'انتخاب مکان…' : 'Select a location…'}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
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
                <label className={labelCls}>{isPersian ? 'مبدأ' : 'Origin'}</label>
                <select value={fOriginId} onChange={(e) => setFOriginId(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'مقصد' : 'Destination'}</label>
                <select
                  value={fDestinationId}
                  onChange={(e) => setFDestinationId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>
                  {isPersian ? 'ایستگاه‌های میانی (چند انتخابی)' : 'Intermediate waypoints'}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  {locations
                    .filter((l) => l.id !== fOriginId && l.id !== fDestinationId)
                    .map((l) => {
                      const on = fWaypointIds.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() =>
                            setFWaypointIds((p) =>
                              on ? p.filter((x) => x !== l.id) : [...p, l.id]
                            )
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            on
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                          }`}
                        >
                          {l.name}
                        </button>
                      );
                    })}
                </div>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'سازمان کنترل‌کننده' : 'Controlling faction'}</label>
                <select
                  value={fControllingId}
                  onChange={(e) => setFControllingId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'نیروی گشتی/محافظ' : 'Patrolling faction'}</label>
                <select
                  value={fPatrollingId}
                  onChange={(e) => setFPatrollingId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'faction غارتگر رقیب' : 'Rival raiding faction'}</label>
                <select value={fRivalId} onChange={(e) => setFRivalId(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
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

            {/* Commodities editor */}
            <div className="rounded-2xl border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-300">
                  {isPersian ? 'کالاها' : 'Commodities'}
                </span>
                <button
                  onClick={() => setFCommodities((p) => [...p, { ...EMPTY_COMMODITY }])}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {isPersian ? 'افزودن کالا' : 'Add commodity'}
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
                      placeholder={isPersian ? 'نام کالا…' : 'Commodity name…'}
                    />
                    <button
                      onClick={() => setFCommodities((p) => p.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={c.entityId}
                      onChange={(e) => {
                        const cand = commodityCandidates.find((x) => x.id === e.target.value);
                        setFCommodities((p) =>
                          p.map((x, i) =>
                            i === idx
                              ? { ...x, entityId: e.target.value, name: cand ? cand.name : x.name }
                              : x
                          )
                        );
                      }}
                      className={inputCls}
                    >
                      <option value="">{isPersian ? 'کالای استخراجی/عتیقه…' : 'Extraction good / relic…'}</option>
                      {commodityCandidates.map((cand) => (
                        <option key={cand.id} value={cand.id}>
                          {cand.name} ({cand.source})
                        </option>
                      ))}
                    </select>
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