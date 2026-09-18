# Eval Cassettes (Plan 14)

Recorded raw model outputs for the Tier-2 golden scenarios, laid out as:

```
cassettes/<modelId>/<scenarioId>.json
```

Each file is the **RAW** (pre-normalization) model payload — `{ narrative, choices, extractedMemories }` —
so the evaluator measures the model rather than the deterministic guardrails that would repair it.

## Creating / refreshing

```bash
cd web
npm run eval:record                                  # all scenarios, default model
npm run eval:record -- --model=gemini-3.5-flash-lite # a specific model
```

This requires `GEMINI_API_KEY` and spends real credits. Commit the resulting
JSON so `npm run eval:narrative` replays it deterministically in CI for free.

## Running (replay)

```bash
npm run eval:narrative
npm run eval:narrative -- --scenario=eval_standoff_sentry
npm run eval:narrative -- --model=gemini-3.5-flash-lite --json
```

With no cassette present a scenario is reported as `SKIP` rather than silently
passing, so a green run always means real, recorded evidence.
