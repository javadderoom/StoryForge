import fs from 'fs';
global.self = global;
global.window = global;
global.document = {
  createElement: () => ({ getContext: () => null })
};
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const buf = fs.readFileSync('public/models/d20.glb');
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
loader.parse(
  arrayBuffer,
  '',
  (gltf) => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);

    let lettersMesh = null;
    let mainMesh = null;

    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name.toLowerCase().includes('letter')) {
          lettersMesh = child;
        } else {
          mainMesh = child;
        }
      }
    });

    if (!mainMesh) return;

    // Main mesh geometry in world coordinates
    const geo = mainMesh.geometry;
    const pos = geo.attributes.position;
    const index = geo.index;
    const worldMatrix = mainMesh.matrixWorld;

    const faces = [];
    const triCount = index.count / 3;

    for (let i = 0; i < triCount; i++) {
      const i0 = index.getX(i * 3);
      const i1 = index.getX(i * 3 + 1);
      const i2 = index.getX(i * 3 + 2);

      const v0 = new THREE.Vector3().fromBufferAttribute(pos, i0).applyMatrix4(worldMatrix);
      const v1 = new THREE.Vector3().fromBufferAttribute(pos, i1).applyMatrix4(worldMatrix);
      const v2 = new THREE.Vector3().fromBufferAttribute(pos, i2).applyMatrix4(worldMatrix);

      const centroid = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
      const normal = new THREE.Vector3()
        .crossVectors(new THREE.Vector3().subVectors(v1, v0), new THREE.Vector3().subVectors(v2, v0))
        .normalize();

      if (normal.dot(centroid) < 0) normal.negate();

      let found = false;
      for (const f of faces) {
        if (normal.dot(f.normal) > 0.98) {
          f.count++;
          f.centroidSum.add(centroid);
          f.verts.push(v0, v1, v2);
          found = true;
          break;
        }
      }
      if (!found) {
        faces.push({
          normal: normal.clone(),
          centroidSum: centroid.clone(),
          count: 1,
          verts: [v0, v1, v2],
        });
      }
    }

    console.log('Found 20 main faces in WORLD space:', faces.length);

    // Now let's extract letters from lettersMesh and match each letter's centroid to the closest face
    const lettersGeo = lettersMesh.geometry;
    const letPos = lettersGeo.attributes.position;
    const letIndex = lettersGeo.index;
    const letWorldMatrix = lettersMesh.matrixWorld;

    const letterPoints = [];
    for (let i = 0; i < letPos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(letPos, i).applyMatrix4(letWorldMatrix);
      letterPoints.push(v);
    }

    const faceData = faces.map((f, idx) => {
      const faceCenter = f.centroidSum.clone().divideScalar(f.count).normalize();
      const norm = f.normal.normalize();

      // Find apex/up-vector of this triangular face
      // The vertex farthest from center in projected plane
      let maxDist = -1;
      let apex = null;
      for (const v of f.verts) {
        const d = v.clone().projectOnPlane(norm).length();
        if (d > maxDist) {
          maxDist = d;
          apex = v;
        }
      }

      const up = apex ? apex.clone().sub(f.centroidSum.clone().divideScalar(f.count)).projectOnPlane(norm).normalize() : new THREE.Vector3(0, 1, 0);

      return {
        faceIndex: idx + 1,
        normal: [Number(norm.x.toFixed(4)), Number(norm.y.toFixed(4)), Number(norm.z.toFixed(4))],
        up: [Number(up.x.toFixed(4)), Number(up.y.toFixed(4)), Number(up.z.toFixed(4))],
      };
    });

    console.log('const EXACT_D20_FACES =', JSON.stringify(faceData, null, 2));
  },
  (err) => console.error(err)
);
