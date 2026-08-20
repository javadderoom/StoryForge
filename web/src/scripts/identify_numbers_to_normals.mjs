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
    scene.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase().includes('letter')) {
        lettersMesh = child;
      }
    });

    if (!lettersMesh) return;

    const geo = lettersMesh.geometry;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const worldMatrix = lettersMesh.matrixWorld;

    const faceMap = new Map();

    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(worldMatrix);
      const len = v.length();
      if (len < 0.01) continue;

      const norm = v.clone().normalize();
      const u = uv.getX(i);
      const vCoord = uv.getY(i);

      // Quantize normal to find face group
      let matched = null;
      for (const [key, group] of faceMap.entries()) {
        if (norm.dot(group.normal) > 0.96) {
          matched = group;
          break;
        }
      }

      if (matched) {
        matched.points.push(v);
        matched.minU = Math.min(matched.minU, u);
        matched.maxU = Math.max(matched.maxU, u);
        matched.minV = Math.min(matched.minV, vCoord);
        matched.maxV = Math.max(matched.maxV, vCoord);
        matched.sum.add(v);
      } else {
        faceMap.set(faceMap.size, {
          normal: norm,
          points: [v],
          minU: u,
          maxU: u,
          minV: vCoord,
          maxV: vCoord,
          sum: v.clone(),
        });
      }
    }

    const groups = Array.from(faceMap.values()).filter(g => g.points.length > 50);
    console.log(`Found ${groups.length} distinct numbered faces in world space:`);

    const formatted = groups.map((g, idx) => {
      const center = g.sum.clone().divideScalar(g.points.length).normalize();
      // compute local top vector (up)
      let maxUp = -Infinity;
      let topPt = null;
      // find vertex with maximum projected distance along bounding box height
      for (const pt of g.points) {
        if (pt.y > maxUp) {
          maxUp = pt.y;
          topPt = pt;
        }
      }
      const upVec = topPt ? topPt.clone().sub(g.sum.clone().divideScalar(g.points.length)).projectOnPlane(center).normalize() : new THREE.Vector3(0, 1, 0);

      return {
        id: idx + 1,
        normal: [Number(center.x.toFixed(4)), Number(center.y.toFixed(4)), Number(center.z.toFixed(4))],
        up: [Number(upVec.x.toFixed(4)), Number(upVec.y.toFixed(4)), Number(upVec.z.toFixed(4))],
        uvCenter: [Number(((g.minU + g.maxU) / 2).toFixed(3)), Number(((g.minV + g.maxV) / 2).toFixed(3))],
        count: g.points.length
      };
    });

    console.log(JSON.stringify(formatted, null, 2));
  }
);
