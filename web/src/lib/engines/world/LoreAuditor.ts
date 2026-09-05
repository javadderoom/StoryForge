import { WorldBible, SagaManifest } from '@/lib/types/world';
import { ContradictionAuditReport, ContradictionFinding } from './GenesisSchemas';

/**
 * Deterministic, AI-free lore consistency auditor ("Contradiction Radar").
 *
 * The AI auditor (route `audit_world`) is richer for narrative paradoxes, but
 * these rule-based checks are guaranteed to fire for objective violations and
 * run instantly without an API key. They are also unioned into the AI report
 * so nothing slips through.
 */
export class LoreAuditor {
  public static audit(world: WorldBible): ContradictionAuditReport {
    const findings: ContradictionFinding[] = [];

    this.checkDanglingLinks(world, findings);
    this.checkMagicBanViolations(world, findings);
    this.checkFactionRivalryAsymmetry(world, findings);
    this.checkOrphanedEntities(world, findings);
    this.checkEmptyFields(world, findings);
    // Plan 08 Auditor v2
    this.checkArtifactHolderRefs(world, findings);
    this.checkReligionRefs(world, findings);
    this.checkBestiaryHabitats(world, findings);
    this.checkDramaBondEndpoints(world, findings);
    this.checkDuplicateNames(world, findings);
    this.checkDuplicateIds(world, findings);
    this.checkLawConflicts(world, findings);
    this.checkTimelineOrder(world, findings);
    this.checkFactionRelationSpectrum(world, findings);

    const score = LoreAuditor.computeScore(world, findings);
    return {
      score,
      summary:
        findings.length === 0
          ? 'No deterministic consistency issues detected. The World Bible is internally coherent.'
          : `Detected ${findings.length} issue(s): ${findings.filter((f) => f.severity === 'error').length} error(s), ${findings.filter((f) => f.severity === 'warning').length} warning(s), ${findings.filter((f) => f.severity === 'suggestion').length} suggestion(s).`,
      findings,
    };
  }

  /**
   * Plan 08: deterministic audit of a committed saga campaign graph — dangling
   * choice edges, duplicate scene ids, empty chapters, and scope escalation.
   */
  public static auditSaga(saga: SagaManifest): ContradictionAuditReport {
    const findings: ContradictionFinding[] = [];
    const chapters = saga.chapters || [];

    const sceneOwner = new Map<string, string>(); // sceneId → chapterId
    for (const ch of chapters) {
      for (const sc of ch.scenes || []) {
        if (sceneOwner.has(sc.sceneId)) {
          findings.push(this.finding('warning', 'missing_link', 'Duplicate scene id', `Scene id "${sc.sceneId}" exists in more than one chapter ("${sceneOwner.get(sc.sceneId)}" and "${ch.id}"). Branching edges and tree layout will collide.`, [{ entityType: 'story_chapter', name: ch.title }], 'Rename one of the duplicated scene ids.'));
        } else {
          sceneOwner.set(sc.sceneId, ch.id);
        }
      }
    }

    for (const ch of chapters) {
      if ((ch.scenes || []).length === 0) {
        findings.push(this.finding('warning', 'missing_link', 'Empty chapter', `Chapter "${ch.title}" (#${ch.chapterNumber}) has no scenes.`, [{ entityType: 'story_chapter', name: ch.title }], 'Add scenes or remove the chapter.'));
      }
      for (const sc of ch.scenes || []) {
        for (const choice of sc.choices || []) {
          if (choice.targetSceneId && !sceneOwner.has(choice.targetSceneId)) {
            findings.push(this.finding('warning', 'missing_link', 'Dangling branch edge', `Choice "${choice.text}" in "${sc.sceneId}" targets missing scene id "${choice.targetSceneId}".`, [{ entityType: 'story_beat', name: sc.sceneId }], `Point the choice at an existing scene or clear its destination.`));
          }
        }
      }
    }

    // Scope tiers must escalate (street < regional < continental < mythic)
    const tierRank: Record<string, number> = { street: 0, regional: 1, continental: 2, mythic: 3 };
    let lastRank = -1;
    for (const ch of [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)) {
      const rank = tierRank[ch.scopeTier] ?? 0;
      if (rank < lastRank) {
        findings.push(this.finding('suggestion', 'timeline_paradox', 'Scope tier regression', `Chapter "${ch.title}" (${ch.scopeTier}) lowers the escalation after a higher-scope chapter. Early sagas must stay grounded before expanding.`, [{ entityType: 'story_chapter', name: ch.title }], 'Re-order scope tiers so stakes escalate monotonically.'));
      }
      lastRank = Math.max(lastRank, rank);
    }

    const score = Math.max(0, Math.min(100, 100 - findings.length * 8));
    return {
      score,
      summary:
        findings.length === 0
          ? 'Saga graph is coherent.'
          : `Saga audit detected ${findings.length} issue(s).`,
      findings,
    };
  }

