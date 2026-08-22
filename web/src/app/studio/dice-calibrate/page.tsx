'use client';

import React, { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RotateCw,
  Sparkles,
  Dices,
  Check,
  Play,
  SlidersHorizontal,
  Flame,
  MousePointer,
  Crosshair,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Download,
  Upload,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

interface SavedCalibration {
  num: number;
  normal: [number, number, number];
  up: [number, number, number];
  isFixed: boolean;
}

// 20 Geometric Facet Normals of d20.glb for crisp magnetic face snapping
const D20_GEOMETRIC_FACETS: THREE.Vector3[] = [
  new THREE.Vector3(0.8952, 0.2750, 0.3508).normalize(),
  new THREE.Vector3(-0.6730, 0.6960, -0.2502).normalize(),
  new THREE.Vector3(-0.5671, 0.2902, 0.7708).normalize(),
  new THREE.Vector3(-0.5587, -0.7454, 0.3638).normalize(),
  new THREE.Vector3(-0.2763, -0.5626, 0.7792).normalize(),
  new THREE.Vector3(0.7067, -0.7011, 0.0946).normalize(),
  new THREE.Vector3(-0.9575, -0.1649, -0.2368).normalize(),
  new THREE.Vector3(0.0697, 0.9952, 0.0683).normalize(),
  new THREE.Vector3(0.4718, 0.3409, -0.8132).normalize(),
  new THREE.Vector3(0.6693, 0.6989, -0.2521).normalize(),
  new THREE.Vector3(0.9418, -0.2548, -0.2195).normalize(),
  new THREE.Vector3(0.4730, -0.1538, -0.8675).normalize(),
  new THREE.Vector3(-0.9689, 0.2350, 0.0769).normalize(),
  new THREE.Vector3(0.0332, 0.9617, 0.2720).normalize(),
  new THREE.Vector3(-0.2251, 0.5291, -0.8181).normalize(),
  new THREE.Vector3(-0.3018, -0.3476, 0.8878).normalize(),
  new THREE.Vector3(0.8728, 0.4277, 0.2353).normalize(),
  new THREE.Vector3(-0.9257, 0.3732, 0.0614).normalize(),
  new THREE.Vector3(0.5572, -0.8302, 0.0152).normalize(),
  new THREE.Vector3(-0.9170, -0.3632, -0.1653).normalize(),
];

// Initial defaults for all 20 numbers
const INITIAL_CALIBRATIONS: SavedCalibration[] = [
  { num: 1,  normal: [0.0146, -0.9916, -0.1287], up: [0.0143, -0.1285, 0.9916], isFixed: true },
  { num: 2,  normal: [0.6457, 0.7247, -0.2406],  up: [0.5836, -0.6715, -0.4567], isFixed: true },
  { num: 3,  normal: [-0.9495, -0.2299, -0.2136], up: [-0.1065, 0.8763, -0.4698], isFixed: true },
  { num: 4,  normal: [0.6045, 0.1545, 0.7815],   up: [0.6176, -0.7105, -0.3373], isFixed: true },
  { num: 5,  normal: [0.9455, -0.2242, -0.2363], up: [0.088, 0.8742, -0.4776],  isFixed: true },
  { num: 6,  normal: [-0.6114, 0.1363, 0.7795],  up: [-0.621, -0.6932, -0.3658], isFixed: true },
  { num: 7,  normal: [-0.0132, -0.5139, -0.8577], up: [-0.0176, 0.8578, -0.5137], isFixed: true },
  { num: 8,  normal: [-0.6682, 0.7038, -0.2412], up: [-0.5447, -0.6837, -0.4858], isFixed: true },
  { num: 9,  normal: [-0.3025, -0.4126, 0.8592], up: [0.5134, 0.689, 0.5116],  isFixed: true },
  { num: 10, normal: [-0.2693, 0.4314, -0.861],  up: [0.5345, -0.6767, -0.5063], isFixed: true },
  { num: 11, normal: [0.3281, -0.3916, 0.8596],  up: [-0.4797, 0.7148, 0.5088], isFixed: true },
  { num: 12, normal: [0.2974, 0.4018, -0.8661],  up: [-0.5261, -0.688, -0.4999], isFixed: true },
  { num: 13, normal: [0.6607, -0.7117, 0.2388],  up: [0.561, 0.6795, 0.4728],  isFixed: true },
  { num: 14, normal: [-0.0049, 0.5405, 0.8414],  up: [-0.0328, -0.841, 0.54],   isFixed: true },
  { num: 15, normal: [0.6188, -0.1375, -0.7734], up: [0.5989, 0.7197, 0.3512], isFixed: true },
  { num: 16, normal: [-0.9527, 0.1747, 0.2486],  up: [-0.036, -0.8774, 0.4785], isFixed: true },
  { num: 17, normal: [-0.6811, -0.09, -0.7266],  up: [-0.5467, 0.7226, 0.4229], isFixed: true },
  { num: 18, normal: [0.9489, 0.1987, 0.245],   up: [0.0666, -0.8855, 0.4598], isFixed: true },
  { num: 19, normal: [-0.6776, -0.6924, 0.2479], up: [-0.5529, 0.7019, 0.449],  isFixed: true },
  { num: 20, normal: [-0.0085, 0.9997, -0.0208], up: [-0.0223, -0.021, -0.9995], isFixed: true },
];

const STORAGE_KEY = 'storyforge_d20_free_calibration_v1';

// localStorage-backed external store for calibrations (avoids setState-in-effect on mount).
let calibrationRawCache = '';
let calibrationParsedCache: SavedCalibration[] = INITIAL_CALIBRATIONS;
const CALIBRATION_EVENT = 'storyforge:calibration-change';

function readCalibrations(): SavedCalibration[] {
  if (typeof window === 'undefined') return INITIAL_CALIBRATIONS;
  const raw = window.localStorage.getItem(STORAGE_KEY) || '';
  if (raw !== calibrationRawCache) {
    calibrationRawCache = raw;
    try {
      const parsed = JSON.parse(raw);
      calibrationParsedCache =
        Array.isArray(parsed) && parsed.length === 20 ? parsed : INITIAL_CALIBRATIONS;
    } catch {
      calibrationParsedCache = INITIAL_CALIBRATIONS;
    }
  }
  return calibrationParsedCache;
}

function subscribeCalibrations(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CALIBRATION_EVENT, cb);
  return () => window.removeEventListener(CALIBRATION_EVENT, cb);
}

function notifyCalibrationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CALIBRATION_EVENT));
}

export default function DiceCalibratePage() {
  const calibrations = useSyncExternalStore(
    subscribeCalibrations,
    readCalibrations,
    () => INITIAL_CALIBRATIONS
  );
  const [selectedNum, setSelectedNum] = useState<number>(20);
  const [showCrosshair, setShowCrosshair] = useState<boolean>(true);
  const [hasCopied, setHasCopied] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Drag interaction states
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Test Roll State
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [rollingTargetText, setRollingTargetText] = useState<string>('');

  const mountRef = useRef<HTMLDivElement>(null);
  const dicePivotRef = useRef<THREE.Group | null>(null);
  const lastSpherePointRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 1));
  const isPointerDownRef = useRef<boolean>(false);

  // Save to localStorage and notify subscribers (store-backed, no setState-in-effect)
  const saveCalibrationsToStorage = (updated: SavedCalibration[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota error
    }
    notifyCalibrationsChanged();
  };

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // Convert normal + up vectors to Three.js Quaternion
  const computeQuaternionFromVectors = useCallback((normalVec: [number, number, number], upVec: [number, number, number]) => {
    const normal = new THREE.Vector3(...normalVec).normalize();
    const up = new THREE.Vector3(...upVec).projectOnPlane(normal).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, normal);
    return new THREE.Quaternion().setFromRotationMatrix(basis).invert();
  }, []);

  // Calculate current model-space normal & up from dicePivot's current orientation
  const getCurrentOrientationVectors = useCallback(() => {
    if (!dicePivotRef.current) return null;
    const invQ = dicePivotRef.current.quaternion.clone().invert();
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(invQ).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(invQ).normalize();
    return {
      normal: [Number(normal.x.toFixed(4)), Number(normal.y.toFixed(4)), Number(normal.z.toFixed(4))] as [number, number, number],
      up: [Number(up.x.toFixed(4)), Number(up.y.toFixed(4)), Number(up.z.toFixed(4))] as [number, number, number],
    };
  }, []);

  // Map 2D pointer coordinates on viewport to a 3D Virtual Sphere point for Arcball rotation
  const getSpherePoint = (clientX: number, clientY: number, rect: DOMRect): THREE.Vector3 => {
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const sq = x * x + y * y;
    if (sq <= 1.0) {
      return new THREE.Vector3(x, y, Math.sqrt(1.0 - sq)).normalize();
    } else {
      return new THREE.Vector3(x, y, 0).normalize();
    }
  };

  // Setup Three.js WebGL Scene
  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    let isDestroyed = false;
    let animationId = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(380, 380);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;

    mountNode.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xfffbeb, 0x18181b, 2.2);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffe082, 4.8);
    key.position.set(5, 7, 7);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x38bdf8, 3.2);
    rim.position.set(-6, -3, 5);
    scene.add(rim);

    const front = new THREE.PointLight(0xfffbeb, 3.0, 12);
    front.position.set(0, 1, 6);
    scene.add(front);

    const dicePivot = new THREE.Group();
    scene.add(dicePivot);
    dicePivotRef.current = dicePivot;

    // Load initial 20 orientation
    const init20 = INITIAL_CALIBRATIONS.find((c) => c.num === 20)!;
    const initialQ = computeQuaternionFromVectors(init20.normal, init20.up);
    dicePivot.quaternion.copy(initialQ);

    const loader = new GLTFLoader();
    loader.load('/models/d20.glb', (gltf) => {
      if (isDestroyed) return;
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const sizeBox = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(sizeBox.x, sizeBox.y, sizeBox.z);
      const scaleFactor = 3.2 / (maxDim || 1);
      model.scale.setScalar(scaleFactor);
      model.position.copy(center.negate().multiplyScalar(scaleFactor));

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mesh.name.toLowerCase().includes('letter')) {
              mat.color = new THREE.Color(0xffd700);
              mat.metalness = 0.95;
              mat.roughness = 0.15;
              mat.envMapIntensity = 2.5;
            } else {
              mat.metalness = 0.2;
              mat.roughness = 0.35;
              mat.envMapIntensity = 1.2;
            }
            mat.needsUpdate = true;
          }
        }
      });

      dicePivot.add(model);
    });

    const render = () => {
      animationId = requestAnimationFrame(render);
      renderer.render(scene, camera);
    };
    render();

    return () => {
      isDestroyed = true;
      cancelAnimationFrame(animationId);
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mountNode) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [computeQuaternionFromVectors]);

  // Pointer drag events for Arcball 3D rotation
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRolling) return;
    const rect = e.currentTarget.getBoundingClientRect();
    isPointerDownRef.current = true;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    lastSpherePointRef.current = getSpherePoint(e.clientX, e.clientY, rect);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || !dicePivotRef.current || isRolling) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentPoint = getSpherePoint(e.clientX, e.clientY, rect);
    const lastPoint = lastSpherePointRef.current;

    const axis = new THREE.Vector3().crossVectors(lastPoint, currentPoint);
    const dot = Math.min(1.0, Math.max(-1.0, lastPoint.dot(currentPoint)));
    const angle = Math.acos(dot);

    if (axis.lengthSq() > 1e-6 && angle > 1e-4) {
      axis.normalize();
      // Sensitivity multiplier for responsive dragging
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle * 1.6);
      dicePivotRef.current.quaternion.premultiply(deltaQ);
      lastSpherePointRef.current.copy(currentPoint);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }
  };

  // Screen Roll rotation (Z-axis rotation in camera view plane)
  const handleRollDelta = (degrees: number) => {
    if (!dicePivotRef.current || isRolling) return;
    const rad = (degrees * Math.PI) / 180;
    const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rad);
    dicePivotRef.current.quaternion.premultiply(rollQ);
  };

  // View-space Pitch (X) / Yaw (Y) tilt nudges
  const handlePitchDelta = (degrees: number) => {
    if (!dicePivotRef.current || isRolling) return;
    const rad = (degrees * Math.PI) / 180;
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rad);
    dicePivotRef.current.quaternion.premultiply(pitchQ);
  };

  const handleYawDelta = (degrees: number) => {
    if (!dicePivotRef.current || isRolling) return;
    const rad = (degrees * Math.PI) / 180;
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rad);
    dicePivotRef.current.quaternion.premultiply(yawQ);
  };

  // Snap the nearest d20 facet to perfectly face the camera (+Z)
  const handleSnapNearestFacet = () => {
    if (!dicePivotRef.current || isRolling) return;
    const invQ = dicePivotRef.current.quaternion.clone().invert();
    const currentFrontModel = new THREE.Vector3(0, 0, 1).applyQuaternion(invQ).normalize();

    // Find facet with highest dot product with current front
    let bestFacet = D20_GEOMETRIC_FACETS[0];
    let maxDot = -Infinity;
    for (const facet of D20_GEOMETRIC_FACETS) {
      const dot = facet.dot(currentFrontModel);
      if (dot > maxDot) {
        maxDot = dot;
        bestFacet = facet;
      }
    }

    // Preserve the current screen-up orientation projected onto the plane of the best facet
    const currentUpModel = new THREE.Vector3(0, 1, 0).applyQuaternion(invQ).normalize();
    const projectedUp = currentUpModel.clone().projectOnPlane(bestFacet).normalize();
    const projectedRight = new THREE.Vector3().crossVectors(projectedUp, bestFacet).normalize();

    const basis = new THREE.Matrix4().makeBasis(projectedRight, projectedUp, bestFacet);
    const snappedQ = new THREE.Quaternion().setFromRotationMatrix(basis).invert();

    dicePivotRef.current.quaternion.copy(snappedQ);
    showToast('Snapped facet flat to screen!');
  };

  // Jump to and inspect a specific number's saved orientation
  const handleSelectNumber = (num: number) => {
    setSelectedNum(num);
    const item = calibrations.find((c) => c.num === num);
    if (item && dicePivotRef.current && !isRolling) {
      const q = computeQuaternionFromVectors(item.normal, item.up);
      dicePivotRef.current.quaternion.copy(q);
    }
  };

  // Fix & Lock current orientation for the selected number
  const handleFixCurrentOrientation = (targetNum = selectedNum) => {
    const orientation = getCurrentOrientationVectors();
    if (!orientation) return;

    const updated = calibrations.map((item) => {
      if (item.num === targetNum) {
        return {
          ...item,
          normal: orientation.normal,
          up: orientation.up,
          isFixed: true,
        };
      }
      return item;
    });

    saveCalibrationsToStorage(updated);
    showToast(`✓ Fixed and locked orientation for Number ${targetNum}!`);

    // Suggest next un-fixed number
    const nextUnfixed = updated.find((c) => !c.isFixed && c.num !== targetNum);
    if (nextUnfixed) {
      // Keep user on the flow or highlight next
    }
  };

  // Test Choreographed Roll
  const performChoreographedRoll = (targetNum: number) => {
    const item = calibrations.find((c) => c.num === targetNum) || calibrations[19];
    setIsRolling(true);
    setRollingTargetText(`Number ${targetNum}`);

    if (!dicePivotRef.current) return;
    const pivot = dicePivotRef.current;

    const targetQ = computeQuaternionFromVectors(item.normal, item.up);
    const startQ = pivot.quaternion.clone();

    let velX = (18 + Math.random() * 8) * (Math.random() > 0.5 ? 1 : -1);
    let velY = (24 + Math.random() * 10) * (Math.random() > 0.5 ? 1 : -1);
    let velZ = (16 + Math.random() * 6) * (Math.random() > 0.5 ? 1 : -1);

    const startTime = Date.now();
    const duration = 1300;

    const rollStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / duration);

      if (progress < 0.65) {
        pivot.rotation.x += velX * 0.016;
        pivot.rotation.y += velY * 0.016;
        pivot.rotation.z += velZ * 0.016;
        velX *= 0.992;
        velY *= 0.992;
        velZ *= 0.992;
        startQ.copy(pivot.quaternion);
        requestAnimationFrame(rollStep);
      } else {
        const settleT = (progress - 0.65) / 0.35;
        const c1 = 1.4;
        const c3 = c1 + 1;
        const easeT = 1 + c3 * Math.pow(settleT - 1, 3) + c1 * Math.pow(settleT - 1, 2);

        pivot.quaternion.slerpQuaternions(startQ, targetQ, Math.min(1.0, Math.max(0, easeT)));

        if (progress < 1.0) {
          requestAnimationFrame(rollStep);
        } else {
          pivot.quaternion.copy(targetQ);
          setIsRolling(false);
        }
      }
    };
    requestAnimationFrame(rollStep);
  };

  // Generate clean TypeScript code for ThreeD20Dice.tsx
  const generateTypeScriptCode = () => {
    const cleanList = calibrations.map((c) => ({
      num: c.num,
      normal: c.normal,
      up: c.up,
    }));
    cleanList.sort((a, b) => a.num - b.num);

    return `// 20 Exact Calibrated Face Normals and Up Vectors for d20.glb (1 to 20)\nexport const D20_FACE_NORMALS: { num: number; normal: [number, number, number]; up: [number, number, number] }[] = ${JSON.stringify(
      cleanList,
      null,
      2
    )};`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateTypeScriptCode());
    setHasCopied(true);
    showToast('Code copied to clipboard!');
    setTimeout(() => setHasCopied(false), 2500);
  };

  const handleResetDefaults = () => {
    saveCalibrationsToStorage(INITIAL_CALIBRATIONS);
    handleSelectNumber(selectedNum);
    showToast('Reset calibrations to initial defaults.');
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(calibrations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'storyforge-d20-calibrations.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed) && parsed.length === 20) {
          saveCalibrationsToStorage(parsed);
          showToast('Successfully imported calibrations!');
        } else {
          showToast('Invalid JSON file structure');
        }
      } catch {
        showToast('Failed to parse JSON');
      }
    };
    reader.readAsText(file);
  };

  const fixedCount = calibrations.filter((c) => c.isFixed).length;
  const activeCalibration = calibrations.find((c) => c.num === selectedNum);

  return (
    <div dir="ltr" className="min-h-screen bg-[#07080d] text-zinc-100 p-4 md:p-8 font-sans selection:bg-amber-500/30">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
              <Dices className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">Free-Roam D20 Calibrator</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
                  {fixedCount}/20 Fixed
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-1">
                Drag the dice directly with your mouse to rotate freely, align each number upright, and lock it in.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportJSON}
              title="Export JSON backup"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700/60 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>

            <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700/60 transition cursor-pointer active:scale-95">
              <Upload className="w-3.5 h-3.5" /> Import
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>

            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/25 transition-all active:scale-95"
            >
              {hasCopied ? <Check className="w-4 h-4 stroke-[3]" /> : <Sparkles className="w-4 h-4" />}
              {hasCopied ? 'Copied Code!' : 'Copy Code for ThreeD20Dice'}
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {feedbackToast && (
          <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-amber-500 text-black font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-top-2 flex items-center gap-2 border border-amber-300">
            <Sparkles className="w-4 h-4" />
            {feedbackToast}
          </div>
        )}

        {/* 20 Number Status Bar (1 to 20) */}
        <section className="p-4 md:p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-zinc-300 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400" />
              Select Target Number to Calibrate (1 - 20):
            </span>
            <span className="text-zinc-400 font-mono text-[11px]">
              Active Slot: <strong className="text-amber-400 text-xs">Number {selectedNum}</strong> {activeCalibration?.isFixed ? '(Fixed ✓)' : '(Unsaved)'}
            </span>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-20 gap-1.5">
            {calibrations.map((item) => {
              const isSelected = selectedNum === item.num;
              return (
                <button
                  key={item.num}
                  onClick={() => handleSelectNumber(item.num)}
                  className={`group relative py-2.5 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black shadow-lg shadow-amber-500/30 scale-105 ring-2 ring-amber-300'
                      : item.isFixed
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/80'
                      : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/40'
                  }`}
                >
                  <span className="text-sm leading-none">{item.num}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.isFixed ? (isSelected ? 'bg-black' : 'bg-emerald-400') : 'bg-zinc-600'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </section>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 3D Viewport Stage */}
          <div className="lg:col-span-7 p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800 shadow-2xl flex flex-col items-center justify-between space-y-6">
            <div className="w-full flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <MousePointer className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-zinc-200">Interactive 3D Stage</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                  Click & Drag to Rotate
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCrosshair(!showCrosshair)}
                  className={`p-1.5 rounded-lg border text-xs transition ${
                    showCrosshair
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                  }`}
                  title="Toggle Alignment Crosshair"
                >
                  <Crosshair className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3D Canvas Mount with Crosshair Overlay */}
            <div className="relative group select-none">
              <div
                ref={mountRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-[340px] h-[340px] sm:w-[380px] sm:h-[380px] rounded-3xl bg-gradient-to-b from-black/90 via-[#0e0f17] to-[#141624] border border-zinc-800 shadow-inner flex items-center justify-center overflow-hidden touch-none ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              />

              {/* Centering & Vertical Alignment Crosshair */}
              {showCrosshair && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-44 h-44 rounded-full border border-amber-500/20 border-dashed" />
                  <div className="w-20 h-20 rounded-full border border-amber-400/30" />
                  <div className="absolute w-[1px] h-32 bg-amber-400/25" />
                  <div className="absolute h-[1px] w-32 bg-amber-400/25" />
                  <div className="absolute top-6 text-[10px] font-mono text-amber-400/60 uppercase tracking-widest">
                    ▲ Upright Top
                  </div>
                </div>
              )}

              {/* Status Badge Overlays */}
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-zinc-700/60 text-[11px] font-mono text-zinc-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Fixing Number: <strong className="text-white">{selectedNum}</strong>
              </div>

              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-zinc-700/60 text-[11px] font-mono text-zinc-300">
                {activeCalibration?.isFixed ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Fixed
                  </span>
                ) : (
                  <span className="text-amber-400">Unsaved</span>
                )}
              </div>
            </div>

            {/* Quick Actions Directly Below Canvas */}
            <div className="w-full flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleSnapNearestFacet}
                disabled={isRolling}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs border border-zinc-700/80 transition active:scale-95 disabled:opacity-50"
              >
                <Compass className="w-4 h-4 text-sky-400" />
                Snap Flat to Nearest Face
              </button>

              <button
                onClick={() => handleFixCurrentOrientation(selectedNum)}
                disabled={isRolling}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Lock & Save as Number {selectedNum}
              </button>
            </div>
          </div>

          {/* Right Column: Precision Tools & Controls */}
          <div className="lg:col-span-5 space-y-5">
            {/* Step 1: Upright Roll (Screen-Space Z-Axis) */}
            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-amber-400" />
                  1. Upright Roll (Spin on Screen)
                </span>
                <span className="text-xs text-zinc-400 font-mono">Camera Z</span>
              </div>
              <p className="text-xs text-zinc-400">
                Once the number is facing you, spin it clockwise or counter-clockwise until it stands upright:
              </p>

              {/* Precision Roll Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleRollDelta(-90)}
                  className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95"
                >
                  -90°
                </button>
                <button
                  onClick={() => handleRollDelta(-15)}
                  className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95"
                >
                  -15°
                </button>
                <button
                  onClick={() => handleRollDelta(-1)}
                  className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-bold transition active:scale-95"
                >
                  -1°
                </button>
                <button
                  onClick={() => handleRollDelta(1)}
                  className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-bold transition active:scale-95"
                >
                  +1°
                </button>
                <button
                  onClick={() => handleRollDelta(15)}
                  className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95"
                >
                  +15°
                </button>
                <button
                  onClick={() => handleRollDelta(90)}
                  className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95"
                >
                  +90°
                </button>
                <button
                  onClick={() => handleRollDelta(180)}
                  className="col-span-2 py-2 px-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition active:scale-95"
                >
                  180° Flip
                </button>
              </div>
            </div>

            {/* Step 2: Micro Pitch & Yaw Tilt Nudges */}
            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                  2. Micro Pitch & Yaw Tilt
                </span>
                <span className="text-xs text-zinc-400 font-mono">±2° / ±10°</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePitchDelta(-10)}
                    title="Tilt Down 10°"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition active:scale-95"
                  >
                    -10° Tilt
                  </button>
                  <button
                    onClick={() => handlePitchDelta(-2)}
                    title="Tilt Down 2°"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sky-300 transition active:scale-95"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePitchDelta(2)}
                    title="Tilt Up 2°"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sky-300 transition active:scale-95"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePitchDelta(10)}
                    title="Tilt Up 10°"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition active:scale-95"
                  >
                    +10° Tilt
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleYawDelta(-10)}
                    title="Pan Left 10°"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition active:scale-95"
                  >
                    -10° Pan
                  </button>
                  <button
                    onClick={() => handleYawDelta(-2)}
                    title="Pan Left 2°"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sky-300 transition active:scale-95"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleYawDelta(2)}
                    title="Pan Right 2°"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sky-300 transition active:scale-95"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleYawDelta(10)}
                    title="Pan Right 10°"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition active:scale-95"
                  >
                    +10° Pan
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Assign Current View to Any Number */}
            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 space-y-3 shadow-lg">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Assign View to Different Number:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setSelectedNum(n);
                      handleFixCurrentOrientation(n);
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-zinc-800/80 hover:bg-amber-500 hover:text-black text-zinc-400 transition"
                  >
                    #{n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Roll Testing Section */}
        <section className="p-6 md:p-8 rounded-3xl bg-zinc-900/40 border border-zinc-800 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                Test Live 3D Roll Physics by Number
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Click any number below to test rolling to its saved orientation with the full game tumble & bounce animation:
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => performChoreographedRoll(selectedNum)}
                disabled={isRolling}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition active:scale-95 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-amber-300" />
                {isRolling ? 'Rolling...' : `Roll Active (#${selectedNum})`}
              </button>

              <button
                onClick={() => {
                  const rand = Math.floor(Math.random() * 20) + 1;
                  performChoreographedRoll(rand);
                }}
                disabled={isRolling}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 transition active:scale-95 disabled:opacity-50"
              >
                <Dices className="w-3.5 h-3.5 text-amber-400" />
                Roll Random
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-20 gap-2">
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
              const item = calibrations.find((c) => c.num === n);
              return (
                <button
                  key={n}
                  onClick={() => performChoreographedRoll(n)}
                  disabled={isRolling}
                  className={`py-3 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
                    item?.isFixed
                      ? 'bg-zinc-800 text-emerald-300 hover:bg-emerald-500 hover:text-black border border-emerald-500/30'
                      : 'bg-zinc-800/60 text-zinc-400 hover:bg-amber-500 hover:text-black border border-zinc-700/40'
                  } active:scale-95 disabled:opacity-50`}
                >
                  <span>{n}</span>
                  <span className="text-[9px] font-mono opacity-60">Roll</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Help & Workflow Guide */}
        <footer className="p-5 rounded-3xl bg-zinc-900/30 border border-zinc-800/60 text-zinc-400 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Calibration Workflow:</strong> 1) Click and drag the dice to find your target number. 2) Click &quot;Snap Flat to Nearest Face&quot;. 3) Use Upright Roll buttons to rotate it upright. 4) Click &quot;Lock &amp; Save as Number X&quot;.
            </span>
          </div>

          <button
            onClick={handleResetDefaults}
            className="text-zinc-500 hover:text-red-400 transition text-[11px] underline underline-offset-4 shrink-0"
          >
            Reset Calibrations to Defaults
          </button>
        </footer>
      </div>
    </div>
  );
}
