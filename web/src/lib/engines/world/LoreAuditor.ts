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

    for (const fac of world.factions) {
      const referenced =
        (fac.territoryIds || []).length > 0 ||
        (fac.rivalFactionIds || []).length > 0 ||
        (fac.alliedFactionIds || []).length > 0 ||
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
