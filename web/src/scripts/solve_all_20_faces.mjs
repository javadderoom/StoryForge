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
  let mainMesh = null;

  scene.traverse((c) => {
    if (c.isMesh) {
      if (c.name.toLowerCase().includes('letter')) lettersMesh = c;
      else mainMesh = c;
    }
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

  // Sort clusters
  clusters.sort((a, b) => b.count - a.count);
  const main20 = clusters.slice(0, 20);

  // Now, for each of the 20 clusters:
  // 1. Calculate the TRUE normal of the flat plane containing the numeral
  // 2. Calculate the TRUE upright direction (the vertical axis of the numeral)
  const results = main20.map((cl, idx) => {
    // Fit a plane to the vertices: Normal = SVD or Cross products
    const center = cl.sum.clone().divideScalar(cl.count);
    const outwardNormal = center.clone().normalize();

    // Find bounding box along principal axes
    // Tangent plane
    const tempUp = Math.abs(outwardNormal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = tempUp.projectOnPlane(outwardNormal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(tangent, outwardNormal).normalize();

    // Compute covariance matrix in 2D tangent plane to find the character's natural vertical spine
    let covXX = 0, covYY = 0, covXY = 0;
    cl.verts.forEach((v) => {
      const rel = v.clone().sub(center);
      const x = rel.dot(bitangent);
      const y = rel.dot(tangent);
      covXX += x * x;
      covYY += y * y;
      covXY += x * y;
    });

    // Principal component angle
    const angle = 0.5 * Math.atan2(2 * covXY, covYY - covXX);
    const spineVector = new THREE.Vector3()
      .addScaledVector(bitangent, Math.sin(angle))
      .addScaledVector(tangent, Math.cos(angle))
      .normalize();

    return {
      clusterIndex: idx + 1,
      center: [Number(outwardNormal.x.toFixed(4)), Number(outwardNormal.y.toFixed(4)), Number(outwardNormal.z.toFixed(4))],
      upVector: [Number(spineVector.x.toFixed(4)), Number(spineVector.y.toFixed(4)), Number(spineVector.z.toFixed(4))],
      triCount: cl.count,
    };
  });

  console.log('RESULTS:', JSON.stringify(results, null, 2));
});
