# OOC Teardown — Consolidated Findings & Open Questions

> **Purpose**: one index of everything established about OOC (`ooc.ai`), everything already recorded elsewhere in `docs/`, and everything still unknown. Written to stop us re-deriving findings we already have.
>
> **Companion**: [`OOC_GENERATION_TEARDOWN.md`](./OOC_GENERATION_TEARDOWN.md) — full evidence, per-phase method, verbatim payloads.
>
> **Date**: 2026-10-26 · **Method**: REA static/dynamic analysis, CDP traffic capture, one signed-in playthrough (2 turns paid), one StoryForge production playtest.
> **Cost**: 156 OOC credits, 0 StoryForge credits.

---

## 1. Scope and constraints honoured

- No bulk content extraction, no credit-system circumvention, no paywall bypass.
- Prompts are treated as unreachable where they are unreachable, and that is stated as a result rather than worked around.
- Two of the user's own turns were played on a real account; everything else was read-only or local.

---

## 2. Confirmed findings

### 2.1 The client never carries the prompt — settled

The complete outbound payload for one turn, over Socket.IO:

```json
["send", { "chatId": "6ad85ed97d4cc6e6d0c72453",
           "message": "I stay limp and keep my palms open…",
           "prevMessageId": "6adf8556a0c8d8225a3b0b4b" }]
```

**Three fields. No prompt, no history, no summary, no model, no sampling parameters.** Prompt extraction from this product is impossible by construction. This is the single most valuable negative result in the teardown and it is final.

### 2.2 Transport and streaming

| Property | Observed |
|---|---|
| Generation transport | **Socket.IO** (`/ooc-gen/socket.io`, namespace `/v3/chats`), not SSE |
| SSE endpoints | exist (`/temp/...`, `/character-temp-chats/...`), apparently guest/temp only |
| Stream shape | `characterMessageGenerating` events carrying **cumulative snapshots** (315 → 1807 bytes), not deltas |
| Terminal event | `characterMessageGenerated` with full `content` + `_id` |
| Metadata leakage | none — no model, tokens, or finish reason in frames |

> Earlier inference in `OOC_GENERATION_TEARDOWN.md` §2 that signed-in generation uses SSE was **wrong** and is retained there as a documented correction.

### 2.3 Model and commercial tiers

- Upstream model leaks in the chat object: **`"model": "sonnet"`** (Anthropic Claude Sonnet). Apex/Max/Superb are marketing labels on one provider family.
- Story defaults: `defaultCrackerModel: "superchat_2_0"`, `defaultSuperChatModel: { name: "Sonnet 3.5", model: "SONNET3.5" }`.

| Tier | Credits/turn | Per extra 100 tokens | Default max output |
|---|---:|---:|---:|
| Max | 195 | 18 | 800 |
| Apex | 90 (sale **78**) | 9 | 800 |
| Superb (default) | 90 | 9 | 800 |
| Skillful | 60 | 8 | 800 |
| Extensive | 60 | 8 | 800 |
| Basic | 30 | 2 | 800 |

Observed: **78 credits and 0–40 MP per turn** at Apex on the active sale. MP is not spent on generation uniformly, which means it is an action currency, not a token budget.

### 2.4 Memory is a paid product line

| Layer | Evidence |
|---|---|
| Summaries | `isSummaryUpdated`, `summaryTriggerMessageId`, `/v3/chats/{id}/summaries` |
| Memories UI | Long-term (4) / Temporary (4) / Relationships / Goal |
| User Note | 1,000 chars free, **4,000 chars for +10 credits/message** |

### 2.5 Server generates the player's next move

Every assistant message carries `dynamicChipList` — 3 suggested actions, pre-formatted `*action beat* 'spoken line'`.

**Measured adoption on real play: 7/7 of human-authored turns used a chip verbatim. The only 2 turns that ignored chips were the ones this analysis wrote.** The loop is closed: the model writes the options, the player selects one, the model reads the selection as the player's voice.

### 2.6 Prose rhythm — OOC vs StoryForge (same measurement scripts)

| Metric | OOC | StoryForge |
|---|---:|---:|
| Words per turn | 413 (223–503) | 101 (90–115) |
| Panels (paragraphs) per turn | 26 | 1–2 |
| **Words per panel** | **~16** | **~72** |
| Words per sentence | 9.2 | 15.3 |
| Dialogue units / 100 words | 1.6 | 1.0 |
| Turns ending on threat/demand | 5/10 | 0/3 |
| Choices per turn | 3 | 1–2 (sometimes 4) |