  private static finding(
    severity: ContradictionFinding['severity'],
    category: ContradictionFinding['category'],
    title: string,
    description: string,
    involved: { entityType: string; name: string }[],
    suggestedFix: string
  ): ContradictionFinding {
    return { id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, severity, category, title, description, involvedEntities: involved, suggestedFix };
  }

  // References to ids that do not exist in the world → missing_link
  private static checkDanglingLinks(world: WorldBible, findings: ContradictionFinding[]): void {
    const locationIds = new Set(world.locations.map((l) => l.id));
    const factionIds = new Set(world.factions.map((f) => f.id));

    const push = (
      severity: ContradictionFinding['severity'],
      title: string,
      description: string,
      category: ContradictionFinding['category'],
      involved: { entityType: string; name: string }[],
      suggestedFix: string
    ) => {
      findings.push({
        id: `missing_${findings.length}_${Date.now().toString(36)}`,
        severity,
        category,
        title,
        description,
        involvedEntities: involved,
        suggestedFix,
      });
    };

    for (const loc of world.locations) {
      for (const ref of loc.connectedLocationIds || []) {
        if (!locationIds.has(ref)) {
          push(
            'warning',
            'Dangling location connection',
            `Location "${loc.name}" connects to non-existent location id "${ref}".`,
            'missing_link',
            [{ entityType: 'location', name: loc.name }],
            `Remove the broken connection or create the missing location "${ref}".`
          );
        }
      }
    }

    for (const fac of world.factions) {
      const refs = [
        ...(fac.territoryIds || []),
        ...(fac.rivalFactionIds || []),
        ...(fac.alliedFactionIds || []),
      ];
      for (const ref of refs) {
        const broken = !factionIds.has(ref) && !locationIds.has(ref);
        if (broken) {
          push(
            'warning',
            'Dangling faction reference',
            `Faction "${fac.name}" references missing entity id "${ref}".`,
            'missing_link',
            [{ entityType: 'faction', name: fac.name }],
            `Remove the dangling reference or create the missing entity "${ref}".`
          );
        }
      }
    }

    for (const rel of world.factionRelations || []) {
      for (const [label, id] of [['source', rel.sourceFactionId], ['target', rel.targetFactionId]] as const) {
        if (!factionIds.has(id)) {
          push(
            'warning',
            'Faction relation references missing faction',
            `Faction relation "${rel.id}" ${label} "${id}" does not exist.`,
            'missing_link',
            [{ entityType: 'faction', name: id }],
            `Create the faction "${id}" or delete/fix the relation.`
          );
        }
      }
      if (rel.sourceFactionId === rel.targetFactionId) {
        push(
          'warning',
          'Self-referential faction relation',
          `Faction relation "${rel.id}" links a faction to itself.`,
          'missing_link',
          [{ entityType: 'faction', name: rel.sourceFactionId }],
          'Delete the self-relation.'
        );
      }
    }

    for (const npc of world.npcs) {
      if (npc.factionId && !factionIds.has(npc.factionId)) {
        push(
          'warning',
          'NPC aligned to missing faction',
          `NPC "${npc.name}" belongs to a faction id "${npc.factionId}" that does not exist.`,
          'missing_link',
          [{ entityType: 'npc', name: npc.name }],
          `Create the faction "${npc.factionId}" or update the NPC's factionId.`
        );
      }
      if (npc.currentLocationId && !locationIds.has(npc.currentLocationId)) {
        push(
          'warning',
          'NPC stationed at missing location',
          `NPC "${npc.name}" is stationed at location id "${npc.currentLocationId}" that does not exist.`,
          'missing_link',
          [{ entityType: 'npc', name: npc.name }],
          `Create the location or update the NPC's currentLocationId.`
        );
      }
    }

    for (const art of world.artifacts || []) {
      if (art.currentHolderType === 'location' && art.currentHolderId && !locationIds.has(art.currentHolderId)) {
        push(
          'suggestion',
          'Artifact holder not found',
          `Artifact "${art.name}" is held by a location id "${art.currentHolderId}" that does not exist.`,
          'missing_link',
          [{ entityType: 'artifact', name: art.name }],
          `Create the holding location or update currentHolderId.`
        );
      }
    }

    for (const t of world.timeline) {
      for (const ref of [...(t.linkedFactionIds || []), ...(t.linkedLocationIds || [])]) {
        const ok = factionIds.has(ref) || locationIds.has(ref);
        if (!ok) {
          push(
            'warning',
            'Timeline event linked to missing entity',
            `Timeline event "${t.title}" references missing entity id "${ref}".`,
            'missing_link',
            [{ entityType: 'timeline_event', name: t.title }],
            `Create the referenced entity or remove the link.`
          );
        }
      }
    }
  }

