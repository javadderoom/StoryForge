import { NextRequest, NextResponse } from 'next/server';
import { ActionCategoryRepository } from '@/lib/db/repositories/actionCategoryRepository';
import { ActionCategorySchema } from '@/lib/types/actionCategory';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireStudioWrite } from '@/lib/auth/studioAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain') || undefined;
    const worldId = searchParams.get('worldId') || undefined;
    const search = searchParams.get('search') || undefined;

    const categories = await ActionCategoryRepository.getAll({
      domain,
      worldId,
      search,
    });

    return NextResponse.json(
      { success: true, data: categories },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('Error fetching action categories:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch action categories' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const parseResult = ActionCategorySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parseResult.error.format(),
        },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    const result = await ActionCategoryRepository.create(parseResult.data);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201, headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('Error creating action category:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create action category' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