### 2.7 Structural architecture of a StoryForge turn (read from source)

`PromptAssembler.ts` assembles **29 sections** (dossiers, threat clocks, bestiary, gear catalogue, memories, world laws, power ranks) around a deterministic, pre-rolled outcome. `modelCall.ts` calls Gemini at **temperature 0.75** and demands strict JSON: `narrative`, `playerConditionChanges`, `npcTrustChanges`, `clockChanges`, `choices[]`.

Confirmed defects from one live turn:

1. `activeTensionClocks: []` and every `sagaLedger` array empty — no tension-bearing state existed to render.
2. The sampled turn resolved `d20: 20, DC: 0, success, trust +5, +10 XP` — **a clean win that changed nothing**. The prompt bans flat outcomes for *failure* only.
3. Paragraph breaks were not produced despite an explicit instruction, so the renderer received a single 95-word block.

---

## 3. Already documented elsewhere — do not re-derive

These were established before this teardown and should be cited, not rediscovered:

| Finding | Where it lives |
|---|---|
| **Spatial/Kinetic Countdown** ("40 yards, 30, 20…") | `COMPETITIVE_ANALYSIS_AND_LITRPG_WEBTOON_INTEGRATION.md` L234, directive at L446 |
| Micro-dopamine cadence, zero filler turns | same doc, Pillar 1 |
| Skeptic-to-Awe NPC loop | same doc, Pillar 2 |
| True lethal stakes / anti-plot-armor | same doc, L191 |
| Choice chips and short action text | same doc, L238, L340 |
| Reader ergonomics per turn | same doc, L238 |
| Narrative prompt inventory | `TALA_VA_LAJAN_SYSTEM_PROMPT_AUDIT.md` |
| System/gameplay issues | `SYSTEM_AND_GAMEPLAY_AUDIT.md` |
| HP drain / archetype choices | `INVESTIGATION_ARCHETYPE_CHOICES_AND_HP_DRAIN.md` |

**The countdown directive is already implemented** at `PromptAssembler.ts:477`:

> *"When threats, ambushes, charges, or ticking-clock hazards occur, use spatial countdowns (e.g. 'forty yards, thirty, twenty... tusks aimed directly at your chest. You have seconds.')"*

So `OOC_GENERATION_TEARDOWN.md` §15 is a **re-confirmation with a concrete scene**, not a new insight. It is worth keeping only because it caught the live failure to *comply* with that instruction.

---

## 4. Corrections to earlier docs (drift)

`COMPETITIVE_ANALYSIS_AND_LITRPG_WEBTOON_INTEGRATION.md` §4.2 quotes the prompt as **250–500 words across 4 rigid paragraphs**. That is **stale**. The live prompt now reads:

> *"Target Length: Deliver punchy, high-velocity literary prose between **100 and 200 words** across short, kinetic **1-to-3 sentence paragraph blocks**… Beat 1 Kinetic Execution · Beat 2 World Shockwave & NPC Reaction · Beat 3 The Looming Dilemma & Ticking Threat."*

Consequences:
- That doc's "Over-Bloated Novelistic Architecture" critique no longer matches the code.
- The length problem is now the **opposite** of what that doc described: the floor is being hit, not the ceiling.
- Its other findings (countdown, plot armor, chips, skeptic-to-awe) remain valid.

---

## 5. Tension doctrine (corrected)

### 5.1 The rule the user set

> **Tension must fit the story, not the turn counter.** Tension every turn is not tension — it is a metronome, and players learn to ignore it.

### 5.2 Why the current prompt produces robotic tension by construction

Beat 3 is mandatory on every turn:

> *"Beat 3 (The Looming Dilemma & Ticking Threat): Establish the new immediate physical dilemma or escalating danger that immediately sets up the choices."*

Every turn must end in **new escalating danger**. That is a per-turn escalation mandate baked into the prompt — the exact shape that trains players to stop believing the stakes. It also explains the observed prose: 6/10 OOC-style turns close on a sensory beat, while StoryForge turns close on whatever Beat 3 forces.

### 5.3 What replaces it

