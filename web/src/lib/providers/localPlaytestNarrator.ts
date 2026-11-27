import fs from 'node:fs';
import path from 'node:path';
import type { GenerationPromptPayload } from '../engines/narrative/PromptAssembler';
import type {
  RawSceneData,
  RawSceneResult,
  SceneModelCall,
  SceneModelOptions,
} from '../engines/narrative/modelCall';
import type { GeminiAdapter } from './GeminiAdapter';

export interface LocalChoiceOption {
  id: string;
  text: string;
  style: string;
  riskLevel: string;
  requiredStatId?: string;
  targetDC?: number;
}

export interface LocalPlaytestScene extends RawSceneData {
  narrative: string;
  choices: LocalChoiceOption[];
  extractedMemories: Array<{
    category: string;
    importance: number;
    summary: string;
  }>;
}

export interface LocalPlaytestScriptFile {
  scenes?: RawSceneData[];
  turns?: Record<string, RawSceneData>;
}

export interface LocalPlaytestOptions {
  /** Explicit in-memory script queue for deterministic test scenes. */
  script?: RawSceneData[] | LocalPlaytestScriptFile;
  /** Optional path to a JSON script file authored by Antigravity or a tester. */
  scriptPath?: string;
}

export interface ParsedPromptContext {
  isEnglish: boolean;
  isOpeningChoices: boolean;
  isChoicesOnly: boolean;
  locationName: string;
  locationDescription: string;
  actionText: string;
  outcome: 'critical_success' | 'success' | 'mixed_success' | 'failure' | 'critical_failure' | 'unknown';
  consequence: string;
  costLine: string;
  failureDirective: string;
  travel?: {
    originName: string;
    destinationName: string;
    currentStopName: string;
    nextStopName?: string;
    routeName?: string;
    companions: string[];
    arriving: boolean;
    elliptical: boolean;
  };
  travelArrival?: {
    destinationName: string;
  };
  encounter?: {
    title: string;
    premise: string;
    npcName?: string;
    creatureName?: string;
    recommendedStat?: string;
    recommendedDC?: number;
  };
  presentNpcNames: string[];
  nearbyResidentNames: string[];
  bestiaryNames: string[];
  questSummaries: string[];
  knownLocations: string[];
  tradeDestinations: string[];
  completedActions: string[];
  validStatIds: string[];
  isLowBase: boolean;
}

/**
 * Production Safety Invariant (Plan 08):
 * Local zero-API playtesting is strictly forbidden in `NODE_ENV === 'production'`.
 * Production routes MUST continue rejecting unavailable external AI with HTTP 503.
 */
export function isLocalPlaytestEnabled(requestedLocalFlag?: unknown): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (process.env.STORYFORGE_LOCAL_PLAYTEST === 'true') {
    return true;
  }
  return requestedLocalFlag === true || requestedLocalFlag === 'true';
}

/**
 * Inspects an incoming API request + parsed JSON body for explicit local
 * playtest activation (`body.localPlaytest`, `x-storyforge-local-playtest`
 * header, or `STORYFORGE_LOCAL_PLAYTEST=true`), always disabled in production.
 */
