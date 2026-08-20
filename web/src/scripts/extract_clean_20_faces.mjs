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

  let mainMesh = null;
  scene.traverse((c) => {
    if (c.isMesh && !c.name.toLowerCase().includes('letter')) mainMesh = c;
  });

  const geo = mainMesh.geometry;
  const pos = geo.attributes.position;
  const index = geo.index;
  const mat = mainMesh.matrixWorld;

  const faces = [];
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i);
    const i1 = index.getX(i + 1);
    const i2 = index.getX(i + 2);

    const v0 = new THREE.Vector3().fromBufferAttribute(pos, i0).applyMatrix4(mat);
    const v1 = new THREE.Vector3().fromBufferAttribute(pos, i1).applyMatrix4(mat);
    const v2 = new THREE.Vector3().fromBufferAttribute(pos, i2).applyMatrix4(mat);

    const centroid = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
    const norm = centroid.clone().normalize();

    let found = null;
    for (const f of faces) {
      if (norm.dot(f.norm) > 0.98) {
        found = f;
        break;
      }
    }
    if (found) {
      found.verts.push(v0, v1, v2);
      found.sum.add(centroid);
      found.count++;
    } else {
      faces.push({
        norm,
        sum: centroid.clone(),
        verts: [v0, v1, v2],
        count: 1,
      });
    }
  }

  // Filter 20 major faces
  const sorted = faces.sort((a, b) => b.count - a.count).slice(0, 20);

  const clean20 = sorted.map((f, idx) => {
    const normal = f.sum.clone().divideScalar(f.count).normalize();
    // Default up vector projected on plane
    const up = (Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1))
      .projectOnPlane(normal)
      .normalize();

    return {
      faceId: idx + 1,
      normal: [Number(normal.x.toFixed(4)), Number(normal.y.toFixed(4)), Number(normal.z.toFixed(4))],
      up: [Number(up.x.toFixed(4)), Number(up.y.toFixed(4)), Number(up.z.toFixed(4))],
    };
  });

  console.log('const RAW_20_FACES =', JSON.stringify(clean20, null, 2));
  fs.writeFileSync('src/lib/raw20Faces.json', JSON.stringify(clean20, null, 2));
});
