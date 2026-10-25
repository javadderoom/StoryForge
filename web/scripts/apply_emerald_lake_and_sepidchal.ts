import https from 'https';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZjJmMmFhYi1kNzQyLTRjYWEtYjA1My1jMTg0YmY5ZGU4ZTEiLCJwaG9uZU51bWJlciI6Iis5ODkyMTEzNTEzMzAiLCJlbWFpbCI6bnVsbCwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzkyNTk4NjM2LCJleHAiOjE3OTUxOTA2MzZ9.9kiAmsjO_Quj8TumxFWuFTKmbzPlr-Oo4YcJqJF5DK4';

interface Coord {
  x: number;
  y: number;
}

const NEW_LOCATIONS: Record<string, Coord> = {
  loc_mtptnyfb_qb5k: { x: 920, y: 460 },   // دریاچهٔ زمرد (Emerald Lake) - Northwest foothills
  loc_mv0qancl_iked: { x: 680, y: 1120 },  // سپیدچال (Sepidchal) - Southern Hiram salt pan
};

// Route: دریاچه زمرد ➔ کاروانسرای شاخ زرین (Shakh-e Zarrin)
const EMERALD_LAKE_ROUTE_WAYPOINTS: Coord[] = [
  { x: 990, y: 620 },
  { x: 1080, y: 800 },
];

// Route: سپیدچال ➔ زرین پل (Zarrin-Pol)
const SEPIDCHAL_ROUTE_WAYPOINTS: Coord[] = [
  { x: 860, y: 1080 },
  { x: 1050, y: 1020 },
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

  // 1. Update coordinates in worldBible.locations
  let updatedCount = 0;
  for (const loc of story.worldBible?.locations || []) {
    if (NEW_LOCATIONS[loc.id]) {
      const targetCoord = NEW_LOCATIONS[loc.id];
      console.log(`Updating ${loc.name} (${loc.id}):`, loc.coordinates, '->', targetCoord);
      loc.coordinates = targetCoord;
      loc.coordinatesSource = 'manual';
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} locations.`);

  // 2. Synchronize any placements in mapData.placements
  if (story.worldBible?.mapData?.placements) {
    for (const p of story.worldBible.mapData.placements) {
      if (NEW_LOCATIONS[p.entityId]) {
        const targetCoord = NEW_LOCATIONS[p.entityId];
        console.log(`Updating placement ${p.id} for ${p.entityId}: (${p.x}, ${p.y}) -> (${targetCoord.x}, ${targetCoord.y})`);
        p.x = targetCoord.x;
        p.y = targetCoord.y;
      }
    }
  }

  // 3. Update Trade Routes
  const tradeRoutes = story.worldBible?.tradeRoutes || [];

  // Emerald Lake -> Shakh-e Zarrin
  const emeraldRoute = tradeRoutes.find((r: any) =>
    r.originLocationId === 'loc_mtptnyfb_qb5k' || (r.name && r.name.includes('دریاچه زمرد'))
  );
  if (emeraldRoute) {
    console.log(`Updating trade route: "${emeraldRoute.name}" (${emeraldRoute.id})`);
    emeraldRoute.originLocationId = 'loc_mtptnyfb_qb5k';
    emeraldRoute.destinationLocationId = 'loc_mtr2c3uu_yocj';
    emeraldRoute.waypoints = EMERALD_LAKE_ROUTE_WAYPOINTS;
  }

  // Sepidchal -> Zarrin-Pol
  const sepidchalRoute = tradeRoutes.find((r: any) =>
    r.originLocationId === 'loc_mv0qancl_iked' || (r.name && r.name.includes('سپیدچال'))
  );
  if (sepidchalRoute) {
    console.log(`Updating trade route: "${sepidchalRoute.name}" (${sepidchalRoute.id})`);
    sepidchalRoute.originLocationId = 'loc_mv0qancl_iked';
    sepidchalRoute.destinationLocationId = 'loc_mtr1h3jy_8dv6';
    sepidchalRoute.waypoints = SEPIDCHAL_ROUTE_WAYPOINTS;
  }

  // 4. Save to production
  console.log('2. Saving updated story to production...');
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
    console.log('Emerald Lake and Sepidchal successfully placed on map and saved to production!');
  } else {
    console.error('Update failed:', postRes.data);
    process.exit(1);
  }
}

main().catch(console.error);
