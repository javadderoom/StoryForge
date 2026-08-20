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

  // Group triangles into 20 face clusters
  const faces = [];
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
    for (const f of faces) {
      if (norm.dot(f.norm) > 0.96) {
        found = f;
        break;
      }
    }
    if (found) {
      found.verts.push(v0, v1, v2);
      found.sum.add(c);
      found.triCount++;
    } else {
      faces.push({
        norm,
        sum: c.clone(),
        verts: [v0, v1, v2],
        triCount: 1,
      });
    }
  }

  // Filter 20 main faces (the ones with > 100 triangles)
  const main20 = faces.filter(f => f.verts.length > 300);
  console.log('Main 20 faces count:', main20.length);

  // For each face, find center and top vertex (up vector)
  const faceNormals = main20.map((f, i) => {
    const center = f.sum.clone().divideScalar(f.triCount).normalize();

    // Find apex (the vertex farthest in height on projected tangent plane)
    let maxProj = -Infinity;
    let apexVert = null;

    // Use initial vertical hint
    const tempUp = Math.abs(center.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = tempUp.projectOnPlane(center).normalize();
    const bitangent = new THREE.Vector3().crossVectors(tangent, center).normalize();

    // Center of letter bounds
    const localCenter = f.sum.clone().divideScalar(f.triCount);

    let maxDot = -Infinity;
    let upCandidate = null;

    for (const v of f.verts) {
      const rel = v.clone().sub(localCenter);
      // Project on tangent plane
      const proj = rel.projectOnPlane(center);
      if (proj.length() > 0.1) {
        // Look for topmost part of character
        if (v.y > maxProj) {
          maxProj = v.y;
          apexVert = proj.clone().normalize();
        }
      }
    }

    const up = apexVert || tangent;

    return {
      index: i + 1,
      normal: [Number(center.x.toFixed(4)), Number(center.y.toFixed(4)), Number(center.z.toFixed(4))],
      up: [Number(up.x.toFixed(4)), Number(up.y.toFixed(4)), Number(up.z.toFixed(4))],
    };
  });

  console.log('EXPORTED FACES:', JSON.stringify(faceNormals, null, 2));
});
