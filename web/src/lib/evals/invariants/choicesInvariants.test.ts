import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChoices } from '@/lib/providers/GeminiAdapter';

const STATS = ['might', 'cunning', 'agility', 'charisma', 'arcana'];
const VALID_STYLES = new Set([
  'defensive', 'agile', 'aggressive', 'diplomatic', 'inquisitive', 'tactical', 'stealthy', 'free_text',
]);
const VALID_RISKS = new Set(['low', 'medium', 'high']);

/** Armed standoffs / confrontations that MUST become real dice checks (EN + FA). */
const STANDOFF_TEXTS = [
  'Rest hand on the hilt of the sword and lock eyes with the sentry',
  'Draw your blade and confront the guard at the checkpoint',
  'Grab the spear from the sentry and shove him aside',
  'Level your crossbow at the bandit and demand he stand down',
  'Threaten the guard with your weapon',
  'Interrogate the sentry about the sealed bridge',
  'Intimidate the commander into opening the gate',
  'Attack the sentry with your sword',
  'Coerce the guard into silence',
  'Stab the sentry in the dark',
  'Shoot the sentry before he can raise the alarm',
  'Sneak past the armed guard',
  'Pickpocket the sentry at the gate',
  'دست گذاشتن روی دستهٔ شمشیر و نگاه کردن به چشم‌های گزمه',
  'کشیدن تیغه و تهدید نگهبان دروازه',
  'نشانه گرفتن تفنگ به سوی راهزن و وادار کردنش به عقب‌نشینی',
  'بازجویی سرد از پاسبان درباره‌ی پل بسته',
  'ارعاب فرمانده برای باز کردن دروازه',
  'حمله به گزمه با شمشیر',
  'دزدی از نگهبان کنار دروازه',
  'جاخالی دادن از نیزهٔ گزمه',
];

/** Peaceful, routine actions that must remain diceless. */
const PEACEFUL_TEXTS = [
  'Greet the innkeeper and ask his name',
  'Sit by the fire and rest a while',
  'Buy a loaf of bread from the baker',
  'Follow the road quietly onward',
  'از پیرمرد مهمان‌خانه‌دار نامش را بپرس',
  'کنار آتش بنشین و استراحت کن',
  'از نانوا یک قرص نان بخر',
];

describe('Tier 1 — normalizeChoices: standoff safety net', () => {
  it('never leaves an armed standoff / confrontation diceless', () => {
    for (const text of STANDOFF_TEXTS) {
      const out = normalizeChoices([{ id: 'c', text }], STATS, false);
      assert.equal(out.length, 1, `choice dropped: ${text}`);
      assert.ok(out[0].requiredStatId !== undefined, `standoff was diceless: ${text}`);
      assert.ok(
        typeof out[0].targetDC === 'number' && out[0].targetDC >= 9,
        `standoff lacked a calibrated DC: ${text}`
      );
    }
  });

  it('keeps genuinely peaceful routine actions diceless', () => {
    for (const text of PEACEFUL_TEXTS) {
      const out = normalizeChoices([{ id: 'c', text }], STATS, false);
      assert.equal(out.length, 1, `choice dropped: ${text}`);
      assert.equal(out[0].requiredStatId, undefined, `peaceful action wrongly forced a check: ${text}`);
      assert.equal(out[0].targetDC, undefined, `peaceful action wrongly got a DC: ${text}`);
    }
  });

  it('forces a check for high-risk choices even without confrontational keywords', () => {
    const out = normalizeChoices([{ id: 'c', text: 'Reach for the ledge', riskLevel: 'high' }], STATS, true);
    assert.equal(out.length, 1);
    assert.ok(out[0].requiredStatId !== undefined);
    assert.ok(typeof out[0].targetDC === 'number');
  });
});

