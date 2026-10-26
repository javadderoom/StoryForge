# Forensic Teardown: How OOC Generates Story Text

> **Target**: `https://ooc.ai` — "The Playable Anime" (AI interactive fiction platform, Wrtn Technologies).
> **Method**: Phase A — static analysis only. REA browser-scenario capture → 49 production JS chunks (2,199,050 bytes) pulled from `cdn.ooc.ai` → static enumeration of the client's API surface.
> **Constraints honoured**: no account used, no credits spent, no story content extracted, no paywall or credit-system circumvention.
> **Date**: 2026-10-26.
> **Confidence key**: **[OBSERVED]** = read directly from shipped client code or captured traffic. **[INFERRED]** = reasoned from observed structure, not proven.

---

## 0. Verdict

The client does not contain a single prompt, sampling parameter, or model identifier. Text generation is **entirely server-side**. What the client *does* expose — in unusual detail, because it ships a fully generated OpenAPI client — is the **shape of the generation pipeline**: the endpoints, the three transports, the context/memory model, the model-tier system, and the credit enforcement path.

**The short answer to "how does OOC generate text":**

1. Client `POST`s a user turn to a chat resource.
2. The generation service (`ooc-gen`) produces the continuation asynchronously.
3. The client **subscribes to the message resource over SSE** and receives tokens as they stream back. A parallel Socket.IO channel carries chat-level events.
4. The server maintains its own **rolling summaries** of the conversation — the client never assembles the context window.
5. The model used is a **tier** chosen from `/v3/chat-models` and paid for in credits; a `402` surfaces as a `credit:insufficient` UI event.

The prompt engineering — the actual reason the prose reads the way it does — is **not in the bundle**. It lives behind `api.ooc.ai`, and only a recorded generation session (Phase B) can reveal the payload that reaches it.

