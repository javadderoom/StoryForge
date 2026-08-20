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

  const triangles = [];
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i);
    const i1 = index.getX(i + 1);
    const i2 = index.getX(i + 2);

    const v0 = new THREE.Vector3().fromBufferAttribute(pos, i0).applyMatrix4(mat);
    const v1 = new THREE.Vector3().fromBufferAttribute(pos, i1).applyMatrix4(mat);
    const v2 = new THREE.Vector3().fromBufferAttribute(pos, i2).applyMatrix4(mat);

    const normal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(v1, v0), new THREE.Vector3().subVectors(v2, v0))
      .normalize();
    const centroid = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
    if (normal.dot(centroid) < 0) normal.negate();

    triangles.push({ normal, centroid, verts: [v0, v1, v2] });
  }

  // Cluster triangles by plane normal with 0.95 tolerance
  const planes = [];
  for (const tri of triangles) {
    let matched = null;
    for (const p of planes) {
      if (tri.normal.dot(p.normal) > 0.98) {
        matched = p;
        break;
      }
    }
    if (matched) {
      matched.triangles.push(tri);
      matched.centroidSum.add(tri.centroid);
    } else {
      planes.push({
        normal: tri.normal.clone(),
        centroidSum: tri.centroid.clone(),
        triangles: [tri],
      });
    }
  }

  // Sort by triangle count / area
  planes.sort((a, b) => b.triangles.length - a.triangles.length);
  const true20 = planes.slice(0, 20);

  console.log(`True 20 main body facets found: ${true20.length}`);
  true20.forEach((p, idx) => {
    const center = p.centroidSum.clone().divideScalar(p.triangles.length).normalize();
    const norm = p.normal.normalize();
    console.log(`Facet ${idx + 1}: triangles=${p.triangles.length}, normal=[${norm.x.toFixed(4)}, ${norm.y.toFixed(4)}, ${norm.z.toFixed(4)}]`);
  });
});