  // Immutable magic-ban law vs artifact that grants open magical power
  private static checkMagicBanViolations(
    world: WorldBible,
    findings: ContradictionFinding[]
  ): void {
    const banLaw = world.laws.find(
      (l) =>
        l.category === 'magic' &&
        l.isImmutable &&
        /(ban|forbid|prohibit|illegal|outlaw|ممنوع|غیرقانونی|قدغن|جرم)/i.test(l.rule + ' ' + (l.description || ''))
    );
    if (!banLaw) return;


    for (const art of world.artifacts || []) {
      const text = (art.powers || []).join(' ') + ' ' + (art.description || '');
      if (/(cast|summon|grant.*magic|infuse.*arcane|channel.*power|spell)/i.test(text)) {
        findings.push({
          id: `magic_violation_${art.id}`,
          severity: 'error',
          category: 'magic_violation',
          title: 'Artifact violates immutable magic law',
          description: `Artifact "${art.name}" grants magical power, but immutable law "${banLaw.rule}" forbids or bans such magic.`,
          involvedEntities: [
            { entityType: 'artifact', name: art.name },
            { entityType: 'world_law', name: banLaw.rule },
          ],
          suggestedFix: `Either restrict the artifact's powers to comply with "${banLaw.rule}", or relax the law to permit this specific relic.`,
        });
      }
    }
  }



  // Faction A lists B as rival but B does not list A → asymmetry suggestion
  private static checkFactionRivalryAsymmetry(world: WorldBible, findings: ContradictionFinding[]): void {
    const byId = new Map(world.factions.map((f) => [f.id, f]));
    for (const fac of world.factions) {
      for (const rivalId of fac.rivalFactionIds || []) {
        const rival = byId.get(rivalId);
        if (rival && !(rival.rivalFactionIds || []).includes(fac.id)) {
          findings.push({
            id: `faction_rivalry_${fac.id}_${rivalId}`,
            severity: 'suggestion',
            category: 'faction_rivalry',
            title: 'One-sided rivalry',
            description: `Faction "${fac.name}" lists "${rival.name}" as a rival, but "${rival.name}" does not reciprocate.`,
            involvedEntities: [
              { entityType: 'faction', name: fac.name },
              { entityType: 'faction', name: rival.name },
            ],
            suggestedFix: `Add "${fac.name}" to "${rival.name}"'s rivalFactionIds for symmetry, or remove the one-sided grudge.`,
          });
        }
      }
    }
  }

