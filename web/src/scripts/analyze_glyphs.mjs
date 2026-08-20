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

  // Group triangles by face normal direction
  const faceMap = [];

  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i);
    const i1 = index.getX(i + 1);
    const i2 = index.getX(i + 2);

    const v0 = new THREE.Vector3().fromBufferAttribute(pos, i0).applyMatrix4(mat);
    const v1 = new THREE.Vector3().fromBufferAttribute(pos, i1).applyMatrix4(mat);
    const v2 = new THREE.Vector3().fromBufferAttribute(pos, i2).applyMatrix4(mat);

    const centroid = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
    const dir = centroid.clone().normalize();

    let matched = null;
    for (const f of faceMap) {
      if (dir.dot(f.normal) > 0.96) {
        matched = f;
        break;
      }
    }

    if (matched) {
      matched.triangles.push([v0, v1, v2]);
      matched.sum.add(centroid);
      matched.verts.push(v0, v1, v2);
    } else {
      faceMap.push({
        normal: dir,
        sum: centroid.clone(),
        triangles: [[v0, v1, v2]],
        verts: [v0, v1, v2],
      });
    }
  }

  console.log(`Found ${faceMap.length} numbered faces:`);

  // For each face, project vertices onto 2D local plane (X, Y)
  const faceDetails = faceMap.map((f, idx) => {
    const normal = f.sum.clone().divideScalar(f.triangles.length).normalize();

    // Basis for local 2D projection
    // Choose arbitrary tangent
    const tangent = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
    if (tangent.length() < 0.1) tangent.set(1, 0, 0).projectOnPlane(normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    // Project all points to 2D
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    f.verts.forEach((v) => {
      const x = v.dot(bitangent);
      const y = v.dot(tangent);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });

    const w = maxX - minX;
    const h = maxY - minY;
    const aspectRatio = w / (h || 1);

    return {
      index: idx + 1,
      normal: [Number(normal.x.toFixed(4)), Number(normal.y.toFixed(4)), Number(normal.z.toFixed(4))],
      triCount: f.triangles.length,
      width: Number(w.toFixed(4)),
      height: Number(h.toFixed(4)),
      aspectRatio: Number(aspectRatio.toFixed(3)),
    };
  });

  // Sort by triCount to see complexity (e.g. 1 has few triangles, 20/18/19 have many triangles)
  faceDetails.sort((a, b) => a.triCount - b.triCount);
  console.log(JSON.stringify(faceDetails, null, 2));
});
