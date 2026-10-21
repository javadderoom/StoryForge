# Plan 20: Studio Save Pipeline — Idle Autosave & the Incremental API

Current state of the Studio's write path: **every change fired a full-manifest network request.** Typing one character in the location editor, nudging one pin on the Cartographer, or toggling one layer each produced a `POST /api/studio/story` carrying the entire story manifest (the production story's manifest is ~6,100 lines of JSON). The author asked for a better API system; the decision recorded here is deliberately incremental.

> **Decision:** no sockets for writes. Batch the edits, then send **one** request once the author has paused.

---

## 1. Problem Diagnosis

### 1.1 What actually happens today

`web/src/lib/context/StudioStoryContext.tsx` → `persistToStorage()` (L1165) was:

```ts
localStorage.setItem(key, JSON.stringify(newStory));  // local draft — good
setHasLocalDraft(true);
saveToServer(newStory);                               // ← network request PER CHANGE
```

Every mutation in the Studio funnels through `persistToStorage` (locations, NPCs, factions, artifacts, the Cartographer's terrain/pins/routes, arc stages, story meta). So one keystroke = one request = one full manifest upload.

Consequences:

| Symptom | Cause |
| :--- | :--- |
| Typing is laggy on large stories | Each keystroke serializes and uploads ~600 KB of JSON |
| Server churn | 200 keystrokes = 200 uploads of the same document |
| Lost edits | Last write wins — two tabs (or a slow upload racing a newer one) overwrite each other |
| Version churn | `worldBibleVersion` bumps on every request, so in-flight sessions re-pin constantly (Plan 17 §4.4) |
| Publish-gate noise | The gate re-audits the whole world on every keystroke |

### 1.2 Why not sockets

WebSockets were considered and rejected **for writes**:

- The Studio is a Next.js route-handler app; holding WebSocket connections needs a custom server (or a separate realtime service), which breaks the current deployment model (`next start` behind the existing proxy).
- Write traffic over a socket is *harder*, not easier: no HTTP retries, no status codes, no idempotency, and a dropped connection mid-save is ambiguous.
- The actual problem is request *volume*, not transport. One request per pause solves it.

Sockets remain interesting for a different job — **server→client invalidation** (see §5) — where SSE is enough.

---

## 2. Shipped: Idle Autosave (this change)

### 2.1 The rule

> **Save when there have been no changes for 5 seconds.**

Every change resets an idle timer; when the author pauses, the newest state is persisted once. Two safety valves:

- **Max wait (60 s):** a continuous editing session still persists — the pending value is saved even while changes keep arriving, so work is never stranded in memory.
- **No overlapping saves:** a change that lands while a save is in flight is queued and persisted by the next idle window.

### 2.2 Architecture

`web/src/lib/utils/idleAutosave.ts` — a pure, framework-free controller (8 unit tests, injectable timers):

```ts
createIdleAutosave<T>({ idleMs, maxWaitMs, save, onError, now?, setTimeoutFn?, clearTimeoutFn? })
  → { schedule(value), flush(), cancel(), isPending(), isSaving() }
```

Wiring in `StudioStoryContext.tsx`:

| Concern | Implementation |
| :--- | :--- |
| Local draft | Written **immediately** on every change (crash-safe) — unchanged |
| Network write | `persistToStorage` now calls `autosave.schedule(newStory)` instead of `saveToServer(newStory)` |
| Explicit Save (header, publish) | `saveToServer()` cancels the scheduled autosave, then writes at once |
| Story switch | The load effect flushes the pending autosave before the pointer moves on |
| Save failure | Surfaced as an error toast; the local draft is kept, so nothing is lost |

### 2.3 Race safety

A change that lands *during* an in-flight save must not lose its local draft: on success the draft is cleared **only when it still matches the manifest that was just saved** (`StudioStoryContext.saveToServerRaw`). Otherwise the draft stays and the newer change is saved by the next window.

### 2.4 Effect

| Scenario | Before | After |
| :--- | :--- | :--- |
| Typing a 200-char description | 200 requests × ~600 KB | 1 request |
| Dragging 30 pins | 30 requests | 1 request (5 s after the last drag) |
| Toggling 12 layers | 12 requests | 1 request |
| Editing for 10 minutes straight | 100s of requests | 1 request per 60 s (max-wait cap) |

---

## 3. What Is Still Missing (the "better API system")

Debouncing fixes the request *rate*. Three structural problems remain:

### 3.1 Payload size — the whole manifest per save

`POST /api/studio/story` carries the entire manifest to change one location. The manifest is a single JSON column (`stories.manifest`), so the server cannot patch a JSON sub-tree with SQL — but it *can* merge at the application level.

**Proposed endpoint — `POST /api/studio/story/patch`:**

```jsonc
{
  "storyId": "story_mt4ofllt",
  "baseVersion": 42,              // the version the client edited
  "changes": {
    "worldBible.locations": { "op": "replace", "value": [ /* ... */ ] },
    "worldBible.mapData":    { "op": "replace", "value": { /* ... */ } }
  }
}
```

Server behaviour:

1. Load the stored manifest.
2. Apply each change by **path** (`worldBible.locations`, `worldBible.mapData.terrainFeatures`, `title`, …) — a whitelist of writable paths, never an arbitrary deep merge.
3. Compare `baseVersion` with the stored `worldBibleVersion`:
   - equal → apply, bump the version, return `{ version }`;
   - stale → **409 Conflict** with the changed paths, so the client can rebase instead of silently overwriting another tab's work.
4. Fall back to the full-manifest endpoint when the diff cannot be computed safely.

This turns "last write wins" into "detect and reconcile", which is the only way two tabs can coexist.

### 3.2 Version churn

`worldBibleVersion` currently bumps on every lore write. With autosave the rate is sane, but a semantic split is still right:

- **`worldBibleVersion`** — bumped when *canon* changes (a published story, a shared-world lore edit). In-flight sessions pin to it (Plan 17 §4.4) and must not re-pin because an author typed a character.
- **`draftVersion`** — bumped on every save. Used for optimistic concurrency (§3.1) and for cross-tab invalidation (§5).

### 3.3 Duplicate work per save

The publish gate re-audits the entire world on every save (`canPublish` in `api/studio/story`). With autosave that is now bounded, but the gate only needs to run when the story is *published* or when a collection relevant to it changed.

---

## 4. Client-Side Diffing

The Studio already keeps the full manifest in memory and knows the last server-synced snapshot (`lastServerSynced`). The diff is therefore cheap:

```
dirtyPaths = diffPaths(lastSyncedManifest, currentManifest)   // top-level + one worldBible level
```

Rules:

- `worldBible.locations`, `worldBible.npcs`, `worldBible.mapData`, `worldBible.tradeRoutes`, … are leaf paths (replace whole collection).
- `title`, `tagline`, `synopsis`, `initialSceneId`, `engineTier`, `published` are story-level leaves.
- Anything the differ cannot classify confidently → **full manifest** (safe default).

---

## 5. Cross-Tab Invalidation (where sockets would fit)

With optimistic concurrency (§3.1) a second tab no longer loses work — it gets a 409 and rebases. Live *push* is then a convenience, not a correctness requirement, and **SSE** is the right transport (no custom server, works with the existing auth/CORS model, auto-reconnects):

```
GET /api/studio/story/stream?storyId=story_mt4ofllt
→ event: version   data: {"version": 43, "paths": ["worldBible.locations"]}
```

The client compares `version` with its own and refetches the changed paths. A WebSocket would be justified only if the Studio later needs bidirectional collaboration (live cursors, two authors editing the same beat), which it does not today.

---

## 6. Rollout

1. **Phase 1 (shipped)** — idle autosave: 5 s idle, 60 s max wait, local draft immediate, explicit save still immediate.
2. **Phase 2** — `POST /api/studio/story/patch` with a path whitelist + `baseVersion` conflict detection; the client falls back to the full manifest when unsure.
3. **Phase 3** — split `worldBibleVersion` (canon) from `draftVersion` (concurrency).
4. **Phase 4** — SSE invalidation for multi-tab authoring.

**Commit policy:** land code + plan in commits relative to each phase; commit locally at completion; **never push automatically** (repo rule).

---

## 7. Acceptance Criteria

1. Editing a text field for 30 seconds issues **one** `POST /api/studio/story` (plus one per 60 s cap under continuous typing) — verified in the browser's Network tab.
2. The local draft is written on every change; a hard reload restores unsaved work.
3. The explicit Save button still writes immediately and clears the "unsaved" indicator.
4. A failed autosave keeps the local draft and surfaces an error.
5. `npm run test` passes (idle autosave unit tests included).
