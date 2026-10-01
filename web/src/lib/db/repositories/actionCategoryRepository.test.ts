import 'dotenv/config';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../client';
import { ActionCategoryRepository } from './actionCategoryRepository';

describe('ActionCategoryRepository — Database CRUD', () => {
  const testCode = 'test_sample_category_unique';
  let createdId: string;

  before(async () => {
    // Clean up if left over
    await prisma.actionCategory.deleteMany({ where: { code: testCode } });
  });

  after(async () => {
    await prisma.actionCategory.deleteMany({ where: { code: testCode } });
    await prisma.$disconnect();
  });

  test('getAll returns categories from database', async () => {
    const list = await ActionCategoryRepository.getAll();
    assert.ok(Array.isArray(list));
    assert.ok(list.length > 0, 'Database should contain seeded categories');
    const lightProj = list.find((c) => c.code === 'incoming_light_projectile');
    assert.ok(lightProj, 'Seeded incoming_light_projectile should exist in database');
    assert.equal(lightProj?.domain, 'combat_defense');
  });

  test('create creates a new action category in the database', async () => {
    const res = await ActionCategoryRepository.create({
      code: testCode,
      nameFa: 'دسته تستی',
      nameEn: 'Test Category',
      domain: 'combat_defense',
      description: 'توضیحات آزمایشی برای پایگاه داده',
      tags: ['تست', 'آزمایش'],
    });

    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.equal(res.data?.code, testCode);
    assert.equal(res.data?.nameEn, 'Test Category');
    createdId = res.data!.id;
  });

  test('getByCode retrieves the category by unique code', async () => {
    const cat = await ActionCategoryRepository.getByCode(testCode);
    assert.ok(cat);
    assert.equal(cat?.id, createdId);
    assert.equal(cat?.nameFa, 'دسته تستی');
  });

  test('update modifies category fields', async () => {
    const updateRes = await ActionCategoryRepository.update(createdId, {
      nameEn: 'Updated Test Category',
      description: 'بروزرسانی شده',
    });

    assert.equal(updateRes.success, true);
    assert.equal(updateRes.data?.nameEn, 'Updated Test Category');
    assert.equal(updateRes.data?.description, 'بروزرسانی شده');

    const fetched = await ActionCategoryRepository.getById(createdId);
    assert.equal(fetched?.nameEn, 'Updated Test Category');
  });

  test('delete removes the category from the database', async () => {
    const delRes = await ActionCategoryRepository.delete(createdId);
    assert.equal(delRes.success, true);

    const fetched = await ActionCategoryRepository.getById(createdId);
    assert.equal(fetched, null);
  });
});