export function isLocalPlaytestRequest(
  req?: { headers?: { get(name: string): string | null } } | null,
  body?: { localPlaytest?: unknown } | null
): boolean {
  const headerFlag = req?.headers?.get?.('x-storyforge-local-playtest');
  return isLocalPlaytestEnabled(body?.localPlaytest ?? headerFlag);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSection(userPrompt: string, headerStartPattern: RegExp): string | undefined {
  const lines = userPrompt.split(/\r?\n/);
  let collecting = false;
  const collected: string[] = [];

  for (const line of lines) {
    if (!collecting) {
      if (headerStartPattern.test(line.trim())) {
        collecting = true;
        collected.push(line);
      }
      continue;
    }
    // Next bracketed top-level prompt block terminates this section
    if (/^\[[A-Z\u0600-\u06FF]/.test(line.trim())) {
      break;
    }
    collected.push(line);
  }

  return collected.length ? collected.join('\n') : undefined;
}

function normalizeOutcomeToken(raw?: string): ParsedPromptContext['outcome'] {
  const upper = (raw || '').trim().toUpperCase();
  if (upper === 'CRITICAL_SUCCESS') return 'critical_success';
  if (upper === 'SUCCESS') return 'success';
  if (upper === 'MIXED_SUCCESS') return 'mixed_success';
  if (upper === 'FAILURE') return 'failure';
  if (upper === 'CRITICAL_FAILURE') return 'critical_failure';
  return 'unknown';
}

function quotedMatches(line: string, open: string, close: string): string[] {
  const re = new RegExp(`${escapeRegExp(open)}([^${escapeRegExp(close)}]+)${escapeRegExp(close)}`, 'g');
  return Array.from(line.matchAll(re), (m) => m[1].trim()).filter(Boolean);
}

/**
 * Parses PromptAssembler's structured [BLOCK] payload into clean fields so the
 * local Antigravity synthesizer reacts to real encounters, travel legs, quests,
 * check outcomes, and present vs nearby NPC boundaries.
 */
export function parsePromptContext(prompt: GenerationPromptPayload): ParsedPromptContext {
  const text = prompt.userPrompt || '';
  const sys = prompt.systemPrompt || '';
  const isEnglish = Boolean(prompt.isEnglish);

  const isOpeningChoices =
    sys.includes('opening scene prose has ALREADY been written') ||
    sys.includes('متن صحنهٔ آغازین قبلاً نگارش شده');
  const isChoicesOnly =
    sys.includes('scene prose has ALREADY been established') ||
    sys.includes('متن نثر صحنه قبلاً نگارش و تأیید شده');

  // Location
  const locHeaderMatch = text.match(
    /^\[(?:CURRENT LOCATION|موقعیت مکانی فعلی \/ CURRENT LOCATION):\s*([^\]]+)\]/m
  );
  const locationSection = extractSection(
    text,
    /^\[(?:CURRENT LOCATION|موقعیت مکانی فعلی \/ CURRENT LOCATION):/
  );
  const locationDescMatch = locationSection?.match(/(?:Description|توضیحات):\s*(.+)/);

  // Outcome section
  const outcomeSection = extractSection(
    text,
    /^\[(?:PRE-RESOLVED GAME ENGINE OUTCOME|نتیجه محاسباتی موتور بازی \/ PRE-RESOLVED OUTCOME)\]/
  );
  const actionMatch = outcomeSection?.match(/(?:Player Action|عمل انجام شده توسط بازیکن):\s*"([^"]+)"/);
  const resultMatch = outcomeSection?.match(/(?:Check Result|نتیجه تاس و بررسی):\s*([A-Z_]+)/);
  const consequenceMatch = outcomeSection?.match(/(?:Consequence|پیامد):\s*(.+)/);
  const costMatch = outcomeSection?.match(/(?:Cost \([^)]*\)|هزینه \([^)]*\)):\s*(.+)/);
  const failureDirMatch = text.match(/(?:Binding directive|دستور الزام‌آور):\s*(.+)/);

  // Travel / Arrival
  const journeyEnRouteSec = extractSection(
    text,
    /^\[(?:JOURNEY EN ROUTE|JOURNEY ELLIPSIS|سفر در راه \/ JOURNEY EN ROUTE|گذر زمان و خلاصهٔ سفر \/ JOURNEY ELLIPSIS)\]/
  );
  let travel: ParsedPromptContext['travel'];
  if (journeyEnRouteSec) {
    const isElliptical = /ELLIPSIS/.test(journeyEnRouteSec);
    const quotePairs = isEnglish
      ? quotedMatches(journeyEnRouteSec, '"', '"')
      : quotedMatches(journeyEnRouteSec, '«', '»');
    const currentStopMatch = journeyEnRouteSec.match(/(?:Current stop|ایستگاه فعلی):\s*["«]([^"»]+)["»]/);
    const nextStopMatch = journeyEnRouteSec.match(/(?:Next stop|ایستگاه بعدی):\s*["«]([^"»]+)["»]/);
    const companionsMatch = journeyEnRouteSec.match(/(?:Travelling companions|همسفران راه):\s*([^\n.]+)/);
    travel = {
      originName: quotePairs[0] || '',
      destinationName: quotePairs[1] || quotePairs[0] || '',
      currentStopName: currentStopMatch?.[1]?.trim() || quotePairs[0] || '',
      nextStopName: nextStopMatch?.[1]?.trim(),
      routeName: quotePairs[2],
      companions: companionsMatch
        ? companionsMatch[1].split(/[،,]/).map((s) => s.trim()).filter(Boolean)
        : [],
      arriving: /(?:FINAL LEG|پایان راه:)/.test(journeyEnRouteSec),
      elliptical: isElliptical,
    };
  }

  const arrivalSec = extractSection(
    text,
    /^\[(?:JOURNEY ARRIVED|رسیدن به مقصد \/ JOURNEY ARRIVED)\]/
  );
  let travelArrival: ParsedPromptContext['travelArrival'];
  if (arrivalSec) {
    const quotePairs = isEnglish
      ? quotedMatches(arrivalSec, '"', '"')
      : quotedMatches(arrivalSec, '«', '»');
    if (quotePairs[0]) {
      travelArrival = { destinationName: quotePairs[0] };
    }
  }

  // Active Encounter
  const encounterSec = extractSection(
    text,
    /^\[(?:ACTIVE SCENE ENCOUNTER \/ KEY EVENT|رخداد یا مکالمهٔ ویژهٔ صحنه \/ ACTIVE SCENE ENCOUNTER):/
  );
  let encounter: ParsedPromptContext['encounter'];
  if (encounterSec) {
    const titleMatch = encounterSec.match(/ACTIVE SCENE ENCOUNTER[^:]*:\s*([^\]]+)\]/);
    const premiseMatch = encounterSec.match(/(?:Dramatic Premise|هستهٔ رخداد):\s*(.+)/);
    const npcMatch = encounterSec.match(/(?:Featured NPC|شخصیت کانونی):\s*([^•\n]+)/);
    const creatureMatch = encounterSec.match(/(?:Featured Creature\/Hazard|جانور\/خطر کانونی):\s*([^•\n]+)/);
    const statMatch = encounterSec.match(/(?:Anchor at least one key choice around|حولِ ویژگیِ)\s*["«]([^"»]+)["»]/);
    const dcMatch = encounterSec.match(/(?:DC|سختیِ حدود)\s*(\d+)/);
    encounter = {
      title: titleMatch?.[1]?.trim() || 'Active Encounter',
      premise: premiseMatch?.[1]?.trim() || '',
      npcName: npcMatch?.[1]?.trim(),
      creatureName: creatureMatch?.[1]?.trim(),
      recommendedStat: statMatch?.[1]?.trim(),
      recommendedDC: dcMatch ? Number(dcMatch[1]) : undefined,
    };
  }

  // Present vs Nearby Resident NPCs
  const npcsSection = extractSection(
    text,
    /^\[(?:PRESENT NPCS|شخصیت‌های حاضر \/ PRESENT NPCS|NPCS PRESENT IN THIS|شخصیت‌های حاضر در این صحنه)/
  );
  const presentNpcNames: string[] = [];
  const nearbyResidentNames: string[] = [];
  if (npcsSection) {
    for (const rawLine of npcsSection.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith('•')) continue;
      const namePart = line
        .replace(/^•\s*/, '')
        .split(/\s*(?:\[|\(| - )/)[0]
        .trim();
      if (!namePart) continue;
      if (line.includes('STATIONED AT LOCATION') || line.includes('هنوز در صحنه حاضر نیست')) {
        nearbyResidentNames.push(namePart);
      } else {
        presentNpcNames.push(namePart);
      }
    }
  }

  // Bestiary
  const bestiarySection = extractSection(text, /^\[(?:BESTIARY|موجودات \/ BESTIARY)/);
  const bestiaryNames: string[] = [];
  if (bestiarySection) {
    for (const rawLine of bestiarySection.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith('•')) continue;
      const name = line.replace(/^•\s*/, '').split(/[:(\[—-]/)[0].trim();
      if (name) bestiaryNames.push(name);
    }
  }

  // Active Quests
  const questsSection = extractSection(text, /^\[(?:ACTIVE QUESTS|مأموریت‌های فعال)/);
  const questSummaries: string[] = [];
  if (questsSection) {
    for (const rawLine of questsSection.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith('•')) {
        questSummaries.push(line.replace(/^•\s*/, '').trim());
      }
    }
  }

  // Known locations & Trade route destinations (strictly from the story prompt)
  const locationsSection = extractSection(text, /^\[(?:KNOWN LOCATIONS|مکان‌های شناخته‌شده)/);
  const knownLocations: string[] = [];
  if (locationsSection) {
    for (const rawLine of locationsSection.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith('•')) continue;
      const locName = line.replace(/^•\s*/, '').split(/[:(\[—-]/)[0].trim();
      if (locName) knownLocations.push(locName);
    }
  }

  const routesSection = extractSection(
    text,
    /^\[(?:COMMERCIAL ARTERIES|شاهراه‌ها و کاروان‌های تجاری فعال)/
  );
  const tradeDestinations: string[] = [];
  if (routesSection) {
    const destMatches = routesSection.matchAll(/(?:→|->)\s*([^•\n(;|]+)/g);
    for (const m of destMatches) {
      const candidate = m[1].trim();
      const matchedLoc = knownLocations.find((loc) => candidate.includes(loc) || loc.includes(candidate));
      const name = matchedLoc || candidate;
      if (name && !tradeDestinations.includes(name)) tradeDestinations.push(name);
    }
    for (const loc of knownLocations) {
      if (routesSection.includes(loc) && !tradeDestinations.includes(loc)) {
        tradeDestinations.push(loc);
      }
    }
  }

  // Recently completed actions
  const completedSection = extractSection(
    text,
    /^\[(?:RECENTLY COMPLETED ACTIONS|COMPLETED ACTIONS|اقدامات اخیراً انجام‌شده|اقدامات انجام‌شدهٔ اخیر)/
  );
  const completedActions: string[] = [];
  if (completedSection) {
    for (const rawLine of completedSection.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith('•') && !line.includes('DIRECTIVE') && !line.includes('دستور')) {
        completedActions.push(line.replace(/^•\s*/, '').trim());
      }
    }
  }

  const validStatIds = Object.keys(prompt.playerStatIds || {}).filter(Boolean);
  return {
    isEnglish,
    isOpeningChoices,
    isChoicesOnly,
    locationName: locHeaderMatch?.[1]?.trim() || (isEnglish ? 'the frontier road' : 'گذرگاه پیش‌رو'),
    locationDescription: locationDescMatch?.[1]?.trim() || '',
    actionText: actionMatch?.[1]?.trim() || (isEnglish ? 'press onward' : 'پیشروی به سوی مقصد'),
    outcome: normalizeOutcomeToken(resultMatch?.[1]),
    consequence: consequenceMatch?.[1]?.trim() || '',
    costLine: costMatch?.[1]?.trim() || '',
    failureDirective: failureDirMatch?.[1]?.trim() || '',
    travel,
    travelArrival,
    encounter,
    presentNpcNames,
    nearbyResidentNames,
    bestiaryNames,
    questSummaries,
    knownLocations,
    tradeDestinations,
    completedActions,
    validStatIds: validStatIds.length ? validStatIds : ['might', 'agility', 'cunning', 'charisma'],
    isLowBase: Boolean(prompt.isLowBase),
  };
}

function pickStatId(preferred: string[], valid: string[], fallbackIndex = 0): string {
  for (const cand of preferred) {
    const exact = valid.find((v) => v.toLowerCase() === cand.toLowerCase());
    if (exact) return exact;
  }
  return valid[fallbackIndex % valid.length] || valid[0] || 'cunning';
}

function sanitizeChoiceMentions(text: string, blockedNames: string[]): string {
  let clean = text;
  for (const name of blockedNames) {
    if (name.length >= 2 && clean.includes(name)) {
      clean = clean.replaceAll(name, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return clean;
}

function tokenizeForOverlap(str: string): Set<string> {
  return new Set(
    str
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2)
  );
}

function overlapsCompleted(candidateText: string, blockedActions: string[]): boolean {
  const cWords = tokenizeForOverlap(candidateText);
  if (cWords.size === 0) return false;
  for (const prior of blockedActions) {
    if (!prior || prior.length < 6) continue;
    const pWords = tokenizeForOverlap(prior);
    if (pWords.size === 0) continue;
    const inter = [...cWords].filter((w) => pWords.has(w)).length;
    const union = new Set([...cWords, ...pWords]).size;
    const jaccard = inter / union;
    const overlap = inter / Math.min(cWords.size, pWords.size);
    if (jaccard >= 0.45 || overlap >= 0.6) return true;
  }
  return false;
}

function selectFreshChoices(
  candidates: LocalChoiceOption[],
  ctx: ParsedPromptContext,
  turnHint: number
): LocalChoiceOption[] {
  const blocked = [...ctx.completedActions, ctx.actionText].filter(Boolean);
  const cleaned = candidates.map((c) => ({
    ...c,
    text: sanitizeChoiceMentions(c.text, ctx.nearbyResidentNames),
  }));
  const nonOverlapping = cleaned.filter((c) => !overlapsCompleted(c.text, blocked));
  const picked: LocalChoiceOption[] = [];
  for (const cand of nonOverlapping) {
    if (!picked.some((p) => p.text === cand.text)) picked.push(cand);
    if (picked.length >= 3) break;
  }

  // Fallback diversity generator if a long stationary loop exhausted the static pool
  let idx = 1;
  while (picked.length < 3 && idx <= 6) {
    const stat = ctx.validStatIds[(turnHint + idx) % ctx.validStatIds.length] || 'cunning';
    const fallbackText = ctx.isEnglish
      ? `Try an unorthodox angle #${turnHint}-${idx} around ${ctx.locationName} (${picked.length === 0 ? 'probe' : picked.length === 1 ? 'parley' : 'shift'}).`
      : idx === 1
        ? `زاویه تازه‌ای در نقطه شماره ${turnHint} برای عبور از بن‌بست ${ctx.locationName} بیازمای.`
        : idx === 2
          ? `رد تازه‌تری در گوشه دیگر ${ctx.locationName} طی نوبت ${turnHint} جست‌وجو کن.`
          : `آهنگ حرکت و شیوه تعامل را در مرحله ${turnHint} دگرگون ساز و پیش برو.`;
    const candidate: LocalChoiceOption = {
      id: `local_c_${turnHint}_var_${idx}`,
      text: sanitizeChoiceMentions(fallbackText, ctx.nearbyResidentNames),
      style: idx === 1 ? 'tactical' : idx === 2 ? 'inquisitive' : 'cautious',
      riskLevel: 'low',
      requiredStatId: stat,
      targetDC: ctx.isLowBase ? 9 : 11,
    };
    if (!overlapsCompleted(candidate.text, blocked) && !picked.some((p) => p.text === candidate.text)) {
      picked.push(candidate);
    }
    idx += 1;
  }

  if (picked.length < 3) {
    for (const cand of cleaned) {
      if (!picked.some((p) => p.text === cand.text)) picked.push(cand);
      if (picked.length >= 3) break;
    }
  }
  return picked;
}

function resolveQuestOrRouteDestination(ctx: ParsedPromptContext): string | undefined {
  const uncheckedText = ctx.questSummaries
    .map((q) => {
      const pendingParts = q.match(/\[\s\]\s*[^;\]]+/g);
      return pendingParts ? pendingParts.join(' ') : q;
    })
    .join(' ');
  const combined = [...ctx.tradeDestinations, ...ctx.knownLocations].filter(
    (loc) => loc && loc !== ctx.locationName && !loc.includes(ctx.locationName)
  );
  // Prefer the furthest / final destination mentioned in an unchecked quest objective
  const matchesInQuest = combined.filter((loc) => uncheckedText.includes(loc));
  if (matchesInQuest.length > 0) {
    return matchesInQuest[matchesInQuest.length - 1];
  }
  return (
    ctx.tradeDestinations.find((d) => d !== ctx.locationName) ||
    ctx.knownLocations.find((l) => l !== ctx.locationName)
  );
}

function buildContextualChoices(
  ctx: ParsedPromptContext,
  turnHint: number
): LocalChoiceOption[] {
  const dcLow = ctx.isLowBase ? 8 : 10;
  const dcMed = ctx.isLowBase ? 9 : 12;
  const dcHigh = ctx.isLowBase ? 11 : 14;

  const tacticalStat = ctx.encounter?.recommendedStat
    ? pickStatId([ctx.encounter.recommendedStat], ctx.validStatIds, 0)
    : pickStatId(['cunning', 'perception', 'intellect', 'awareness'], ctx.validStatIds, 0);
  const boldStat = pickStatId(['might', 'strength', 'prowess', 'combat'], ctx.validStatIds, 1);
  const agileStat = pickStatId(['agility', 'stealth', 'dexterity', 'cunning'], ctx.validStatIds, 2);
  const socialStat = pickStatId(['charisma', 'presence', 'diplomacy', 'cunning'], ctx.validStatIds, 3);

  const encDC = ctx.encounter?.recommendedDC ?? dcMed;
  const activeNpc = ctx.encounter?.npcName || ctx.presentNpcNames[0] || ctx.travel?.companions[0];

  if (ctx.isEnglish) {
    const pool: LocalChoiceOption[] = [];
    if (ctx.encounter) {
      const targetSubject = ctx.encounter.creatureName || ctx.encounter.npcName || ctx.encounter.title;
      pool.push(
        {
          id: `local_c_${turnHint}_1`,
          text: `Address "${ctx.encounter.title}" head-on and secure the advantage around ${targetSubject}.`,
          style: 'tactical',
          riskLevel: 'medium',
          requiredStatId: tacticalStat,
          targetDC: encDC,
        },
        {
          id: `local_c_${turnHint}_2`,
          text: `Flank the threat cautiously using the terrain near ${ctx.locationName}.`,
          style: 'stealthy',
          riskLevel: 'medium',
          requiredStatId: agileStat,
          targetDC: dcMed,
        },
        {
          id: `local_c_${turnHint}_3`,
          text: activeNpc
            ? `Speak rapidly with ${activeNpc} to coordinate a measured response before stepping further.`
            : `Study the surroundings carefully and weigh a safe path past the danger.`,
          style: activeNpc ? 'diplomatic' : 'cautious',
          riskLevel: 'low',
        },
        {
          id: `local_c_${turnHint}_4`,
          text: `Commit forcefully against ${targetSubject} to break the stalemate cleanly.`,
          style: 'aggressive',
          riskLevel: 'high',
          requiredStatId: boldStat,
          targetDC: dcHigh,
        },
        {
          id: `local_c_${turnHint}_5`,
          text: `Pull back behind solid cover in ${ctx.locationName} and bait an opening.`,
          style: 'defensive',
          riskLevel: 'low',
          requiredStatId: tacticalStat,
          targetDC: dcLow,
        }
      );
    } else if (ctx.travel) {
      const targetDest = ctx.travel.nextStopName || ctx.travel.destinationName || ctx.locationName;
      pool.push(
        {
          id: `local_c_${turnHint}_1`,
          text: `Push the pace along the road toward ${targetDest} while keeping watch on the horizon.`,
          style: 'tactical',
          riskLevel: 'low',
          requiredStatId: tacticalStat,
          targetDC: dcLow,
        },
        {
          id: `local_c_${turnHint}_2`,
          text: activeNpc
            ? `Check in with ${activeNpc} about road hazards ahead before making the next push.`
            : `Inspect gear and lead the column steadily across the stretch toward ${targetDest}.`,
          style: 'diplomatic',
          riskLevel: 'low',
        },
        {
          id: `local_c_${turnHint}_3`,
          text: `Scout the flanks and tracks along the trail toward ${targetDest} for ambushes or loot.`,
          style: 'stealthy',
          riskLevel: 'medium',
          requiredStatId: agileStat,
          targetDC: dcMed,
        },
        {
          id: `local_c_${turnHint}_4`,
          text: `Advance with shields raised across the exposed pass toward ${targetDest}.`,
          style: 'defensive',
          riskLevel: 'medium',
          requiredStatId: boldStat,
          targetDC: dcMed,
        },
        {
          id: `local_c_${turnHint}_5`,
          text: `Hold the caravan steady over rough shale until clearing the bend toward ${targetDest}.`,
          style: 'cautious',
          riskLevel: 'low',
        }
      );
    } else {
      const questDest = resolveQuestOrRouteDestination(ctx);
      pool.push(
        {
          id: `local_c_${turnHint}_1`,
          text: questDest
            ? `Travel with the caravan to ${questDest} and begin the journey along the road.`
            : `Advance deeper into ${ctx.locationName} and confront whatever awaits ahead.`,
          style: 'tactical',
          riskLevel: 'medium',
          requiredStatId: boldStat,
          targetDC: dcMed,
        },
        {
          id: `local_c_${turnHint}_2`,
          text: activeNpc
            ? `Question ${activeNpc} about current developments in ${ctx.locationName}.`
            : `Observe the layout and whispers in ${ctx.locationName} before committing.`,
          style: 'diplomatic',
          riskLevel: 'low',
          requiredStatId: socialStat,
          targetDC: dcLow,
        },
        {
          id: `local_c_${turnHint}_3`,
          text: `Consolidate supplies, orient yourself in ${ctx.locationName}, and prepare for departure.`,
          style: 'cautious',
          riskLevel: 'low',
        },
        {
          id: `local_c_${turnHint}_4`,
          text: `Search the outskirts of ${ctx.locationName} for concealed tracks or trade dispatches.`,
          style: 'inquisitive',
          riskLevel: 'low',
          requiredStatId: tacticalStat,
          targetDC: dcLow,
        },
        {
          id: `local_c_${turnHint}_5`,
          text: `Slip quietly past the watchposts along ${ctx.locationName}'s rim to probe the road.`,
          style: 'stealthy',
          riskLevel: 'medium',
          requiredStatId: agileStat,
          targetDC: dcMed,
        }
      );
    }
    return selectFreshChoices(pool, ctx, turnHint);
  }

  // Persian choices — rich rotating pool so completed-action guardrail never loops
  const poolFa: LocalChoiceOption[] = [];
  if (ctx.encounter) {
    const focusSubject = ctx.encounter.creatureName || ctx.encounter.npcName || ctx.encounter.title;
    poolFa.push(
      {
        id: `local_c_${turnHint}_1`,
        text: `در برابر رخداد «${ctx.encounter.title}» پیشقدم شو و موقعیت را در برابر ${focusSubject} مهار کن.`,
        style: 'tactical',
        riskLevel: 'medium',
        requiredStatId: tacticalStat,
        targetDC: encDC,
      },
      {
        id: `local_c_${turnHint}_2`,
        text: `با احتیاط از حاشیه زمین پیرامون ${ctx.locationName} وضعیت را دور بزن و روزنه امنی بگشا.`,
        style: 'stealthy',
        riskLevel: 'medium',
        requiredStatId: agileStat,
        targetDC: dcMed,
      },
      {
        id: `local_c_${turnHint}_3`,
        text: activeNpc
          ? `بی‌درنگ با ${activeNpc} هم‌صدا شو تا واکنشی سنجیده در برابر این پیشامد شکل بگیرد.`
          : `موقعیت را با خونسردی بپای و پیش از حرکت بعدی ردِ خطر را بسنج.`,
        style: activeNpc ? 'diplomatic' : 'cautious',
        riskLevel: 'low',
      },
      {
        id: `local_c_${turnHint}_4`,
        text: `با تمام توان و جسارت مستقیم به سوی ${focusSubject} یورش ببر تا گره صحنه بشکند.`,
        style: 'aggressive',
        riskLevel: 'high',
        requiredStatId: boldStat,
        targetDC: dcHigh,
      },
      {
        id: `local_c_${turnHint}_5`,
        text: `پشت جان‌پناه طبیعی در ${ctx.locationName} موضع بگیر و رخنه‌ای تازه برای عبور بیاب.`,
        style: 'defensive',
        riskLevel: 'low',
        requiredStatId: tacticalStat,
        targetDC: dcLow,
      }
    );
  } else if (ctx.travel) {
    const targetDest = ctx.travel.nextStopName || ctx.travel.destinationName || ctx.locationName;
    poolFa.push(
      {
        id: `local_c_${turnHint}_1`,
        text: `حرکت کاروان و گام‌ها را به سوی ${targetDest} تندتر کن و چشم از افق برندار.`,
        style: 'tactical',
        riskLevel: 'low',
        requiredStatId: tacticalStat,
        targetDC: dcLow,
      },
      {
        id: `local_c_${turnHint}_2`,
        text: activeNpc
          ? `کنار ${activeNpc} بران و درباره خطرات مسیر پیش‌رو تا ${targetDest} گفت‌وگو کن.`
          : `سازوبرگ را وارسی کن و ریتم حرکت به سوی ${targetDest} را استوار نگه دار.`,
        style: 'diplomatic',
        riskLevel: 'low',
      },
      {
        id: `local_c_${turnHint}_3`,
        text: `پیشاپیش مسیر را به سوی ${targetDest} دیده‌بانی کن تا رد کمین یا نشانه‌ای تازه را بیابی.`,
        style: 'stealthy',
        riskLevel: 'medium',
        requiredStatId: agileStat,
        targetDC: dcMed,
      },
      {
        id: `local_c_${turnHint}_4`,
        text: `آرایش محافظان ستون را پیش از عبور از تنگه به سمت ${targetDest} مرتب ساز.`,
        style: 'defensive',
        riskLevel: 'medium',
        requiredStatId: boldStat,
        targetDC: dcMed,
      },
      {
        id: `local_c_${turnHint}_5`,
        text: `گام‌به‌گام بر سنگلاخ مسیر بتاز تا کاروان پیش از غروب به نزدیکی ${targetDest} برسد.`,
        style: 'cautious',
        riskLevel: 'low',
      }
    );
  } else {
    const questDest = resolveQuestOrRouteDestination(ctx);
    poolFa.push(
      {
        id: `local_c_${turnHint}_1`,
        text: questDest
          ? `حرکت به سوی ${questDest} را همراه کاروان آغاز کن و جاده پیش‌رو را در پیش بگیر.`
          : `کاوش دقیق در گوشه‌های ناشناخته ${ctx.locationName} را پی بگیر.`,
        style: 'tactical',
        riskLevel: 'medium',
        requiredStatId: boldStat,
        targetDC: dcMed,
      },
      {
        id: `local_c_${turnHint}_2`,
        text: activeNpc
          ? `با ${activeNpc} درباره وضعیت جاده، بارها و حرکت از ${ctx.locationName} مشورت کن.`
          : `شواهد و نشانه‌های پنهان در ${ctx.locationName} را با دقت و حوصله بررسی کن.`,
        style: 'diplomatic',
        riskLevel: 'low',
        requiredStatId: socialStat,
        targetDC: dcLow,
      },
      {
        id: `local_c_${turnHint}_3`,
        text: `حاشیه اردوگاه و باروبندیل کاروان را در ${ctx.locationName} پیش از حرکت نهایی بسنج.`,
        style: 'cautious',
        riskLevel: 'low',
      },
      {
        id: `local_c_${turnHint}_4`,
        text: `در سایه دیوارهای ${ctx.locationName} گشت بزن و رد خبرچین یا سرنخ تازه را دنبال کن.`,
        style: 'inquisitive',
        riskLevel: 'low',
        requiredStatId: tacticalStat,
        targetDC: dcLow,
      },
      {
        id: `local_c_${turnHint}_5`,
        text: `سراغ دروازه خروجی ${ctx.locationName} برو و آماده همراهی کاروان شو.`,
        style: 'stealthy',
        riskLevel: 'medium',
        requiredStatId: agileStat,
        targetDC: dcMed,
      },
      {
        id: `local_c_${turnHint}_6`,
        text: `بند زره و تسمه کوله را محکم ببند و رو به جاده خاکی پیش‌رو بایست.`,
        style: 'tactical',
        riskLevel: 'low',
      }
    );
  }

  return selectFreshChoices(poolFa, ctx, turnHint);
}

/**
 * Generates contextual, guardrail-clean literary prose & choices completely
 * locally (zero external AI HTTP calls), obeying ProseValidator's outcome,
 * cost marker, bestiary, script, and minimum word count constraints.
 */
export function synthesizeLocalPlaytestScene(
  prompt: GenerationPromptPayload,
  turnCounter = 1
): LocalPlaytestScene {
  const ctx = parsePromptContext(prompt);
  const choices = buildContextualChoices(ctx, turnCounter);

  if (ctx.isOpeningChoices || ctx.isChoicesOnly) {
    return {
      narrative: '',
      choices,
      extractedMemories: [],
    };
  }

  const companion = ctx.presentNpcNames[0] || ctx.travel?.companions[0] || ctx.encounter?.npcName;

  if (ctx.isEnglish) {
    const p1 = (() => {
      if (ctx.outcome === 'failure' || ctx.outcome === 'critical_failure') {
        const failDetail = ctx.failureDirective || ctx.consequence || 'the attempt falters against stubborn resistance';
        return `You move to ${ctx.actionText}, throwing your weight into the moment, yet the effort turns sour almost at once: ${failDetail}. Dust and cold grit sting your eyes as your footing slips across the uneven ground, forcing you to recover balance while the initiative swings against you.`;
      }
      if (ctx.outcome === 'mixed_success') {
        const costClause = ctx.costLine || 'a sharp bruise across your shoulder, heavy exhaustion in your lungs, and unwelcome commotion nearby';
        return `You commit fully to ${ctx.actionText} and manage to carve through the immediate obstacle (${ctx.consequence || 'the objective holds'}), though never without a steep price: you pay for the ground gained with ${costClause}. Your breath catches in tight rasps as you steady yourself against the strain.`;
      }
      return `You carry out ${ctx.actionText} with measured precision, turning the moment cleanly in your favor (${ctx.consequence || 'the path opens forward'}). Every motion settles into place across ${ctx.locationName}, giving you room to read the terrain and anticipate what shifts next.`;
    })();

    const p2 = (() => {
      if (ctx.travelArrival) {
        return `After long watches on the open trail, the horizon breaks apart and the silhouette of ${ctx.travelArrival.destinationName} rises directly ahead. Lantern smoke, stone thresholds, and guarded voices wash over your senses as the road closes behind your boots and a sharper tension takes hold inside the gates.`;
      }
      if (ctx.travel) {
        const routeNote = ctx.travel.routeName ? ` along ${ctx.travel.routeName}` : '';
        const partyText = companion ? ` ${companion} stays alert beside the pack animals, glancing over at you: "Keep your eyes on the ridge ahead — the stretch toward ${ctx.travel.nextStopName || ctx.travel.destinationName} rarely stays quiet."` : '';
        return `The march continues across the corridor between ${ctx.travel.currentStopName} and ${ctx.travel.destinationName}${routeNote}, marked by shifting light and steady road weariness.${partyText}`;
      }
      const npcDialogue = companion
        ? ` Beside you, ${companion} lowers their voice: "Hold steady here in ${ctx.locationName}; every step counts now."`
        : '';
      return `Around ${ctx.locationName}, cold air drifts across worn timber and stone while shadows stretch across the ground.${npcDialogue} Even small noises carry sharply through the dry air.`;
    })();

    const p3 = (() => {
      if (ctx.encounter) {
        const beastNote = ctx.encounter.creatureName
          ? ` The unmistakable sign of ${ctx.encounter.creatureName} stirs nearby, keeping every nerve taut.`
          : '';
        return `Before the dust settles, "${ctx.encounter.title}" commands the center of attention: ${ctx.encounter.premise}.${beastNote} Those nearby shift into readiness as the immediate dilemma demands an answer before the window closes.`;
      }
      if (ctx.questSummaries[0]) {
        return `In the quiet breath between motions, the weight of your current objective (${ctx.questSummaries[0]}) presses forward, pointing toward your next decisive move across ${ctx.locationName}.`;
      }
      return `Every trace around ${ctx.locationName} signals that lingering here too long invites trouble, leaving the next turn squarely in your hands.`;
    })();

    return {
      narrative: [p1, p2, p3].join('\n\n'),
      choices,
      extractedMemories: [
        {
          category: 'story',
          importance: 6,
          summary: `${ctx.locationName}: ${ctx.actionText} (${ctx.outcome})`,
        },
      ],
    };
  }

  // Persian narrative (~110-150 words across 3 clean paragraphs, zero foreign script leaks)
  const p1Fa = (() => {
    if (ctx.outcome === 'failure' || ctx.outcome === 'critical_failure') {
      const dirText = ctx.failureDirective || ctx.consequence || 'برخورد سخت و واژگون شدن تعادل کار را دشوار ساخت';
      return `به محض آنکه برای «${ctx.actionText}» پیش می‌تازی، زمینِ ناهموار زیر پایت سُست می‌شود و حرکتت به نتیجه دلخواه نمی‌رسد؛ ${dirText}. ضربهٔ ناگهانی، شکست سنگینِ نبض حرکت را به دوش تو می‌گذارد و گرد و غبار خشک فضا، لحظه‌ای دیدت را تیره می‌کند تا ناچار شوی با شتاب موضع تازه‌ای بگیری.`;
    }
    if (ctx.outcome === 'mixed_success') {
      const costText = ctx.costLine || 'خراش سوزان روی بازو، خستگی نفس‌گیر در سینه و جلب توجه ناخواسته اطرافیان';
      return `با تمرکز کامل دست به «${ctx.actionText}» می‌زنی و گره پیش‌رو را به دشواری می‌گشایی (${ctx.consequence || 'گام نخست برداشته شد'})، اما این پیشروی بدون هزینه نیست: بهای سختِ حرکت با ${costText} بر تنت می‌نشیند. دردِ گنگِ عضلات و سنگینیِ نَفَس به تو یادآوری می‌کند که فرصت اندک است.`;
    }
    return `هنگامی که برای «${ctx.actionText}» اقدام می‌کنی، سنجش دقیقِ فاصله و زمان به یاریت می‌آید و مانع را با اطمینان پشت سر می‌گذاری (${ctx.consequence || 'مسیر به درستی گشوده شد'}). نظم گام‌ها و تسلطت بر فضای ${ctx.locationName} باعث می‌شود نبض صحنه در دستانت بماند و نشانه‌های پنهان محیط روشن‌تر دیده شوند.`;
  })();

  const p2Fa = (() => {
    if (ctx.travelArrival) {
      return `پس از سپری شدن روزهای سختِ جاده، سرانجام پسِ پیچ آخر، خط و نشانِ «${ctx.travelArrival.destinationName}» پیش چشم پدیدار می‌شود و کاروان به درون محدوده آن گام می‌گذارد. بوی دود اجاق‌ها، غرش گام‌های سنگین و همهمه نگهبانان در فضا می‌پیچد و فصل تازه‌ای از ماجرا در آستانه همین منزلگاه آغاز می‌شود.`;
    }
    if (ctx.travel) {
      const nextStop = ctx.travel.nextStopName || ctx.travel.destinationName;
      const talkFa = companion
        ? ` کنار ستوران، ${companion} با صدایی آهسته و هوشیار رو به تو می‌گوید: «چشم از تیغه‌های جاده برندار؛ مسیر پیش‌رو تا ${nextStop} همیشه آبستن حادثه است.»`
        : '';
      return `در میانه راه میان «${ctx.travel.currentStopName}» و «${ctx.travel.destinationName}» حرکت کاروان با تغییر نور آسمان و خستگیِ مرکب‌ها ادامه می‌یابد و بادِ خاکی خط افق را می‌آشوبد.${talkFa}`;
    }
    const localTalkFa = companion
      ? ` در همین لحظه ${companion} نگاهی گذرا به اطراف می‌اندازد و با لحنی سنجیده زمزمه می‌کند: «در ${ctx.locationName} هر درنگی بهایی دارد؛ باید تصمیم بعدی را دقیق گرفت.»`
      : '';
    return `در پهنهٔ ${ctx.locationName}، نسیم خشک از لابه‌لای سنگ‌ها و سایه‌های کشیده می‌گذرد و هر صدای خفیفی در سکوت فضا پژواک پیدا می‌کند.${localTalkFa}`;
  })();

  const p3Fa = (() => {
    if (ctx.encounter) {
      const creatureLine = ctx.encounter.creatureName
        ? ` حضور نزدیک و تهدیدآمیز «${ctx.encounter.creatureName}» سایه سنگینی بر حرکت همه می‌اندازد و مجال غفلت نمی‌گذارد.`
        : '';
      return `درست در همین دم، رخداد «${ctx.encounter.title}» کانون صحنه را در بر می‌گیرد: ${ctx.encounter.premise}.${creatureLine} نگاه‌های حاضر آمادهٔ واکنشند و این موقعیت پیش از بسته شدنِ فرصت، پاسخی قاطع از تو می‌طلبد.`;
    }
    if (ctx.questSummaries[0]) {
      return `نشانهٔ مأموریت فعال (${ctx.questSummaries[0]}) همچنان در پیشِ چشم توست و فضای ${ctx.locationName} گام بعدی را به سمت حل گره اصلی داستان فرا می‌خواند.`;
    }
    return `نشانه‌های پراکنده در ${ctx.locationName} خبر از تغییر وضعیت محیط می‌دهند و اکنون انتخابِ هوشمندانهٔ مسیر بعدی در دستان توست.`;
  })();

  return {
    narrative: [p1Fa, p2Fa, p3Fa].join('\n\n'),
    choices,
    extractedMemories: [
      {
        category: 'story',
        importance: 6,
        summary: `${ctx.locationName}: ${ctx.actionText} (${ctx.outcome})`,
      },
    ],
  };
}

function readScriptFile(scriptPath?: string): LocalPlaytestScriptFile | null {
  const candidatePath =
    scriptPath ||
    process.env.STORYFORGE_LOCAL_SCRIPT_PATH ||
    path.resolve(process.cwd(), '.storyforge-local-script.json');
  if (!candidatePath || !fs.existsSync(candidatePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(candidatePath, 'utf-8'));
    if (Array.isArray(parsed)) return { scenes: parsed };
    if (parsed && typeof parsed === 'object') return parsed as LocalPlaytestScriptFile;
  } catch (err) {
    console.warn('[localPlaytestNarrator] Failed to parse local script file:', err);
  }
  return null;
}

async function emitStreamedChunks(
  narrative: string,
  onTextDelta?: (delta: string) => void
): Promise<void> {
  if (typeof onTextDelta !== 'function' || !narrative) return;
  const words = narrative.split(/(\s+)/);
  const chunkSize = 8;
  for (let i = 0; i < words.length; i += chunkSize) {
    onTextDelta(words.slice(i, i + chunkSize).join(''));
  }
}

/**
 * Creates a zero-network SceneModelCall driven by Antigravity-local synthesis
 * or an optional pre-authored JSON script queue/map.
 */
export function createLocalPlaytestModelCall(
  options: LocalPlaytestOptions = {}
): SceneModelCall {
  let turnCounter = 0;
  let scriptIndex = 0;

  return async (
    prompt: GenerationPromptPayload,
    modelOptions: SceneModelOptions = {}
  ): Promise<RawSceneResult | null> => {
    turnCounter += 1;

    const scriptObj: LocalPlaytestScriptFile | null = options.script
      ? Array.isArray(options.script)
        ? { scenes: options.script }
        : options.script
      : readScriptFile(options.scriptPath);

    let data: RawSceneData | undefined;
    if (scriptObj) {
      const turnKey = String(turnCounter);
      if (scriptObj.turns && scriptObj.turns[turnKey]) {
        data = scriptObj.turns[turnKey];
      } else if (Array.isArray(scriptObj.scenes) && scriptIndex < scriptObj.scenes.length) {
        data = scriptObj.scenes[scriptIndex];
        scriptIndex += 1;
      }
    }

    if (!data) {
      data = synthesizeLocalPlaytestScene(prompt, turnCounter);
    }

    if (typeof modelOptions.onTextDelta === 'function' && typeof data.narrative === 'string') {
      await emitStreamedChunks(data.narrative, modelOptions.onTextDelta);
    }

    return {
      data,
      rawText: JSON.stringify(data),
      modelUsed: 'antigravity-local',
    };
  };
}

/**
 * Dynamically constructs a `GeminiAdapter` bound strictly to the local
 * Antigravity zero-API model call seam (never invoking external Gemini/AI APIs).
 */
export async function createLocalPlaytestAdapter(
  options: LocalPlaytestOptions = {}
): Promise<GeminiAdapter> {
  const { GeminiAdapter } = await import('./GeminiAdapter');
  return new GeminiAdapter(undefined, 'antigravity-local', {
    modelCall: createLocalPlaytestModelCall(options),
  });
}
