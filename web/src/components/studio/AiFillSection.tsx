'use client';

import { useMemo, useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

export type AiFillType =
  | 'world'
  | 'location'
  | 'npc'
  | 'artifact'
  | 'creature'
  | 'deity'
  | 'timeline_event'
  | 'world_law'
  | 'faction'
  | 'scene';

export type AiData = Record<string, unknown>;

interface AiFillSectionProps {
  type: AiFillType;
  onFilled: (data: AiData) => void;
  customSystemPrompt?: string;
}

const RARITY = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const SPECIES = ['beast', 'monstrosity', 'undead', 'elemental', 'flora', 'draconic'];
const DOMAIN = ['light', 'secrets', 'death', 'war', 'nature', 'chaos', 'forge'];
const LAW_CATEGORY = ['magic', 'physics', 'society', 'divine'];
const ERA = ['ancient', 'war', 'reign', 'cataclysm', 'present'];
const DANGER = [1, 2, 3, 4, 5];
const SCOPES = ['street', 'regional', 'continental', 'mythic'];

const SUBTYPE_FIELD: Partial<Record<AiFillType, string>> = {
  artifact: 'rarity',
  creature: 'speciesCategory',
  deity: 'domain',
  world_law: 'category',
  timeline_event: 'eraCategory',
  location: 'dangerLevel',
  npc: 'npcRole',
  faction: 'scope',
};

// Field name in the generated JSON (may differ from the request field, e.g. npc)
const DATA_FIELD: Partial<Record<AiFillType, string>> = {
  artifact: 'rarity',
  creature: 'speciesCategory',
  deity: 'domain',
  world_law: 'category',
  timeline_event: 'eraCategory',
  location: 'dangerLevel',
  npc: 'role',
  faction: 'scope',
};

export default function AiFillSection({ type, onFilled, customSystemPrompt }: AiFillSectionProps) {
  const { isPersian, story } = useStudioStory();
  const [description, setDescription] = useState('');
  const [subtype, setSubtype] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const worldContext = useMemo(() => buildWorldContextString(story), [story]);

  // Existing-lore anchors: the new item is tied to one of these so the model
  // derives its concept from real lore instead of defaulting to memory/forgetting.
  const anchorCandidates = useMemo(() => {
    const wb = story?.worldBible;
    const list: Array<{ key: string; kind: string; label: string; detail: string }> = [];
    (wb?.factions ?? []).forEach((f) =>
      list.push({
        key: `faction:${f.id}`,
        kind: 'faction',
        label: f.name,
        detail: `${f.alignment}${f.scope ? ` (${f.scope} scope)` : ''}. ${f.publicGoals}${f.secretAgendas ? ` | Hidden: ${f.secretAgendas}` : ''}`,
      })
    );
    (wb?.locations ?? []).forEach((l) =>
      list.push({
        key: `location:${l.id}`,
        kind: 'location',
        label: l.name,
        detail: `${l.region || 'unknown region'}, danger ${l.dangerLevel}. ${l.description}`,
      })
    );
    (wb?.religions ?? []).forEach((d) =>
      list.push({ key: `deity:${d.id}`, kind: 'deity', label: d.name, detail: `domain: ${d.domain}. ${d.coreDogma}` })
    );
    (wb?.timeline ?? []).forEach((t) =>
      list.push({ key: `era:${t.id}`, kind: 'era', label: t.title, detail: `${t.yearOrEra} — ${t.summary}` })
    );
    return list;
  }, [story]);

  const [anchorKey, setAnchorKey] = useState('');

  const subtypeField = SUBTYPE_FIELD[type];

  const npcRoles: Array<{ id: string; name: string }> = story?.worldBible?.ontology?.npcRoles ?? [];
  const subtypeConfig = (() => {
    if (!subtypeField) return null;
    if (type === 'npc') {
      if (!npcRoles.length) return null;
      return {
        label: isPersian ? 'نقش' : 'Role',
        options: npcRoles.map((r) => ({ value: r.name, label: r.name })),
      };
    }
    if (type === 'artifact')
      return { label: isPersian ? 'ندرت' : 'Rarity', options: RARITY.map((v) => ({ value: v, label: v })) };
    if (type === 'creature')
      return { label: isPersian ? 'گونه' : 'Species', options: SPECIES.map((v) => ({ value: v, label: v })) };
    if (type === 'deity') {
      const domains = story?.worldBible?.ontology?.domains ?? [];
      const opts = domains.length
        ? domains.map((d) => ({ value: d.id, label: d.name }))
        : DOMAIN.map((v) => ({ value: v, label: v }));
      return { label: isPersian ? 'قلمرو' : 'Domain', options: opts };
    }
    if (type === 'world_law')
      return { label: isPersian ? 'دسته' : 'Category', options: LAW_CATEGORY.map((v) => ({ value: v, label: v })) };
    if (type === 'timeline_event')
      return { label: isPersian ? 'دوران' : 'Era', options: ERA.map((v) => ({ value: v, label: v })) };
    if (type === 'location')
      return { label: isPersian ? 'سطح خطر' : 'Danger', options: DANGER.map((v) => ({ value: String(v), label: String(v) })) };
    if (type === 'faction')
      return {
        label: isPersian ? 'گستره روایی' : 'Narrative Scope',
        options: SCOPES.map((v) => ({
          value: v,
          label:
            v === 'street'
              ? isPersian
                ? 'خیابانی (Street)'
                : 'Street'
              : v === 'regional'
              ? isPersian
                ? 'منطقه‌ای (Regional)'
                : 'Regional'
              : v === 'continental'
              ? isPersian
                ? 'قاره‌ای (Continental)'
                : 'Continental'
              : isPersian
              ? 'اسطوره‌ای / کیهانی (Mythic)'
              : 'Mythic',
        })),
      };
    return null;
  })();

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        type,
        isPersian,
        themeContext: story?.worldBible?.themeNotes || '',
        worldContext,
        prompt: description,
      };
      if (customSystemPrompt) body.customSystemPrompt = customSystemPrompt;
      let anchor: string | undefined;
      if (anchorKey && anchorKey !== 'none') {
        const c = anchorCandidates.find((x) => x.key === anchorKey);
        if (c) anchor = `${c.kind.toUpperCase()}: ${c.label} — ${c.detail}`;
      } else if (!anchorKey && anchorCandidates.length) {
        const c = anchorCandidates[Math.floor(Math.random() * anchorCandidates.length)];
        anchor = `${c.kind.toUpperCase()}: ${c.label} — ${c.detail}`;
      }
      if (anchor) body.anchor = anchor;
      if (subtypeField && subtype) {
        body[subtypeField] = type === 'location' ? Number(subtype) : subtype;
      }
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success: boolean; error?: string; data?: AiData };
      if (!json.success) throw new Error(json.error || 'Generation failed');
      const data: AiData = json.data ?? {};
      const reqField = SUBTYPE_FIELD[type];
      const datField = DATA_FIELD[type];
      if (datField) {
        if (subtype) {
          // Explicit constraint: force the chosen value onto the result
          data[datField] = type === 'location' ? Number(subtype) : subtype;
        } else if (reqField) {
          // No explicit choice: don't clobber a manual selection with the AI's default
          delete data[datField];
        }
      }
      onFilled(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : isPersian ? 'خطا در تولید' : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-3 space-y-3">
      <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
        <span>✦</span>
        <span>{isPersian ? 'دستیار هوش مصنوعی' : 'AI Assist'}</span>
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">
          {isPersian ? 'توصیف آنچه می‌خواهید بسازید' : 'Describe what you want generated'}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={isPersian ? 'مثال: یک خنجر سیاه‌نقره‌ای که در تاریکی زمزمه می‌کند' : 'e.g. a silver-black dagger that whispers in the dark'}
          className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
        />
      </div>
      {subtypeConfig && (
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{subtypeConfig.label}</label>
          <select
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="">{isPersian ? 'انتخاب نشده' : '—'}</option>
            {subtypeConfig.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {anchorCandidates.length > 0 && (
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            {isPersian ? 'اتصال به لور موجود (جلوگیری از تکرار تم):' : 'Anchor to existing lore (prevents theme drift):'}
          </label>
          <select
            value={anchorKey}
            onChange={(e) => setAnchorKey(e.target.value)}
            className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="">{isPersian ? 'خودکار (یک مورد تصادفی)' : 'Auto (random existing lore)'}</option>
            <option value="none">{isPersian ? 'بدون اتصال (مستقل / رویداد نوظهور)' : 'No connection (standalone / new event)'}</option>
            {anchorCandidates.map((c) => (
              <option key={c.key} value={c.key}>
                {c.kind}: {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-900 text-sm font-semibold px-3 py-1.5"
        >
          {loading
            ? isPersian
              ? 'در حال ساخت…'
              : 'Generating…'
            : isPersian
              ? 'پر کردن فرم با هوش مصنوعی'
              : 'Fill form with AI'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      <p className="text-[11px] text-zinc-500">
        {isPersian
          ? 'هوش مصنوعی فقط فیلدهای خالی را پر می‌کند؛ مواردی که خودتان نوشته‌اید حفظ می‌شوند.'
          : 'AI fills only empty fields; anything you already typed is preserved.'}
      </p>
    </div>
  );
}
