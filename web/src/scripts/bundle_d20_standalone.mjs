import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

// 1. Read d20.glb as base64
const glbBuffer = fs.readFileSync('public/models/d20.glb');
const glbBase64 = glbBuffer.toString('base64');

// 2. Create the complete standalone entry with embedded GLB data
const entryCode = `
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// 20 Exact Calibrated Face Normals and Up Vectors for d20.glb (1 to 20)
const D20_FACE_NORMALS = [
  { num: 1,  normal: [0.0146, -0.9916, -0.1287], up: [0.0143, -0.1285, 0.9916] },
  { num: 2,  normal: [0.6457, 0.7247, -0.2406],  up: [0.5836, -0.6715, -0.4567] },
  { num: 3,  normal: [-0.9495, -0.2299, -0.2136], up: [-0.1065, 0.8763, -0.4698] },
  { num: 4,  normal: [0.6045, 0.1545, 0.7815],   up: [0.6176, -0.7105, -0.3373] },
  { num: 5,  normal: [0.9455, -0.2242, -0.2363], up: [0.088, 0.8742, -0.4776] },
  { num: 6,  normal: [-0.6114, 0.1363, 0.7795],  up: [-0.621, -0.6932, -0.3658] },
  { num: 7,  normal: [-0.0132, -0.5139, -0.8577], up: [-0.0176, 0.8578, -0.5137] },
  { num: 8,  normal: [-0.6682, 0.7038, -0.2412], up: [-0.5447, -0.6837, -0.4858] },
  { num: 9,  normal: [-0.3025, -0.4126, 0.8592], up: [0.5134, 0.689, 0.5116] },
  { num: 10, normal: [-0.2693, 0.4314, -0.861],  up: [0.5345, -0.6767, -0.5063] },
  { num: 11, normal: [0.3281, -0.3916, 0.8596],  up: [-0.4797, 0.7148, 0.5088] },
  { num: 12, normal: [0.2974, 0.4018, -0.8661],  up: [-0.5261, -0.688, -0.4999] },
  { num: 13, normal: [0.6607, -0.7117, 0.2388],  up: [0.561, 0.6795, 0.4728] },
  { num: 14, normal: [-0.0049, 0.5405, 0.8414],  up: [-0.0328, -0.841, 0.54] },
  { num: 15, normal: [0.6188, -0.1375, -0.7734], up: [0.5989, 0.7197, 0.3512] },
  { num: 16, normal: [-0.9527, 0.1747, 0.2486],  up: [-0.036, -0.8774, 0.4785] },
  { num: 17, normal: [-0.6811, -0.09, -0.7266],  up: [-0.5467, 0.7226, 0.4229] },
  { num: 18, normal: [0.9489, 0.1987, 0.245],   up: [0.0666, -0.8855, 0.4598] },
  { num: 19, normal: [-0.6776, -0.6924, 0.2479], up: [-0.5529, 0.7019, 0.449] },
  { num: 20, normal: [-0.0085, 0.9997, -0.0208], up: [-0.0223, -0.021, -0.9995] }
];

function computeTargetQuaternion(num) {
  const face = D20_FACE_NORMALS.find(f => f.num === num) || D20_FACE_NORMALS[19];
  const normal = new THREE.Vector3(...face.normal).normalize();
  const up = new THREE.Vector3(...face.up).projectOnPlane(normal).normalize();
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  const basis = new THREE.Matrix4().makeBasis(right, up, normal);
  return new THREE.Quaternion().setFromRotationMatrix(basis).invert();
}

const container = document.getElementById('d20-container') || document.body;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 0, 7.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
const initialWidth = window.innerWidth || 300;
const initialHeight = window.innerHeight || 300;
renderer.setSize(initialWidth, initialHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const roomEnv = new RoomEnvironment();
scene.environment = pmremGenerator.fromScene(roomEnv).texture;

const ambient = new THREE.HemisphereLight(0xfffbeb, 0x18181b, 2.4);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffe082, 4.8);
keyLight.position.set(5, 7, 7);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x38bdf8, 3.2);
rimLight.position.set(-6, -3, 5);
scene.add(rimLight);

const frontHighlight = new THREE.PointLight(0xfffbeb, 3.0, 12);
frontHighlight.position.set(0, 1, 6);
scene.add(frontHighlight);

const dicePivot = new THREE.Group();
scene.add(dicePivot);

let rollStartTime = 0;
const rollDuration = 1300;
let velX = 18, velY = 24, velZ = 16;
const startQ = new THREE.Quaternion();
let targetQ = computeTargetQuaternion(20);
let isModelReady = false;

// Embedded GLB Base64 Data (Zero CORS, Zero Network Fetch)
const glbData = "${glbBase64}";
const rawData = atob(glbData);
const arrayBuffer = new ArrayBuffer(rawData.length);
const bytes = new Uint8Array(arrayBuffer);
for (let i = 0; i < rawData.length; i++) {
  bytes[i] = rawData.charCodeAt(i);
}

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const sizeBox = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(sizeBox.x, sizeBox.y, sizeBox.z);
  const scaleFactor = 3.2 / (maxDim || 1);
  model.scale.setScalar(scaleFactor);
  model.position.copy(center.negate().multiplyScalar(scaleFactor));

  model.traverse((child) => {
    if (child.isMesh && child.material) {
      const isLettersMesh = child.name.toLowerCase().includes('letter');
      if (isLettersMesh) {
        child.material.color = new THREE.Color(0xffd700);
        child.material.metalness = 0.95;
        child.material.roughness = 0.15;
        child.material.envMapIntensity = 2.5;
      } else {
        child.material.metalness = 0.2;
        child.material.roughness = 0.35;
        child.material.envMapIntensity = 1.2;
      }
      child.material.needsUpdate = true;
    }
  });

  dicePivot.add(model);
  dicePivot.quaternion.copy(targetQ);
  isModelReady = true;

  if (window.RollChannel) {
    window.RollChannel.postMessage('loaded');
  }
});

window.rollDice = function(targetNum) {
  targetQ = computeTargetQuaternion(targetNum);
  rollStartTime = Date.now();
  velX = (18 + Math.random() * 8) * (Math.random() > 0.5 ? 1 : -1);
  velY = (24 + Math.random() * 10) * (Math.random() > 0.5 ? 1 : -1);
  velZ = (16 + Math.random() * 6) * (Math.random() > 0.5 ? 1 : -1);
  startQ.copy(dicePivot.quaternion);
};

window.setTargetNumber = function(targetNum) {
  targetQ = computeTargetQuaternion(targetNum);
  dicePivot.quaternion.copy(targetQ);
};

function animate() {
  requestAnimationFrame(animate);

  if (rollStartTime > 0) {
    const elapsed = Date.now() - rollStartTime;
    const progress = Math.min(1.0, elapsed / rollDuration);

    if (progress < 0.65) {
      dicePivot.rotation.x += velX * 0.016;
      dicePivot.rotation.y += velY * 0.016;
      dicePivot.rotation.z += velZ * 0.016;
      velX *= 0.992;
      velY *= 0.992;
      velZ *= 0.992;
      startQ.copy(dicePivot.quaternion);
    } else {
      const settleT = (progress - 0.65) / 0.35;
      const c1 = 1.4;
      const c3 = c1 + 1;
      const easeT = 1 + c3 * Math.pow(settleT - 1, 3) + c1 * Math.pow(settleT - 1, 2);

      dicePivot.quaternion.slerpQuaternions(startQ, targetQ, Math.min(1.0, Math.max(0, easeT)));

      if (progress >= 1.0) {
        dicePivot.quaternion.copy(targetQ);
        rollStartTime = 0;
        if (window.RollChannel) {
          window.RollChannel.postMessage('settled');
        }
      }
    }
  } else if (isModelReady) {
    dicePivot.quaternion.copy(targetQ);
    dicePivot.position.y = Math.sin(Date.now() * 0.002) * 0.06;
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  const w = window.innerWidth || 300;
  const h = window.innerHeight || 300;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
`;

fs.writeFileSync('src/scripts/d20_standalone_entry.js', entryCode);
console.log('Wrote d20_standalone_entry.js successfully!');
