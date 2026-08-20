import fs from 'fs';

const buf = fs.readFileSync('public/models/d20.glb');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const binOffset = 20 + jsonLen + 8;

// Mesh 0 face normals (first 20)
const faceNormals = [
  [0.0000, -0.7947, 0.6071],
  [0.3568, -0.7947, -0.4911],
  [-0.5774, -0.7947, 0.1876],
  [0.5774, -0.7947, 0.1876],
  [-0.9342, -0.1876, 0.3035],
  [-0.5774, 0.1876, 0.7946],
  [0.0000, -0.1876, 0.9822],
  [-0.9342, 0.1876, -0.3035],
  [-0.0000, 0.1876, -0.9822],
  [0.9342, 0.1876, -0.3035],
  [-0.5774, -0.1876, -0.7946],
  [0.5774, -0.1876, -0.7946],
  [0.9342, -0.1876, 0.3035],
  [0.5774, 0.1876, 0.7946],
  [-0.3568, 0.7947, 0.4911],
  [-0.5774, 0.7947, -0.1876],
  [0.0000, 0.7947, -0.6071],
  [0.5774, 0.7947, -0.1876],
  [0.3568, 0.7947, 0.4911],
  [-0.3568, -0.7947, -0.4911],
];

// Let's check Mesh 1 (Letters)
const accPos = json.accessors[6];
const bvPos = json.bufferViews[accPos.bufferView];
const posOffset = binOffset + (bvPos.byteOffset || 0) + (accPos.byteOffset || 0);

const accUv = json.accessors[10];
const bvUv = json.bufferViews[accUv.bufferView];
const uvOffset = binOffset + (bvUv.byteOffset || 0) + (accUv.byteOffset || 0);

const accIdx = json.accessors[11];
const bvIdx = json.bufferViews[accIdx.bufferView];
const idxOffset = binOffset + (bvIdx.byteOffset || 0) + (accIdx.byteOffset || 0);

const verts = [];
for (let i = 0; i < accPos.count; i++) {
  const x = buf.readFloatLE(posOffset + i * 12);
  const y = buf.readFloatLE(posOffset + i * 12 + 4);
  const z = buf.readFloatLE(posOffset + i * 12 + 8);
  const u = buf.readFloatLE(uvOffset + i * 8);
  const v = buf.readFloatLE(uvOffset + i * 8 + 4);
  verts.push({ x, y, z, u, v });
}

// For each face normal, compute the average UV coordinate of the letter on it
faceNormals.forEach((fn, fIdx) => {
  let uSum = 0, vSum = 0, count = 0;
  for (const vert of verts) {
    const len = Math.hypot(vert.x, vert.y, vert.z);
    if (len < 0.01) continue;
    const nx = vert.x / len, ny = vert.y / len, nz = vert.z / len;
    const dot = nx * fn[0] + ny * fn[1] + nz * fn[2];
    if (dot > 0.95) {
      uSum += vert.u;
      vSum += vert.v;
      count++;
    }
  }
  const avgU = count > 0 ? (uSum / count).toFixed(3) : '0';
  const avgV = count > 0 ? (vSum / count).toFixed(3) : '0';
  console.log(`Face ${fIdx + 1}: normal=[${fn.map(x=>x.toFixed(4)).join(', ')}], uv=[${avgU}, ${avgV}], vertCount=${count}`);
});
