import fs from 'fs';
global.self = global;
global.window = global;
global.document = { createElement: () => ({ getContext: () => null }) };
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Simple BMP creator in pure JS
function createBMP(width, height, getPixel) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  // BMP Header
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // offset to pixels

  // DIB Header
  buf.writeUInt32LE(40, 14); // header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // bpp
  buf.writeUInt32LE(0, 30); // compression
  buf.writeUInt32LE(pixelArraySize, 34);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(x, y);
      const offset = 54 + y * rowSize + x * 3;
      buf[offset] = b;
      buf[offset + 1] = g;
      buf[offset + 2] = r;
    }
  }
  return buf;
}

const glbBuf = fs.readFileSync('public/models/d20.glb');
const arrayBuffer = glbBuf.buffer.slice(glbBuf.byteOffset, glbBuf.byteOffset + glbBuf.byteLength);

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
    } else {
      clusters.push({
        norm,
        sum: c.clone(),
        triangles: [[v0, v1, v2]],
        count: 1,
      });
    }
  }

  // Filter 20 main clusters
  const main20 = clusters.filter(c => c.count > 100);
  console.log(`Rendering ${main20.length} face images...`);

  main20.forEach((c, idx) => {
    const normal = c.sum.clone().divideScalar(c.count).normalize();
    const up = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();

    const W = 120, H = 120;
    const pts = [];
    c.triangles.forEach(([v0, v1, v2]) => {
      [v0, v1, v2].forEach(v => {
        const x = v.dot(right);
        const y = v.dot(up);
        pts.push({ x, y });
      });
    });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });

    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const padX = w * 0.2;
    const padY = h * 0.2;

    const img = Array.from({ length: H }, () => Array(W).fill(false));

    c.triangles.forEach(([v0, v1, v2]) => {
      const p0 = { x: v0.dot(right), y: v0.dot(up) };
      const p1 = { x: v1.dot(right), y: v1.dot(up) };
      const p2 = { x: v2.dot(right), y: v2.dot(up) };

      // Map to pixel coords
      const toPixel = (p) => ({
        x: Math.floor(((p.x - (minX - padX)) / (w + 2 * padX)) * (W - 1)),
        y: Math.floor(((p.y - (minY - padY)) / (h + 2 * padY)) * (H - 1)),
      });

      const s0 = toPixel(p0), s1 = toPixel(p1), s2 = toPixel(p2);

      // Draw wireframe/triangle
      const minPy = Math.max(0, Math.min(s0.y, s1.y, s2.y));
      const maxPy = Math.min(H - 1, Math.max(s0.y, s1.y, s2.y));
      const minPx = Math.max(0, Math.min(s0.x, s1.x, s2.x));
      const maxPx = Math.min(W - 1, Math.max(s0.x, s1.x, s2.x));

      for (let py = minPy; py <= maxPy; py++) {
        for (let px = minPx; px <= maxPx; px++) {
          img[py][px] = true;
        }
      }
    });

    const bmp = createBMP(W, H, (x, y) => {
      return img[y][x] ? [251, 191, 36] : [15, 17, 26];
    });

    fs.writeFileSync(`public/models/face_${idx + 1}.bmp`, bmp);
    console.log(`Saved face_${idx + 1}.bmp (normal: [${normal.x.toFixed(4)}, ${normal.y.toFixed(4)}, ${normal.z.toFixed(4)}])`);
  });
});
