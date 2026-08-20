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
      found.verts.push(v0, v1, v2);
    } else {
      clusters.push({
        norm,
        sum: c.clone(),
        triangles: [[v0, v1, v2]],
        count: 1,
        verts: [v0, v1, v2],
      });
    }
  }

  // Filter 20 main clusters
  const main20 = clusters.filter(c => c.count > 100);

  // Identify all 20 face centers and their precise local up vector
  const faceList = main20.map((c, i) => {
    const center = c.sum.clone().divideScalar(c.count).normalize();
    const up = new THREE.Vector3(0, 1, 0).projectOnPlane(center).normalize();
    const right = new THREE.Vector3().crossVectors(up, center).normalize();

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    c.verts.forEach(v => {
      const x = v.dot(right);
      const y = v.dot(up);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });

    const w = maxX - minX;
    const h = maxY - minY;

    return {
      clusterId: i + 1,
      center,
      normal: [Number(center.x.toFixed(4)), Number(center.y.toFixed(4)), Number(center.z.toFixed(4))],
      up: [Number(up.x.toFixed(4)), Number(up.y.toFixed(4)), Number(up.z.toFixed(4))],
      triCount: c.count,
      w: Number(w.toFixed(2)),
      h: Number(h.toFixed(2)),
    };
  });

  // Find the top 20 distinct faces that have 10 antipodal pairs
  const distinctFaces = [];
  const used = new Set();

  for (let i = 0; i < faceList.length; i++) {
    if (used.has(i)) continue;
    let bestJ = -1;
    let bestDot = 1;
    for (let j = 0; j < faceList.length; j++) {
      if (i === j) continue;
      const dot = faceList[i].center.dot(faceList[j].center);
      if (dot < bestDot) {
        bestDot = dot;
        bestJ = j;
      }
    }
    if (bestJ !== -1 && bestDot < -0.95 && !used.has(bestJ)) {
      used.add(i);
      used.add(bestJ);
      distinctFaces.push(faceList[i]);
      distinctFaces.push(faceList[bestJ]);
    }
  }

  console.log(`Found exactly ${distinctFaces.length} verified face normals (10 pairs)!`);

  // Let's print out the exact mapping table
  console.log('const VERIFIED_D20_NORMALS =', JSON.stringify(distinctFaces.map((f, idx) => ({
    num: idx + 1,
    normal: f.normal,
    up: f.up,
  })), null, 2));
});
