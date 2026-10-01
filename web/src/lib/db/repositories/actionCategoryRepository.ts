import { prisma } from '../client';
import { ActionCategory, ActionCategoryInput } from '@/lib/types/actionCategory';

export interface ActionCategoryFilters {
  domain?: string;
  worldId?: string | null;
  search?: string;
  includeGlobal?: boolean;
}

export class ActionCategoryRepository {
  /**
   * Fetches all action categories matching optional filters.
   * If worldId is specified and includeGlobal is true (default), returns both
   * global system categories and world-specific custom categories.
   */
  static async getAll(filters?: ActionCategoryFilters): Promise<ActionCategory[]> {
    try {
      const where: any = {};

      if (filters?.domain && filters.domain !== 'all') {
        where.domain = filters.domain;
      }

      if (filters?.worldId) {
        if (filters.includeGlobal !== false) {
          where.OR = [{ worldId: null }, { worldId: filters.worldId }];
        } else {
          where.worldId = filters.worldId;
        }
      }

      if (filters?.search && filters.search.trim()) {
        const query = filters.search.trim();
        const searchCondition = [
          { code: { contains: query, mode: 'insensitive' } },
          { nameFa: { contains: query, mode: 'insensitive' } },
          { nameEn: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } },
        ];
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: searchCondition }];
          delete where.OR;
        } else {
          where.OR = searchCondition;
        }
      }

      const rows = await prisma.actionCategory.findMany({
        where,
        orderBy: [{ domain: 'asc' }, { code: 'asc' }],
      });

      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        nameFa: r.nameFa,
        nameEn: r.nameEn,
        domain: r.domain,
        description: r.description,
        tags: r.tags,
        isSystem: r.isSystem,
        worldId: r.worldId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch (error) {
      console.error('Failed to fetch action categories from database:', error);
      return [];
    }
  }

  /**
   * Fetches a single category by its unique code (slug).
   */
  static async getByCode(code: string): Promise<ActionCategory | null> {
    try {
      const row = await prisma.actionCategory.findUnique({
        where: { code },
      });
      if (!row) return null;
      return {
        id: row.id,
        code: row.code,
        nameFa: row.nameFa,
        nameEn: row.nameEn,
        domain: row.domain,
        description: row.description,
        tags: row.tags,
        isSystem: row.isSystem,
        worldId: row.worldId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    } catch (error) {
      console.error(`Failed to get action category by code ${code}:`, error);
      return null;
    }
  }

  /**
   * Fetches a single category by its primary ID.
   */
  static async getById(id: string): Promise<ActionCategory | null> {
    try {
      const row = await prisma.actionCategory.findUnique({
        where: { id },
      });
      if (!row) return null;
      return {
        id: row.id,
        code: row.code,
        nameFa: row.nameFa,
        nameEn: row.nameEn,
        domain: row.domain,
        description: row.description,
        tags: row.tags,
        isSystem: row.isSystem,
        worldId: row.worldId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    } catch (error) {
      console.error(`Failed to get action category by id ${id}:`, error);
      return null;
    }
  }

  /**
   * Creates a new action category.
   */
  static async create(input: ActionCategoryInput): Promise<{ success: boolean; data?: ActionCategory; error?: string }> {
    try {
      const existing = await prisma.actionCategory.findUnique({
        where: { code: input.code },
      });
      if (existing) {
        return { success: false, error: `Action category with code "${input.code}" already exists.` };
      }

      const row = await prisma.actionCategory.create({
        data: {
          code: input.code,
          nameFa: input.nameFa,
          nameEn: input.nameEn,
          domain: input.domain,
          description: input.description || null,
          tags: input.tags || [],
          isSystem: Boolean(input.isSystem),
          worldId: input.worldId || null,
        },
      });

      return {
        success: true,
        data: {
          id: row.id,
          code: row.code,
          nameFa: row.nameFa,
          nameEn: row.nameEn,
          domain: row.domain,
          description: row.description,
          tags: row.tags,
          isSystem: row.isSystem,
          worldId: row.worldId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      };
    } catch (error: any) {
      console.error('Failed to create action category:', error);
      return { success: false, error: error?.message || 'Database error creating action category' };
    }
  }

  /**
   * Updates an existing action category.
   */
  static async update(
    id: string,
    input: Partial<ActionCategoryInput>
  ): Promise<{ success: boolean; data?: ActionCategory; error?: string }> {
    try {
      const existing = await prisma.actionCategory.findUnique({ where: { id } });
      if (!existing) {
        return { success: false, error: `Action category with id "${id}" not found.` };
      }

      // If code is changing, check uniqueness
      if (input.code && input.code !== existing.code) {
        const codeConflict = await prisma.actionCategory.findUnique({
          where: { code: input.code },
        });
        if (codeConflict) {
          return { success: false, error: `Action category with code "${input.code}" already exists.` };
        }
      }

      const row = await prisma.actionCategory.update({
        where: { id },
        data: {
          code: input.code ?? undefined,
          nameFa: input.nameFa ?? undefined,
          nameEn: input.nameEn ?? undefined,
          domain: input.domain ?? undefined,
          description: input.description !== undefined ? input.description : undefined,
          tags: input.tags ?? undefined,
          worldId: input.worldId !== undefined ? input.worldId : undefined,
        },
      });

      return {
        success: true,
        data: {
          id: row.id,
          code: row.code,
          nameFa: row.nameFa,
          nameEn: row.nameEn,
          domain: row.domain,
          description: row.description,
          tags: row.tags,
          isSystem: row.isSystem,
          worldId: row.worldId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      };
    } catch (error: any) {
      console.error(`Failed to update action category ${id}:`, error);
      return { success: false, error: error?.message || 'Database error updating action category' };
    }
  }

  /**
   * Deletes an action category.
   */
  static async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await prisma.actionCategory.findUnique({ where: { id } });
      if (!existing) {
        return { success: false, error: `Action category with id "${id}" not found.` };
      }

      await prisma.actionCategory.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      console.error(`Failed to delete action category ${id}:`, error);
      return { success: false, error: error?.message || 'Database error deleting action category' };
    }
  }
}
