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
  findExistingEntityByName,
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
  place_category: { en: 'Place Category', fa: 'دسته‌بندی مکان' },
  law_category: { en: 'Law Category', fa: 'دسته‌بندی قانون' },
  npc_role: { en: 'NPC Role', fa: 'نقش شخصیت' },
  domain: { en: 'Domain', fa: 'حوزه کیهانی' },
  relation_type: { en: 'Relation Type', fa: 'نوع پیوند' },
  quest: { en: 'Quest', fa: 'ماموریت' },
  trade_route: { en: 'Trade Route', fa: 'مسیر تجاری' },
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
    const isOntologyType = [
      'place_category',
      'law_category',
      'npc_role',
      'domain',
      'relation_type',
    ].includes(entity);

    try {
      if (a.op === 'create') {
        const candidateName = a.data?.name || (a.data as any)?.title || (a.data as any)?.rule;

        // De-duplication Guard 1: Skip create if entity already exists in World Bible
        if (candidateName && worldBible) {
          const existing = findExistingEntityByName(worldBible, entity, candidateName);
          if (existing) {
            console.warn(
              `[prepareWorldChanges] Skipping duplicate create for already-existing ${entity}: "${nameOf(entity, existing)}"`
            );
            continue;
          }
        }

        // De-duplication Guard 2: Skip create if already in ready queue for this batch
        if (
          candidateName &&
          ready.some(
            (r) =>
              r.entity === entity &&
              r.op === 'create' &&
              nameMatch(nameOf(entity, r.newData), candidateName)
          )
        ) {
          console.warn(
            `[prepareWorldChanges] Skipping duplicate create in same batch for ${entity}: "${candidateName}"`
          );
          continue;
        }

        let data: any;
        if (a.data && typeof a.data === 'object' && Object.keys(a.data).length > 0) {
          // Direct Easy Insert: bypass AI generation and preserve author's exact data
          data = normalizeEntity(entity, { ...a.data });

          // Automatically resolve parent location reference if provided by name
          if (entity === 'location' && !data.parentLocationId && worldBible?.locations) {
            const pName = data.parentLocationName || data.parentLocation || data.parent;
            if (typeof pName === 'string' && pName.trim()) {
              const matchedParent = worldBible.locations.find((l) => nameMatch(l.name, pName));
              if (matchedParent) {
                data.parentLocationId = matchedParent.id;
              }
            }
          }

          // Plan 10: resolve trade-route endpoint / faction / commodity refs by name.
          if (entity === 'trade_route' && worldBible) {
            const locs = worldBible.locations ?? [];
            const byLocName = (v: unknown) => {
              if (typeof v !== 'string' || !v.trim()) return undefined;
              if (locs.some((l) => l.id === v)) return v;
              return locs.find((l) => nameMatch(l.name, v))?.id;
            };
            const originRef = data.originLocationName || data.origin || data.from;
            const destRef = data.destinationLocationName || data.destination || data.to;
            const resolvedOrigin = byLocName(data.originLocationId) ?? byLocName(originRef);
            const resolvedDest = byLocName(data.destinationLocationId) ?? byLocName(destRef);
            if (resolvedOrigin) data.originLocationId = resolvedOrigin;
            if (resolvedDest) data.destinationLocationId = resolvedDest;
            if (Array.isArray(data.intermediateLocationIds)) {
              data.intermediateLocationIds = data.intermediateLocationIds
                .map((w: unknown) => byLocName(w) ?? w)
                .filter((w: unknown) => typeof w === 'string' && (w as string).trim());
            }
            const factions = worldBible.factions ?? [];
            const byFactionName = (v: unknown) => {
              if (typeof v !== 'string' || !v.trim()) return undefined;
              if (factions.some((f) => f.id === v)) return v;
              return factions.find((f) => nameMatch(f.name, v))?.id;
            };
            for (const k of ['controllingFactionId', 'patrollingFactionId', 'rivalRaidingFactionId'] as const) {
              const resolved = byFactionName(data[k]);
              if (resolved) data[k] = resolved;
            }
            if (Array.isArray(data.commodities)) {
              const bestiary = worldBible.bestiary ?? [];
              const artifacts = worldBible.artifacts ?? [];
              data.commodities = data.commodities.map((c: any, i: number) => {
                if (typeof c === 'string') return { entityId: `good_${Date.now()}_${i}`, name: c, flowDirection: 'forward' };
                const ref = c.entityName || c.name;
                const hit =
                  bestiary.find((b) => b.id === c.entityId || nameMatch(b.name, String(ref ?? ''))) ||
                  artifacts.find((a) => a.id === c.entityId || nameMatch(a.name, String(ref ?? '')));
                if (hit) return { ...c, entityId: hit.id, name: c.name || hit.name };
                return c;
              });
            }
          }
        } else if (isOntologyType) {
          const rawPrompt = (a.prompt || userText).trim();
          const cleanName = rawPrompt.replace(/^(create|add|new|ایجاد|بساز|افزودن)\s+/i, '').trim();
          data = normalizeEntity(entity, {
            name: cleanName || (isPersian ? 'دسته جدید' : 'New Category'),
            description: rawPrompt,
          });
        } else {
          const json = await callGenerate({
            type: entity,
            prompt: a.prompt || userText,
            worldContext,
            isPersian,
            anchor: a.anchor,
            themeContext,
          });
          if (!json.success || !json.data) throw new Error(json.error || t.failed);
          data = normalizeEntity(entity, json.data);

          // De-duplication Guard 3: Check AI-generated name against existing entities
          const genName = nameOf(entity, data);
          if (genName && worldBible) {
            const existing = findExistingEntityByName(worldBible, entity, genName);
            if (existing) {
              console.warn(
                `[prepareWorldChanges] Skipping duplicate create for AI-generated ${entity}: "${genName}"`
              );
              continue;
            }
          }
        }
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
          let data: any;
          if (a.data && typeof a.data === 'object' && Object.keys(a.data).length > 0) {
            // Direct update: merge provided fields directly onto the target entity
            const merged = { ...target, ...a.data, id: target.id };
            data = normalizeEntity(entity, merged);
            if (entity === 'location' && !data.parentLocationId && worldBible?.locations) {
              const pName = a.data.parentLocationName || a.data.parentLocation || a.data.parent;
              if (typeof pName === 'string' && pName.trim()) {
                const matchedParent = worldBible.locations.find((l) => nameMatch(l.name, pName));
                if (matchedParent) {
                  data.parentLocationId = matchedParent.id;
                }
              }
            }
          } else if (isOntologyType) {
            const cleanDesc = (a.prompt || userText || '').trim();
            const merged = { ...target, description: cleanDesc || target.description, id: target.id };
            data = normalizeEntity(entity, merged);
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
            data = normalizeEntity(entity, merged);
          }
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
