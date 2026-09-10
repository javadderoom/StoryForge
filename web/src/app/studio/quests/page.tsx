'use client';

import React, { useMemo, useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  ListChecks,
  Plus,
  Trash2,
  Edit2,
  X,
  User,
  MapPin,
  Package,
  Coins,
  Link2,
  Flag,
} from 'lucide-react';
import {
  WorldQuest,
  QuestObjective,
  QuestCategory,
  QuestObjectiveType,
  WorldQuestSchema,
} from '@/lib/types';
import { notify } from '@/lib/notify';

const CATEGORIES: QuestCategory[] = [
  'main_arc',
  'personal_errand',
  'caravan_escort',
  'bounty',
  'investigation',
  'vault_heist',
];

const OBJECTIVE_TYPES: QuestObjectiveType[] = [
  'fetch',
  'deliver',
  'slay',
  'infiltrate',
  'escort',
  'interrogate',
  'discover',
];

const CATEGORY_LABEL: Record<QuestCategory, { en: string; fa: string }> = {
  main_arc: { en: 'Main Arc', fa: 'قوس اصلی' },
  personal_errand: { en: 'Personal Errand', fa: 'لطف شخصی' },
  caravan_escort: { en: 'Caravan Escort', fa: 'اسکورت کاروان' },
  bounty: { en: 'Bounty', fa: 'جایزه شکار' },
  investigation: { en: 'Investigation', fa: 'تحقیق' },
  vault_heist: { en: 'Vault Heist', fa: 'سرقت خزانه' },
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

interface ObjectiveDraft {
  description: string;
  type: QuestObjectiveType;
  targetLocationId: string;
  targetNpcId: string;
  targetCreatureId: string;
  requiredItemId: string;
  requiredItemName: string;
  requiredQuantity: string;
  consumeItemOnComplete: boolean;
  isOptional: boolean;
}

const EMPTY_OBJECTIVE: ObjectiveDraft = {
  description: '',
  type: 'fetch',
  targetLocationId: '',
  targetNpcId: '',
  targetCreatureId: '',
  requiredItemId: '',
  requiredItemName: '',
  requiredQuantity: '1',
  consumeItemOnComplete: true,
  isOptional: false,
};

interface TrustRewardDraft {
  npcId: string;
  trustDelta: string;
}

export default function QuestsStudioPage() {
  const { story, isPersian, addQuest, editQuest, deleteQuest } = useStudioStory();

  const quests = story.worldBible.quests || [];
  const npcs = story.worldBible.npcs || [];
  const locations = story.worldBible.locations || [];
  const bestiary = story.worldBible.bestiary || [];
  const gameItems = story.rpgSystem.startingInventory || [];

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLine, setFilterLine] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ---- form state ----
  const [fTitle, setFTitle] = useState('');
  const [fSummary, setFSummary] = useState('');
  const [fCategory, setFCategory] = useState<QuestCategory>('personal_errand');
  const [fGiverNpcId, setFGiverNpcId] = useState('');
  const [fOriginLocationId, setFOriginLocationId] = useState('');
  const [fTriggerItemId, setFTriggerItemId] = useState('');
  const [fQuestLineId, setFQuestLineId] = useState('');
  const [fQuestLineName, setFQuestLineName] = useState('');
  const [fOrderInLine, setFOrderInLine] = useState('1');
  const [fNextQuestId, setFNextQuestId] = useState('');
  const [fReqCompleted, setFReqCompleted] = useState('');
  const [fReqTrust, setFReqTrust] = useState('');
  const [fReqItems, setFReqItems] = useState('');
  const [fObjectives, setFObjectives] = useState<ObjectiveDraft[]>([{ ...EMPTY_OBJECTIVE }]);
  const [fTrustRewards, setFTrustRewards] = useState<TrustRewardDraft[]>([]);
  const [fSecrets, setFSecrets] = useState('');
  const [fItemRewards, setFItemRewards] = useState('');
  const [fGold, setFGold] = useState('');
  const [fResolution, setFResolution] = useState('');

  const questLines = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const q of quests) {
      if (!q.questLineId) continue;
      const cur = map.get(q.questLineId) || {
        id: q.questLineId,
        name: q.questLineName || q.questLineId,
        count: 0,
      };
      cur.count += 1;
      map.set(q.questLineId, cur);
    }
    return [...map.values()];
  }, [quests]);

  const filtered = quests.filter((q) => {
    if (filterCategory !== 'all' && q.category !== filterCategory) return false;
    if (filterLine !== 'all' && q.questLineId !== filterLine) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!(q.title.toLowerCase().includes(s) || q.summary.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const npcName = (id?: string) => npcs.find((n) => n.id === id)?.name || id || '—';
  const locName = (id?: string) => locations.find((l) => l.id === id)?.name || id || '—';

  const resetForm = () => {
    setEditingId(null);
    setFTitle('');
    setFSummary('');
    setFCategory('personal_errand');
    setFGiverNpcId('');
    setFOriginLocationId('');
    setFTriggerItemId('');
    setFQuestLineId('');
    setFQuestLineName('');
    setFOrderInLine('1');
    setFNextQuestId('');
    setFReqCompleted('');
    setFReqTrust('');
    setFReqItems('');
    setFObjectives([{ ...EMPTY_OBJECTIVE }]);
    setFTrustRewards([]);
    setFSecrets('');
    setFItemRewards('');
    setFGold('');
    setFResolution('');
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (q: WorldQuest) => {
    setEditingId(q.id);
    setFTitle(q.title || '');
    setFSummary(q.summary || '');
    setFCategory((q.category as QuestCategory) || 'personal_errand');
    setFGiverNpcId(q.giverNpcId || '');
    setFOriginLocationId(q.originLocationId || '');
    setFTriggerItemId(q.triggerItemId || '');
    setFQuestLineId(q.questLineId || '');
    setFQuestLineName(q.questLineName || '');
    setFOrderInLine(String(q.orderInLine ?? 1));
    setFNextQuestId(q.nextQuestId || '');
    setFReqCompleted((q.prerequisites?.requiredCompletedQuestIds || []).join(', '));
    setFReqTrust(
      q.prerequisites?.requiredTrustLevel !== undefined ? String(q.prerequisites.requiredTrustLevel) : ''
    );
    setFReqItems((q.prerequisites?.requiredPossessedItemIds || []).join(', '));
    setFObjectives(
      (q.objectives || []).map((o) => ({
        description: o.description || '',
        type: (o.type as QuestObjectiveType) || 'fetch',
        targetLocationId: o.targetLocationId || '',
        targetNpcId: o.targetNpcId || '',
        targetCreatureId: o.targetCreatureId || '',
        requiredItemId: o.requiredItemId || '',
        requiredItemName: o.requiredItemName || '',
        requiredQuantity: String(o.requiredQuantity ?? 1),
        consumeItemOnComplete: o.consumeItemOnComplete ?? true,
        isOptional: o.isOptional ?? false,
      }))
    );
    setFTrustRewards(
      (q.rewards?.trustRewards || []).map((t) => ({ npcId: t.npcId, trustDelta: String(t.trustDelta) }))
    );
    setFSecrets((q.rewards?.unlockedSecretIds || []).join(', '));
    setFItemRewards(
      (q.rewards?.itemRewards || []).map((i) => `${i.name}x${i.quantity ?? 1}`).join(', ')
    );
    setFGold(q.rewards?.goldReward ? String(q.rewards.goldReward) : '');
    setFResolution(q.rewards?.narrativeResolution || '');
    setShowModal(true);
  };

  const handleSave = () => {
    const objectives: QuestObjective[] = [];
    for (const d of fObjectives) {
      if (!d.description.trim()) continue;
      objectives.push({
        id: newId('obj'),
        description: d.description.trim(),
        type: d.type,
        ...(d.targetLocationId ? { targetLocationId: d.targetLocationId } : {}),
        ...(d.targetNpcId ? { targetNpcId: d.targetNpcId } : {}),
        ...(d.targetCreatureId ? { targetCreatureId: d.targetCreatureId } : {}),
        ...(d.requiredItemId ? { requiredItemId: d.requiredItemId } : {}),
        ...(d.requiredItemName.trim() ? { requiredItemName: d.requiredItemName.trim() } : {}),
        requiredQuantity: Math.max(1, parseInt(d.requiredQuantity || '1', 10) || 1),
        consumeItemOnComplete: d.consumeItemOnComplete,
        isOptional: d.isOptional,
      });
    }
    if (objectives.length === 0) {
      notify.error(isPersian ? 'حداقل یک هدف با توضیح لازم است' : 'At least one objective with a description is required');
      return;
    }

    const trustRewards = fTrustRewards
      .filter((t) => t.npcId)
      .map((t) => ({ npcId: t.npcId, trustDelta: parseInt(t.trustDelta || '0', 10) || 0 }));

    const itemRewards = fItemRewards
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const m = s.match(/^(.+?)x(\d+)$/);
        if (m) return { id: newId('ritem'), name: m[1].trim(), quantity: parseInt(m[2], 10) || 1 };
        return { id: newId('ritem'), name: s, quantity: 1 };
      });

    const splitIds = (s: string) =>
      s.split(',').map((x) => x.trim()).filter(Boolean);

    const payload = {
      id: editingId || newId('quest'),
      title: fTitle.trim(),
      summary: fSummary.trim(),
      category: fCategory,
      ...(fGiverNpcId ? { giverNpcId: fGiverNpcId } : {}),
      ...(fOriginLocationId ? { originLocationId: fOriginLocationId } : {}),
      ...(fTriggerItemId ? { triggerItemId: fTriggerItemId } : {}),
      ...(fQuestLineId.trim() ? { questLineId: fQuestLineId.trim() } : {}),
      ...(fQuestLineName.trim() ? { questLineName: fQuestLineName.trim() } : {}),
      orderInLine: Math.max(1, parseInt(fOrderInLine || '1', 10) || 1),
      ...(fNextQuestId ? { nextQuestId: fNextQuestId } : {}),
      prerequisites: {
        requiredCompletedQuestIds: splitIds(fReqCompleted),
        ...(fReqTrust.trim() ? { requiredTrustLevel: parseInt(fReqTrust, 10) || 0 } : {}),
        requiredPossessedItemIds: splitIds(fReqItems),
      },
      objectives,
      rewards: {
        trustRewards,
        unlockedSecretIds: splitIds(fSecrets),
        itemRewards,
        goldReward: Math.max(0, parseInt(fGold || '0', 10) || 0),
        ...(fResolution.trim() ? { narrativeResolution: fResolution.trim() } : {}),
      },
    };

    try {
      const parsed = WorldQuestSchema.parse(payload);
      if (editingId) editQuest(editingId, parsed);
      else addQuest(parsed);
      setShowModal(false);
      resetForm();
    } catch (e) {
      notify.error(isPersian ? 'خطا در اعتبارسنجی ماموریت' : 'Quest validation failed');
    }
  };

  const inputCls =
    'w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60';
  const labelCls = 'text-[11px] font-bold text-zinc-400 mb-1 block';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <ListChecks className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-zinc-100">
              {isPersian ? 'ماموریت‌ها و خطوط داستانی' : 'Quests & Quest Lines'}
            </h1>
            <p className="text-[11px] text-zinc-500">
              {isPersian
                ? `${quests.length} ماموریت • ${questLines.length} خط داستانی`
                : `${quests.length} quests • ${questLines.length} quest lines`}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {isPersian ? 'ماموریت جدید' : 'New Quest'}
        </button>
      </div>

      {/* Quest line strip */}
      {questLines.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterLine('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
              filterLine === 'all'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            {isPersian ? 'همه خطوط' : 'All lines'}
          </button>
          {questLines.map((l) => (
            <button
              key={l.id}
              onClick={() => setFilterLine(l.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                filterLine === l.id
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {l.name} ({l.count})
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-200 cursor-pointer">
          <option value="all">{isPersian ? 'همه دسته‌ها' : 'All categories'}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {isPersian ? CATEGORY_LABEL[c].fa : CATEGORY_LABEL[c].en}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isPersian ? 'جستجو در عنوان و خلاصه…' : 'Search title & summary…'}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 min-w-[220px]"
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center">
          <ListChecks className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-300">
            {isPersian ? 'هنوز ماموریتی ثبت نشده' : 'No quests yet'}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {isPersian ? 'اولین ماموریت را بسازید یا از مشاور هوش مصنوعی بخواهید.' : 'Create the first quest or ask the Oracle.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((q) => (
            <div key={q.id} className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-3 hover:border-amber-500/30 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-zinc-100 truncate">{q.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                      {isPersian ? CATEGORY_LABEL[(q.category as QuestCategory) || 'personal_errand'].fa : CATEGORY_LABEL[(q.category as QuestCategory) || 'personal_errand'].en}
                    </span>
                    {q.questLineName && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20 font-bold">
                        {q.questLineName} · {q.orderInLine ?? 1}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2">{q.summary}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(q)} className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-all cursor-pointer" title={isPersian ? 'ویرایش' : 'Edit'}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteQuest(q.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-all cursor-pointer" title={isPersian ? 'حذف' : 'Delete'}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                {q.giverNpcId && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {npcName(q.giverNpcId)}
                  </span>
                )}
                {q.originLocationId && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {locName(q.originLocationId)}
                  </span>
                )}
                {q.triggerItemId && (
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" /> trigger: {q.triggerItemId}
                  </span>
                )}
                {q.nextQuestId && (
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> next: {quests.find((x) => x.id === q.nextQuestId)?.title || q.nextQuestId}
                  </span>
                )}
                {(q.rewards?.goldReward || 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" /> {q.rewards?.goldReward}
                  </span>
                )}
                {(q.rewards?.trustRewards?.length || 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Flag className="w-3 h-3" /> +{(q.rewards?.trustRewards || []).map((t) => `${t.trustDelta} ${npcName(t.npcId)}`).join(', ')}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {(q.objectives || []).map((o, i) => (
                  <div key={o.id || i} className="flex items-start gap-2 text-[11px] bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-3 py-2">
                    <span className="text-amber-400 font-mono font-bold shrink-0">{i + 1}.</span>
                    <div className="min-w-0">
                      <span className="text-zinc-200">{o.description}</span>
                      <span className="text-zinc-500"> · {o.type}</span>
                      {o.isOptional && <span className="text-zinc-500"> · {isPersian ? 'اختیاری' : 'optional'}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-3xl rounded-2xl bg-[#0d0e15] border border-zinc-800 p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-zinc-100">
                {editingId ? (isPersian ? 'ویرایش ماموریت' : 'Edit Quest') : (isPersian ? 'ماموریت جدید' : 'New Quest')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className={labelCls}>{isPersian ? 'عنوان' : 'Title'}</label>
                <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} className={inputCls} placeholder="Blood-Debt of the Frost Convoy" />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{isPersian ? 'خلاصه' : 'Summary'}</label>
                <textarea value={fSummary} onChange={(e) => setFSummary(e.target.value)} rows={2} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'دسته' : 'Category'}</label>
                <select value={fCategory} onChange={(e) => setFCategory(e.target.value as QuestCategory)} className={inputCls}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{isPersian ? CATEGORY_LABEL[c].fa : CATEGORY_LABEL[c].en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'دهنده ماموریت (NPC)' : 'Giver NPC'}</label>
                <select value={fGiverNpcId} onChange={(e) => setFGiverNpcId(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {npcs.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'مکان شروع' : 'Origin location'}</label>
                <select value={fOriginLocationId} onChange={(e) => setFOriginLocationId(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'آیتم محرک (triggerItemId)' : 'Trigger item ID'}</label>
                <select value={fTriggerItemId} onChange={(e) => setFTriggerItemId(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {gameItems.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'شناسه خط داستانی' : 'Quest line ID'}</label>
                <input value={fQuestLineId} onChange={(e) => setFQuestLineId(e.target.value)} className={inputCls} placeholder="ql_vesper_conspiracy" />
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'نام خط داستانی' : 'Quest line name'}</label>
                <input value={fQuestLineName} onChange={(e) => setFQuestLineName(e.target.value)} className={inputCls} placeholder="The Vesper Conspiracy" />
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'ترتیب در خط' : 'Order in line'}</label>
                <input value={fOrderInLine} onChange={(e) => setFOrderInLine(e.target.value)} type="number" min={1} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'ماموریت بعدی' : 'Next quest'}</label>
                <select value={fNextQuestId} onChange={(e) => setFNextQuestId(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {quests.filter((q) => q.id !== editingId).map((q) => (
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl border border-zinc-800 p-4">
              <div className="md:col-span-3 text-[11px] font-black text-zinc-300">{isPersian ? 'پیش‌نیازها' : 'Prerequisites'}</div>
              <div>
                <label className={labelCls}>{isPersian ? 'ماموریت‌های لازم (id, comma)' : 'Required completed IDs'}</label>
                <input value={fReqCompleted} onChange={(e) => setFReqCompleted(e.target.value)} className={inputCls} placeholder="quest_a, quest_b" />
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'حداقل اعتماد' : 'Required trust'}</label>
                <input value={fReqTrust} onChange={(e) => setFReqTrust(e.target.value)} type="number" className={inputCls} placeholder="20" />
              </div>
              <div>
                <label className={labelCls}>{isPersian ? 'آیتم‌های لازم' : 'Required item IDs'}</label>
                <input value={fReqItems} onChange={(e) => setFReqItems(e.target.value)} className={inputCls} placeholder="signet_ring" />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-300">{isPersian ? 'اهداف' : 'Objectives'}</span>
                <button onClick={() => setFObjectives((p) => [...p, { ...EMPTY_OBJECTIVE }])} className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> {isPersian ? 'افزودن هدف' : 'Add objective'}
                </button>
              </div>
              {fObjectives.map((o, idx) => (
                <div key={idx} className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={o.description} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))} className={inputCls} placeholder={isPersian ? 'شرح هدف…' : 'Objective description…'} />
                    <button onClick={() => setFObjectives((p) => p.filter((_, i) => i !== idx))} className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <select value={o.type} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, type: e.target.value as QuestObjectiveType } : x)))} className={inputCls}>
                      {OBJECTIVE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <select value={o.targetNpcId} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, targetNpcId: e.target.value } : x)))} className={inputCls}>
                      <option value="">NPC: —</option>
                      {npcs.map((n) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                    <select value={o.targetLocationId} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, targetLocationId: e.target.value } : x)))} className={inputCls}>
                      <option value="">Loc: —</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <select value={o.targetCreatureId} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, targetCreatureId: e.target.value } : x)))} className={inputCls}>
                      <option value="">Beast: —</option>
                      {bestiary.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input value={o.requiredItemId} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, requiredItemId: e.target.value } : x)))} className={inputCls} placeholder="requiredItemId" />
                    <input value={o.requiredItemName} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, requiredItemName: e.target.value } : x)))} className={inputCls} placeholder="Item name" />
                    <input value={o.requiredQuantity} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, requiredQuantity: e.target.value } : x)))} type="number" min={1} className={inputCls} placeholder="qty" />
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={o.consumeItemOnComplete} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, consumeItemOnComplete: e.target.checked } : x)))} />
                        {isPersian ? 'مصرف' : 'consume'}
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={o.isOptional} onChange={(e) => setFObjectives((p) => p.map((x, i) => (i === idx ? { ...x, isOptional: e.target.checked } : x)))} />
                        {isPersian ? 'اختیاری' : 'optional'}
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-300">{isPersian ? 'پاداش‌ها (اعتماد NPC)' : 'Rewards (NPC trust)'}</span>
                <button onClick={() => setFTrustRewards((p) => [...p, { npcId: '', trustDelta: '25' }])} className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> {isPersian ? 'پاداش اعتماد' : 'Trust reward'}
                </button>
              </div>
              {fTrustRewards.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select value={t.npcId} onChange={(e) => setFTrustRewards((p) => p.map((x, i) => (i === idx ? { ...x, npcId: e.target.value } : x)))} className={inputCls}>
                    <option value="">NPC…</option>
                    {npcs.map((n) => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                  <input value={t.trustDelta} onChange={(e) => setFTrustRewards((p) => p.map((x, i) => (i === idx ? { ...x, trustDelta: e.target.value } : x)))} type="number" className={inputCls} placeholder="+25" />
                  <button onClick={() => setFTrustRewards((p) => p.filter((_, i) => i !== idx))} className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isPersian ? 'رازهای آزادشونده (id, comma)' : 'Unlocked secret IDs'}</label>
                  <input value={fSecrets} onChange={(e) => setFSecrets(e.target.value)} className={inputCls} placeholder="secret_1, secret_2" />
                </div>
                <div>
                  <label className={labelCls}>{isPersian ? 'آیتم‌ها (نامxتعداد, comma)' : 'Item rewards (namexqty)'}</label>
                  <input value={fItemRewards} onChange={(e) => setFItemRewards(e.target.value)} className={inputCls} placeholder="Moon-Steel Bladex1" />
                </div>
                <div>
                  <label className={labelCls}>{isPersian ? 'طلا' : 'Gold'}</label>
                  <input value={fGold} onChange={(e) => setFGold(e.target.value)} type="number" min={0} className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>{isPersian ? 'نتیجه روایی' : 'Narrative resolution'}</label>
                  <input value={fResolution} onChange={(e) => setFResolution(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer">
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button onClick={handleSave} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black cursor-pointer">
                {isPersian ? 'ذخیره ماموریت' : 'Save Quest'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
