import { NextResponse } from 'next/server';
import { requireStudioWrite } from '@/lib/auth/studioAuth';
import { getPrisma } from '@/lib/db/client';
import type { AotBranchAudit } from '@/lib/engines/narrative/aotBranchAudit';
import { isSnapAotJudgeEnabled } from '@/lib/engines/narrative/aotBranchJudge';
import { isSnapAotEnabled } from '@/lib/play/snapAot';
import { summarizeSnapReport } from '@/lib/play/snapReport';

export const dynamic = 'force-dynamic';

/**
 * Studio → Snap Analytics: measured hit/miss of SubQ choice predictions and
 * the shadow-AOT branch audit that sits behind the promotion gate.
 *
 * Read-only, but scoped to the same author/admin guard as the rest of Studio.
 * `storyId` is optional; without it the report covers every story (matching
 * `npm run aot:report`).
 */
export async function GET(req: Request) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('storyId') || undefined;
    const rawLimit = Number(searchParams.get('limit') ?? '100');
    const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.round(rawLimit))) : 100;

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        {
          success: false,
          error:
            'ENABLE_DB is not "true" — Snap analytics needs the playthrough database.',
          databaseDisabled: true,
        },
        { status: 503 }
      );
    }

    const where = storyId ? { storyId } : {};
    const [decisions, branches] = await Promise.all([
      prisma.snapDecisionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.snapAotBranch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const summary = summarizeSnapReport(decisions, branches);
    const branchByKey = new Map(
      branches.map((branch) => [`${branch.sessionId}:${branch.turnNumber}`, branch])
    );

    // The log stores choice IDs; the Studio table needs the human labels. The
    // turn whose choices were shown is exactly the log's turnNumber, and
    // TurnHistory keeps its presentedChoices.
    const decisionKeys = Array.from(
      new Map(
        decisions.map((decision) => [
          `${decision.sessionId}:${decision.turnNumber}`,
          { sessionId: decision.sessionId, turnNumber: decision.turnNumber },
        ])
      ).values()
    );
    const turnRows = decisionKeys.length
      ? await prisma.turnHistory.findMany({
          where: { OR: decisionKeys },
          select: { sessionId: true, turnNumber: true, presentedChoices: true },
        })
      : [];
    const choicesByKey = new Map<string, Array<{ id?: string; text?: string }>>();
    for (const row of turnRows) {
      const list = Array.isArray(row.presentedChoices)
        ? (row.presentedChoices as unknown as Array<{ id?: string; text?: string }>)
        : [];
      choicesByKey.set(`${row.sessionId}:${row.turnNumber}`, list);
    }

    const recent = decisions.map((decision) => {
      const key = `${decision.sessionId}:${decision.turnNumber}`;
      const branch = branchByKey.get(key);
      const audit = branch?.audit as unknown as AotBranchAudit | null;
      const findings = Array.isArray(audit?.findings)
        ? audit.findings.filter((finding) => finding.severity !== 'info')
        : [];
      const actualChoiceText = decision.actualChoiceId
        ? choicesByKey.get(key)?.find((choice) => choice.id === decision.actualChoiceId)?.text ?? null
        : null;

      return {
        id: decision.id,
        sessionId: decision.sessionId,
        turnNumber: decision.turnNumber,
        predictedChoiceId: decision.predictedChoiceId,
        predictedChoiceText: branch?.choiceText ?? null,
        actualChoiceId: decision.actualChoiceId,
        actualChoiceText,
        actualActionText: decision.actualActionText,
        hit: decision.hit,
        confidence: decision.confidence,
        latencyMs: decision.latencyMs,
        createdAt: decision.createdAt.toISOString(),
        resolvedAt: decision.resolvedAt?.toISOString() ?? null,
        branch: branch
          ? {
              id: branch.id,
              status: branch.status,
              verdict: branch.verdict,
              outcome: branch.outcome,
              diceRoll: branch.diceRoll,
              isDiceless: branch.isDiceless,
              findings: findings.length,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        storyId: storyId ?? null,
        limit,
        flags: {
          snapAot: isSnapAotEnabled(),
          judge: isSnapAotJudgeEnabled(),
        },
        summary,
        recent,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load Snap analytics';
    console.error('Studio Snap analytics error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