Tension is a **scene property**, with three allowed intensities. Not every turn gets the top one.

| Mode | When | What it does | Example from the sample |
|---|---|---|---|
| **Latent** (most turns) | travel, aftermath, conversation, recovery | a named risk exists and is *untouched*; no new threat introduced | the goblin warren: disarmed, surrounded, nobody attacking |
| **Active** | a pursued goal, an approaching deadline | one measurable in-world quantity counts down, once | "forty feet… thirty-five… twenty-five… fifteen" |
| **Peak** (rare) | once per scene, at a chosen point | irreversible loss becomes possible; a real cost is paid | Marcus's throat; the resurrection costing all MP and blood |

Rules that follow:

1. **Never escalate twice in a row.** A peak must be followed by a latent turn, or it reads as noise.
2. **Latent turns still move something** — a clock, a fact, a relationship — but silently, without announcing danger.
3. **The countdown is authored per scene from the fiction**, never read from a shared ticking registry.
4. **A threat must reason, not roar.** Competent discovery beats monsters.
5. **Every option must cost something, even on success** — otherwise no mode produces tension.
6. **No narrated dread.** If the prose names an emotion, attach it to a body doing something.

### 5.4 The unresolved design question

OOC clearly varies intensity — the warren is latent, the scouts are active→peak. **We do not know whether OOC decides this with a model, a state machine, or fortune.** That question is unanswerable from traffic alone and is listed in §6.

### 5.5 Withdrawal: the missing choice class

**This is the most consequential gap found, and it was not previously documented.**

At the ruin, facing an unknown threat it could not fight, OOC offered exactly three options:

1. *"*I mark the wall with a charcoal bit and **retreat** to the tunnels.* 'Survival comes first. I'll recover and return with a plan.'"*
2. *"*I move along the cavern perimeter, keeping low.* 'There has to be another way in. I'm not giving up on this loot yet.'"*
3. *"*I lean back toward the fissure, listening intently.* 'If it stays in there, maybe I can bait it out or find a weakness from the outside.'"*

**Withdraw / work around / probe.** Not one option charges in. The player took option 1 — and *that is what produced the best scene in the entire playthrough*. Retreating led to the tunnel, the Moss Stalker pack, the warren, and eventually the Celestine scouts. **The scouts scene only exists because the game let the player leave.**

#### The functional taxonomy across all 10 chip sets

| Function | Examples seen |
|---|---|
| **Withdraw + return** | *"retreat to the tunnels… I'll recover and return with a plan"* |
| **Wait / observe** | *"remain motionless, waiting for them to leave"* |
| **Work around** | *"another way in… bait it out or find a weakness from the outside"* |
| **Self-care / prepare** | forage food; sharpen the dagger; mark the wall |
| **Ally / consult** | *"head west toward the warren. The ruin is a death trap for now"* |
| **Reveal / trust** | *"step out of the bushes, hands raised"* |
| **Bargain** | *"return my blade… a disarmed man is a liar"* |
| **Confront / assert** | *"toss the torn fabric at her feet"* |
| **Comply / submit** | *"let my body go limp"* |
| **Cover tracks** | *"burn the scout's tunic… time to disappear"* |

Only a minority of OOC's suggestions advance aggressively. In 5 of 10 sets there is an explicit withdrawal or wait option, and the player chose the cautious branch in nearly every set — **and the story got tenser, not flatter.**

#### Why retreat *raises* tension

The player withdraws; the world does not. The Moss Stalkers follow. The scouts pick up the trail. The gap between player and threat narrows while the player is trying to leave. That is the cinematic feeling: the protagonist backs away and the thing keeps coming.

Retreat also does three other jobs:

1. **Threat readout.** Offering "leave" tells the player the game thinks they are under-levelled. That is credible danger with zero narrated dread.
2. **Player-controlled intensity.** Withdraw = latent, work-around = active, press = peak. **The player chooses the volume, which removes the need for an engine-side intensity scheduler** — the concern raised in §5.2/§5.3.
3. **Anticipation instead of consumption.** *"I'll return with a plan"* plants a thread. Returning later is a payoff.

#### Why StoryForge does not generate it — prompt-side, not schema

