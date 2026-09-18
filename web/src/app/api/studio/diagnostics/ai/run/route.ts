import { NextRequest, NextResponse } from 'next/server';
import { EVAL_SCENARIOS } from '@/lib/evals/evalScenarios';
import { runScenario } from '@/lib/evals/evalRunner';
import { replaySceneModelCall, missingSceneModelCall } from '@/lib/evals/modelReplay';
import { loadCassette, listCassetteModels } from '@/lib/evals/cassetteStore';
import { defaultSceneModelCall } from '@/lib/engines/narrative/modelCall';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';

/**
 * Plan 14 — Tier 5: Studio Diagnostic Bench backend.
 * Lists the golden scenarios and runs one on demand (cassette replay by default,
 * live when explicitly requested).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: {
        scenarios: EVAL_SCENARIOS.map((s) => ({
          id: s.id,
          title: s.title,
          invariant: s.invariant,
          language: s.language,
        })),
        cassetteModels: listCassetteModels(),
      },
    },
    { headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenarioId, modelId = 'gemini-3.5-flash-lite', live = false, judge = false } = body ?? {};

    const scenario = EVAL_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { success: false, error: `Unknown scenario "${scenarioId}".` },
        { status: 404, headers: corsHeaders }
      );
    }

    let modelCall;
    if (live) {
      modelCall = defaultSceneModelCall;
    } else {
      const cassette = loadCassette(modelId, scenarioId);
      modelCall = cassette ? replaySceneModelCall(cassette, modelId) : missingSceneModelCall();
    }

    const result = await runScenario(scenario, {
      modelId,
      modelCall,
      source: live ? 'live' : 'cassette',
      judge: judge ? { modelCall: defaultSceneModelCall, modelId: 'judge' } : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...result,
          // Raw payloads can be large; strip the memory field for the UI while
          // keeping the narrative + choices the bench renders.
          raw: result.raw ? { narrative: result.raw.narrative, choices: result.raw.choices } : null,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Evaluation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: corsHeaders });
  }
}
