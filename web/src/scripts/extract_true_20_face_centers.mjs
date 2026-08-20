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

  // Compute triangle normals and centroids
  const triNormals = [];
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i);
    const i1 = index.getX(i + 1);
    const i2 = index.getX(i + 2);

    const v0 = new THREE.Vector3().fromBufferAttribute(pos, i0).applyMatrix4(mat);
    const v1 = new THREE.Vector3().fromBufferAttribute(pos, i1).applyMatrix4(mat);
    const v2 = new THREE.Vector3().fromBufferAttribute(pos, i2).applyMatrix4(mat);

    const e1 = new THREE.Vector3().subVectors(v1, v0);
    const e2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();
    const centroid = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);

    // ensure normal points outward
    if (normal.dot(centroid) < 0) normal.negate();

    triNormals.push({ normal, centroid, verts: [v0, v1, v2] });
  }

  // Cluster triangles with identical normal vectors (flat coplanar facets)
  const facePlanes = [];
  for (const tri of triNormals) {
    let found = false;
    for (const fp of facePlanes) {
      if (tri.normal.dot(fp.normal) > 0.999) {
        fp.triangles.push(tri);
        fp.centroidSum.add(tri.centroid);
        found = true;
        break;
      }
    }
    if (!found) {
      facePlanes.push({
        normal: tri.normal.clone(),
        centroidSum: tri.centroid.clone(),
        triangles: [tri],
      });
    }
  }

  console.log(`Found ${facePlanes.length} coplanar facets in main mesh`);

  // Sort by triangle count / area to find the 20 main triangular facets
  facePlanes.sort((a, b) => b.triangles.length - a.triangles.length);
  const main20 = facePlanes.slice(0, 20);

  const exactFaces = main20.map((fp, i) => {
    const normal = fp.normal.clone().normalize();
    const center = fp.centroidSum.clone().divideScalar(fp.triangles.length);

    // Find the apex vertex (the corner of the triangle pointing up)
    // Gather all unique vertices on this plane
    const pts = [];
    fp.triangles.forEach((t) => pts.push(...t.verts));

    // Choose tangent
    const tempUp = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const up = tempUp.projectOnPlane(normal).normalize();

    return {
      faceId: i + 1,
      normal: [Number(normal.x.toFixed(4)), Number(normal.y.toFixed(4)), Number(normal.z.toFixed(4))],
      up: [Number(up.x.toFixed(4)), Number(up.y.toFixed(4)), Number(up.z.toFixed(4))],
      triCount: fp.triangles.length,
    };
  });

  console.log('const EXACT_20_FLAT_FACES =', JSON.stringify(exactFaces, null, 2));
});