  /**
   * 5-state spectrum audit: reverse-entry symmetry, allied↔hostile
   * contradictions, duplicate pairs, and legacy-array conflicts.
   */
  private static checkFactionRelationSpectrum(world: WorldBible, findings: ContradictionFinding[]): void {
    const byId = new Map(world.factions.map((f) => [f.id, f]));
    const rels = world.factionRelations || [];
    const pairKey = (a: string, b: string) => [a, b].sort().join('↔');
    const seenPairs = new Map<string, (typeof rels)[number][]>();
    for (const r of rels) {
      const k = pairKey(r.sourceFactionId, r.targetFactionId);
      seenPairs.set(k, [...(seenPairs.get(k) || []), r]);
    }

    for (const [key, group] of seenPairs) {
      const [x, y] = key.split('↔');
      const xn = byId.get(x)?.name || x;
      const yn = byId.get(y)?.name || y;
      if (group.length > 2 || (group.length === 2 && group[0].value !== group[1].value)) {
        const values = group.map((g) => g.value).join(' vs ');
        const clash =
          group.some((g) => g.value === 'allied') && group.some((g) => g.value === 'hostile');
        findings.push({
          id: `faction_spectrum_clash_${key.replace(/[^a-z0-9]+/gi, '_')}`,
          severity: clash ? 'error' : 'warning',
          category: 'faction_rivalry',
          title: clash ? 'Allied↔hostile contradiction' : 'Asymmetric faction relation',
          description:
            clash
              ? `Factions "${xn}" and "${yn}" are simultaneously allied and blood enemies (${values}). A pact and open war cannot coexist.`
              : `Factions "${xn}" and "${yn}" disagree on their relation (${values}). Align both directions to one spectrum value.`,
          involvedEntities: [
            { entityType: 'faction', name: xn },
            { entityType: 'faction', name: yn },
          ],
          suggestedFix: clash
            ? 'Keep either the alliance or the blood enmity and delete the other entry.'
            : 'Set both directions to the same spectrum value (allied/favorable/neutral/rival/hostile).',
        });
      }
      if (group.length === 1) {
        findings.push({
          id: `faction_spectrum_onesided_${group[0].id}`,
          severity: 'suggestion',
          category: 'faction_rivalry',
          title: 'One-sided spectrum entry',
          description: `Relation "${xn} → ${yn}" (${group[0].value}) has no reverse entry. Undirected pairs read cleaner with both directions recorded.`,
          involvedEntities: [
            { entityType: 'faction', name: xn },
            { entityType: 'faction', name: yn },
          ],
          suggestedFix: `Add the reverse "${yn} → ${xn}" entry with the same value, or confirm one-sidedness is intentional.`,
        });
      }
    }

    // Legacy arrays vs explicit spectrum conflicts.
    for (const fac of world.factions) {
      for (const allyId of fac.alliedFactionIds || []) {
        const rel = rels.find(
          (r) =>
            (r.sourceFactionId === fac.id && r.targetFactionId === allyId) ||
            (r.sourceFactionId === allyId && r.targetFactionId === fac.id)
        );
        if (rel && (rel.value === 'rival' || rel.value === 'hostile')) {
          findings.push({
            id: `faction_legacy_clash_${fac.id}_${allyId}`,
            severity: 'warning',
            category: 'faction_rivalry',
            title: 'Legacy ally vs spectrum enemy',
            description: `Faction "${fac.name}" lists "${byId.get(allyId)?.name || allyId}" as legacy ally but the spectrum says ${rel.value}.`,
            involvedEntities: [
              { entityType: 'faction', name: fac.name },
              { entityType: 'faction', name: byId.get(allyId)?.name || allyId },
            ],
            suggestedFix: 'Remove the legacy ally link or change the spectrum value to allied/favorable.',
          });
        }
      }
      for (const rivalId of fac.rivalFactionIds || []) {
        const rel = rels.find(
          (r) =>
            (r.sourceFactionId === fac.id && r.targetFactionId === rivalId) ||
            (r.sourceFactionId === rivalId && r.targetFactionId === fac.id)
        );
        if (rel && (rel.value === 'allied' || rel.value === 'favorable')) {
          findings.push({
            id: `faction_legacy_clash_${fac.id}_${rivalId}`,
            severity: 'warning',
            category: 'faction_rivalry',
            title: 'Legacy rival vs spectrum friend',
            description: `Faction "${fac.name}" lists "${byId.get(rivalId)?.name || rivalId}" as legacy rival but the spectrum says ${rel.value}.`,
            involvedEntities: [
              { entityType: 'faction', name: fac.name },
              { entityType: 'faction', name: byId.get(rivalId)?.name || rivalId },
            ],
            suggestedFix: 'Remove the legacy rival link or change the spectrum value to rival/hostile.',
          });
        }
      }
    }
  }