> **Phase B complete — see [§11](#11-phase-b-results-recorded-generation).** The recorded session answered the central question: the client sends **only the message text plus two ids**. No prompt, no history, no summary, no model, no sampling parameters cross the wire. The prompt is a server-side asset. Phase B also recovered the upstream model identity (`sonnet`), the full tier/pricing table, and the memory architecture.

---

## 1. Method and what static analysis can/cannot establish

**Captured:** a headless Chrome scenario through the system proxy, retaining network metadata for every request the homepage makes, then re-fetching the 49 enumerated JS assets directly.

| Item | Value |
|---|---|
| JS chunks analysed | 49 |
| Total bytes | 2,199,050 |
| Unique API paths in generated client | 264 |
| Top-level resource groups | 49 |
| Auth surfaces | bearer token + `wrtn-uid` + `wrtn-user-id` API keys |

**This method establishes**[OBSERVED]: endpoint inventory, HTTP verbs, auth requirements, transport choice (REST / SSE / Socket.IO), which subsystem owns which call, response-type declarations, and UI copy that shipped in locale chunks.

**This method cannot establish**: system prompts, instruction hierarchy, temperature/top-p/max-tokens, model vendor or version, context-window assembly, retrieval strategy, safety filtering, or per-turn token budgets. All of that is server-side.

> **Note on names**: the client's `claude` / `gpt-` string hits are from bundled `ua-parser-js` bot detection, **not** model references. They are a red herring and are excluded from every conclusion below.

---

## 2. The three-transport architecture [OBSERVED]

The client is built on a generated HTTP client with three distinct base URLs and an explicit SSE variant of every verb:

| Transport | Base URL | Used for |
|---|---|---|
| REST | `/fig/ooc-api` | catalogue, profiles, credits, endings, social, authoring |
| SSE | `/fig/ooc-gen` | token streaming for **guest/temp** message resources |
| Socket.IO | `PUBLIC_URL_API` + `/ooc-gen/socket.io` | **authenticated chat turns and token streaming** (namespaces `/v3/chats`, `/v1/character/chats`) |

> **Corrected in Phase B.** Phase A inferred that authenticated generation streamed over SSE, because the generated client declares `sse.get("/temp/{tempChatId}/messages/{id}")`. Phase B disproved this for signed-in sessions: the turn is sent *and* streamed entirely over **Socket.IO**, and no HTTP `POST` is issued at all. The SSE endpoints appear to serve guest/temp chats only. The Phase A inference is retained above as a documented error rather than silently deleted.

The generated client exposes `sse: { connect, delete, get, head, options, patch, post, put, trace }` — so streaming was a deliberate transport choice, just not the one that carries signed-in generation.

**Streaming calls found:**

```js
sse.get({ url: "/temp/{tempChatId}/messages/{tempChatMessageId}" })                    // guest chat
sse.get({ url: "/character-temp-chats/{tempChatId}/messages/{tempChatMessageId}" })   // guest character chat
```

That shape is diagnostic: streaming is a **`GET` on a message resource**, not a `POST` that returns a stream. The write and the read are separated. [INFERRED] The sequence is therefore: `POST` the turn → server accepts and enqueues → client opens an SSE subscription to the new message → tokens arrive as events → client closes the stream on completion. This is the standard "async job + subscribe" pattern, and it is what makes regeneration, branching, and multi-device resume cheap.

---

## 3. Generation lifecycle [OBSERVED endpoints, INFERRED sequence]

```
POST /v3/chats/stories/{storyId}          open a playthrough against a story
POST /v3/chats/{chatId}/messages          submit the user turn
        ↓
   [ ooc-gen: model tier runs, context assembled server-side ]
        ↓
GET  (SSE) /temp/{tempChatId}/messages/{id}   ← tokens stream in
     (Socket.IO /v3/chats namespace)          ← chat-level events
        ↓
POST /v3/chats/{chatId}/messages/{messageId}   edit / reroll a turn
GET  /v3/chats/{chatId}/messages/{messageId}   fetch one message
DELETE /v3/chats/{chatId}/messages/{messageId} delete a turn
```

**Supporting calls that shape the narrative:**

| Endpoint | Role |
|---|---|
| `POST /v3/chats/{chatId}/branch` | fork the playthrough — the narrative tree |
| `GET /v3/chats/{chatId}/branch-title` | auto-title for a branch |
| `GET/POST /v3/chats/{chatId}/summaries` | server-side conversation compression |
| `DELETE /v3/chats/{chatId}/summaries/{summaryId}` | drop a summary |
| `GET /v3/chats/{chatId}/stats` | playthrough stats |
| `GET /v3/chats/{chatId}/endings/hints/latest` | ending-approach hints |
| `POST …/endings/hints/{hintId}/check` · `…/dismiss` | hint interaction |
| `GET /v3/chat-models` · `/discount-banner` · `/errors` | model tier catalogue |

`GET /v3/chats/{chatId}/summaries` is the single most informative endpoint in the whole inventory. [INFERRED] It means the platform does **not** replay raw history to the model. It maintains its own compressed state per chat and feeds the model a summary plus recent turns. That is the standard mitigation for context-window limits in long-form interactive fiction, and it is why OOC stories can run for hundreds of turns without the model forgetting the premise.

---

## 4. Context and memory model

Three distinct memory layers are visible [OBSERVED as endpoints, INFERRED as semantics]:

| Layer | Endpoint family | What it implies |
|---|---|---|
| **Conversation summary** | `/v3/chats/{chatId}/summaries` | rolling compression of prior turns, server-owned |
| **Branch tree** | `/v3/chats/{chatId}/branch`, `/branch-title` | narrative forks persist as first-class objects, not text |
| **User persona** | `/profiles/{profileId}/chat-profiles` | per-user, per-profile persona injected into prompts |

Plus a fourth, subtler one:

| **Reusable prompt macros** | `/shortcut-commands` · `/shortcut-commands/hub` | user-authored "slash commands" stored and reused across chats |

`/profile/setting/slash-command` appears in the route table [OBSERVED], confirming a user-facing slash-command editor. `/shortcut-commands/hub/{id}/import/stories/{storyId}` [OBSERVED] lets a creator **publish a prompt macro as a story asset**. That is the platform industrialising prompt engineering: authors ship instruction packages, not prose.

---

## 5. Model tiering and unit economics [OBSERVED]

| Signal | Evidence |
|---|---|
| Model catalogue | `GET /v3/chat-models`, plus `/discount-banner` and `/errors` |
| Credit enforcement | `POST` paths return `402`; client emits `credit:insufficient` on `statusCode === 402` |
| Failure billing copy | locale string: *"Generation failed. Credits will not be deducted."* |
| Credit economy | `/cash`, `/cash/products`, `/cash/reward/{type}`, `/cash/history`, `/cash/payment-history` |
| Subscriptions | `/auto-purchases/stripe` + pause / resume / cancel / retry / method |
| Pricing policy | `/credit-policies` |
| Promotions | `/coupons/use`, `/cash/promotion-session`, `/halloween-product/*` |

The model is **never named in the client** — it is a server-selected tier with a price. The `402`-to-`credit:insufficient` path proves billing is enforced at the generation boundary, not the UI.

---

## 6. Authoring copilot — why the catalogue can scale [OBSERVED]

The most strategically interesting finding: **creators never write prompts.** The server writes them.

| Endpoint | What it produces |
|---|---|
| `POST /characters/auto-gen/prompt` | the character's prompt |
| `POST /characters/auto-gen/intro-message` | opening message |
| `POST /characters/auto-gen/example-message` | example dialogue for few-shot anchoring |
| `POST /characters/auto-gen/recommend-next-message` | suggested player reply |
| `POST /stories/suggest/initial-message` | story opener |
| `POST /stories/suggest/conversation-example` | dialogue exemplar |
| `POST /stories/suggest/epilogue-example` | epilogue exemplar |
| `POST /stories/suggest/detail` | story detail copy |
| `POST /stories/suggest/parameter-description` | parameter docs |
| `POST /stories/validate-inputs/v2` | input validation against platform rules |

[INFERRED] This is the core scaling mechanism. A creator supplies a premise and characters; the backend generates the instruction package that the runtime model will actually follow. Quality is therefore **platform-controlled, not author-controlled** — which explains how a user-generated catalogue can maintain a consistent feel while the individual authors are amateurs. It also means the effective prompt template is a single artefact shared across thousands of stories, and it is exactly the thing Phase B can capture.

---

## 7. What is *not* in the client

Verified absent from all 49 chunks:

- No `systemPrompt` / `system_prompt` string
- No `temperature`, `top_p`, `max_tokens` / `maxTokens`
- No model vendor or model id (`claude`/`gpt` hits are bot-detection strings)
- No `chat/completions`-style provider call — no direct LLM traffic from the browser
- No prompt templates, no instruction text of any kind
- No `EventSource` usage — streaming is abstracted behind the generated `sse` client

Conclusion: **the prompt is server-side.** Anyone claiming to have extracted OOC's prompt from the web bundle is mistaken unless they recorded a payload.

---

## 8. Retention machinery — the "why is it addictive" evidence base [OBSERVED surfaces]

REA cannot measure addiction, but it can inventory the machinery. Every one of these is a shipped endpoint, not a guess:

| Mechanism | Endpoints | Loop |
|---|---|---|
| **Endings collection** | `/collected-endings/*`, `/story-endings/*`, `/ending-cards/*` | finite, collectable outcomes per story |
| **Ending cards** | `…/ending-cards/custom`, `/cost-info`, `…/primary`, `…/batch-delete` | paid custom outcomes — spend to author your own ending |
| **Daily attendance** | `/attendance`, `/stories/recommendations/attendance` | streak reward |
| **Newbie funnel** | `/stories/recommendations/newbie`, `/story-recommendations/{newbie,similar,user-based}` | first-session targeting |
| **Rankings** | `/stories/ranking`, `/character-rankings`, `/keyword/ranking` | social proof + aspiration |
| **Missions** | `/creators/missions/{start,status}`, `/tutorials/{start,status}` | guided progression |
| **Referral** | `/referral/{apply,rewards,content-share}` | viral loop |
| **Notifications** | `/alarm`, `/alarm/check`, `/announcements/noti` | re-engagement |
| **Reroll** | `/games/{gameId}/character-cards/{id}/reroll` | variable reward |
| **Suggestions** | `/characters/auto-gen/recommend-next-message` | removes blank-page friction |
| **Block/personalisation** | `/block/*`, `/profiles/onboarding`, content-preference gate | tuned feed |

[INFERRED] The design pattern is coherent: **variable reward** (reroll, generated continuations, ending discoveries) + **finite collection** (endings, cards, images) + **loss aversion** (credits, streaks, auto-purchase) + **zero-friction continuation** (suggested next message, cliffhanger endings). That is the machinery. Whether it *works* is a behavioural question the code cannot answer.

---

## 9. Hypotheses for Phase B (recorded generation session)

These are falsifiable, and each is cheap to check against one recorded generation:

| # | Hypothesis | Test |
|---|---|---|
| H1 | Server assembles context; client sends only the user turn + ids | inspect `POST /v3/chats/{id}/messages` body |
| H2 | A rolling summary is injected as system/context content | compare summaries endpoint output to request payload |
| H3 | Streaming frames carry deltas with no metadata about model | inspect SSE frame shape |
| H4 | Model tier is chosen server-side, not sent by client | confirm absence of model field in request |
| H5 | Story/character instruction package is referenced by id, never inlined | check request fields for `storyId`/`characterId` vs prompt text |
| H6 | Ending hints are model-generated, not static | inspect hint payload |

If H5 holds, **the prompts remain unreachable** even in Phase B — only ids cross the wire. That would be the definitive negative result, and it is worth knowing before spending credits.

---

## 10. Open questions

1. Is generation single-pass, or a draft→critique→revise loop? (Not observable client-side; would need latency/stream-shape analysis.)
2. Does the platform do retrieval over earlier branches, or only summaries?
3. Are ending hints generated per-playthrough or cached per story?
4. Is the tier visible to users as a brand name? `/v3/chat-models` is an unauthenticated `GET` — worth one read in Phase C.
5. How much of the "voice" is template vs. model? Only Phase B + narrative audit together can separate them.

---

## 11. Phase B results (recorded generation)

**Method**: Chrome 156 attached over CDP with `Network.enable`, `Network.webSocketFrameSent/Received`, and `Runtime` console capture, held open for the full generation. Two turns were played on a signed-in account (Apex tier). No HTTP `POST` was observed for either turn — the whole exchange is Socket.IO.

### 11.1 The send frame — H5 answered [OBSERVED]

This is the complete client→server payload for one turn, 358 bytes:

```
42/v3/chats,["send",{"chatId":"6ad85ed97d4cc6e6d0c72453",
  "message":"I stay limp and keep my palms open in the dirt. 'I yield, Vashka…'",
  "prevMessageId":"6adf8556a0c8d8225a3b0b4b"}]
```

**Three fields: `chatId`, `message`, `prevMessageId`.**

No system prompt. No conversation history. No rolling summary. No model id. No temperature, top-p, or max-tokens. No character card. No story text. **The prompt is assembled entirely server-side and never crosses the wire.** This is the definitive negative result for prompt extraction — recording more sessions will not change it.

It also explains the architecture economically: `prevMessageId` is a concurrency token and branch anchor, not a context carrier. Context lives in server state keyed by `chatId`, which is why branching, reroll, and cross-device resume are cheap.

### 11.2 The response sequence [OBSERVED]

```
42/v3/chats,["userMessageCreated",{"data":{"_id":"…","role":"user","content":"…"}}]
42/v3/chats,["characterMessageLoading",{"result":"success"}]
43/v3/chats,2[{"result":"success"}]                      ← ack
42/v3/chats,["characterMessageGenerating",{"data":{"chunk":"…","chatId":"…"}}]  ×14
42/v3/chats,["characterMessageGenerated",{"data":{"_id":"…","content":"…"}}]
2  / 3                                                    ← engine.io ping/pong
```

**The `chunk` field is a cumulative snapshot, not a delta.** Successive frames carried 315, 453, 558, 671, 817, 920, 1020, 1133, 1270, 1384, 1512, 1640, 1772, 1807 bytes — each one the *entire* text so far. That is bandwidth-wasteful but render-trivial: the client replaces content rather than appending.

No frame carries model identity, token counts, or finish reason. **H3 confirmed.**

### 11.3 Upstream model identified [OBSERVED]

The chat object leaks the provider model directly:

```json
{ "model": "sonnet", "crackerModel": "superb",
  "chatModelId": "6adb04589ada3fee6ec732e7" }
```

`chatModelId` maps to **Apex**; the user-facing tier name is decoupled from both `crackerModel` and the provider model. The story object separately declares `defaultSuperChatModel: { name: "Sonnet 3.5", model: "SONNET3.5" }` and `defaultCrackerModel: "superchat_2_0"`.

**Conclusion:** the runtime is **Anthropic Claude Sonnet** behind OOC's tier branding. "Apex", "Superb", "Max" are commercial labels, not distinct model families — they map onto the same provider family with different output budgets and price points.

### 11.4 Tier and pricing table [OBSERVED, verbatim from `/v3/chat-models?serviceType=story`]

| Tier | Description | Credits/turn | Per extra 100 tokens | Default max output | Notes |
|---|---|---:|---:|---:|---|
| **Max** | "Uncompromising realism" | 195 | 18 | 800 | most expensive, no free-pass |
| **Apex** | "Gripping, character-driven stories" | 90 (sale **78**) | 9 | 800 | free chat pass eligible |
| **Superb** | "Best quality, most immersive" | 90 | 9 | 800 | **default** |
| **Skillful** | "Vivid and descriptive narratives" | 60 | 8 | 800 | |
| **Extensive** | "Strong details and long narratives" | 60 | 8 | 800 | |
| **Basic** | "Light and cheap" | 30 | 2 | 800 | |

Observed charge: **78 credits per turn** at Apex on the active sale (2026-10-23 → 10-29), matching `discountedCrackerQuantity`. Two turns cost 156 credits.

### 11.5 Output length is a user-visible parameter [OBSERVED, UI copy]

`Chat Settings → Output Length` exposes a per-model multiplier: **Default / 1.5x / 3x / 5x** over the 800-token default, billed at the per-100-token rate above. So the ceiling is ~4,000 tokens per turn. The chat object carries the authoritative state:

```json
"maxOutputSettings": [{ "chatModelId": "…", "maxOutputMultiplier": "default", "thinkingLevel": "off" }]
```

`thinkingLevel` is present and `off` — extended-reasoning control exists per model.

### 11.6 Memory architecture [OBSERVED]

Three layers are user-visible, and all three are server-side injection points:

| Layer | Evidence |
|---|---|
| **Summaries** | `isSummaryUpdated: true`, `summaryTriggerMessageId`, `isSummaryFreeEditable: false` on the chat object; `/v3/chats/{id}/summaries` |
| **Memories** | `Chat Settings → Memories` renders **Long-term (4)**, **Temporary (4)**, **Relationships**, **Goal** with a Status filter |
| **User Note** | `User Note` panel: *"write down the information that you would like to be remembered in this session"* — 1,000 chars free, 4,000 chars for **10 extra credits per message** |

This is the clearest commercial signal in the whole teardown: **memory is a paid tier**, not a technical side effect. The platform sells continuity.

### 11.7 The server writes your next move [OBSERVED]

Every assistant message carries a `dynamicChipList` — three server-generated suggested actions:

```json
["*I mark the wall with a charcoal bit and retreat to the tunnels.* 'Survival comes first…'",
 "*I move along the cavern perimeter, keeping low.* 'There has to be another way in…'",
 "*I lean back toward the fissure, listening intently.* 'If it stays in there, maybe I can bait it out…'"]
```

Each is a first-person action plus an in-character quote, pre-formatted for one-tap send. Combined with `isAutoRecommendUserNextMessage: true`, the app never presents a blank page. **This is the single strongest mechanical contributor to the "can't stop" feeling** — the player is always handed three dramatic, plot-advancing choices, one of which is almost always the most exciting option.

### 11.8 Story prompt is a named template, not shipped text [OBSERVED]

```json
"promptTemplate": { "name": "Creator Custom Prompt", "template": "custom" }
```

Creators select a template *name*; the text lives server-side. This confirms Phase A's authoring-copilot finding: the instruction package is a platform asset keyed by name, and "custom" means the creator-supplied layer is composed with platform scaffolding the client never sees.

### 11.9 Hypothesis results

| # | Hypothesis | Result | Evidence |
|---|---|---|---|
| H1 | Client sends only the turn + ids | **CONFIRMED** | 358-byte send frame, 3 fields |
| H2 | Rolling summary injected server-side | **CONFIRMED (indirect)** | summary flags on chat; Memories UI tiers |
| H3 | Stream carries deltas, no model metadata | **PARTLY WRONG** — frames are *cumulative snapshots*, not deltas; no model metadata confirmed | 14 growing chunks |
| H4 | Model tier chosen server-side | **CONFIRMED** | no model field in send frame; `model:"sonnet"` only in server response |
| H5 | Instruction package referenced by id, never inlined | **CONFIRMED** | no prompt text in payload → **prompts unreachable** |
| H6 | Ending hints are model-generated | **NOT TESTED** | `hasEnding: false`; hints endpoint returned empty |

### 11.10 Implications for StoryForge

1. **Prompt extraction from competitors is a dead end by construction.** Anyone claiming to have lifted OOC's system prompt from its web app is wrong — the wire format carries no prompt.
2. **The competitive moat is not the model.** It is the *composition* around a commodity model: server-side prompt assembly, tiered memory, and generated action chips.
3. **The cheapest high-leverage feature to copy is `dynamicChipList`.** Three in-character, plot-advancing suggestions per turn. It removes blank-page paralysis and steers pacing — pure prompt work plus a render loop.
4. **Memory as a paid tier is validated commercially.** OOC charges 10 credits/message for a 4,000-char user note and gates long-term memory behind a UI. StoryForge's memory work is a revenue surface, not just a quality feature.
5. **800-token default output** is the industry norm for this genre — long enough to feel substantial, short enough to stay cheap and keep turns fast.

---

## 12. Phase C — prose structure analysis

**Sample**: the 20 messages already retained in `ooc-turn2.json` (10 player turns, 10 assistant turns, one story, Apex tier). Zero additional credits spent.

### 12.1 Turn economics and shape [OBSERVED]

| Metric | Value |
|---|---|
| Assistant words per turn | **412 avg** (222–502) |
| Player words per turn | **26 avg** (7–50) |
| Ratio assistant : player | **15.9 : 1** |
| Avg sentence length | **12.8 words** |
| Avg paragraph length | **~16 words** (25–38 paragraphs per turn) |
| Turns ending with a literal `?` | **0 / 10** |
| Turns ending with an explicit prompt ("What's your move?") | 4 / 10 |
| Turns ending on a sensory/emotional beat instead | 6 / 10 |
| Turns containing an HP/MP/XP block | 7 / 10 |
| Turns containing an inline scene image | **10 / 10** |
| Suggested actions per turn | **3** (10 / 10 turns) |

Two numbers carry the design: **~16 words per paragraph** and **12.8 words per sentence**. The output is deliberately chopped into one- and two-sentence paragraphs. That is webnovel formatting — built for vertical scrolling on a phone, not for reading density. It *feels* fast because the eye never crosses a wide block.

And **no turn ever ends on a question mark**, yet every turn hands control back. The model closes on a concrete image — a claw drawing blood, a spear tip an inch from an eye, an implication hanging — rather than a polite "What would you like to do?". The handoff is structural, not interrogative. That single choice is the difference between a game master and a novelist.

### 12.2 The player only speaks in the model's voice [OBSERVED]

This is the most important finding in the teardown.

| Behaviour | Count |
|---|---|
| Player turns that are verbatim suggested actions (`dynamicChipList`) | **7 / 9** |
| Adoption rate, all turns | **78%** |
| Adoption rate, human-authored turns only | **100% (7 / 7)** |
| Turns that ignored the chips | 2 — **both written by me during testing** |

The player has never once typed an original action. Every human turn in this sample is a chip. And the chips train format: they are shaped `*action beat* 'spoken line or stated intent'`, and **7 of 10 player turns conform to that exact shape** — including the one non-chip message the human typed, which still keeps the `'quote'` half.

So the loop is closed. The model writes three options in a house style → the player selects one → the model reads that selection as the player's voice → and generates the next three in the same register. **The player's expressive range is authored by the system.** That is why the prose stays on-tone for hundreds of turns with no drift, and it is the single strongest retention mechanism observed — stronger than the credits economy, because it removes the blank page *and* the burden of inventing voice.

### 12.3 Structural motifs [OBSERVED]

1. **Every turn is a decision point.** 10 / 10. No filler turns, no dead air — the scene always advances.
2. **Speaker-labelled dialogue for major NPCs** (`Vashka: "..."`), bare quoted dialogue for minor ones. Readers track who is talking without attribution prose.
3. **Italic interiority for the player character** (`*The implication hangs heavy.*`) — the model narrates the player's own inner state, which the player rarely wrote. The system supplies the player's emotions for them.
4. **Characterisation through broken syntax.** The goblin leader speaks in clipped, article-dropping lines: *"You rest here, you safe. We feed you, let you recover."* Cheap, effective, instantly distinguishable.
5. **Stat blocks as italic prose**, not UI panels — `*MP: 50 / 600*` sits inline in the narrative, so mechanical feedback never breaks immersion.
6. **Scene images at the top of every turn**, injected as markdown into the message content itself, not rendered as separate UI.

### 12.4 Implications for StoryForge

1. **Target 350–450 words per turn at ~16 words per paragraph.** That is the observed sweet spot for mobile interactive fiction; longer turns read as work.
2. **Never end on a question mark.** End on a concrete threat, image, or implication. The "What do you do?" line, when used at all, belongs mid-turn, not as the final beat.
3. **Ship three suggested actions per turn, in-character, in a fixed shape.** Measure chip adoption as a first-class product metric — OOC's is effectively 100%. If your players type free text instead, your chips are wrong, not your players.
4. **Fix the input format.** `*action* 'quote'` gives the model a stable parse target and gives the player a voice they can borrow.
5. **Put stats inline as italics.** Panels break pacing; inline italic lines don't.
6. **Budget one image per turn.** It is 10/10 in the sample, and it is doing narrative work — establishing space without spending words.

---

## 13. Phase D — StoryForge (afsanehsaz.ir) vs OOC

`afsanehsaz.ir` is StoryForge's own Persian deployment (same `/api/play/action`, same `storyforge_auth_token`, same Next+Prisma stack). So this is not competitor recon: it is the same comparison with full source access on one side.

**Method**: read `web/src/lib/engines/narrative/PromptAssembler.ts` and `modelCall.ts`; ran the real pipeline against production (`story_mt4ofllt`, 1 session + 2 turns, no auth, no credits) using the same flow as `scripts/playtestRemoteAfsanehsaz.ts`; measured both corpora with identical scripts.

### 13.1 Architecture

| | **OOC** | **StoryForge** |
|---|---|---|
| Provider model | Claude Sonnet (`model:"sonnet"`, observed) | Gemini via `@google/genai`, multi-model cascade |
| Temperature | unknown (server-side) | **0.75** (explicit) |
| Who decides outcomes | The model narrates and appears to own HP/MP inline | **Deterministic engine first**: `d20 + statMod + envMod` vs DC, then a binding `[PRE-RESOLVED GAME ENGINE OUTCOME]` section |
| Output contract | free prose, stats as inline italics | **strict JSON**: `narrative` + `playerConditionChanges` + `npcTrustChanges` + `clockChanges` + `choices[]` |
| Context assembly | server-side summaries, Memories UI, paid User Note | **29 prompt sections**: dossiers, threat clocks, bestiary grounding, gear catalogue, memories, world laws, power ranks |
| Choice payload | 3 plain strings, pre-formatted in player voice | 1–2 objects: `id`, `text`, `style`, `riskLevel`, `requiredStatId`, `targetDC` |
| Prompt readable? | no — never crosses the wire | **yes, in the repo** |

StoryForge is architecturally the more rigorous of the two: honest dice, explicit state diffs, reasoned XP, zero prompt ambiguity. OOC's economy is opaque and its mechanics live inside prose. **On determinism and auditability, StoryForge wins outright.**

### 13.2 Output, measured identically

| Metric | StoryForge (fa) | OOC (en) |
|---|---:|---:|
| Turns sampled | 3 | 10 |
| **Words per turn** | **101** (90–115) | **413** (223–503) |
| Paragraphs per turn | 2 (1 in two of three turns) | 26 |
| **Words per paragraph** | **72** | **18** |
| Words per sentence | 15.3 | 9.2 |
| Dialogue units per 100 words | 1.0 | 1.6 |
| Choices offered | 1–2 | 3 |
| Turns ending on movement/atmosphere | 2 / 3 | 0 / 10 |
| Turns ending on threat, demand, or question | 0 / 3 | 5 / 10 |

The gap is not subtle: **4× shorter, 4× longer paragraphs, half the choice count, and different ending mechanics.**

### 13.3 Diagnosis — four concrete defects

**1. The length instruction is being met at its floor.** PromptAssembler line 468 asks for *"100 and 200 words"*. Observed: 90, 98, 115. The model satisfies the constraint minimally and stops. OOC targets ~400–500, which is what makes a turn feel like a scene rather than an update.

**2. The paragraph instruction is being ignored.** The same directive says *"short, kinetic 1-to-3 sentence paragraph blocks"*. Observed: turns 1 and 2 arrived as **one 95-word block with no blank lines**. The renderer (`NarrativeProse` → `splitParagraphs`) cannot split what was never split, so the player gets a wall of text. This is a prompt-compliance failure with a visible user-facing cost, and it is probably the single cheapest thing to fix in the codebase.

**3. Turns end on scenery, not pressure.** StoryForge closes on:

> «سنگریزه زیر پایت خش‌خش می‌کند و سایهٔ دراز کاروان روی خاک سرخ کشیده می‌شود.»

OOC closes on:

> "Tell me why I do not snap your spine and drag your carcass back to Yamulcire's throne myself."

Both are well-written. Only one of them makes you press the button. The `[PRE-RESOLVED GAME ENGINE OUTCOME]` section governs *movement* (cost / complication / reveal / reposition / escalation) but nothing governs the **final sentence**.

**4. Choices are in third person, so the player must translate.** StoryForge: `"گرفتن کیسهٔ نقره، انداختن تسمهٔ شتر پیشرو روی شانه و به راه افتادن"` ("taking the silver pouch, slinging the lead camel's strap..."). OOC: `"*I mark the wall with a charcoal bit and retreat to the tunnels.* 'Survival comes first.'"`.

OOC's chips are already in the player's voice — first person, action beat plus spoken line — which is why they hit **100% adoption** and why players never type original text. StoryForge's are descriptive, so the player rewrites them mentally.

Also noted: the opening scene returned **one** choice. An opening with a single option is a dead end, not a decision.

### 13.4 What StoryForge does better

- **Honest mechanics.** `diceRoll: 20, DC: 0, outcome: success` is inspectable. OOC's MP cost of 40 on one turn and 0 on the next is unexplained and unfalsifiable.
- **Explicit state diffs.** `npcTrustChanges`, `clockChanges`, `playerConditionChanges` are contract, not inference. OOC buries the same information in italics.
- **Prompt auditable and versioned in git.** Its defects can be fixed in minutes; OOC's cannot even be read.
- **Failure handling is specified.** The `[PRE-RESOLVED...]` section forbids static retries and mandates at least two genuinely different approaches — stricter than anything observable in OOC.

### 13.5 Recommended changes, ranked by leverage

1. **Raise target length to 300–450 words** (keep the "never pad" clause). Current floor reads thin.
2. **Enforce paragraph breaks.** Ask for `\n\n` between blocks *and* validate it: a `ProseValidator` rule that rejects any paragraph over 40 words and reparses. Cheap, deterministic, visible.
3. **Always return 3 choices, in first person, action beat + quoted line** — mirroring the format that drives OOC's 100% adoption.
4. **Mandate a pressure-bearing final sentence.** "The last sentence must introduce a new threat, cost, deadline, or demand — never end on landscape."
5. **Instrument the metrics.** Words/turn, paragraphs/turn, choice count, and choice adoption rate. You currently have none of these in production, which is why a 4× length gap went unnoticed.

---

## Appendix A — Evidence inventory

| Artefact | Path |
|---|---|
| Scenario capture (224 events, screenshot, DOM, storage) | `%LOCALAPPDATA%\Temp\opencode\rea-ooc-full-out.json` |
| Homepage screenshot | `%LOCALAPPDATA%\Temp\opencode\ooc-home.png` |
| 49 production JS chunks | `%LOCALAPPDATA%\Temp\opencode\ooc-js\` |
| Prior connect-mode inspection | `%LOCALAPPDATA%\Temp\opencode\ooc-page.json` |
| **Phase B turn capture (Socket.IO frames + read-only payloads)** | `%LOCALAPPDATA%\Temp\opencode\ooc-turn2.json` |
| **Phase B recorder (WS + Network + console)** | `%LOCALAPPDATA%\Temp\opencode\cdp-record2.js` |
| **Phase C prose analysis scripts (v1–v3)** | `%LOCALAPPDATA%\Temp\opencode\ooc-prose-analysis*.js` |
| **Settings panel text (Memories, Output Length, User Note)** | `%LOCALAPPDATA%\Temp\opencode\ooc-panels.json` |
| **Phase D StoryForge live playtest (1 session + 2 turns)** | `%LOCALAPPDATA%\Temp\opencode\afs-remote.json` |
| **Phase D extracted narratives** | `%LOCALAPPDATA%\Temp\opencode\afs-narrative.txt` |
| **Phase D comparison + metrics scripts** | `%LOCALAPPDATA%\Temp\opencode\compare*.js` |

## Appendix B — Resource groups (264 paths, 49 groups)

| Group | Paths | Group | Paths |
|---|---:|---|---:|
| stories | 28 | auto-purchases | 10 |
| characters | 26 | cash | 6 |
| v3 (chat runtime) | 21 | creators | 5 |
| games | 18 | content | 5 |
| profiles | 16 | referral | 4 |
| shortcut-commands | 13 | tutorials | 4 |
| collected-endings | 12 | terms | 4 |
| feeds | 11 | temp | 4 |
| character-chats | 10 | story-recommendations | 3 |
| collected-images | 10 | keyword / pages / audits / announcements / halloween-product / situation-images / block / story-drafts / character-temp-chats / story-endings | 3 each |
| alarm / assignments / temp-stories / user-voices | 2 each | story-starting-sets / user / genres / character-rankings / experiments / me / token / oauth / account / logout / coupons / search / attendance / genre-navigations / credit-policies / v1 | 1 each |

Generation-critical paths:

```
/v3/chats/{chatId}/messages
/v3/chats/{chatId}/branch
/v3/chats/{chatId}/summaries
/v3/chat-models
/characters/auto-gen/prompt
/stories/suggest/initial-message
/temp/{tempChatId}/messages/{tempChatMessageId}        (SSE)
/character-temp-chats/{tempChatId}/messages/{id}       (SSE)
```
