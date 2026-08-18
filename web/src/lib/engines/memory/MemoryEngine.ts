import { MemoryEntry, MemoryCategory, ImportanceScore } from '@/lib/types/memory';

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
}