  // Orphaned entities that have no inbound or outbound relationships
  private static checkOrphanedEntities(world: WorldBible, findings: ContradictionFinding[]): void {
    if (world.factions.length === 0) return;

    const factionTerritories = new Set<string>();
    // Faction ids that are referenced BY something else (NPC membership, timeline links).
    const referencedFactionIds = new Set<string>();
    for (const fac of world.factions) {
      (fac.territoryIds || []).forEach((t) => factionTerritories.add(t));
    }
    for (const npc of world.npcs) {
      if (npc.factionId) referencedFactionIds.add(npc.factionId);
    }
    for (const t of world.timeline) {
      (t.linkedFactionIds || []).forEach((id) => referencedFactionIds.add(id));
    }
    const spectrumIds = new Set<string>();
    for (const r of world.factionRelations || []) {
      spectrumIds.add(r.sourceFactionId);
      spectrumIds.add(r.targetFactionId);
    }

    for (const fac of world.factions) {
      const referenced =
        (fac.territoryIds || []).length > 0 ||
        (fac.rivalFactionIds || []).length > 0 ||
        (fac.alliedFactionIds || []).length > 0 ||
        spectrumIds.has(fac.id) ||
        referencedFactionIds.has(fac.id);
      if (!referenced) {
        findings.push({
          id: `orphan_fac_${fac.id}`,
          severity: 'suggestion',
          category: 'missing_link',
          title: 'Orphaned faction',
          description: `Faction "${fac.name}" has no territories, rivals, allies, or member NPCs. It is disconnected from the world graph.`,
          involvedEntities: [{ entityType: 'faction', name: fac.name }],
          suggestedFix: `Assign at least one territory, rival, ally, or member NPC to "${fac.name}".`,
        });
      }
    }

    for (const loc of world.locations) {
      const connected = (loc.connectedLocationIds || []).length > 0 || factionTerritories.has(loc.id);
      if (!connected) {
        findings.push({
          id: `orphan_loc_${loc.id}`,
          severity: 'suggestion',
          category: 'missing_link',
          title: 'Isolated location',
          description: `Location "${loc.name}" has no connections and is not controlled by any faction.`,
          involvedEntities: [{ entityType: 'location', name: loc.name }],
          suggestedFix: `Connect "${loc.name}" to at least one other location or assign it as a faction territory.`,
        });
      }
    }
  }

