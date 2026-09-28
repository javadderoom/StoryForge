# Technical Risk & Hardening Audit

> **Audit Date:** September 25, 2026
> **Status:** Findings A–D and the §2.5/§2.6 session and level-up issues were **remediated on September 25, 2026** — see [Remediation Log](#remediation-log) at the end of this document for what shipped and how it was verified. Findings E–K remain open.
> **Scope:** `web/` (Next.js 16 backend + Studio authoring), `app/` (Flutter reader client)
> **Method:** Static read of all API route handlers, repositories, engine modules, auth primitives, and client state layer. Cross-referenced against the 55 server test files and 3 client test files.
> **Focus:** Engineering risk only. Narrative/gameplay correctness is covered separately in [`SYSTEM_AND_GAMEPLAY_AUDIT.md`](file:///d:/Code/StoryForge/docs/SYSTEM_AND_GAMEPLAY_AUDIT.md).

---

## 1. Executive Summary

StoryForge's *conceptual* architecture is unusually disciplined. The doctrine — **AI is the narrator, never the game engine or database** — is not a slogan but a mechanically enforced invariant, backed by a deterministic pre-resolution step, a post-generation prose validator, an auto-repair loop, and a fail-closed 503 that refuses to persist unrepairable output. The injectable model seam (`web/src/lib/engines/narrative/modelCall.ts`), the scope-tier lore pruner, and the Living World Ledger are all mature, well-motivated designs.

The weakness is almost entirely **perimeter and drift**, not design:

| | Finding | Severity |
| :--- | :--- | :--- |
| **A** | 9 of 19 API routes have **no authentication whatsoever**, including every LLM-calling Studio route and every world/story mutation route | 🔴 **Critical** |
| **B** | `Access-Control-Allow-Origin: *` + `Allow-Credentials: true` on all `/api/*` — invalid per spec and maximally permissive | 🔴 **Critical** |
| **C** | Repository layer has **no ownership concept**; `deleteWorld` cascades away stories, sessions, turns, and memories | 🔴 **Critical** |
| **D** | Hardcoded JWT fallback secret; `verifyJwt` uses `!==` instead of `timingSafeEqual` | 🟠 High |
| **E** | Client RPG engine is a divergent fork of the server engine | 🟠 High |
| **F** | Zod is absent from the LLM boundary — schema instructions are prompts, not validation | 🟡 Medium |
| **G** | No caching, no queue; heavy generation runs synchronously in-request | 🟡 Medium |
| **H** | Failures are silent — repositories `console.warn` and return empty results | 🟡 Medium |
| **I** | 2,754-line monolithic client store | 🟡 Medium |
| **J** | Test coverage concentrated in pure functions; zero coverage of route handlers, auth, and the Flutter session notifier | 🟡 Medium |
| **K** | Committed dead code (`scratch/`, 3 orphaned widgets) pollutes the graph and greps | 🔵 Low |

> [!CAUTION]
> **Findings A, B, and C are one chain, not three.** An unauthenticated, credential-bearing, wildcard-CORS `DELETE /api/studio/worlds?worldId=…` is a single unauthenticated request that permanently destroys a world and every playthrough inside it. There is no ownership check at any layer to stop it. This should be treated as a pre-production blocker.

---

## 2. Critical — Authentication & Authorization

### 2.1 The Authentication Surface Is Much Smaller Than the Route Surface

`getAuthenticatedUser` (`web/src/lib/auth/getUser.ts:40`) is the only auth primitive, and it is **optional by design**: it returns `null` for a missing or invalid token rather than throwing. Callers are expected to decide what an anonymous visitor may do. Auditing the 19 route files for that decision:

| Route | Auth call | Role gate | Verdict |
| :--- | :--- | :--- | :--- |
| `POST /api/play/action` | ✅ | — | OK (optional-auth is intentional: guests play, credits skipped) |
| `GET/PATCH /api/play/session` | ✅ | — | OK |
| `GET /api/play/stories` | — | — | OK (published catalog, public by design) |
| `POST /api/play/level-up` | ❌ | ❌ | **Mutates player state, unauthenticated** |
| `POST /api/studio/generate` | ❌ | ❌ | **Unauthenticated LLM spend, 6 call sites** |
| `POST /api/studio/chat` | ❌ | ❌ | **Unauthenticated LLM spend** |
| `POST /api/studio/diagnostics/ai/run` | ❌ | ❌ | **Unauthenticated LLM spend when `live:true`** |
| `GET/PATCH /api/studio/lore` | ❌ | ❌ | **PATCH mutates world canon, unauthenticated** |
| `GET/POST/DELETE /api/studio/story` | ❌ | ❌ | **Save + delete, unauthenticated** |
| `GET/POST /api/studio/stories` | ❌ | ❌ | **Save, unauthenticated** |
| `GET/POST/DELETE /api/studio/worlds` | ❌ | ❌ | **Create/fork/delete + cascade, unauthenticated** |
| `GET/POST/DELETE /api/studio/encounters` | ✅ | ✅ | OK |
| `POST /api/admin/*` (3 routes) | ✅ | ✅ | OK |
| `POST /api/auth/*` (3 routes) | — / ✅ | — | OK (login/register/me) |
| `POST /api/billing/*` (2 routes) | ✅ | ✅ (packages) | OK |

> [!WARNING]
> The 5 correctly-gated routes prove the pattern was intended and simply never applied to the Studio surface. `web/src/app/api/studio/encounters/route.ts:32` gates writes on `role !== 'ADMIN' && role !== 'AUTHOR'`; `web/src/app/api/studio/worlds/route.ts` has no such check on any verb, despite `forkWorld` and `deleteWorld` being strictly more destructive.

### 2.2 Unauthenticated LLM Spend Is a Direct Financial Loss

`POST /api/studio/generate` calls `generateStructuredJson` at six sites — [`:141`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L141), [`:180`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L180), [`:278`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L278), [`:621`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L621), [`:649`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L649), [`:727`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L727) — across a 30-member task union with **no auth, no rate limit, and no quota**. The `genesis` and saga-synthesis paths additionally run **audit-gated repair retry loops** ([`:180`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L180), [`:649`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L649), [`:727`](file:///d:/Code/StoryForge/web/src/app/api/studio/generate/route.ts#L727)), so a *single* request can trigger two or three model calls.

Any internet-reachable deployment is one `curl` loop away from an unbounded bill. `web/src/lib/ai/geminiClient.ts` has a two-model cascade queue but no budget, no per-principal accounting, and no circuit breaker.

### 2.3 CORS Is Simultaneously Invalid and Unrestrictive

`web/next.config.ts:7-17` stamps every `/api/*` response with:

```ts
{ key: "Access-Control-Allow-Credentials", value: "true" },
{ key: "Access-Control-Allow-Origin", value: "*" },
```

Browsers **reject** the `*` + credentials combination outright (the spec requires an explicit origin when credentials are allowed), so the header pair is simultaneously broken *and* advertises a fully open policy. Read `Access-Control-Allow-Credentials: true` as intent-to-allow-credentials, and the `*` as intent-to-allow-everyone.

The consequence is that if this is ever "fixed" by naively replacing `*` with a reflected `Origin` — the standard copy-paste remediation — **every origin becomes credentialed and the JWT cookie becomes readable and replayable from any site on the internet.** Fixing the CORS header without first closing 2.1 would make the exposure strictly worse than today. **Order matters: authorization first, CORS second.**

### 2.4 The Repository Layer Has No Ownership Concept

Every `StoryRepository` method takes a bare `storyId` / `worldId` and performs no owner check:

- `getAllStories` — [`:220`](file:///d:/Code/StoryForge/web/src/lib/db/repositories/storyRepository.ts#L220) — returns **every** story including unpublished ones
- `getStoryById` — [`:279`](file:///d:/Code/StoryForge/web/src/lib/db/repositories/storyRepository.ts#L279)
- `deleteStory` — [`:689`](file:///d:/Code/StoryForge/web/src/lib/db/repositories/storyRepository.ts#L689)
- `forkWorld` — [`:135`](file:///d:/Code/StoryForge/web/src/lib/db/repositories/storyRepository.ts#L135) — deep-copies another author's entire world bible
- `deleteWorld` — [`:190`](file:///d:/Code/StoryForge/web/src/lib/db/repositories/storyRepository.ts#L190)

`deleteWorld` is the worst of these. Inside a single transaction it runs:

```ts
await tx.story.deleteMany({ where: { worldId: resolved } });   // :199
await tx.story.deleteMany({ where: { id: resolved, worldId: null } as any });  // :200
await tx.world.delete({ where: { id: resolved } });             // :203
```

Because `Story.world` is `onDelete: SetNull` but `WorldBible`/`RpgSystem` cascade (`web/prisma/schema.prisma:41`), and `PlaythroughSession`/`TurnHistory`/`MemoryLog` all cascade from `Story`, **one call destroys a world's canon, every story built on it, and every player's turn history and memory log.** There is no soft-delete, no trash state, and no confirmation token.

Note the asymmetry: `User` has a `role` enum and `Story` has an `author String?` field, but **no `Story` is ever related to a `User`**. Ownership is modelled in the type system and then not used.

> [!NOTE]
> `PlaythroughSession.userId` does default to the literal string `"guest_user"` with a `SetNull` relation (`schema.prisma:186-203`), so session rows can be attributed to a real user — but nothing enforces that a caller requesting a session *is* that user. `GET /api/play/session?sessionId=…` is an unauthenticated IDOR: session IDs are returned to the client in plaintext and are the only secret protecting a playthrough.

### 2.5 IDOR on Session Mutation

`POST /api/play/level-up` (`web/src/app/api/play/level-up/route.ts:15`) authenticates nobody and authorizes nothing. It takes a `sessionId` from the body, loads it, and calls `allocateLevelUpRewards`. The *point budget* is validated server-side, so this is not a stat-inflation exploit — but anyone holding a session ID can spend that session's unspent stat points and ability picks on the legitimate player's behalf, and `PATCH /api/play/session` is similarly open.

### 2.6 A Latent Stat-Inflation Bug in the Level-Up Path

`allocateLevelUpRewards` (`web/src/lib/engines/game/progressionEngine.ts`) applies allocations with a hardcoded baseline:

```ts
updated.stats[statId] = (updated.stats[statId] || 10) + b;   // hardcoded 10
```

Its sibling implementation gets this right — `computeMaxResources` (`web/src/lib/engines/game/vitalScaling.ts:52`) correctly resolves `playerStats[stat.id] ?? stat.baseValue`.

For any story authored on a non-D&D scale (the codebase explicitly supports this — `universalBaseValue`, and `getStatModifier(statValue, baseValue = 10)` in `GameEngine.ts:154` is baseline-parameterised for exactly this reason), allocating a point to a stat the character does not yet possess creates it at **10 instead of the story baseline**. On a baseline-3 system that is a `+3` modifier for 1 spent point. Combined with 2.5's missing authorization, this is remotely triggerable.

**Fix:** thread `rpgSystem` (already a parameter of the function) into the fallback — `(updated.stats[statId] ?? resolveStatBase(statId, rpgSystem)) + b`.

---

## 3. High — Authentication Cryptography

### 3.1 Hardcoded Fallback Signing Secret

`web/src/lib/auth/jwt.ts:3`:

```ts
const JWT_SECRET = process.env.JWT_SECRET || 'storyforge-secret-jwt-key-2026-secure-token-void';
```

This is a **committed, publicly readable secret in the repository**. If `JWT_SECRET` is unset in any deployed environment, every JWT in that deployment is forgeable by anyone who has read this file — and because `/api/studio/*` is unauthenticated anyway (2.1), the practical impact today is masked. **That is the dangerous part: fixing 2.1 without fixing 3.1 converts a low-impact problem into full account and role forgery.**

The failure mode is also silent. There is no startup assertion that `JWT_SECRET` is present in production, no length check, and no warning log.

> [!CAUTION]
> **Mandatory co-change:** 2.1 (authorization) and 3.1 (secret) must ship together. Neither is safe alone, and the second is unsafe to leave behind after the first.

**Fix:**
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  if (!process.env.NODE_ENV) throw new Error('JWT_SECRET is required');
}
```
…with a dev-only generated ephemeral secret behind `NODE_ENV !== 'production'`.

### 3.2 Signature Comparison Is Not Constant-Time

`verifyJwt` compares signatures with `!==` (`web/src/lib/auth/jwt.ts:137`):

```ts
if (signature !== expectedSignature) { return null; }
```

`verifyPassword` in the **same file, 70 lines earlier**, does it correctly with `crypto.timingSafeEqual` (`jwt.ts:66`). This is an inconsistency rather than an oversight, which makes it cheap to fix:

```ts
const a = Buffer.from(signature), b = Buffer.from(expectedSignature);
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
```

The practical exploitability of a remote timing attack over a noisy network is low. It is listed as High because the fix is one line and the inconsistency is indefensible in review.

### 3.3 `phoneVerified` Is a Dead Column

`User.phoneVerified` exists in the schema (`schema.prisma:121`) and is surfaced through the whole stack — `AuthenticatedUser.phoneVerified`, `UserProfile.phoneVerified` in Flutter, and the profile drawer. Only **2 assignments** of `phoneVerified: true` exist in the entire server codebase, both in seed/registration paths. There is no OTP, no SMS verification, no verification endpoint. The column is presented to authors as a trust signal that is never earned.

---

## 4. High — Client/Server Engine Drift

### 4.1 The Problem

`app/lib/core/engine/rpg_engine.dart` (198 lines) is a **hand-maintained fork** of `web/src/lib/engines/game/GameEngine.ts` (1,913 lines). Its header comment claims it "mirrors" the server. It does not.

| Server term (`GameEngine.ts:1191-1192`) | Client |
| :--- | :--- |
| `roll + statModifier + skillBonus + equipmentModifier + passiveBonus + abilityBonus + envMod` | `roll + statModifier + equipmentModifier + tacticalEnvMod` |
| `STAT_CANONICAL_ALIASES` canonicalization (`:1069`) | absent |
| `evaluatePassiveAbilities` / `parseAbilityModifier` | absent |
| `evaluateAbilityEffects` (structured active abilities, added in the most recent commit `28069cf`) | absent |
| `stateDiff` — nat-1 → −15 HP, mixed → −5 HP / −10 stamina, failure → −10 HP (`:1232-1272`) | absent |
| `rpgSystem.diceType` honoured (`:1063`) | hardcoded `d20` |
| Pellet consumed into `itemsRemovedIds` (`:1155-1164`) | not consumed |

The most recent commit — `feat(rpg): implement structured ability effects` — added an entire ability-effect subsystem to the server and moved the divergence further apart, which is the expected failure mode of an ungenerated fork.

### 4.2 Why It Is Currently Contained

The client is **not** the source of truth. `ReaderScreen` rolls locally to animate the dice, then ships the same value as `forcedDiceRoll` ([`reader_screen.dart:145`](file:///d:/Code/StoryForge/app/lib/ui/screens/reader_screen.dart#L145) → [`:171`](file:///d:/Code/StoryForge/app/lib/ui/screens/reader_screen.dart#L171)), the server re-resolves authoritatively, and the client overwrites its display with `result['data']['resolution']` ([`game_session_provider.dart:338-339`](file:///d:/Code/StoryForge/app/lib/providers/game_session_provider.dart#L338)). World state is server-derived. The `holdNarrativeUpdate` / `applyPendingTurn` split ([`:349-359`](file:///d:/Code/StoryForge/app/lib/providers/game_session_provider.dart#L349), [`:412-458`](file:///d:/Code/StoryForge/app/lib/providers/game_session_provider.dart#L412)) is a genuinely good spoiler guard.

**So the bug is visible, not dangerous:** the dice overlay's `Roll + Mod = Total vs DC` row can display a total that differs from the committed outcome, and a player can watch a "success" resolve into prose describing failure. In a game whose entire premise is *"the player cannot change the rules of the world without a reason,"* a die that reports a different total than the one that was rolled is a serious trust problem even when the state is correct.

> [!NOTE]
> The overlay already carries an English→Persian consequence translation map (`dice_roll_overlay.dart:87-100`) and the server returns the authoritative `outcome` in the same payload. The fix is cheap: **stop computing the display total on the client at all** and render the server's `CheckResolution` once it lands, keeping the local roll purely as the animation trigger.

**Longer-term fix:** generate the Dart engine from the TypeScript, or reduce the client to a dice *presenter* that receives the resolution. A 198-line fork of a 1,913-line engine has no sustainable maintenance cost/benefit ratio.

---

## 5. Medium — LLM Output Validation

### 5.1 Zod Is Not on the LLM Boundary

Zod is imported in exactly **7 non-test files** — `types/world.ts`, `types/rpg.ts`, `types/story.ts`, `types/memory.ts`, `types/gameplay.ts`, `world/GenesisSchemas.ts`, `evals/judge.ts`. It is used for manifest validation, encounter writes, and judge reports.

It is **not** used to validate any model response. The Gemini boundary relies on `responseMimeType: 'application/json'` plus hand-written normalizers:

- `normalizeChoices` — `lib/providers/GeminiAdapter.ts:77-228`
- `normalizeExtractedMemories` — `:236`
- `normalizeEntity` — `lib/engines/world/ActionNormalizer.ts:179`
- `coerceWeave` — `lib/engines/narrative/storyWeaver.ts:156`
- `coerceToSagaManifest` — `app/api/studio/generate/route.ts:836`

The `schemaInstruction` strings at `generate/route.ts:376-527` are **prose in a prompt**, not enforced schemas. They read as API contracts but nothing validates against them.

> [!NOTE]
> This is a defensible choice, not a mistake — `responseMimeType: 'application/json'` plus aggressive normalization is a legitimate pattern, and the normalizers are genuinely thorough (`normalizeChoices` resolves stat aliases, binds unknown stats rather than dropping the choice, and *infers* a stat check from confrontational text when the model omits one). The gap is that the failure is silent when normalization misses: there is no record that a repair fired, so gradual model drift is invisible until a player sees it.
>
> **Cheap improvement:** emit a structured log whenever a normalizer actually mutates a payload (`normalizeChoices` returning `{ changed: true, reasons: [...] }`). The eval harness already asserts on raw payloads for exactly this reason (`evals/evaluator.ts:8-13`) — the same discipline belongs in production logs.

---

## 6. Medium — Performance & Resilience

### 6.1 Caching Is Aggressively Disabled

There is no Redis, no `unstable_cache`, no `revalidateTag`. Instead:

- **8 routes** declare `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
- Client fetches use `cache: 'no-store'` (`lib/play/api.ts:45`, `:70`; `StudioStoryContext.tsx:564`, `:609`)
- `next.config.ts:13` forces `no-store, no-cache` on every `/api/*` response

Defensible for a mutable, credit-metered play API. But it also applies to **`GET /api/play/stories`**, the catalog, which changes only on publish and is read by every player on app launch. The only real caches in the codebase are client-side (`diceAssetCache.preloadD20`, localStorage Studio drafts).

**Suggested split:** keep `force-dynamic` on `/api/play/action` and `/api/play/session` (session-scoped, must never be cached), and give the catalog a short `revalidate` keyed on a publish-time version. `World.worldBibleVersion` (`schema.prisma:14`) is already bumped on every lore write (`storyRepository.ts:500-514`) and is a natural cache key.

### 6.2 Heavy Generation Runs Synchronously In-Request

There is no queue (no BullMQ/SQS/worker). `POST /api/studio/generate` performs world genesis, saga synthesis, or story weaving — including 2–3 sequential model calls with 45-second timeouts ([`geminiClient.ts:115`](file:///d:/Code/StoryForge/web/src/lib/ai/geminiClient.ts#L115)) plus deterministic audit passes — all inside one HTTP request. On any serverless platform with a <60s limit this is a guaranteed timeout on the largest tasks.

**Fix:** move generation to a job table with a `PENDING/RUNNING/DONE/FAILED` status column; the Studio polls or subscribes. This also gives a natural place to enforce the per-user quota that 2.2 requires.

### 6.3 Failures Are Silent by Design

`getPrisma()` returns `null` when `ENABLE_DB !== 'true'` (`lib/db/client.ts:11`), which switches `SessionRepository` to a module-level `Map` and makes `StoryRepository` return `[]`, `null`, or `{isMock: true}`. The in-memory degradation is a genuinely good development affordance.

The problem is the failure path: repositories `console.warn` and return an empty result rather than throwing. `deleteWorld` returning `{ success: false }` is indistinguishable from a genuine validation failure. Combined with 2.3, a misconfigured production environment would serve a Studio that *appears to work* while persisting nothing.

**Fix:** throw on persistence failure in mutating paths; reserve empty returns for genuine "not found". Add a startup assertion that `ENABLE_DB=true` in production.

---

## 7. Medium — Maintainability

### 7.1 `StudioStoryContext.tsx` Is 2,754 Lines

`web/src/lib/context/StudioStoryContext.tsx` owns localStorage draft sync, server sync, world/story selection, publish-gate state, and every entity mutator consumed by `oracleActions.applyWorldChange`. It is the single largest file in the project after the bundled `bundle.js`, and it is the reason entity mutation cannot be tested without a React tree.

**Fix:** extract the persistence concern (localStorage draft + debounced server sync) into a dedicated `useStoryPersistence` hook. That alone removes several hundred lines and makes the mutators testable in isolation.

### 7.2 Committed Dead Code

- **`scratch/`** — 40+ ad-hoc debug scripts (`play_turn_3.js` … `play_turn_10.js`, `inspect_*.js`, `rerun_turn_4_clean.js`, `tap.js`, plus captured `*-tsc.txt` / `*-tests.txt` logs) are tracked in git. This inflates the knowledge graph (the `bundle.js` community in `graphify-out/` is partly an artifact of this pattern) and makes every repo-wide grep noisier.
- **Flutter** — `dice_roll_dialog.dart` (369 lines), `choice_pill.dart` (97), `story_catalog_dialog.dart` (276) are unreachable; nothing imports them. `ThreeDChoiceCard.fallbackStatId` (`three_d_choice_card.dart:17`) is never passed, so the stat badge silently hides when the model omits `requiredStatId` — contradicting the component's own doc comment at `:14-16`.

**Fix:** add `scratch/` to `.gitignore` and purge the three widgets.

### 7.3 `getAllStories(publishedOnly = false)` Is the Default

[`storyRepository.ts:220`](file:///d:/Code/StoryForge/web/src/lib/db/repositories/storyRepository.ts#L220) defaults to returning **unpublished** stories. The one caller that must be public — `GET /api/play/stories` — correctly passes `true`. The unsafe direction is the default, so any future caller that forgets the argument leaks the draft catalog.

**Fix:** invert the signature to `getAllStories({ publishedOnly = true })`, or split into `getPublishedStories()` / `getAllStoriesIncludingDrafts()`.

---

## 8. Medium — Test Coverage

### 8.1 What Is Covered

**Server: 55 `node:test` files**, discovered by `web/scripts/testAll.ts` and run with `npm test` (`tsx`). This is a real, working suite with good instincts — notably `evals/evaluator.ts:8-13`, which deliberately asserts on the **raw** model payload rather than the normalized output "because `normalizeChoices` would mask failures." That is exactly the right call and worth preserving.

> [!NOTE]
> `vitest` is a devDependency but every test file uses `node:test` / `node:assert`. The dependency is dead weight and mildly misleading — a contributor will reasonably expect `vitest` to be the runner.

**Client: 3 files, 229 lines.** `rpg_engine_test.dart` is the only meaningful one — 4 tests locking the baseline-relative modifier behaviour (baseline 3 → 0, baseline 5 cross-stat → +1/+0), which is genuinely subtle logic worth pinning. `creature_discovery_test.dart` has 2 model-parsing tests and 2 widget tests. `widget_test.dart` is a 14-line smoke test with no assertions beyond `find.byType(...)` returning one result.

### 8.2 What Is Not Covered

Zero tests exist for the highest-risk code in the repository:

| Untested | Why it matters |
| :--- | :--- |
| **All 19 API route handlers** | Findings A/B/C live entirely in route handlers. A single `assert 401` test per mutating route would have caught every one of them. |
| **Authorization / role gating** | The only 3 correctly-gated routes have no test proving the gate holds. |
| **`getAuthenticatedUser` / `verifyJwt`** | No test for a missing, malformed, or expired token. |
| **`GameSessionNotifier`** (742 lines) | Turn submission, the `holdNarrativeUpdate`/`applyPendingTurn` spoiler guard, equipment slot rules, `useConsumable` vitals. |
| **`ChoiceOption.requiresRoll`** | This is the gate that makes a choice diceless — a content bug here silently forces dice rolls into narrative beats. |
| **JSON parser defensive fallbacks** | `StoryStatSummary` accepts `baseValue ?? defaultValue ?? value` (`story.dart:85`); `targetSceneId ?? destinationSceneId` (`choice_option.dart:28`); `ChoiceOption` is the contract between the model and the dice. |

> [!CAUTION]
> The `targetSceneId` / `destinationSceneId` fallback deserves particular attention. `graphMigration.ts:54` performs a *permanent, one-time* migration renaming `destinationSceneId` → `targetSceneId` for existing manifests. The Flutter client still accepts the legacy key as a fallback. If the migration is ever re-run against a partially-migrated corpus, or if a new story is authored from a template predating the rename, the client is the only thing keeping those beats navigable — and it is untested.

### 8.3 The Structural Recommendation

The suite is well-suited to pure functions and poorly suited to the actual risk surface, which is **request-shaped**. The cheapest high-value addition is a route-level auth assertion suite — a table of `(method, path, expectedStatus)` for anonymous, `READER`, `AUTHOR`, and `ADMIN` principals, run against a real Postgres via the existing Docker Compose file. That single table would have surfaced findings A, B, and C as test failures rather than as an audit finding, and it would prevent regression as routes are added.

---

## 9. Remediation Priority

Fix in this order. **Steps 1–3 must ship as one change** — each is individually unsafe to defer once the others land.

| # | Action | Effort | Blocks |
| :--- | :--- | :--- | :--- |
| **1** | Gate all `/api/studio/*` mutations on `role ∈ {AUTHOR, ADMIN}` | S | — |
| **2** | Remove the `JWT_SECRET` fallback; throw in production | S | — |
| **3** | Fix CORS: explicit origin allowlist, no `*` with credentials | S | — |
| **4** | Add ownership to the repository layer (`Story.authorId → User.id`) | **L** | 5–9 |
| **5** | Require session ownership on `/api/play/session` and `/api/play/level-up` | M | 4 |
| **6** | Add a per-user rate limit + quota to the three LLM routes | M | 1 |
| **7** | Soft-delete + confirmation token for `deleteWorld`; un-default `publishedOnly` | M | 4 |
| 8 | `timingSafeEqual` in `verifyJwt`; drop the dead `vitest` dep | XS | — |
| 9 | Thread `rpgSystem` into the level-up stat baseline (2.6) | S | — |
| 10 | Render the server's `CheckResolution` in the dice overlay | M | — |
| 11 | Normalizer-repair structured logging | S | — |
| 12 | Extract `useStoryPersistence` from `StudioStoryContext` | M | — |
| 13 | Route-level auth assertion suite (8.3) | M | prevents 1–7 regressing |
| 14 | Job table for heavy generation; catalog `revalidate` | **L** | — |
| 15 | `scratch/` → `.gitignore`; delete 3 orphan widgets | XS | — |

**Single highest-value non-security change:** item 10. It is small, it removes a whole class of "the dice lied to me" bug, and it directly protects the product's core promise.

---

## 10. What Is Genuinely Strong

A closing note, because an audit that lists only debt misrepresents the codebase.

- **The narrator/engine separation is real, not aspirational.** It is enforced at four independent layers, fails closed with a 503 rather than persisting bad canon, and the injectable model seam means the eval harness runs the *exact* production path (`narrativeTurn.ts:21-22` deliberately excludes auth, credits, and `GameEngine` so both callers share one code path).
- **Deterministic repair over model repair.** `normalizeChoices` rescuing stat drift, `coerceWeave` remapping malformed output, `mergeFactionRelationsDetailed` merging partial relation sets — the system prefers fixing output locally and re-prompts only at three explicit, documented score thresholds (85 / 70 / 75).
- **Scope-tier lore pruning** (`worldContext.ts:362-471`) is the correct answer to the long-saga context problem, and the 4-tier budget table is a genuinely mature piece of design.
- **The defense-in-depth knowledge boundary** — `ActionValidator.detectUndiscoveredSecret` blocks free-text actions, the `isPresetChoice` bypass trusts system-generated choices, and `sanitizeChoices` *still* filters them at render time so leaking text never reaches a button — is the kind of layering most projects skip entirely.
- **Bilingual by construction.** Parallel EN/FA branches with ZWNJ, Arabic-Yeh unification, and diacritic stripping threaded through name matching, validation regexes, and prompt assembly. This is a large, unglamorous correctness surface handled properly.
- **Fail-closed on missing credentials.** `isMock` output is never persisted. A missing API key produces a clean 503, not corrupted canon.

The gap between this and the findings above is not a design gap. It is a **perimeter** gap — the discipline applied inside the engine was never applied to the edge.

---

## 11. Remediation Log

**Shipped September 25, 2026.** Findings A, B, C, D, plus the §2.5 session IDOR and §2.6 stat-inflation issues. Ordering was load-bearing — see the note at the end of this section.

### What changed

| Finding | Fix | Key files |
| :--- | :--- | :--- |
| **A** — 9 ungated routes | `requireStudioWrite` guard on **every** `/api/studio/*` verb, including the `GET`s that leaked unpublished drafts. Pure decision function `decideStudioWrite` extracted so it is testable without a DB. | `lib/auth/studioAuth.ts` (new), 7 route files |
| **B** — CORS wildcard | Origin allowlist via `ALLOWED_ORIGINS`; `Access-Control-Allow-Credentials` emitted **only** alongside a concrete allowlisted origin. Wildcard removed from `next.config.ts` entirely. Falls back to localhost, never to `*`. | `lib/cors.ts`, `next.config.ts` |
| **C** — no ownership | Nullable `Story.authorId` FK mirroring the existing `worldId` pattern; `canModifyStory` enforces owner-or-ADMIN, with `NULL` (legacy) rows staying admin-editable. Identity threaded through `saveStory`. | `prisma/schema.prisma`, migration `20260925120000`, `storyRepository.ts` |
| **D** — JWT secret | Committed fallback deleted. Missing `JWT_SECRET` is fatal in production; dev falls back to a random per-process secret with a warning. `verifyJwt` now uses `timingSafeEqual`. | `lib/auth/jwt.ts` |
| **§2.5** — session IDOR | `crypto.randomUUID()` session ids (was ~31 bits from `Math.random()` + timestamp — enumerable in hours). New `SessionRepository.getSessionForUser` chokepoint applied to all 4 play-session call sites. `body.userId` identity spoofing removed. Guest-session claim now requires `userId: null`, so an already-owned playthrough can no longer be re-parented by a new signup. | `sessionRepository.ts`, `play/session`, `play/action`, `play/level-up`, `auth/login`, `auth/register` |
| **§2.6** — stat inflation | The budget check and apply loop now agree: positive integers only, stat and ability ids validated against `rpgSystem`, new stats created at `resolveStatBase` instead of a hardcoded `10`. The `getStoryById` projection was also dropping `universalBaseValue`, which would have silently defeated the baseline fix. | `progressionEngine.ts`, `vitalScaling.ts`, `storyRepository.ts` |
| **Client dice** | The overlay now renders the **server's** `CheckResolution`; the client engine only picks the die's target face. Added the missing `environmentalModifier` field so the displayed equation adds up. | `dice_overlay_provider.dart`, `dice_roll_overlay.dart`, `main.dart`, `game_state.dart` |

**Two blockers found during implementation, not in the original audit:**

- **Logout never worked.** `AuthContext.logout` cleared the cookie via `document.cookie`, which cannot delete an `httpOnly` cookie — so a "logged out" user remained authenticated on every server-side guard. This had to ship **before** the guards, or all of finding A would have been bypassable by anyone who had ever logged in. Fixed with a new `POST /api/auth/logout`.
- **The inflation bug was worse than reported.** The budget summed a *signed* total while the apply loop only acted on `b > 0`, so `{might: 100, agility: -99}` cost 1 point and granted +100 might — reachable unauthenticated. Reachable only because §2.5 was also open.

### Ordering constraints (do not reorder)

1. Logout **before** any auth guard (see above).
2. JWT secret **in the same change as** finding A — the committed fallback would otherwise turn the new guards into role forgery.
3. CORS **last** — reflecting `Origin` before the authz work would have credentialed every origin on the internet.
4. Guest-migration `userId: null` guard **before** ownership checks — otherwise the ownership check is itself the exploit.

### Verification

- **Suite:** 530 → **640** server tests, 9 → **18** client tests, all passing. Typecheck clean; `flutter analyze` clean in `lib/` (4 remaining issues are pre-existing in the bundled `flutter_poolakey`).
- **Migration** applied against live Postgres; 1 story / 21 sessions / 17 worlds intact, `authorId` nullable as intended, no backfill attempted.
- **`bootstrap:admin`** exercised across all 6 paths (missing env, invalid phone, create, re-run, existing non-admin without force, with force). Note: `prisma/seed.ts` is a no-op, so this script is the only way to create the first admin — **run it before deploying the guards or every operator is locked out.**
- **Live HTTP** against a running server: all Studio verbs `403` anonymous *and* as READER; `200` as AUTHOR. Session IDOR `404` cross-user (including authenticated). `PATCH /api/play/session` `404`. Inflation payload `400` with `might` unchanged at 15. Guest-session steal refused, ownership unchanged. CORS echoes allowlisted origins only. Logout clears the cookie and `/api/auth/me` then `401`.

### Still open

Findings **E** (client/server engine drift — mitigated, not eliminated: the Flutter `rpg_engine.dart` is still a hand-maintained fork and will drift again), **F** (Zod absent at the LLM boundary), **G** (no caching/queue), **H** (silent repository failures), **I** (2,754-line `StudioStoryContext`), **J** (no DB-backed route tests), **K** (committed `scratch/` and 3 orphan widgets).

**Not addressed, worth a ticket:** the Flutter client keeps `sessionId` in memory only, so every app restart orphans the save and mints a new session. That is a pre-existing data-loss bug, and it means the §2.5 ownership binding has no stable handle for a guest to hold. The web client already does this correctly (`page.tsx:61-99`) and is the reference to port.
