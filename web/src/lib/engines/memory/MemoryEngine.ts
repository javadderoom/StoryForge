import { MemoryEntry, MemoryCategory, ImportanceScore, ThreeTierContextEnvelope } from '@/lib/types/memory';
import { ChapterSummaryEntry, WorldStateLedger } from '@/lib/types/world';
import { formatLivingWorldLedger } from '@/lib/engines/narrative/worldContext';

export interface ExtractedFact {
  category: MemoryCategory;
  importance: ImportanceScore;
  summary: string;
  detail?: string;
  tags?: string[];
  entityIds?: string[];
}

export class MemoryEngine {
  private memories: MemoryEntry[] = [];

  constructor(initialMemories: MemoryEntry[] = []) {
    this.memories = [...initialMemories];
  }

  /**
   * Stores a newly formed memory with importance scoring.
   */
  public recordMemory(fact: ExtractedFact, sceneId: string, turnNumber: number): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category: fact.category,
      importance: fact.importance,
      summary: fact.summary,
      detail: fact.detail,
      tags: fact.tags || [],
      sceneId,
      turnNumber,
      entityIds: fact.entityIds || [],
      createdAt: Date.now(),
    };

    // Only persist memories with importance >= 3 (0-2 are ephemeral transient details)
    if (entry.importance >= 3) {
      this.memories.push(entry);
    }

    return entry;
  }

  /**
   * Retrieves the most relevant memories for the current context envelope.
   * Prioritizes high importance (9-10), character relationship facts, and location proximity.
   */
  public getRelevantMemories(
    currentLocationId?: string,
    activeNpcIds: string[] = [],
    limit = 6
  ): MemoryEntry[] {
    const scored = this.memories.map((mem) => {
      let score = mem.importance * 2; // Base score from 0-10 importance

      // Boost memories related to active NPCs in the scene
      if (mem.entityIds && activeNpcIds.some((id) => mem.entityIds!.includes(id))) {
        score += 8;
      }

      // Boost memories created at current location
      if (mem.entityIds && currentLocationId && mem.entityIds.includes(currentLocationId)) {
        score += 5;
      }

      // Boost permanent critical world events (importance >= 9)
      if (mem.importance >= 9) {
        score += 10;
      }

      return { mem, score };
    });

    // Sort by computed relevance descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.mem);
  }

  /**
   * Returns all stored memories.
   */
  public getAllMemories(): MemoryEntry[] {
    return [...this.memories];
  }

  // ------------------------------------------------------------------
  // Plan 07: Hierarchical 3-Tier Saga Memory (long-form campaigns)
  // ------------------------------------------------------------------

  /**
   * Tier 1 (Working Memory): the verbatim memories of the most recent turns.
   * Prevents loss of immediate dialogue and room state across long sessions.
   */
  public getWorkingMemory(limit = 3): MemoryEntry[] {
    return [...this.memories]
      .sort((a, b) => b.turnNumber - a.turnNumber || b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Tier 2 (Episodic Milestone Rollup): compressed chronological summaries of
   * completed chapters. Keeps 50-200+ turn sagas coherent without replaying
   * every historical turn into the context window.
   */
  public buildEpisodicRollup(
    chapterSummaries: ChapterSummaryEntry[],
    limit = 12
  ): string[] {
    return [...chapterSummaries]
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .slice(-limit)
      .map((c) => {
        const flags = c.irreversibleChoices.length
          ? ` | Irreversible: ${c.irreversibleChoices.join('; ')}`
          : '';
        return `Chapter ${c.chapterNumber} «${c.title}»: ${c.summary}${flags}`;
      });
  }

  /**
   * Assembles the full 3-tier hierarchical envelope used by the narrator:
   * working memory (verbatim), episodic rollup (compressed), and the living
   * world ledger (faction reputations / NPC statuses / key items).
   */
  public buildThreeTierEnvelope(
    ledger?: WorldStateLedger | null,
    workingMemoryLimit = 3
  ): ThreeTierContextEnvelope {
    return {
      workingMemory: this.getWorkingMemory(workingMemoryLimit),
      episodicRollup: this.buildEpisodicRollup(ledger?.chapterSummaries ?? []),
      livingWorldLedger: formatLivingWorldLedger(ledger),
    };
  }
}
