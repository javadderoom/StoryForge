import fs from 'fs';
global.self = global;
global.window = global;
global.document = { createElement: () => ({ getContext: () => null }) };
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const buf = fs.readFileSync('public/models/d20.glb');
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  let lettersMesh = null;
  scene.traverse((c) => {
    if (c.isMesh && c.name.toLowerCase().includes('letter')) lettersMesh = c;
  });

  const geo = lettersMesh.geometry;
  const pos = geo.attributes.position;
  const index = geo.index;
  const mat = lettersMesh.matrixWorld;

  // Let's cluster letters by face normal
  const clusters = [];
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i);
    const i1 = index.getX(i + 1);
    const i2 = index.getX(i + 2);

    const v0 = new THREE.Vector3().fromBufferAttribute(pos, i0).applyMatrix4(mat);
    const v1 = new THREE.Vector3().fromBufferAttribute(pos, i1).applyMatrix4(mat);
    const v2 = new THREE.Vector3().fromBufferAttribute(pos, i2).applyMatrix4(mat);

    const c = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
    const norm = c.clone().normalize();

    let found = null;
    for (const cl of clusters) {
      if (norm.dot(cl.norm) > 0.96) {
        found = cl;
        break;
      }
    }
    if (found) {
      found.triangles.push([v0, v1, v2]);
      found.sum.add(c);
      found.count++;
    } else {
      clusters.push({
        norm,
        sum: c.clone(),
        triangles: [[v0, v1, v2]],
        count: 1,
      });
    }
  }

  // Filter 20 main clusters
  const main20 = clusters.filter(c => c.count > 100);
  console.log(`Found ${main20.length} letter clusters`);

  // Generate ASCII art for each of the 20 clusters by projecting 2D points into a grid
  const results = main20.map((c, idx) => {
    const normal = c.sum.clone().divideScalar(c.count).normalize();
    const up = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();

    // 2D grid 16x16
    const grid = Array.from({ length: 14 }, () => Array(18).fill(' '));
    const pts = [];
    c.triangles.forEach(([v0, v1, v2]) => {
      [v0, v1, v2].forEach(v => {
        const x = v.dot(right);
        const y = v.dot(up);
        pts.push({ x, y });
      });
    });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });

    const w = maxX - minX || 1;
    const h = maxY - minY || 1;

    pts.forEach(p => {
      const gx = Math.floor(((p.x - minX) / w) * 17);
      const gy = Math.floor(((maxY - p.y) / h) * 13);
      if (grid[gy] && grid[gy][gx]) grid[gy][gx] = '█';
    });

    const art = grid.map(r => r.join('')).join('\n');

    return {
      index: idx + 1,
      normal: [Number(normal.x.toFixed(4)), Number(normal.y.toFixed(4)), Number(normal.z.toFixed(4))],
      up: [Number(up.x.toFixed(4)), Number(up.y.toFixed(4)), Number(up.z.toFixed(4))],
      art,
    };
  });

  results.forEach(r => {
    console.log(`\n=== FACE ${r.index} === normal: ${JSON.stringify(r.normal)}`);
    console.log(r.art);
  });
});
