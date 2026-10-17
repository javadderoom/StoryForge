-- Plan 15 §2.3 tier 4 (§7.6E) — shadow AOT branch audit:
-- per-branch serving verdict + mistake telemetry (findings: first-draft
-- mistakes, repair spend, surviving findings) stored for analysis.
ALTER TABLE "snap_aot_branches" ADD COLUMN "verdict" TEXT;
ALTER TABLE "snap_aot_branches" ADD COLUMN "audit" JSONB;

CREATE INDEX "snap_aot_branches_verdict_idx" ON "snap_aot_branches"("verdict");
