import { prisma } from '../client';
import { PlaythroughSession, TurnBeat, CheckResolution, PlayerState } from '@/lib/types/gameplay';
import { WorldStateLedger } from '@/lib/types/world';
import type { Prisma } from '@prisma/client';

const isDatabaseActive = process.env.ENABLE_DB === 'true';

const inMemorySessions = new Map<string, any>();

/** Cast helper for Prisma Json columns (avoids new `as any` casts). */
const asJson = (value: unknown) => value as Prisma.InputJsonValue;

/** Plan 07: memory log payload with hierarchical saga fields. */
export interface MemoryLogInput {
  category: string;
  importance: number;
  summary: string;
  detail?: string;
  sceneId?: string;
  entityIds?: string[];
  tags?: string[];
}

export class SessionRepository {
  /**
   * Persists a newly created playthrough session along with its opening turn
   */
  static async createSession(session: PlaythroughSession) {
    if (!isDatabaseActive) {
      inMemorySessions.set(session.sessionId, {
        ...session,
        turns: session.history || [],
        memories: [],
      });
      return session;
    }
    try {
      const initialBeat = session.history[0];

      return await prisma.$transaction(async (tx) => {
        const createdSession = await tx.playthroughSession.create({
          data: {
            sessionId: session.sessionId,
            userId: session.userId,
            storyId: session.storyId,
            currentSceneId: session.currentSceneId,
            turnCount: session.turnCount,
            playerState: session.playerState as any,
            // Plan 07
            currentChapterId: session.currentChapterId ?? null,
            sagaLedger: asJson(session.sagaLedger ?? {}),
          },
        });

        if (initialBeat) {
          await tx.turnHistory.create({
            data: {
              sessionId: session.sessionId,
              turnNumber: initialBeat.turnNumber,
              sceneId: initialBeat.sceneId,
              playerActionText: initialBeat.playerActionText,
              actionStyle: initialBeat.actionStyle,
              narrativeProse: initialBeat.narrativeProse,
              presentedChoices: initialBeat.presentedChoices as any,
              resolution: initialBeat.resolution as any,
              chapterNumber: initialBeat.chapterNumber ?? null,
            },
          });
        }

        return createdSession;
      });
    } catch (e) {
      console.warn('Database error persisting session, proceeding with in-memory state:', e);
      return null;
    }
  }

  /**
   * Retrieves a session by its sessionId including recent turns and memories
   */
  static async getSession(sessionId: string) {
    if (!isDatabaseActive) {
      return inMemorySessions.get(sessionId) || null;
    }
    try {
      const session = await prisma.playthroughSession.findUnique({
        where: { sessionId },
        include: {
          turns: {
            orderBy: { turnNumber: 'asc' },
          },
          memories: {
            orderBy: { importance: 'desc' },
          },
        },
      });

      return session;
    } catch (e) {
      console.warn(`Database error fetching session ${sessionId}:`, e);
      return null;
    }
  }

  /**
   * Commits a turn resolution, updates player state, and writes memory logs.
   * Plan 07: optionally tracks the active chapter, patches the Living World
   * State Ledger, and stores hierarchical memory fields per entry.
   */
  static async recordTurn({
    sessionId,
    beat,
    resolution,
    updatedPlayerState,
    memories = [],
    chapterNumber,
    currentChapterId,
    sagaLedger,
  }: {
    sessionId: string;
    beat: TurnBeat;
    resolution?: CheckResolution;
    updatedPlayerState: PlayerState;
    memories?: MemoryLogInput[];
    chapterNumber?: number;
    currentChapterId?: string;
    sagaLedger?: WorldStateLedger;
  }) {
    const turnChapter = chapterNumber ?? beat.chapterNumber;

    if (!isDatabaseActive) {
      const existing = inMemorySessions.get(sessionId) || {};
      const turns = existing.turns || [];
      const mems = existing.memories || [];
      const newTurn = {
        sessionId,
        turnNumber: beat.turnNumber,
        sceneId: beat.sceneId,
        playerActionText: beat.playerActionText,
        actionStyle: beat.actionStyle,
        narrativeProse: beat.narrativeProse,
        presentedChoices: beat.presentedChoices,
        resolution,
        chapterNumber: turnChapter,
      };
      turns.push(newTurn);
      for (const m of memories) {
        mems.push({ ...m, turnNumber: beat.turnNumber, chapterNumber: turnChapter });
      }
      inMemorySessions.set(sessionId, {
        ...existing,
        currentSceneId: beat.sceneId,
        turnCount: beat.turnNumber,
        playerState: updatedPlayerState,
        currentChapterId: currentChapterId ?? existing.currentChapterId,
        sagaLedger: sagaLedger ?? existing.sagaLedger ?? {},
        turns,
        memories: mems,
      });
      return newTurn;
    }
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Update playthrough session state (+ Plan 07 chapter & ledger sync)
        await tx.playthroughSession.update({
          where: { sessionId },
          data: {
            currentSceneId: beat.sceneId,
            turnCount: beat.turnNumber,
            playerState: updatedPlayerState as any,
            ...(currentChapterId != null ? { currentChapterId } : {}),
            ...(sagaLedger ? { sagaLedger: asJson(sagaLedger) } : {}),
          },
        });

        // 2. Insert Turn History record
        const turn = await tx.turnHistory.create({
          data: {
            sessionId,
            turnNumber: beat.turnNumber,
            sceneId: beat.sceneId,
            playerActionText: beat.playerActionText,
            actionStyle: beat.actionStyle,
            narrativeProse: beat.narrativeProse,
            presentedChoices: beat.presentedChoices as any,
            resolution: resolution as any,
            chapterNumber: turnChapter ?? null,
          },
        });

        // 3. Insert any new significant memories
        if (memories && memories.length > 0) {
          await tx.memoryLog.createMany({
            data: memories.map((m) => ({
              sessionId,
              category: m.category,
              importance: m.importance,
              summary: m.summary,
              detail: m.detail ?? null,
              sceneId: m.sceneId ?? beat.sceneId,
              entityIds: m.entityIds ?? [],
              tags: m.tags ?? [],
              turnNumber: beat.turnNumber,
              chapterNumber: turnChapter ?? null,
            })),
          });
        }

        return turn;
      });
    } catch (e) {
      console.warn(`Database error recording turn for session ${sessionId}:`, e);
      return null;
    }
  }
}
