import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type ProgressListener = (ratio: number) => void;

let cachedD20Scene: THREE.Group | null = null;
let preloadPromise: Promise<THREE.Group> | null = null;
const progressListeners = new Set<ProgressListener>();

/** Estimated byte size of web/public/models/d20.glb */
const ESTIMATED_D20_BYTES = 6926544;

/**
 * Pre-processes, centers, scales, and assigns custom materials
 * to the raw D20 GLTF scene so it's ready for immediate rendering.
 */
function prepareD20Model(rawScene: THREE.Group): THREE.Group {
  const model = rawScene;

  // Center model geometry
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const sizeBox = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(sizeBox.x, sizeBox.y, sizeBox.z);

  // Normalize scale to fit standard viewer container
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

  return model;
}

/**
 * Preload and cache the 3D D20 GLB model in memory.
 * Similar to Flutter's precacheImage / precacheAsset workflow,
 * this ensures subsequent dice rolls instantiate synchronously with 0ms delay.
 */
export function preloadD20(onProgress?: ProgressListener): Promise<THREE.Group> {
  // If already fully cached in memory, report completion immediately.
  if (cachedD20Scene) {
    if (onProgress) onProgress(1);
    return Promise.resolve(cachedD20Scene);
  }

  if (onProgress) {
    progressListeners.add(onProgress);
  }

  // If a preload is already in flight, reuse the promise
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = new Promise<THREE.Group>((resolve, reject) => {
    if (typeof window === 'undefined') {
      // In SSR environment, resolve empty group
      resolve(new THREE.Group());
      return;
    }

    const loader = new GLTFLoader();

    loader.load(
      '/models/d20.glb',
      (gltf) => {
        try {
          const prepared = prepareD20Model(gltf.scene);
          cachedD20Scene = prepared;

          // Notify all progress listeners that load is complete
          progressListeners.forEach((listener) => {
            try {
              listener(1.0);
            } catch (err) {
              console.error('Error in progress listener:', err);
            }
          });
          progressListeners.clear();

          resolve(prepared);
        } catch (err) {
          console.error('Failed to prepare cached D20 model:', err);
          preloadPromise = null;
          reject(err);
        }
      },
      (xhr) => {
        let ratio = 0;
        if (xhr.total && xhr.total > 0) {
          ratio = Math.min(1.0, xhr.loaded / xhr.total);
        } else if (xhr.loaded > 0) {
          ratio = Math.min(0.95, xhr.loaded / ESTIMATED_D20_BYTES);
        }

        progressListeners.forEach((listener) => {
          try {
            listener(ratio);
          } catch (err) {
            console.error('Error in progress listener:', err);
          }
        });
      },
      (error) => {
        console.error('Failed to preload /models/d20.glb:', error);
        preloadPromise = null;
        progressListeners.clear();
        reject(error);
      }
    );
  });

  return preloadPromise;
}

/**
 * Returns a cloned instance of the preloaded D20 model ready to attach to a scene,
 * or null if not yet preloaded.
 */
export function getCachedD20Model(): THREE.Group | null {
  if (!cachedD20Scene) return null;
  return cachedD20Scene.clone(true);
}

/**
 * Returns whether the 3D D20 model is ready in RAM.
 */
export function isD20Preloaded(): boolean {
  return cachedD20Scene !== null;
}