  private static checkEmptyFields(world: WorldBible, findings: ContradictionFinding[]): void {
    for (const law of world.laws) {
      if (!law.description || law.description.trim().length < 5) {
        findings.push({
          id: `empty_law_${law.id}`,
          severity: 'suggestion',
          category: 'missing_link',
          title: 'Thin law description',
          description: `World law "${law.rule}" has a missing or very brief description, weakening guardrail clarity.`,
          involvedEntities: [{ entityType: 'world_law', name: law.rule }],
          suggestedFix: `Expand the law's description with concrete constraints and in-world examples.`,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // Plan 08 Auditor v2 — cross-vault reference integrity
  // ------------------------------------------------------------------

  private static checkArtifactHolderRefs(world: WorldBible, findings: ContradictionFinding[]): void {
    const locationIds = new Set(world.locations.map((l) => l.id));
    const factionIds = new Set(world.factions.map((f) => f.id));
    const npcIds = new Set(world.npcs.map((n) => n.id));

    for (const art of world.artifacts || []) {
      let missing: string | null = null;
      if (art.currentHolderType === 'npc' && art.currentHolderId && !npcIds.has(art.currentHolderId)) {
        missing = 'NPC';
      } else if (art.currentHolderType === 'faction' && art.currentHolderId && !factionIds.has(art.currentHolderId)) {
        missing = 'faction';
      } else if (art.currentHolderType === 'location' && art.currentHolderId && !locationIds.has(art.currentHolderId)) {
        missing = 'location';
      }
      if (missing) {
        findings.push({
          id: `artifact_holder_${art.id}`,
          severity: 'warning',
          category: 'missing_link',
          title: 'Artifact holder not found',
          description: `Artifact "${art.name}" is held by a ${missing} id "${art.currentHolderId}" that does not exist.`,
          involvedEntities: [{ entityType: 'artifact', name: art.name }],
          suggestedFix: `Create the holding ${missing.toLowerCase()} or update currentHolderId.`,
        });
      }
    }
  }

  private static checkReligionRefs(world: WorldBible, findings: ContradictionFinding[]): void {
    const locationIds = new Set(world.locations.map((l) => l.id));
    const factionIds = new Set(world.factions.map((f) => f.id));

    for (const deity of world.religions || []) {
      for (const locId of deity.holyLocationIds || []) {
        if (!locationIds.has(locId)) {
          findings.push({
            id: `deity_loc_${deity.id}_${locId}`,
            severity: 'warning',
            category: 'missing_link',
            title: 'Deity tied to missing holy site',
            description: `Deity "${deity.name}" lists holy location "${locId}" which does not exist.`,
            involvedEntities: [{ entityType: 'religion', name: deity.name }],
            suggestedFix: 'Create the location or remove the link.',
          });
        }
      }
      for (const facId of deity.affiliatedFactionIds || []) {
        if (!factionIds.has(facId)) {
          findings.push({
            id: `deity_fac_${deity.id}_${facId}`,
            severity: 'warning',
            category: 'missing_link',
            title: 'Deity tied to missing faction',
            description: `Deity "${deity.name}" is affiliated with faction "${facId}" which does not exist.`,
            involvedEntities: [{ entityType: 'religion', name: deity.name }],
            suggestedFix: 'Create the faction or remove the link.',
          });
        }
      }
    }
  }

  private static checkBestiaryHabitats(world: WorldBible, findings: ContradictionFinding[]): void {
    const locationIds = new Set(world.locations.map((l) => l.id));
    for (const creature of world.bestiary || []) {
      for (const habitatId of creature.habitatLocationIds || []) {
        if (!locationIds.has(habitatId)) {
          findings.push({
            id: `creature_habitat_${creature.id}_${habitatId}`,
            severity: 'warning',
            category: 'missing_link',
            title: 'Creature habitat not found',
            description: `Creature "${creature.name}" lists habitat "${habitatId}" which does not exist.`,
            involvedEntities: [{ entityType: 'creature', name: creature.name }],
            suggestedFix: 'Create the location or update habitatLocationIds.',
          });
        }
      }
    }
  }

  private static checkDramaBondEndpoints(world: WorldBible, findings: ContradictionFinding[]): void {
    const npcIds = new Set(world.npcs.map((n) => n.id));
    for (const bond of world.dramaBonds || []) {
      if (!npcIds.has(bond.sourceNpcId) || !npcIds.has(bond.targetNpcId)) {
        findings.push({
          id: `bond_${bond.id}`,
          severity: 'warning',
          category: 'missing_link',
          title: 'Drama bond references missing NPC',
          description: `Drama bond "${bond.relationTypeId}" connects "${bond.sourceNpcId}" ↔ "${bond.targetNpcId}", but at least one of them does not exist.`,
          involvedEntities: [{ entityType: 'drama_bond', name: bond.relationTypeId }],
          suggestedFix: 'Re-point the bond to existing NPCs or delete it.',
        });
      }
    }
  }

  private static checkDuplicateNames(world: WorldBible, findings: ContradictionFinding[]): void {
    const vaults: Array<{ kind: string; entities: Array<{ id: string; name: string }> }> = [
      { kind: 'NPC', entities: world.npcs },
      { kind: 'location', entities: world.locations },
      { kind: 'faction', entities: world.factions },
      { kind: 'artifact', entities: world.artifacts || [] },
      { kind: 'deity', entities: world.religions || [] },
      { kind: 'creature', entities: world.bestiary || [] },
    ];

    for (const { kind, entities } of vaults) {
      const byName = new Map<string, string[]>();
      for (const e of entities) {
        const key = (e.name || '').trim().toLowerCase();
        if (!key) continue;
        byName.set(key, [...(byName.get(key) || []), e.id]);
      }
      for (const [name, ids] of byName) {
        if (ids.length > 1) {
          findings.push({
            id: `dup_${kind}_${name.replace(/\s+/g, '_')}`,
            severity: 'suggestion',
            category: 'missing_link',
            title: `Duplicate ${kind} names`,
            description: `${ids.length} ${kind}s share the name "${name}". Duplicate names poison AI context injection and memory retrieval boosts.`,
            involvedEntities: [{ entityType: kind, name }],
            suggestedFix: `Rename or merge the duplicate ${kind} entries.`,
          });
        }
      }
    }
  }

  /**
   * Duplicate ids within or across vaults collide in prompt injection and
   * memory entityIds. Model-generated `law_001`-style ids are the top source.
   */
  private static checkDuplicateIds(world: WorldBible, findings: ContradictionFinding[]): void {
    const seen = new Map<string, string>();
    const vaults: Array<{ kind: string; entities: Array<{ id?: string; name?: string }> }> = [
      { kind: 'law', entities: world.laws || [] },
      { kind: 'faction', entities: world.factions || [] },
      { kind: 'location', entities: world.locations || [] },
      { kind: 'npc', entities: world.npcs || [] },
      { kind: 'artifact', entities: world.artifacts || [] },
      { kind: 'creature', entities: world.bestiary || [] },
      { kind: 'deity', entities: world.religions || [] },
      { kind: 'timeline', entities: world.timeline || [] },
    ];
    for (const { kind, entities } of vaults) {
      for (const e of entities) {
        const id = (e.id || '').trim();
        if (!id) continue;
        const prev = seen.get(id);
        if (prev) {
          findings.push({
            id: `dup_id_${id}`,
            severity: 'error',
            category: 'missing_link',
            title: 'Duplicate entity id',
            description: `Id "${id}" is used by both ${prev} and ${kind}. Id collisions corrupt lore references and memory linkage.`,
            involvedEntities: [{ entityType: kind, name: (e as { name?: string }).name || id }],
            suggestedFix: `Assign a unique stable id to one of the "${id}" entities.`,
          });
        } else {
          seen.set(id, kind);
        }
      }
    }
  }

  /**
   * Lightweight law-vs-law conflict scan (first use of the `law_conflict`
   * category). Detects negation pairs within the same category, EN + FA.
   */
  private static checkLawConflicts(world: WorldBible, findings: ContradictionFinding[]): void {
    const laws = world.laws || [];
    const pairs: Array<[RegExp, RegExp]> = [
      [/requires?|demands?|must/i, /forbids?|bans?|prohibits?|never|illegal/i],
      [/always/i, /never/i],
      [/ممکن|باید|الزامی/i, /ممنوع|قدغن|حرام|غیرقانونی/i],
    ];
    for (let i = 0; i < laws.length; i++) {
      for (let j = i + 1; j < laws.length; j++) {
        const a = `${laws[i].rule} ${laws[i].description || ''}`;
        const b = `${laws[j].rule} ${laws[j].description || ''}`;
        const hit = pairs.some(([p, n]) => (p.test(a) && n.test(b)) || (p.test(b) && n.test(a)));
        if (hit) {
          findings.push({
            id: `law_conflict_${laws[i].id}_${laws[j].id}`,
            severity: 'warning',
            category: 'law_conflict',
            title: 'Potentially conflicting world laws',
            description: `Laws "${laws[i].rule}" and "${laws[j].rule}" may contradict (require vs forbid). Clarify precedence or scope.`,
            involvedEntities: [
              { entityType: 'world_law', name: laws[i].rule },
              { entityType: 'world_law', name: laws[j].rule },
            ],
            suggestedFix: 'Define which law takes precedence, or scope each to a distinct domain.',
          });
        }
      }
    }
  }

  /**
   * Timeline ordering + ripple-target resolution. Era regressions and
   * free-text ripple targets that match no entity are the main drift sources.
   */
  private static checkTimelineOrder(world: WorldBible, findings: ContradictionFinding[]): void {
    const rank: Record<string, number> = { ancient: 0, war: 1, reign: 2, cataclysm: 2, present: 3, recent: 3 };
    const events = world.timeline || [];
    let last = -1;
    for (const e of events) {
      const r = rank[(e.eraCategory as string) || ''] ?? -1;
      if (r >= 0 && last >= 0 && r < last) {
        findings.push({
          id: `timeline_order_${e.id}`,
          severity: 'warning',
          category: 'timeline_paradox',
          title: 'Timeline era regression',
          description: `Event "${e.title}" (${e.eraCategory}) is ordered after a later era. Keep eras chronological.`,
          involvedEntities: [{ entityType: 'timeline_event', name: e.title }],
          suggestedFix: 'Re-order timeline events so eras progress ancient → war/reign → present.',
        });
      }
      if (r >= 0) last = Math.max(last, r);
    }
    const names = new Set<string>();
    for (const arr of [world.factions, world.locations, world.npcs, world.artifacts || [], world.religions || [], world.bestiary || []]) {
      for (const e of arr as Array<{ name?: string }>) {
        if (e.name) names.add(e.name.trim().toLowerCase());
      }
    }
    for (const e of events) {
      for (const ripple of (e as { ripples?: Array<{ targetName?: string }> }).ripples || []) {
        const t = (ripple.targetName || '').trim().toLowerCase();
        if (t && ![...names].some((n) => n.includes(t) || t.includes(n))) {
          findings.push({
            id: `timeline_ripple_${e.id}`,
            severity: 'suggestion',
            category: 'timeline_paradox',
            title: 'Ripple targets unknown entity',
            description: `Timeline event "${e.title}" ripples to "${ripple.targetName}", which matches no world entity.`,
            involvedEntities: [{ entityType: 'timeline_event', name: e.title }],
            suggestedFix: 'Point the ripple at an existing entity or create it.',
          });
        }
      }
    }
  }

  /**
   * Validates saga choice stat ids + DCs against the active RPG system.
   * Mirrors playtime `normalizeChoices` so bad sagas fail at author time.
   */
  public static auditSagaStats(
    saga: SagaManifest,
    validStatIds: string[]
  ): ContradictionFinding[] {
    const out: ContradictionFinding[] = [];
    const stats = new Set(validStatIds.map((s) => s.toLowerCase()));
    for (const ch of saga.chapters || []) {
      for (const sc of ch.scenes || []) {
        if (!sc.choices || sc.choices.length === 0) {
          out.push({
            id: `saga_empty_choices_${sc.sceneId}`,
            severity: 'warning',
            category: 'missing_link',
            title: 'Scene has no choices',
            description: `Scene "${sc.sceneId}" offers no player choices. Every scene needs 3 archetypes.`,
            involvedEntities: [{ entityType: 'story_beat', name: sc.sceneId }],
            suggestedFix: 'Add defensive_diplomatic, tactical_agile, and aggressive_daring choices.',
          });
          continue;
        }
        for (const c of (sc.choices || []) as Array<Record<string, any>>) {
          const stat = String(c.statCheck?.stat || c.requiredStatId || '').toLowerCase();
          if (stat && ![...stats].some((s) => s && stat.includes(s))) {
            // Only flag when a stat vocabulary exists; otherwise playtime default applies.
            if (stats.size > 0) {
              out.push({
                id: `saga_stat_${sc.sceneId}_${stat}`,
                severity: 'error',
                category: 'missing_link',
                title: 'Saga choice references unknown stat',
                description: `Choice in "${sc.sceneId}" requires stat "${stat}" which is not in the RPG system [${[...stats].join(', ')}].`,
                involvedEntities: [{ entityType: 'story_beat', name: sc.sceneId }],
                suggestedFix: 'Point the choice at a real stat id from the RPG system.',
              });
            }
          }
          const dc = (c.statCheck?.dc ?? c.targetDC) as number | undefined;
          if (typeof dc === 'number' && (dc < 5 || dc > 30)) {
            out.push({
              id: `saga_dc_${sc.sceneId}`,
              severity: 'warning',
              category: 'missing_link',
              title: 'Saga DC out of range',
              description: `Scene "${sc.sceneId}" uses DC ${dc}; sane range is 5-30 (prompt contract 9-16).`,
              involvedEntities: [{ entityType: 'story_beat', name: sc.sceneId }],
              suggestedFix: 'Clamp DCs to 5-30, ideally 10-20.',
            });
          }
        }
      }
    }
    return out;
  }

  private static computeScore(world: WorldBible, findings: ContradictionFinding[]): number {
    let score = 100;
    for (const f of findings) {
      if (f.severity === 'error') score -= 18;
      else if (f.severity === 'warning') score -= 8;
      else score -= 3;
    }
    // Floor by content completeness (empty world is not "100/100 coherent").
    const entityCount =
      world.laws.length +
      world.factions.length +
      world.locations.length +
      world.npcs.length +
      (world.artifacts || []).length +
      (world.bestiary || []).length;
    if (entityCount === 0) score = 0;
    return Math.max(0, Math.min(100, score));
  }
}
