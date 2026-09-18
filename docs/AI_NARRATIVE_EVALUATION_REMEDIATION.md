# AI Narrative Evaluation — Remediation Tracker

Date: 2026-09-17
Scope: Plan 14 and live testing of خاکسترِ زروان.

## Evidence corrections

- U+0B3F is ODIA VOWEL SIGN I, not Bengali. Foreign-script contamination is the issue; earlier reports misidentified the script.
- The canonical sentry scenario explicitly uses universal base 10. Its DC floor 12 is not evidence that low-base stories must also use floor 12.
- Mentioning guards or weapons anywhere in prose does not prove an active standoff. Safe conversation or inspection after disengagement may legitimately be diceless.
- Hybrid defeat is a recoverable setback, not terminal death. Continuing after revival is expected.
- A canon-rejection 503 protects persistence. Additional retries are a reliability/cost tradeoff, not proof that the existing safety gate is broken.

## Issue list and acceptance criteria

| # | Priority | Issue | Acceptance criteria | Status |
|---|---|---|---|---|
| 1 | High | Foreign-script characters can pass production Persian prose validation | Language-gated Unicode validation, repair instructions, tests for Odia/Bengali and valid Persian punctuation/marks; production generation and repair both checked | Fixed; script-leak regression tests pass (`ProseValidator.test.ts` Persian script-integrity block + `ProseValidator.scriptLeak.test.ts`); harness reuses the same production detector instead of a narrower copy |
| 2 | High | Low-base high-risk DC 13 snaps to 11 instead of the upper edge 12; floors must be enforced monotonically | Monotonic clamps for low 7–8, medium 9–10, high 11–12; finite DCs; boundary tests | Fixed; `GeminiAdapter.ts` low-base clamp is monotonic with upper-edge snapping; covered by `GeminiAdapter.test.ts` low-base boundary test |
| 3 | Medium | Choices can abandon unresolved immediate threats without a grounded transition | Preserve agency: explicit immediate-threat context rather than blanket guard-keyword checks; regression fixtures covering active danger AND safe disengagement | Open; needs explicit contextual-threat contract, not guard-keyword rule |
| 4 | Medium | Unrepairable prose returns 503 after limited repairs | Bounded repair attempts with mock guards; never persist invalid/mock prose or charge failed turns | Fixed in code; `narrativeTurn.ts` allows the initial draft plus two repair calls with `repair_unavailable` / `unrepairable` guards. Call/error-budget regression tests still missing |
| 5 | High | Explicit npm test list omits test files | Automatic cross-platform discovery of `src/**/*.test.ts`, fail if none, propagate test exit status; all existing tests run | Fixed; `scripts/testAll.ts` discovers and runs all files (`Discovered 48 test files`) |
| 6 | Medium | Only one of ten golden scenarios has a recorded cassette | Record missing live evidence with bounded request budget; retain failures; replay all ten; never fabricate evidence | Open; needs explicit live-recording budget and cassette capture |
| 7 | Medium | DC expectation semantics are ambiguous across base systems | Document explicit scenario bounds versus base-dependent risk bands; keep the canonical base-10 sentry floor separate from low-base bands | Open; single `minDc`/`maxDc` expectations still cannot express both absolute canonical bounds and low-base-relative bands. `isLowBase` is accepted by the evaluator but unused |
| 8 | Low | Golden-scenario and real-story prose budgets differ (450 vs 900 words) | Either share budget or clearly document intentional authored-story override; do not silently claim equal standards | Fixed; documented as intentional long-form budget in `evalStory.ts` (`maxWords: 900`) |
| 9 | Low | Informational raw-probe findings look like scored failures | Distinguish informational findings and scored verdict visually and in reports | Fixed; raw-probe output is labeled unscored/info and scored verdict comes only from route findings |
| 10 | Low | Health-key resolution is duplicated in route and harness | Shared typed resolver in route and harness | Fixed; route and harness both import `resolveHealthKey` from `resourcePools.ts`. Dedicated parity tests not present |
| 11 | Low | Plan says four tiers but defines five | Consistent five-tier wording | Fixed |

## Implementation policy

Write evidence and decisions here before claiming an issue closed. Offline tests must not invoke paid APIs. Live runs require explicit live commands, real evidence, and must not be represented as deterministic model-quality guarantees. Existing user changes remain uncommitted.

## Verification

- TypeScript: `npx tsc --noEmit --pretty false` passes.
- Full discovered suite: 48 test files, 446 tests passing, zero failures.
- Focused script-leak regression: `ProseValidator.scriptLeak.test.ts` rejects Bengali and Odia U+0B3F, accepts clean Persian.
- Focused DC regression: `GeminiAdapter.test.ts` checks monotonic low-base and normal-base boundary clamps.

Open work: a contextual immediate-threat contract for abandoning danger (#3), dedicated repair-budget regression tests (#4), explicit low-base DC-band semantics in the evaluator (#7), and live recording for the nine missing cassettes (#6).
