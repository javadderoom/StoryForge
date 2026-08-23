import { WorldBible } from '@/lib/types/world';
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
