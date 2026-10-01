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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category =
      (await ActionCategoryRepository.getById(id)) ||
      (await ActionCategoryRepository.getByCode(id));

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Action category not found' },
        { status: 404, headers: buildCorsHeaders(req) }
      );
    }

    return NextResponse.json(
      { success: true, data: category },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('Error fetching action category:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch action category' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await req.json();

    const partialSchema = ActionCategorySchema.partial();
    const parseResult = partialSchema.safeParse(body);

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

    const result = await ActionCategoryRepository.update(id, parseResult.data);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('Error updating action category:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update action category' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const result = await ActionCategoryRepository.delete(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Action category deleted successfully' },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('Error deleting action category:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete action category' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
