'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface ThreeD20DiceProps {
  resultNumber: number;
  isRolling: boolean;
  onRollComplete?: () => void;
  size?: number;
}

// 20 Exact Calibrated Face Normals and Up Vectors for d20.glb (1 to 20)
export const D20_FACE_NORMALS: { num: number; normal: [number, number, number]; up: [number, number, number] }[] = [
  {
    num: 1,
    normal: [0.0146, -0.9916, -0.1287],
    up: [0.0143, -0.1285, 0.9916],
  },
  {
    num: 2,
    normal: [0.6457, 0.7247, -0.2406],
    up: [0.5836, -0.6715, -0.4567],
  },
  {
    num: 3,
    normal: [-0.9495, -0.2299, -0.2136],
    up: [-0.1065, 0.8763, -0.4698],
  },
  {
    num: 4,
    normal: [0.6045, 0.1545, 0.7815],
    up: [0.6176, -0.7105, -0.3373],
  },
  {
    num: 5,
    normal: [0.9455, -0.2242, -0.2363],
    up: [0.088, 0.8742, -0.4776],
  },
  {
    num: 6,
    normal: [-0.6114, 0.1363, 0.7795],
    up: [-0.621, -0.6932, -0.3658],
  },
  {
    num: 7,
    normal: [-0.0132, -0.5139, -0.8577],
    up: [-0.0176, 0.8578, -0.5137],
  },
  {
    num: 8,
    normal: [-0.6682, 0.7038, -0.2412],
    up: [-0.5447, -0.6837, -0.4858],
  },
  {
    num: 9,
    normal: [-0.3025, -0.4126, 0.8592],
    up: [0.5134, 0.689, 0.5116],
  },
  {
    num: 10,
    normal: [-0.2693, 0.4314, -0.861],
    up: [0.5345, -0.6767, -0.5063],
  },
  {
    num: 11,
    normal: [0.3281, -0.3916, 0.8596],
    up: [-0.4797, 0.7148, 0.5088],
  },
  {
    num: 12,
    normal: [0.2974, 0.4018, -0.8661],
    up: [-0.5261, -0.688, -0.4999],
  },
  {
    num: 13,
    normal: [0.6607, -0.7117, 0.2388],
    up: [0.561, 0.6795, 0.4728],
  },
  {
    num: 14,
    normal: [-0.0049, 0.5405, 0.8414],
    up: [-0.0328, -0.841, 0.54],
  },
  {
    num: 15,
    normal: [0.6188, -0.1375, -0.7734],
    up: [0.5989, 0.7197, 0.3512],
  },
  {
    num: 16,
    normal: [-0.9527, 0.1747, 0.2486],
    up: [-0.036, -0.8774, 0.4785],
  },
  {
    num: 17,
    normal: [-0.6811, -0.09, -0.7266],
    up: [-0.5467, 0.7226, 0.4229],
  },
  {
    num: 18,
    normal: [0.9489, 0.1987, 0.245],
    up: [0.0666, -0.8855, 0.4598],
  },
  {
    num: 19,
    normal: [-0.6776, -0.6924, 0.2479],
    up: [-0.5529, 0.7019, 0.449],
  },
  {
    num: 20,
    normal: [-0.0085, 0.9997, -0.0208],
    up: [-0.0223, -0.021, -0.9995],
  },
];