**Correction:** an earlier draft of this section claimed the choice schema "has no shape for withdrawal". That was wrong. The live output already contained a diceless choice (`choice_pay_demand`: no `requiredStatId`, no `targetDC`, `riskLevel: low`, resolved at `DC: 0`), so unrolled options are representable today. **Retreat can absolutely carry a risk level and a DC** — and should, when something is chasing you.

Withdrawal has two modes, and both are already expressible:

| Mode | When | Roll | Cost on success | Cost on failure |
|---|---|---|---|---|
| **Contested withdrawal** | something is actively pursuing (pack, hunter, patrol) | stealth / agility / athletics vs DC | time, position, an item dropped | **escape, but pay** — a wound, lost gear, a revealed trail |
| **Uncontested withdrawal** | nothing is chasing; you simply decline | none | time + opportunity (the threat advances) | n/a |

The failure semantic matters more than the DC: a failed retreat must **still let you leave at a price**. "You cannot leave" is a forced-forward move wearing a dice roll, and it converts the agency valve into a second failure point. Reserve contested retreat for genuine pursuit; use the unrolled form when the player is choosing to disengage from something that is not coming after them.

Most of OOC's retreat options were **uncontested**: nothing was chasing through the ruin yet. The price was time and opportunity, and the world spent it.

The actual blockers are all in the prompt:

1. **`[INSTRUCTIONS FOR NEW CHOICES]`** enumerates intents as *"tactical, cautious, conversational/diplomatic, bold"*. **Cautious is not withdrawal** — cautious means a careful attempt at the same objective. There is no "decline the encounter" category, so the generator never enumerates one.
2. **Every choice is framed as an attempt on the current obstacle.** The instruction is *"Every choice must directly stem from the characters, environment, tension, and dilemma established in the scene prose above."* Leaving the dilemma does not stem from it.
3. **Forward-momentum rules forbid it.** `FORWARD MOMENTUM ON OVERCOME OBSTACLES`, plus `[PRE-RESOLVED GAME ENGINE OUTCOME]`: *"The same obstacle may not remain exactly as it was with no new information, pressure, price, or opportunity."* An uncontested retreat leaves the obstacle intact — technically forbidden.

#### The fix, and why it is small

No new subsystem, no schema change — a choice **kind** plus three prompt rules:

| Kind | Rolled? | XP? | Must change state |
|---|---|---|---|
| `contest` | yes (stat + DC) | yes | yes |
| `social` | yes (charisma) | yes | yes |
| `withdraw` | **only if pursued** | on contested success | **yes — advance a clock, reveal a fact, or plant a thread** |
| `observe` | no | no | yes — reveal a fact |

Rules:
- **Time is the price.** An uncontested withdrawal advances a clock: the threat closes in while you leave. That satisfies the existing "obstacle must not remain static" clause *and* converts the retreat into the latent→active transition.
- **Roll only against pursuit.** If nothing is hunting you, do not roll — a forced check on a free choice teaches the player that leaving is a gamble.
- **Failed retreat still exits.** Failure means you leave wounded, marked, or lighter — never that you are trapped.
- **Mandatory when the encounter outclasses the player.** This turns the choice set into a threat readout.
- **Withdrawal never resets the scene.** The world moves during the absence.

Net effect: the player gets a volume knob, the engine keeps its no-static-obstacles rule, and tension stays variable without a global scheduler.

### 5.6 Memory: how far back the engine actually reaches

Read from source, not inferred. Four independent mechanisms with different horizons:

| Mechanism | Horizon | Where |
|---|---|---|
| **Recent scene prose** (verbatim) | last **3 turns** | `narrativeTurn.ts:296` — `sessionTurns.slice(-3)` |
| **Recent completed actions** (anti-repetition) | last **4 player actions** | `narrativeTurn.ts:303` — `slice(-4)` |
| **Relevant memories** (extracted facts) | **all history**, top **6** by relevance | `narrativeTurn.ts:284` → `MemoryEngine.getRelevantMemories(..., 6)` |
| **Episodic rollup** (chapter summaries) | last **12 chapters** | `MemoryEngine.ts:110` |
| **Working memory** (tier 1) | last **3 memories** | `MemoryEngine.ts:97` |
| **Living world ledger** | unbounded | `sagaLedger`: keyItems, npcStatuses, openPlotThreads, chapterSummaries, factionReputations |

