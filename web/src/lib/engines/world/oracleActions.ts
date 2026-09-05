/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WorldBible } from '@/lib/types/world';
import {
  ActionBlock,
  ALLOWED_ENTITIES,
  EntityType,
  getEntityArray,
  nameMatch,
  nameOf,
  normalizeEntity,
  resolveEntityTarget,
} from './ActionProtocol';

export interface WorldActionChange {
  op: 'create' | 'update' | 'delete';
  entity: EntityType;
  label: string;
  newData?: any;
  oldData?: any;
  targetId?: string;
}

export interface WorldActionFailure {
  op: string;
  entity: string;
  label: string;
  error: string;
}

export interface EntityMutators {
  add: (e: any) => void;
  edit: (id: string, u: any) => void;
  del: (id: string) => void;
}

export const ORACLE_ENTITY_LABELS: Record<EntityType, { en: string; fa: string }> = {
  faction: { en: 'Faction', fa: 'جناح' },
  location: { en: 'Location', fa: 'مکان' },
  npc: { en: 'Character', fa: 'شخصیت' },
  artifact: { en: 'Artifact', fa: 'عتیقه' },
  creature: { en: 'Creature', fa: 'موجود' },
  deity: { en: 'Deity', fa: 'ایزد' },
  timeline_event: { en: 'Event', fa: 'رویداد' },
  world_law: { en: 'World Law', fa: 'قانون جهان' },
};