export function ThreeD20Dice({
  resultNumber,
  isRolling,
  onRollComplete,
  size = 230,
}: ThreeD20DiceProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const stateRef = useRef<{
    isRolling: boolean;
    resultNumber: number;
    onRollComplete?: () => void;
  }>({
    isRolling,
    resultNumber,
    onRollComplete,
  });

  useEffect(() => {
    stateRef.current = { isRolling, resultNumber, onRollComplete };
  }, [isRolling, resultNumber, onRollComplete]);

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    let isDestroyed = false;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0, 7.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.setClearColor(0x000000, 0);

    // Studio Environment Lighting (Radiant Gold Reflections)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv).texture;

    mountNode.appendChild(renderer.domElement);

    // 2. Cinematic Lighting
    const ambient = new THREE.HemisphereLight(0xfffbeb, 0x18181b, 2.2);
    scene.add(ambient);

    const warmKeyLight = new THREE.DirectionalLight(0xffe082, 4.8);
    warmKeyLight.position.set(5, 7, 7);
    warmKeyLight.castShadow = true;
    scene.add(warmKeyLight);

    const coolRimLight = new THREE.DirectionalLight(0x38bdf8, 3.2);
    coolRimLight.position.set(-6, -3, 5);
    scene.add(coolRimLight);

    const frontHighlight = new THREE.PointLight(0xfffbeb, 3.0, 12);
    frontHighlight.position.set(0, 1, 6);
    scene.add(frontHighlight);

    // 3. Dice Container Object
    const dicePivot = new THREE.Group();
    scene.add(dicePivot);

    // Compute Target Quaternion for the exact landed numeral
    function computeTargetQuaternion(num: number): THREE.Quaternion {
      const face = D20_FACE_NORMALS.find((f) => f.num === num) || D20_FACE_NORMALS[19]; // Default 20
      const normal = new THREE.Vector3(...face.normal).normalize();
      const up = new THREE.Vector3(...face.up).projectOnPlane(normal).normalize();
      const right = new THREE.Vector3().crossVectors(up, normal).normalize();

      const basis = new THREE.Matrix4().makeBasis(right, up, normal);
      return new THREE.Quaternion().setFromRotationMatrix(basis).invert();
    }

    let animationId = 0;
    let rollStartTime = stateRef.current.isRolling ? Date.now() : 0;
    const rollDuration = 1300;
    let velX = (18 + Math.random() * 8) * (Math.random() > 0.5 ? 1 : -1);
    let velY = (24 + Math.random() * 10) * (Math.random() > 0.5 ? 1 : -1);
    let velZ = (16 + Math.random() * 6) * (Math.random() > 0.5 ? 1 : -1);
    let wasRolling = stateRef.current.isRolling;
    let lastResultNum = stateRef.current.resultNumber;
    let hasTriggeredComplete = !stateRef.current.isRolling;

    const startQuaternion = new THREE.Quaternion();
    let targetQuaternion = computeTargetQuaternion(stateRef.current.resultNumber || 20);

    // 4. Load High-Quality d20.glb Model
    const loader = new GLTFLoader();
    loader.load(
      '/models/d20.glb',
      (gltf) => {
        if (isDestroyed) return;

        const model = gltf.scene;

        // Center model geometry
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const sizeBox = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(sizeBox.x, sizeBox.y, sizeBox.z);

        // Normalize scale to fit viewer
        const scaleFactor = 3.2 / (maxDim || 1);
        model.scale.setScalar(scaleFactor);
        model.position.copy(center.negate().multiplyScalar(scaleFactor));

        // Configure radiant gold numbers & polished obsidian materials
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              const isLettersMesh = mesh.name.toLowerCase().includes('letter');

              if (isLettersMesh) {
                // Radiant Polished Gold Numbers
                mat.color = new THREE.Color(0xffd700);
                mat.metalness = 0.95;
                mat.roughness = 0.15;
                mat.envMapIntensity = 2.5;
              } else {
                // Deep Obsidian / Marble Facet Body
                mat.metalness = 0.2;
                mat.roughness = 0.35;
                mat.envMapIntensity = 1.2;
              }
              mat.needsUpdate = true;
            }
          }
        });

        dicePivot.add(model);
        setIsLoading(false);

        if (!stateRef.current.isRolling) {
          dicePivot.quaternion.copy(targetQuaternion);
        }
      },
      undefined,
      (error) => {
        console.error('Error loading /models/d20.glb:', error);
        setIsLoading(false);
      }
    );

    // 5. Animation & Physics Loop
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const currentState = stateRef.current;

      // Handle roll trigger / result number change
      if (
        (currentState.isRolling && !wasRolling) ||
        currentState.resultNumber !== lastResultNum
      ) {
        rollStartTime = Date.now();
        targetQuaternion = computeTargetQuaternion(currentState.resultNumber || 20);
        velX = (18 + Math.random() * 8) * (Math.random() > 0.5 ? 1 : -1);
        velY = (24 + Math.random() * 10) * (Math.random() > 0.5 ? 1 : -1);
        velZ = (16 + Math.random() * 6) * (Math.random() > 0.5 ? 1 : -1);
        startQuaternion.copy(dicePivot.quaternion);
        hasTriggeredComplete = false;
      }

      wasRolling = currentState.isRolling;
      lastResultNum = currentState.resultNumber;

      if (rollStartTime > 0) {
        const elapsed = Date.now() - rollStartTime;
        const progress = Math.min(1.0, elapsed / rollDuration);

        if (progress < 0.65) {
          // High-speed spin phase
          dicePivot.rotation.x += velX * 0.016;
          dicePivot.rotation.y += velY * 0.016;
          dicePivot.rotation.z += velZ * 0.016;
          velX *= 0.992;
          velY *= 0.992;
          velZ *= 0.992;
          startQuaternion.copy(dicePivot.quaternion);
        } else {
          // Smooth bounce landing
          const settleT = (progress - 0.65) / 0.35;
          const c1 = 1.4;
          const c3 = c1 + 1;
          const easeT = 1 + c3 * Math.pow(settleT - 1, 3) + c1 * Math.pow(settleT - 1, 2);

          dicePivot.quaternion.slerpQuaternions(
            startQuaternion,
            targetQuaternion,
            Math.min(1.0, Math.max(0, easeT))
          );

          if (progress >= 1.0) {
            dicePivot.quaternion.copy(targetQuaternion);
            rollStartTime = 0;
            if (!hasTriggeredComplete && currentState.onRollComplete) {
              hasTriggeredComplete = true;
              currentState.onRollComplete();
            }
          }
        }
      } else {
        // Idle floating
        dicePivot.quaternion.copy(targetQuaternion);
        dicePivot.position.y = Math.sin(Date.now() * 0.002) * 0.06;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Safe Cleanup
    return () => {
      isDestroyed = true;
      cancelAnimationFrame(animationId);
      pmremGenerator.dispose();
      roomEnv.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mountNode) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className="flex items-center justify-center pointer-events-none mx-auto overflow-visible relative"
    >
      <div ref={mountRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}