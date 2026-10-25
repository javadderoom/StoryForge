import https from 'https';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZjJmMmFhYi1kNzQyLTRjYWEtYjA1My1jMTg0YmY5ZGU4ZTEiLCJwaG9uZU51bWJlciI6Iis5ODkyMTEzNTEzMzAiLCJlbWFpbCI6bnVsbCwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzkyNTk4NjM2LCJleHAiOjE3OTUxOTA2MzZ9.9kiAmsjO_Quj8TumxFWuFTKmbzPlr-Oo4YcJqJF5DK4';

interface Coord {
  x: number;
  y: number;
}

const ARC1_COORDINATES: Record<string, Coord> = {
  loc_mtr1h3jy_8dv6: { x: 1235, y: 955 }, // زرین پل (Zarrin-Pol) - User Anchor
  loc_mtr2c3uu_yocj: { x: 1155, y: 980 }, // کاروانسرای شاخ زرین (Shakh-e Zarrin)
  loc_mv00yw4l_lbqn: { x: 975, y: 910 },  // بادپناه (Badpanah)
  loc_rabat_sorkh:   { x: 740, y: 850 },  // رباط سرخ (Rabat-e Sorkh)
  loc_muzo9ij9_ycy6: { x: 480, y: 800 },  // چاه سنگ (Chah-e Sang)
  loc_mtpqnxvl_jdgi: { x: 620, y: 720 },  // دشت هیرام (Hiram Plains)
  loc_mtpnybon_rkj2: { x: 780, y: 680 },  // گذرگاه هیرام (Hiram Pass)
  loc_mtpqfg8n_ns2i: { x: 1260, y: 820 }, // زروان‌رود (Zarvan River)
};

const CARAVAN_WAYPOINTS: Coord[] = [
  { x: 610, y: 825 },
  { x: 740, y: 850 },
  { x: 860, y: 880 },
  { x: 975, y: 910 },
  { x: 1070, y: 950 },
];

function request(url: string, options: https.RequestOptions, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('1. Fetching story_mt4ofllt from https://afsanehsaz.ir...');
  const getRes = await request('https://afsanehsaz.ir/api/studio/stories?id=story_mt4ofllt', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (getRes.status !== 200 || !getRes.data?.success) {
    console.error('Failed to fetch story:', getRes);
    process.exit(1);
  }

  const story = getRes.data.data;
  console.log(`Story found: "${story.title}" (${story.id})`);

  // 1. Update locations in worldBible.locations
  let updatedLocCount = 0;
  for (const loc of story.worldBible?.locations || []) {
    if (ARC1_COORDINATES[loc.id]) {
      const newCoord = ARC1_COORDINATES[loc.id];
      console.log(`Updating ${loc.name} (${loc.id}):`, loc.coordinates, '->', newCoord);
      loc.coordinates = newCoord;
      loc.coordinatesSource = 'manual';
      updatedLocCount++;
    }
  }
  console.log(`Updated ${updatedLocCount} locations in worldBible.locations.`);

  // 2. Synchronize any placements in mapData.placements
  if (story.worldBible?.mapData?.placements) {
    for (const p of story.worldBible.mapData.placements) {
      if (ARC1_COORDINATES[p.entityId]) {
        const newCoord = ARC1_COORDINATES[p.entityId];
        console.log(`Updating placement ${p.id} for ${p.entityId}: (${p.x}, ${p.y}) -> (${newCoord.x}, ${newCoord.y})`);
        p.x = newCoord.x;
        p.y = newCoord.y;
      }
    }
  }

  // 3. Update the trade route "چاه سنگ - زرین پل"
  const tradeRoutes = story.worldBible?.tradeRoutes || [];
  const caravanRoute = tradeRoutes.find((r: any) =>
    r.originLocationId === 'loc_muzo9ij9_ycy6' || r.destinationLocationId === 'loc_mtr2c3uu_yocj' || (r.name && r.name.includes('چاه سنگ'))
  );

  if (caravanRoute) {
    console.log(`Found trade route: "${caravanRoute.name}" (${caravanRoute.id})`);
    caravanRoute.originLocationId = 'loc_muzo9ij9_ycy6';
    caravanRoute.destinationLocationId = 'loc_mtr2c3uu_yocj';
    caravanRoute.waypoints = CARAVAN_WAYPOINTS;
    console.log(`Updated trade route waypoints:`, caravanRoute.waypoints);
  } else {
    console.warn('Could not find "چاه سنگ - زرین پل" trade route.');
  }

  // 4. Save to production
  console.log('2. Saving updated story manifest to production...');
  const postRes = await request('https://afsanehsaz.ir/api/studio/stories', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, story);

  console.log('Update response status:', postRes.status);
  console.log('Update message:', postRes.data?.message || postRes.data?.error);
  if (postRes.data?.success) {
    console.log('Arc 1 locations and caravan route successfully updated on production!');
  } else {
    console.error('Update failed:', postRes.data);
    process.exit(1);
  }
}

main().catch(console.error);
