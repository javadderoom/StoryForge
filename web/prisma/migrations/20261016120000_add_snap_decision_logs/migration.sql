-- Plan 15 §2.3: Snap decision log (prediction vs. actual choice hit-rate instrument).
-- Hand-written: local `migrate dev` is blocked by pre-existing checksum drift
-- on three Sept 2026 migrations (deploy/status unaffected). Applied locally via
-- `db push`; mark applied with `prisma migrate resolve --applied`.
CREATE TABLE "snap_decision_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "questionKey" TEXT NOT NULL DEFAULT 'predicted_choice',
    "model" TEXT NOT NULL DEFAULT 'subq-snap-preview',
    "presentedChoiceIds" TEXT[] NOT NULL DEFAULT '{}',
    "predictedChoiceId" TEXT,
    "choiceProbabilities" JSONB,
    "confidence" DOUBLE PRECISION,
    "actualChoiceId" TEXT,
    "actualActionText" TEXT,
    "hit" BOOLEAN,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "snap_decision_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "snap_decision_logs_sessionId_turnNumber_idx" ON "snap_decision_logs"("sessionId", "turnNumber");
CREATE INDEX "snap_decision_logs_hit_idx" ON "snap_decision_logs"("hit");

ALTER TABLE "snap_decision_logs" ADD CONSTRAINT "snap_decision_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "playthrough_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