Extraction is **model-decided per turn** (`extractedMemories` in the JSON contract). `importance < 3` is dropped (`GeminiAdapter.ts:311`), so chit-chat never enters the log.

#### The retrieval scoring — this is the real memory system

```ts
score = importance * 2                    // 0–20
      + 8   if tied to an active NPC
      + 5   if tied to the current location
      + 10  if importance >= 9            // permanent world events
```

Top 6 by score, plus **one synthetic entry always occupying a slot**: `"Player performed action X with outcome Y"` at importance 8 (`narrativeTurn.ts:288-292`).

**Effective historical depth is therefore 5 recalled facts**, not 6.

#### What "important events" means here

| Importance | Treatment |
|---|---|
| 0–2 | dropped at extraction |
| 3–8 | competes for a slot; may never be retrieved again |
| **9–10** | `+10` score bonus, effectively permanent — survives forever if it keeps winning a slot |
| Irreversible choices | carried in chapter summaries, rendered as `"Irreversible: …"` in the rollup (`MemoryEngine.ts:116-118`) |

#### Five gaps, confirmed in code

1. **The verbatim window is 3 turns.** Beyond that, continuity depends entirely on whether the extractor thought to write a memory. A vivid exchange six turns ago is gone unless it was summarised.
2. **Old facts can outrank recent ones.** Scoring is relevance, never recency. Good for a wound from turn 3; bad for "what did we just decide?" — a turn-40 decision at importance 5 loses to a turn-3 NPC fact.
3. **`decayRate` is declared but never applied.** `types/memory.ts:24` documents a decay multiplier; nothing reads it. Low-importance memories never fade, so the 5-slot budget stays contended forever.
4. **No relationship primacy.** Category `character` exists, but nothing guarantees it. OOC treats **Relationships** as a first-class memory tab; StoryForge treats it as one category among many competing on `importance * 2`.
5. **The ledger was empty in the live sample.** At turn 2, `sagaLedger` returned `[]` for every array. Plausibly correct before a chapter boundary — **but unverified**. If chapter rollups only materialise at chapter close, a long first chapter has no episodic memory at all.

#### OOC versus StoryForge memory

| | OOC | StoryForge |
|---|---|---|
| Extraction | server-side, per chat | model-decided, per turn |
| Compressed summary | server-owned rolling summaries (`isSummaryUpdated`, `summaryTriggerMessageId`) | chapter-level rollups only |
| User-visible | **Memories UI**: Long-term / Temporary / Relationships / Goal | none |
| User-editable | **User Note**, 1,000 chars free / 4,000 for +10 credits | none |
| Categories | relationships are first-class | one category among many |

OOC sells continuity as a product; StoryForge has more *plumbing* but no user surface and no relationship priority.

#### The cheap test worth running

Replay an existing long session through `buildNarrativePrompt` and print the actual `[RELEVANT MEMORIES]`, `[RECENT SCENE PROSE]` and rollup blocks for turn *N*. That shows precisely what the narrator could and could not know, on real data, for free. Open question #12 below.

---

## 6. What we still do not know (and what we would find)

| # | Unknown | Can we find it? | How |
|---|---|---|---|
| 1 | OOC's system prompt | **No** — never crosses the wire | — closed permanently |
| 2 | How OOC decides latent vs active vs peak | Possibly | record a 20+ turn arc; classify per-turn intensity; look for patterns tied to turn index vs story state |
| 3 | What makes a good `dynamicChipList` entry | **Yes** | collect chips across stories, tag by function (probe / escalate / retreat / bond), correlate with player adoption |
| 4 | Whether OOC summaries are user-visible/editable | Partly | the Memories UI implies yes; needs one click-through with an aged chat |
| 5 | Ending/arc architecture | **Not yet** | sampled story has `hasEnding: false`; need a story with endings to observe hint generation |
| 6 | Whether OOC enforces take-backs | Yes | reroll/branch behaviour and its cost |
| 7 | StoryForge's own compliance rate with its 3-beat directive | **Yes, cheaply** | classify N generated turns: does each contain Beat 1/2/3? does Beat 3 fire on quiet scenes? |
| 10 | Whether StoryForge ever offers a true withdrawal | **Yes, free** | count `withdraw`-shaped options in existing choice history (expected: zero) |
| 11 | What fraction of OOC chip sets include retreat | Yes | need more stories; current sample 5/10 sets |
| 12 | What the prompt actually recalls at turn 40 | **Yes, free** | replay a stored session through `buildNarrativePrompt`; print `[RELEVANT MEMORIES]`, `[RECENT SCENE PROSE]`, rollup |
| 13 | Whether `sagaLedger` arrays ever populate, and when | Yes | inspect a session past a chapter boundary |
| 14 | Whether 5 recalled facts are enough for a 50-turn arc | Needs playtest | correlate "narrator forgot X" complaints with retrieval misses |
| 8 | Real per-turn latency by output multiplier | Yes | instrument the 1x/1.5x/3x/5x ladder |
| 9 | Whether priced successes actually reduce player churn | Yes, but needs players | A/B two outcome contracts, measure session length |

