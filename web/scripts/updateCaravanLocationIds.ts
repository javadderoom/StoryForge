import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Database not configured');
  }

  const storyId = 'story_mt4ofllt';
  const story = await prisma.story.findUnique({
    where: { id: storyId },
  });

  if (!story) {
    throw new Error(`Story ${storyId} not found`);
  }

  const manifest = story.manifest as any;
  const wb = manifest.worldBible || {};
  if (!wb.npcs) wb.npcs = [];

  // Mapping of NPC IDs to the locations they should be applicable in
  const locationUpdates: Record<string, string[]> = {
    // Caravan Members (Ensure presence in Caravanserai loc_mtr2c3uu_yocj, Bridge Bazaar loc_mtr1pzab_6vyq, and city loc_mtr1h3jy_8dv6)
    npc_borzou: [
      'loc_muzo9ij9_ycy6', // چاه سنگ
      'loc_rabat_sorkh',  // رباط سرخ
      'loc_mtr1h3jy_8dv6', // زرین پل
      'loc_mtr2c3uu_yocj', // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq', // بازارچهٔ معلق پل
      'loc_mtr1r2eu_25da', // پایاب لجن‌نشینان (for secret handover to Shiroo & Kaveh)
    ],
    npc_mv0uzcpc: [
      'loc_mv0qancl_iked', // سپیدچال
      'loc_rabat_sorkh',  // رباط سرخ
      'loc_mtr1h3jy_8dv6', // زرین پل
      'loc_mtr2c3uu_yocj', // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq', // بازارچهٔ معلق پل
      'loc_mtrk8zp0_krgv', // صرافی سیمین‌سنج (colluding with Tahmineh)
    ],
    npc_mv0zr4qq: [
      'loc_tangeh_niloufar', // تنگه نیلوفر
      'loc_rabat_sorkh',    // رباط سرخ
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
    ],
    npc_maziar: [
      'loc_rabat_sorkh',    // رباط سرخ
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
      'loc_mtr1r2eu_25da',   // پایاب لجن‌نشینان (connecting to Balamran boatmen)
    ],
    npc_bahram: [
      'loc_muzo9ij9_ycy6',   // چاه سنگ
      'loc_rabat_sorkh',    // رباط سرخ
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
    ],
    npc_farrokhzad: [
      'loc_mv0qancl_iked',   // سپیدچال
      'loc_mv00yw4l_lbqn',   // بادپناه
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
    ],
    npc_sohrab: [
      'loc_mv00yw4l_lbqn',   // بادپناه
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
    ],
    npc_parviz: [
      'loc_mtptnyfb_qb5k',   // دریاچه زمرد
      'loc_tangeh_niloufar', // تنگه نیلوفر
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
      'loc_mtsh4jjh_h3dk',   // دکه کتیبه‌خوانی (meeting Moobed Hirbod)
    ],
    npc_farangis: [
      'loc_tangeh_niloufar', // تنگه نیلوفر
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
    ],
    npc_sarbanan_hiram: [
      'loc_muzo9ij9_ycy6',   // چاه سنگ
      'loc_rabat_sorkh',    // رباط سرخ
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
    ],
    npc_qaravolan_caravan: [
      'loc_mv0qancl_iked',   // سپیدچال
      'loc_mv00yw4l_lbqn',   // بادپناه
      'loc_mtr1h3jy_8dv6',   // زرین پل
      'loc_mtr2c3uu_yocj',   // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq',   // بازارچهٔ معلق پل
    ],

    // City NPCs (Filling in missing locations for coherence)
    npc_mtr4uw76_bxlj: [ // دادرس مهرداد کاتب
      'loc_mtr1h3jy_8dv6',
      'loc_mtr1or13_qeqs', // ارگ بالادست
      'loc_mtr1pzab_6vyq', // بازارچهٔ معلق پل
      'loc_mtr2l3c9_zcxi', // برج زنجیر
    ],
    npc_mtrco0ka_l9d2: [ // فرمانده ونداد سنگ‌شکن
      'loc_mtr1h3jy_8dv6',
      'loc_mtr2l3c9_zcxi', // برج زنجیر
      'loc_mtr1or13_qeqs', // ارگ بالادست
    ],
    npc_mtreh7m3: [ // ناخدا شیرو لجن‌پا
      'loc_mtr1h3jy_8dv6',
      'loc_mtr1r2eu_25da', // پایاب لجن‌نشینان
      'loc_mtr2k2fz_gnqv', // گُدارِ سرخ
    ],
    npc_mtrjesl0: [ // پیربزرگ کاوه
      'loc_mtr1h3jy_8dv6',
      'loc_mtrjjq37_5zz2', // کارگاه سنگ‌تراشان
      'loc_mtr1r2eu_25da', // پایاب لجن‌نشینان
    ],
    npc_mtrjuctz: [ // اوستا قباد پُتک‌سنگین
      'loc_mtr1h3jy_8dv6',
      'loc_mtrjwxpf_dbq4', // آهنگری قباد
      'loc_mtr2l3c9_zcxi', // برج زنجیر
    ],
    npc_mtrk813x: [ // بانو تهمینه سیمین‌سنج
      'loc_mtr1h3jy_8dv6',
      'loc_mtrk8zp0_krgv', // صرافی سیمین‌سنج
      'loc_mtr1pzab_6vyq', // بازارچهٔ معلق پل
      'loc_mtr2c3uu_yocj', // کاروانسرای شاخ زرین
    ],
    npc_mtsh4zlo: [ // موبد هیربد
      'loc_mtr1h3jy_8dv6',
      'loc_mtsh4jjh_h3dk', // دکه کتیبه خانی
      'loc_mtr1pzab_6vyq', // بازارچهٔ معلق پل
    ],
    npc_mtshsc58: [ // ماه‌بانو دل‌آشوب
      'loc_mtr1h3jy_8dv6',
      'loc_mtshs6ii_do6e', // دکان عطاری دل‌آشوب
      'loc_mtr1pzab_6vyq', // بازارچهٔ معلق پل
      'loc_mtr1r2eu_25da', // پایاب لجن‌نشینان
    ],
    npc_mtsi0ubl: [ // کاروان‌سالار رادمان دشت‌پیما
      'loc_mtr1h3jy_8dv6',
      'loc_mtr2c3uu_yocj', // کاروانسرای شاخ زرین
      'loc_mtr1pzab_6vyq', // بازارچهٔ معلق پل
    ],
    npc_mtsi7yvr: [ // تیام زوبین‌کِش
      'loc_mtr1h3jy_8dv6',
      'loc_mtr2k2fz_gnqv', // گُدار سرخ
      'loc_mtr1r2eu_25da', // پایاب لجن‌نشینان
    ],
    npc_mtsipql5: [ // سرگزمه گرشاسپ زنجیرآهنی
      'loc_mtr1h3jy_8dv6',
      'loc_mtr1or13_qeqs', // ارگ بالادست
      'loc_mtr1pzab_6vyq', // بازارچهٔ معلق پل
      'loc_mtr2l3c9_zcxi', // برج زنجیر
    ],
    npc_mtsk6xwj: [ // دادستان اردشیر تطهیرکننده
      'loc_mtr1h3jy_8dv6',
      'loc_mtr1or13_qeqs', // ارگ بالادست
      'loc_mtr27lm1_vjev', // دخمه‌های کهن زیر ارگ
    ],
  };

  let updatedCount = 0;
  for (const npc of wb.npcs) {
    if (locationUpdates[npc.id]) {
      // Merge unique location IDs
      const currentLocs = Array.isArray(npc.applicableLocationIds) ? npc.applicableLocationIds : [];
      const mergedLocs = Array.from(new Set([...currentLocs, ...locationUpdates[npc.id]]));
      npc.applicableLocationIds = mergedLocs;
      updatedCount++;
      console.log(`Updated ${npc.name} (${npc.id}) -> ${JSON.stringify(mergedLocs)}`);
    }
  }

  manifest.worldBible = wb;

  // Save to story manifest
  await prisma.story.update({
    where: { id: storyId },
    data: { manifest },
  });

  // Also update dedicated world_bibles table
  const wbRow = await prisma.worldBible.findFirst({
    where: { storyId },
  });

  if (wbRow) {
    await prisma.worldBible.update({
      where: { id: wbRow.id },
      data: {
        npcs: wb.npcs as any,
      },
    });
  }

  console.log(`\n✅ Successfully updated applicableLocationIds for ${updatedCount} NPCs in story_mt4ofllt!`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