async function callGenerate(payload: any): Promise<any> {
  const res = await fetch('/api/studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/**
 * Shared Oracle action pipeline: turns parsed storyforge-action blocks into
 * reviewable world changes (generate-backed for create/update, target-resolved
 * for update/delete). Used by both /studio/chat and the Studio Oracle drawer.
 */
export async function prepareWorldChanges(opts: {
  actions: ActionBlock[];
  worldBible?: WorldBible;
  worldContext: string;
  userText?: string;
  isPersian?: boolean;
  themeContext?: string;
}): Promise<{ ready: WorldActionChange[]; failed: WorldActionFailure[] }> {
  const { actions, worldBible, worldContext, userText = '', isPersian = false } = opts;
  const themeContext = opts.themeContext || worldBible?.themeNotes || '';
  const t = {
    notFound: isPersian ? 'موجودیت یافت نشد' : 'Entity not found',
    failed: isPersian ? 'تولید محتوای هوش مصنوعی ناموفق بود' : 'AI generation failed',
  };

  const ready: WorldActionChange[] = [];
  const failed: WorldActionFailure[] = [];

  for (const a of actions) {
    let entity = a.entity;

    // Infer the entity type from the target name when the model omitted/mangled it.
    if (!ALLOWED_ENTITIES.includes(entity) && a.match?.byName) {
      for (const tt of ALLOWED_ENTITIES) {
        if (getEntityArray(worldBible, tt).some((it) => nameMatch(nameOf(tt, it), a.match!.byName))) {
          entity = tt;
          break;
        }
      }
    }

    const entityLabel = ORACLE_ENTITY_LABELS[entity]?.[isPersian ? 'fa' : 'en'] ?? entity;

    if (!ALLOWED_ENTITIES.includes(entity)) {
      failed.push({
        op: a.op,
        entity: String(a.entity),
        label: a.match?.byName || a.prompt || entity,
        error: t.notFound,
      });
      continue;
    }

    const labelOf = (item: any) => `${entityLabel}: ${nameOf(entity, item)}`;

    try {
      if (a.op === 'create') {
        const json = await callGenerate({
          type: entity,
          prompt: a.prompt || userText,
          worldContext,
          isPersian,
          anchor: a.anchor,
          themeContext,
        });
        if (!json.success || !json.data) throw new Error(json.error || t.failed);
        const data = normalizeEntity(entity, json.data);
        ready.push({ op: 'create', entity, label: labelOf(data), newData: data });
      } else {
        const target = resolveEntityTarget(worldBible, entity, a.match!.byName);
        if (!target) throw new Error(t.notFound);

        if (a.op === 'delete') {
          ready.push({
            op: 'delete',
            entity,
            label: `${entityLabel}: ${nameOf(entity, target)}`,
            oldData: target,
            targetId: target.id,
          });
        } else {
          const changeBrief = a.prompt?.trim() ? a.prompt.trim() : userText || 'Update entity based on user prompt';
          let targetForPrompt = target;
          if (entity === 'faction' && worldBible) {
            const existingRelations = (worldBible.factionRelations || [])
              .filter((r) => r.sourceFactionId === target.id || r.targetFactionId === target.id)
              .map((r) => {
                const otherId = r.sourceFactionId === target.id ? r.targetFactionId : r.sourceFactionId;
                const otherFac = (worldBible.factions || []).find((f) => f.id === otherId);
                return {
                  targetFactionId: otherId,
                  targetFactionName: otherFac?.name || otherId,
                  value: r.value,
                  note: r.note || '',
                  isPublic: r.isPublic ?? true,
                };
              });
            const otherFactions = (worldBible.factions || [])
              .filter((f) => f.id !== target.id)
              .map((f) => ({ id: f.id, name: f.name, alignment: f.alignment }));
            targetForPrompt = {
              ...target,
              relations: existingRelations,
              availableOtherFactions: otherFactions,
            };
          }
          const editPrompt = `Current entity JSON:\n${JSON.stringify(targetForPrompt, null, 2)}\n\nRequested changes to apply:\n${changeBrief}\n\nReturn the COMPLETE updated entity as a JSON object with ALL original fields preserved and only the requested changes applied. Output valid JSON only matching the entity schema.`;
          const editSystem = isPersian
            ? 'تو در حال ویرایش یک موجودیت موجود هستی. خروجی را به صورت شیء JSON کامل شامل تمام فیلدهای پیشین (با اعمال تغییرات) برگردان. نام و شناسه را حفظ کن. فقط JSON معتبر خروجی بده.\n\n'
            : 'You are editing an EXISTING world entity. Return the COMPLETE updated entity as a JSON object with ALL original fields preserved and only the requested changes applied. Preserve name and id. Output valid JSON only.\n\n';
          const json = await callGenerate({
            type: entity,
            prompt: changeBrief,
            worldContext,
            isPersian,
            themeContext,
            customSystemPrompt: editSystem + editPrompt,
          });
          if (!json.success || !json.data) throw new Error(json.error || t.failed);
          const merged = { ...target, ...json.data, id: target.id };
          const data = normalizeEntity(entity, merged);
          ready.push({
            op: 'update',
            entity,
            label: labelOf(data),
            oldData: target,
            newData: data,
            targetId: target.id,
          });
        }
      }
    } catch (e: any) {
      failed.push({
        op: a.op,
        entity,
        label: a.match?.byName || a.prompt || entityLabel,
        error: e?.message || t.failed,
      });
    }
  }

  return { ready, failed };
}

/** Commits a reviewed change to the world through the Studio Story mutators. */
export function applyWorldChange(change: WorldActionChange, mutators: Record<EntityType, EntityMutators>): void {
  const cfg = mutators[change.entity];
  if (!cfg) throw new Error(`No mutators registered for "${change.entity}"`);
  if (change.op === 'create') {
    cfg.add(change.newData);
  } else if (change.op === 'delete') {
    cfg.del(change.targetId!);
  } else {
    cfg.edit(change.targetId!, change.newData);
  }
}

/** Human-readable summary of which fields an update/create touches. */
export function summarizeChangeFields(change: WorldActionChange): string {
  if (change.op === 'update' && change.oldData && change.newData) {
    return Object.keys(change.newData)
      .filter((k) => k !== 'id' && JSON.stringify(change.oldData[k]) !== JSON.stringify(change.newData[k]))
      .slice(0, 8)
      .join(', ');
  }
  if (change.op === 'create' && change.newData) {
    return Object.keys(change.newData)
      .filter((k) => k !== 'id')
      .slice(0, 8)
      .join(', ');
  }
  return '';
}