**Cheapest high-value item is #7**: it is local, free, and tells you whether the prompt is being obeyed before you change it.

---

## 7. Recommended next steps, in order

| # | Action | Cost | Why first |
|---|---|---|---|
| 1 | **Measure StoryForge compliance** — classify last 50 generated turns for Beat 1/2/3, paragraph count, panel size, choice shape | free | you cannot fix a prompt you can't measure obeying |
| 2 | ✅ **Fix `\n\n`** — prompt now names the delimiter; `normalizeParagraphs()` repairs blobs deterministically; `prose_structure` warning counts non-compliance | free | pure defect, already agreed |
| 3 | ✅ **Add the `withdraw` choice kind** — `withdraw`/`observe` styles, mandatory when outclassed; unrolled unless pursued; failure still exits at a price | free | restores player agency *and* hands the player the tension dial (see §5.5) |
| 4 | ✅ **Make Beat 3 conditional** — latent turns allowed; escalation only when earned; quiet turns must still change something | free | removes the metronome at its source |
| 5 | ✅ **Change on success** (not "priced") — a success must move the world, but cost is not mandatory and no wound may be invented to price it | free | kills flat turns like the caravan sample without taxing every win |
| 6 | **Intensity telemetry** — log latent/active/peak per turn and the loud:quiet ratio | small | the only way to keep tension variable on purpose |

**Where items 2–5 live in code:**

| Change | File |
|---|---|
| Paragraph delimiter instruction (EN + FA) | `web/src/lib/engines/narrative/PromptAssembler.ts` §3 |
| Tension variance + conditional Beat 3 (EN + FA) | `PromptAssembler.ts` §3, Beat list |
| Change-on-success clause (EN + FA) | `PromptAssembler.ts` `[FAILURE FORWARD CONTRACT]` |
| `withdraw` / `observe` choice intents + threat readout (EN + FA) | `PromptAssembler.ts` `[INSTRUCTIONS FOR NEW CHOICES]` |
| Deterministic block repair | `web/src/lib/engines/narrative/proseParagraphs.ts` (`normalizeParagraphs`) |
| Applied after validation, before persistence | `web/src/lib/engines/narrative/narrativeTurn.ts` |
| Non-compliance telemetry (`prose_structure`, warning only) | `web/src/lib/engines/narrative/ProseValidator.ts` |
| Momentum judge no longer scores withdrawal as a stall | `web/src/lib/engines/narrative/momentumGuardrail.ts` |

---

## 8. Artifact index

| Artefact | Path |
|---|---|
| Full teardown (method, payloads, phases A–D, scenes) | `docs/OOC_GENERATION_TEARDOWN.md` |
| OOC turn capture (Socket.IO frames + read-only payloads) | `%LOCALAPPDATA%\Temp\opencode\ooc-turn2.json` |
| OOC full playthrough transcript (incl. scouts scene) | `%LOCALAPPDATA%\Temp\opencode\ooc-older.txt` |
| Extracted scouts scene | `%LOCALAPPDATA%\Temp\opencode\ooc-guard-scene.txt` |
| OOC 49 production JS chunks | `%LOCALAPPDATA%\Temp\opencode\ooc-js\` |
| StoryForge live playtest payload | `%LOCALAPPDATA%\Temp\opencode\afs-remote.json` |
| Comparison + metrics scripts | `%LOCALAPPDATA%\Temp\opencode\compare*.js` |
| Paragraph analysis scripts | `%LOCALAPPDATA%\Temp\opencode\ooc-prose-analysis*.js` |