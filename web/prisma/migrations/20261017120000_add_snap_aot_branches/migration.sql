-- Plan 15 §2.3 tier 4: Snap-gated AOT pre-generation branches (shadow phase).
-- One row per dwell on a turn's choices for which Snap produced a prediction and
-- the branch engine pre-wrote (or failed to pre-write) the predicted choice's
-- continuation. Serving stays gated on the measured hit rate over
-- `snap_decision_logs`; until promotion every row is analysis-only.
-- Hand-written: local `migrate dev` is blocked by pre-existing checksum drift
-- on three Sept 2026 migrations (deploy/status unaffected). Applied locally via
-- `db push`; mark applied with `prisma migrate resolve --applied`.
CREATE TABLE "snap_aot_branches" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "predictedChoiceId" TEXT NOT NULL,
    "choiceText" TEXT,
    "diceRoll" INTEGER,
    "isDiceless" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "model" TEXT,
    "narrative" TEXT,
    "choices" JSONB NOT NULL DEFAULT '[]',
    "resolution" JSONB,
    "latencyMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "servedAt" TIMESTAMP(3),

    CONSTRAINT "snap_aot_branches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "snap_aot_branches_sessionId_turnNumber_idx" ON "snap_aot_branches"("sessionId", "turnNumber");
CREATE INDEX "snap_aot_branches_status_idx" ON "snap_aot_branches"("status");

ALTER TABLE "snap_aot_branches" ADD CONSTRAINT "snap_aot_branches_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "playthrough_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