describe('Tier 1 — normalizeChoices: structural hardening (55 adversarial arrays)', () => {
  const BATCH = Array.from({ length: 55 }, (_, i) => {
    const mode = i % 5;
    switch (mode) {
      case 0:
        return { text: `Nameless action ${i}` }; // missing id
      case 1:
        return { id: `c${i}`, text: `Snake case ${i}`, required_stat_id: 'cunning', target_dc: 99 };
      case 2:
        return { id: `c${i}`, text: `Extreme DC ${i}`, requiredStatId: 'might', targetDC: 99 };
      case 3:
        return { id: `c${i}`, text: `Unknown stat ${i}`, requiredStatId: `hacking_${i}` };
      default:
        return { id: `c${i}`, text: `Studio shape ${i}`, check: { stat: 'نیرو' } };
    }
  });

  it('survives every adversarial shape with valid ids, styles, risks, and DC bounds', () => {
    for (const raw of BATCH) {
      const out = normalizeChoices([raw], STATS, false);
      assert.equal(out.length, 1, `array dropped entirely: ${JSON.stringify(raw)}`);
      const c = out[0];
      assert.equal(typeof c.id, 'string');
      assert.ok(c.id.length > 0);
      assert.ok(VALID_STYLES.has(c.style), `invalid style: ${c.style}`);
      assert.ok(VALID_RISKS.has(c.riskLevel), `invalid risk: ${c.riskLevel}`);
      if (c.targetDC !== undefined) {
        assert.ok(c.targetDC >= 5 && c.targetDC <= 30, `DC out of bounds: ${c.targetDC}`);
        if (c.riskLevel === 'low') assert.ok(c.targetDC >= 8 && c.targetDC <= 10, `low DC out of band: ${c.targetDC}`);
        if (c.riskLevel === 'medium') assert.ok(c.targetDC >= 11 && c.targetDC <= 13, `medium DC out of band: ${c.targetDC}`);
        if (c.riskLevel === 'high') assert.ok(c.targetDC >= 14 && c.targetDC <= 16, `high DC out of band: ${c.targetDC}`);
      }
    }
  });

  it('binds unknown stat values to the story first stat instead of dropping', () => {
    const out = normalizeChoices([{ id: 'c', text: 'Hack the terminal', requiredStatId: 'hacking' }], STATS, true);
    assert.equal(out.length, 1);
    assert.equal(out[0].requiredStatId, 'might');
  });

  it('resolves synonyms, Persian names, snake_case, and Studio check.stat shape', () => {
    const out = normalizeChoices(
      [
        { id: 'a', text: 'Punch', requiredStatId: 'strength' },
        { id: 'b', text: 'نگاهی موذیانه', stat: 'نیرو' },
        { id: 'c', text: 'Cast', check: { stat: 'arcana' } },
        { id: 'd', text: 'Slip', required_stat_id: 'چابکی' },
      ],
      STATS,
      true
    );
    assert.equal(out.length, 4);
    assert.equal(out[0].requiredStatId, 'might');
    assert.equal(out[1].requiredStatId, 'might');
    assert.equal(out[2].requiredStatId, 'arcana');
    assert.equal(out[3].requiredStatId, 'agility');
  });

  it('clamps extreme DCs and coerces invalid enum values', () => {
    const out = normalizeChoices(
      [{ id: 'c', text: 'Do it', requiredStatId: 'MIGHT', style: 'wild', riskLevel: 'extreme', targetDC: 0 }],
      STATS,
      true
    );
    assert.equal(out.length, 1);
    // Absolute floor 5, then pulled into the medium band (11-13).
    assert.equal(out[0].targetDC, 11);
    assert.equal(out[0].style, 'tactical');
    assert.equal(out[0].riskLevel, 'medium');
  });

  it('caps the panel at 4 choices and returns [] for non-arrays', () => {
    const raw = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, text: `Choice ${i}` }));
    assert.equal(normalizeChoices(raw, STATS, true).length, 4);
    assert.deepEqual(normalizeChoices('nonsense', STATS, true), []);
    assert.deepEqual(normalizeChoices(null, STATS, true), []);
  });

  it('applies the low-base DC band (6-11) when isLowBase is true', () => {
    const out = normalizeChoices(
      [
        { id: 'l', text: 'Sneak past guard', requiredStatId: 'agility', riskLevel: 'low' },
        { id: 'm', text: 'Climb the wall', requiredStatId: 'might', riskLevel: 'medium' },
        { id: 'h', text: 'Leap the chasm', requiredStatId: 'agility', riskLevel: 'high' },
      ],
      STATS,
      true,
      true
    );
    assert.equal(out.length, 3);
    for (const c of out) {
      assert.ok(c.targetDC !== undefined && c.targetDC >= 6 && c.targetDC <= 11, `low-base DC: ${c.targetDC}`);
    }
  });
});
