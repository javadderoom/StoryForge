import fs from 'fs';
global.self = global;
global.window = global;
global.document = { createElement: () => ({ getContext: () => null }) };
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// The verified mapping of 1..20 to Face IDs:
const FACE_NUMBER_MAP = {
  1: 7,
  2: 10,
  3: 20,
  4: 13,
  5: 11,
  6: 3,
  7: 19,
  8: 2,
  9: 5,
  10: 15,
  11: 18,
  12: 9,
  13: 6,
  14: 14,
  15: 12,
  16: 16,
  17: 17,
  18: 1,
  19: 4,
  20: 8
};

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

  // Find 20 connected numeral clusters
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
      found.sum.add(c);
      found.count++;
      found.verts.push(v0, v1, v2);
    } else {
      clusters.push({
        norm,
        sum: c.clone(),
        count: 1,
        verts: [v0, v1, v2],
      });
    }
  }

  clusters.sort((a, b) => b.count - a.count);
  const main20 = clusters.slice(0, 20);

  const finalTable = [];

  for (let num = 1; num <= 20; num++) {
    const faceId = FACE_NUMBER_MAP[num];
    const cl = main20[faceId - 1];
    const normal = cl.sum.clone().divideScalar(cl.count).normalize();

    // Compute character vertical principal axis
    const tempUp = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = tempUp.projectOnPlane(normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    // Center of letter
    const center = cl.sum.clone().divideScalar(cl.count);

    let covXX = 0, covYY = 0, covXY = 0;
    cl.verts.forEach((v) => {
      const rel = v.clone().sub(center);
      const x = rel.dot(bitangent);
      const y = rel.dot(tangent);
      covXX += x * x;
      covYY += y * y;
      covXY += x * y;
    });

    const angle = 0.5 * Math.atan2(2 * covXY, covYY - covXX);
    let spine = new THREE.Vector3()
      .addScaledVector(bitangent, Math.sin(angle))
      .addScaledVector(tangent, Math.cos(angle))
      .normalize();

    // Pick upward orientation
    if (spine.dot(tempUp) < 0) {
      spine.negate();
    }

    finalTable.push({
      num,
      normal: [Number(normal.x.toFixed(4)), Number(normal.y.toFixed(4)), Number(normal.z.toFixed(4))],
      up: [Number(spine.x.toFixed(4)), Number(spine.y.toFixed(4)), Number(spine.z.toFixed(4))],
    });
  }

  console.log('const D20_FACE_NORMALS =', JSON.stringify(finalTable, null, 2));
  fs.writeFileSync('src/lib/finalD20Normals.json', JSON.stringify(finalTable, null, 2));
});
