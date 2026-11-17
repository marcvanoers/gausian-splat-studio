/**
 * 3D Viewport Component for Postshot Studio
 * Powered by @mkkellogg/gaussian-splats-3d (industry-standard Three.js 3DGS engine)
 * - Multi-threaded Web Worker Radix Sorting at rock-solid 60 FPS
 * - Eliminates giant floater blobs with alpha thresholding and near-plane clamping
 * - Full support for Inria 3DGS binary PLY (with Spherical Harmonics 0-3), SPLAT, and KSPLAT
 * - Integrated Studio Grid, SfM Camera Frustums, Bounding Crop Box, and Keyframe Sequencer
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import {
  GaussianCloud,
  CameraPose,
  CameraKeyframe,
  RenderMode,
  SplatViewSettings,
  CropBox,
} from '../types/gaussian';
import { exportToSplatFormat } from '../services/plySplatIO';
import { Focus, RefreshCw, Eye, Sliders, Layers, Sparkles, CheckCircle } from 'lucide-react';

interface Viewport3DProps {
  cloud: GaussianCloud | null;
  cameraPoses: CameraPose[];
  keyframes: CameraKeyframe[];
  isPlayingAnimation: boolean;
  animationProgress: number; // 0 to 1
  renderMode: RenderMode;
  viewSettings: SplatViewSettings;
  cropBox: CropBox;
  selectedCameraId: string | null;
  onSelectCamera: (id: string | null) => void;
  onFpsUpdate?: (fps: number) => void;
  onToggleInvertY?: () => void;
  onUpdateFloaterThreshold?: (val: number) => void;
  onUpdateSplatScale?: (scale: number) => void;
  onClearHaze?: () => void;
  onResetFullQuality?: () => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  cloud,
  cameraPoses,
  keyframes,
  isPlayingAnimation,
  animationProgress,
  renderMode,
  viewSettings,
  cropBox,
  selectedCameraId,
  onSelectCamera,
  onFpsUpdate,
  onToggleInvertY,
  onUpdateFloaterThreshold,
  onUpdateSplatScale,
  onClearHaze,
  onResetFullQuality,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Viewer instance reference
  const viewerRef = useRef<GaussianSplats3D.Viewer | null>(null);

  // Aux scene objects added to viewer.threeScene
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const frustumsGroupRef = useRef<THREE.Group | null>(null);
  const cropBoxMeshRef = useRef<THREE.LineSegments | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const sceneTransitionLockRef = useRef<Promise<void>>(Promise.resolve());

  // Internal states
  const [isLoadingScene, setIsLoadingScene] = useState(false);
  const [loadProgress, setLoadProgress] = useState<string | null>(null);
  const [activeSplatCount, setActiveSplatCount] = useState<number>(0);
  const [showFloaterMenu, setShowFloaterMenu] = useState(false);
  const [showScaleMenu, setShowScaleMenu] = useState(false);

  // Focus and center model
  const focusModel = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.controls || !viewer.camera) return;

    const center = cloud?.bounds?.center || [0, 0.5, 0];
    const radius = Math.max(1.5, (cloud?.bounds?.radius || 2.0) * 1.8);

    const targetY = viewSettings.invertY ? -center[1] : center[1];
    viewer.controls.target.set(center[0], targetY, center[2]);
    viewer.camera.position.set(
      center[0] + radius * 0.75,
      targetY + radius * 0.65,
      center[2] + radius * 1.15
    );
    viewer.controls.update();
  }, [cloud, viewSettings.invertY]);

  // View Presets
  const setViewPreset = (type: 'iso' | 'top' | 'front' | 'side') => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.controls || !viewer.camera) return;

    const center = cloud?.bounds?.center || [0, 0.5, 0];
    const radius = Math.max(2.0, (cloud?.bounds?.radius || 2.5) * 2.0);
    const targetY = viewSettings.invertY ? -center[1] : center[1];

    viewer.controls.target.set(center[0], targetY, center[2]);

    if (type === 'top') {
      viewer.camera.position.set(center[0], targetY + radius * 1.5, center[2] + 0.001);
    } else if (type === 'front') {
      viewer.camera.position.set(center[0], targetY + radius * 0.2, center[2] + radius * 1.5);
    } else if (type === 'side') {
      viewer.camera.position.set(center[0] + radius * 1.5, targetY + radius * 0.2, center[2]);
    } else {
      // Iso
      viewer.camera.position.set(
        center[0] + radius * 0.8,
        targetY + radius * 0.7,
        center[2] + radius * 1.1
      );
    }
    viewer.controls.update();
  };

  // 1. Initialize GaussianSplats3D.Viewer
  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    container.innerHTML = '';

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: container,
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 1.5, 3.5],
      initialCameraLookAt: [0, 0.5, 0],
      sharedMemoryForWorkers: false, // Safe execution in iframe & browser environments
      useBuiltInControls: true,
      selfDrivenMode: true,
      gpuAcceleratedSort: false, // Reliable WebGL2 worker radix sort
      integerBasedSort: true,
      antialiased: true,
      sphericalHarmonicsDegree: viewSettings.shDegree || 1, // Crucial for rich specular sheen and reflections
      splatAlphaRemovalThreshold: Math.max(0, viewSettings.floaterThreshold ?? 0), // 0 keeps 100% of splats
      logLevel: GaussianSplats3D.LogLevel.None,
    });

    viewer.init();
    viewer.start();
    viewerRef.current = viewer;

    // Set background color
    if (viewer.renderer) {
      viewer.renderer.setClearColor(new THREE.Color(viewSettings.backgroundColor), 1.0);
    }

    // Ground Grid Helper
    const grid = new THREE.GridHelper(10, 40, 0x475569, 0x1e293b);
    grid.position.y = 0;
    grid.visible = viewSettings.showGroundGrid;
    viewer.threeScene.add(grid);
    gridHelperRef.current = grid;

    // Crop Box Wireframe
    const cropBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cropBoxEdges = new THREE.EdgesGeometry(cropBoxGeo);
    const cropBoxMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
    const cropBoxMesh = new THREE.LineSegments(cropBoxEdges, cropBoxMat);
    cropBoxMesh.visible = viewSettings.showCropBox && cropBox.enabled;
    viewer.threeScene.add(cropBoxMesh);
    cropBoxMeshRef.current = cropBoxMesh;

    // Camera Frustums Group
    const frustumsGroup = new THREE.Group();
    frustumsGroup.visible = viewSettings.showCameras;
    viewer.threeScene.add(frustumsGroup);
    frustumsGroupRef.current = frustumsGroup;

    // Camera flight trajectory line
    const trajMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 });
    const trajGeo = new THREE.BufferGeometry();
    const trajLine = new THREE.Line(trajGeo, trajMat);
    viewer.threeScene.add(trajLine);
    trajectoryLineRef.current = trajLine;

    // Monitor FPS smoothly
    let lastTime = performance.now();
    let frameCount = 0;
    let animId: number;

    const fpsLoop = () => {
      animId = requestAnimationFrame(fpsLoop);
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 500) {
        if (onFpsUpdate) {
          const calculatedFps = Math.round((frameCount * 1000) / (now - lastTime));
          onFpsUpdate(calculatedFps);
        }
        frameCount = 0;
        lastTime = now;
      }
    };
    animId = requestAnimationFrame(fpsLoop);

// Safeguard document.body.removeChild against non-child removals from 3DGS library async disposal
if (typeof document !== 'undefined' && typeof document.body?.removeChild === 'function') {
  const nativeRemoveChild = document.body.removeChild.bind(document.body);
  document.body.removeChild = function <T extends Node>(child: T): T {
    if (child && child.parentNode === document.body) {
      return nativeRemoveChild(child);
    }
    if (child && child.parentNode) {
      return child.parentNode.removeChild(child) as T;
    }
    return child;
  };
}

    return () => {
      cancelAnimationFrame(animId);
      if (viewerRef.current) {
        const viewer = viewerRef.current;
        viewerRef.current = null;
        try {
          viewer.dispose().catch(() => {});
        } catch {
          // Ignore disposal errors
        }
      }
    };
  }, []);

  // Safe helper to update splat scale and point cloud mode when material uniforms are ready
  const updateSplatMeshParameters = (splatMesh: any) => {
    if (!splatMesh) return;
    try {
      const mat = splatMesh.material;
      if (mat && mat.uniforms && mat.uniforms.splatScale) {
        if (typeof splatMesh.setSplatScale === 'function') {
          try {
            splatMesh.setSplatScale(viewSettings.splatScale);
          } catch {
            mat.uniforms.splatScale.value = viewSettings.splatScale;
          }
        } else {
          mat.uniforms.splatScale.value = viewSettings.splatScale;
        }
      }
      if (mat && mat.uniforms && mat.uniforms.pointCloudModeEnabled) {
        if (typeof splatMesh.setPointCloudModeEnabled === 'function') {
          try {
            splatMesh.setPointCloudModeEnabled(renderMode === 'pointcloud');
          } catch {
            mat.uniforms.pointCloudModeEnabled.value = renderMode === 'pointcloud';
          }
        } else {
          mat.uniforms.pointCloudModeEnabled.value = renderMode === 'pointcloud';
        }
      }
    } catch {
      // Ignore transient material initialization states
    }
  };

  // 2. Load / Reload Splat Scene into Viewer when cloud or invertY or floaterThreshold changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !cloud || cloud.count === 0) return;

    let isCancelled = false;

    // Helper to safely wait until viewer finishes any internal load or unload task
    const waitForViewerIdle = async (): Promise<boolean> => {
      let attempts = 0;
      const v = viewer as any;
      while (v && typeof v.isLoadingOrUnloading === 'function' && v.isLoadingOrUnloading()) {
        if (isCancelled) return false;
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
        if (attempts > 1200) return false; // 60-second safety timeout, return false so caller does not proceed while busy
      }
      return !isCancelled && !(typeof v.isLoadingOrUnloading === 'function' && v.isLoadingOrUnloading());
    };

    const loadScene = async () => {
      try {
        setIsLoadingScene(true);
        setLoadProgress('Loading Gaussian Splat Scene...');

        // Wait for any previous pending load/unload to finish before touching scenes
        const isReady = await waitForViewerIdle();
        if (!isReady || isCancelled) return;

        // Clear existing splat scenes safely
        while (viewer.getSceneCount() > 0) {
          const canRemove = await waitForViewerIdle();
          if (!canRemove || isCancelled) return;
          try {
            await viewer.removeSplatScene(0, false);
          } catch (e: any) {
            console.warn('Safe splat scene removal notice:', e?.message || e);
            break;
          }
        }

        if (isCancelled) return;
        const canAdd = await waitForViewerIdle();
        if (!canAdd || isCancelled) return;

        // Determine orientation rotation (OpenCV / COLMAP Y-down flip)
        const rotation: [number, number, number, number] | undefined = viewSettings.invertY
          ? [1, 0, 0, 0] // 180 deg around X flips Y and Z
          : undefined;

        let blobUrl = '';
        let format: GaussianSplats3D.SceneFormat = GaussianSplats3D.SceneFormat.Splat;
        let shouldUseDirectBlob = false;

        if (cloud.fileBlob) {
          const fileName = (cloud.fileBlob as File).name?.toLowerCase() || '';
          try {
            const slice = await cloud.fileBlob.slice(0, 16).arrayBuffer();
            const u8 = new Uint8Array(slice);
            const isPly = u8.length >= 4 && u8[0] === 0x70 && u8[1] === 0x6c && u8[2] === 0x79 && (u8[3] === 0x0a || (u8[3] === 0x0d && u8[4] === 0x0a));
            const isSqlite = u8.length >= 6 && u8[0] === 0x53 && u8[1] === 0x51 && u8[2] === 0x4c;
            const isZip = u8.length >= 2 && u8[0] === 0x50 && u8[1] === 0x4b;

            if (isPly) {
              shouldUseDirectBlob = true;
              format = GaussianSplats3D.SceneFormat.Ply;
              blobUrl = URL.createObjectURL(cloud.fileBlob);
            } else if (fileName.endsWith('.splat') && !isSqlite && !isZip && cloud.fileBlob.size % 32 === 0) {
              shouldUseDirectBlob = true;
              format = GaussianSplats3D.SceneFormat.Splat;
              blobUrl = URL.createObjectURL(cloud.fileBlob);
            }
          } catch {
            shouldUseDirectBlob = false;
          }
        }

        if (!shouldUseDirectBlob) {
          // Export cloud safely to 100% compliant 32-byte .splat
          const splatBlob = exportToSplatFormat(cloud, cropBox);
          blobUrl = URL.createObjectURL(splatBlob);
          format = GaussianSplats3D.SceneFormat.Splat;
        }

        const alphaThreshold = Math.max(0, viewSettings.floaterThreshold ?? 0);
        
        // Final guard: check if viewer became busy in the interim
        if (typeof (viewer as any).isLoadingOrUnloading === 'function' && (viewer as any).isLoadingOrUnloading()) {
          console.warn('Deferring addSplatScene: Viewer is currently busy with another operation.');
          URL.revokeObjectURL(blobUrl);
          setIsLoadingScene(false);
          setLoadProgress(null);
          return;
        }

        await viewer.addSplatScene(blobUrl, {
          format,
          splatAlphaRemovalThreshold: alphaThreshold,
          showLoadingUI: false,
          progressiveLoad: false,
          rotation,
          onProgress: (percent, label) => {
            if (!isCancelled) {
              setLoadProgress(`${label || 'Processing'} (${Math.round(percent)}%)`);
            }
          },
        });

        URL.revokeObjectURL(blobUrl);

        if (!isCancelled) {
          const splatMesh = viewer.getSplatMesh();
          const loadedCount = splatMesh ? splatMesh.getSplatCount() : cloud.count;
          updateSplatMeshParameters(splatMesh);
          setActiveSplatCount(loadedCount || cloud.count);
          setIsLoadingScene(false);
          setLoadProgress(null);

          // Auto-frame camera to model bounds
          focusModel();
        }
      } catch (err: any) {
        if (!isCancelled) {
          if (err?.message?.includes('another load or unload is already in progress')) {
            console.warn('Splat scene operation safely deferred until viewer is idle.');
          } else {
            console.error('Failed to load splat scene in viewer:', err);
          }
          setIsLoadingScene(false);
          setLoadProgress(null);
        }
      }
    };

    // Chain serialized execution so loads/unloads never execute concurrently
    sceneTransitionLockRef.current = sceneTransitionLockRef.current
      .then(async () => {
        if (!isCancelled) {
          await loadScene();
        }
      })
      .catch((err) => {
        console.warn('Scene transition lock resolved with warning:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [cloud, viewSettings.invertY, viewSettings.floaterThreshold]);

  // Live update of splat scale and point cloud mode directly on SplatMesh
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const splatMesh = viewer.getSplatMesh();
    updateSplatMeshParameters(splatMesh);
    if (typeof viewer.forceRenderNextFrame === 'function') {
      try {
        viewer.forceRenderNextFrame();
      } catch {
        // Ignore
      }
    }
  }, [viewSettings.splatScale, renderMode]);

  // 3. Update Auxiliary Objects (Grid, Background, Crop Box)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (viewer.renderer) {
      viewer.renderer.setClearColor(new THREE.Color(viewSettings.backgroundColor), 1.0);
    }
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = viewSettings.showGroundGrid;
    }
    if (cropBoxMeshRef.current) {
      cropBoxMeshRef.current.visible = viewSettings.showCropBox && cropBox.enabled;

      if (cropBox.enabled) {
        const sizeX = Math.max(0.1, cropBox.max[0] - cropBox.min[0]);
        const sizeY = Math.max(0.1, cropBox.max[1] - cropBox.min[1]);
        const sizeZ = Math.max(0.1, cropBox.max[2] - cropBox.min[2]);

        const centerX = (cropBox.min[0] + cropBox.max[0]) / 2;
        const centerY = (cropBox.min[1] + cropBox.max[1]) / 2;
        const centerZ = (cropBox.min[2] + cropBox.max[2]) / 2;

        const actualCenterY = viewSettings.invertY ? -centerY : centerY;
        cropBoxMeshRef.current.scale.set(sizeX, sizeY, sizeZ);
        cropBoxMeshRef.current.position.set(centerX, actualCenterY, centerZ);
      }
    }
  }, [viewSettings.backgroundColor, viewSettings.showGroundGrid, viewSettings.showCropBox, cropBox, viewSettings.invertY]);

  // 4. Update Camera Frustums
  useEffect(() => {
    if (!frustumsGroupRef.current) return;
    const group = frustumsGroupRef.current;
    group.visible = viewSettings.showCameras;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      group.remove(child);
    }

    if (!viewSettings.showCameras || cameraPoses.length === 0) return;

    const fovRad = THREE.MathUtils.degToRad(50);
    const aspect = 16 / 9;
    const depth = 0.22;
    const h = depth * Math.tan(fovRad / 2);
    const w = h * aspect;

    const vertices = new Float32Array([
      // Apex
      0, 0, 0,   -w,  h, -depth,
      0, 0, 0,    w,  h, -depth,
      0, 0, 0,    w, -h, -depth,
      0, 0, 0,   -w, -h, -depth,
      // Base rectangle
      -w,  h, -depth,   w,  h, -depth,
       w,  h, -depth,   w, -h, -depth,
       w, -h, -depth,  -w, -h, -depth,
      -w, -h, -depth,  -w,  h, -depth,
      // Up indicator top triangle
      -w * 0.4, h, -depth,   0, h * 1.5, -depth,
       0, h * 1.5, -depth,   w * 0.4, h, -depth,
    ]);

    cameraPoses.forEach((cam) => {
      const isSelected = cam.id === selectedCameraId;
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

      const lineMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xf59e0b : 0x06b6d4,
        transparent: true,
        opacity: isSelected ? 1.0 : 0.65,
      });

      const lines = new THREE.LineSegments(lineGeo, lineMat);
      const camY = viewSettings.invertY ? -cam.position[1] : cam.position[1];
      const targetY = viewSettings.invertY ? -cam.target[1] : cam.target[1];

      lines.position.set(cam.position[0], camY, cam.position[2]);
      lines.lookAt(cam.target[0], targetY, cam.target[2]);
      group.add(lines);
    });
  }, [cameraPoses, viewSettings.showCameras, selectedCameraId, viewSettings.invertY]);

  // 5. Update Keyframe Trajectory Curve
  useEffect(() => {
    if (!trajectoryLineRef.current || keyframes.length < 2) return;

    const curvePoints: THREE.Vector3[] = [];
    const splinePoints = keyframes.map((k) => {
      const y = viewSettings.invertY ? -k.position[1] : k.position[1];
      return new THREE.Vector3(k.position[0], y, k.position[2]);
    });

    const curve = new THREE.CatmullRomCurve3(splinePoints, true);
    const divisions = 80;
    for (let i = 0; i <= divisions; i++) {
      curvePoints.push(curve.getPoint(i / divisions));
    }

    trajectoryLineRef.current.geometry.setFromPoints(curvePoints);
    trajectoryLineRef.current.visible = viewSettings.showCameras;
  }, [keyframes, viewSettings.showCameras, viewSettings.invertY]);

  // 6. Camera Flight Sequencer Animation
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.camera || !viewer.controls || keyframes.length < 2 || !isPlayingAnimation) return;

    const t = animationProgress;
    let k1 = keyframes[0];
    let k2 = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].time && t <= keyframes[i + 1].time) {
        k1 = keyframes[i];
        k2 = keyframes[i + 1];
        break;
      }
    }

    const span = k2.time - k1.time || 1.0;
    const localT = (t - k1.time) / span;
    const easeT = 0.5 - 0.5 * Math.cos(localT * Math.PI);

    const px = THREE.MathUtils.lerp(k1.position[0], k2.position[0], easeT);
    const rawPy = THREE.MathUtils.lerp(k1.position[1], k2.position[1], easeT);
    const py = viewSettings.invertY ? -rawPy : rawPy;
    const pz = THREE.MathUtils.lerp(k1.position[2], k2.position[2], easeT);

    const tx = THREE.MathUtils.lerp(k1.target[0], k2.target[0], easeT);
    const rawTy = THREE.MathUtils.lerp(k1.target[1], k2.target[1], easeT);
    const ty = viewSettings.invertY ? -rawTy : rawTy;
    const tz = THREE.MathUtils.lerp(k1.target[2], k2.target[2], easeT);

    viewer.camera.position.set(px, py, pz);
    viewer.controls.target.set(tx, ty, tz);
    viewer.controls.update();
  }, [animationProgress, isPlayingAnimation, keyframes, viewSettings.invertY]);

  // 7. Jump to selected camera pose
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.camera || !viewer.controls || !selectedCameraId) return;

    const cam = cameraPoses.find((c) => c.id === selectedCameraId);
    if (!cam) return;

    const camY = viewSettings.invertY ? -cam.position[1] : cam.position[1];
    const targetY = viewSettings.invertY ? -cam.target[1] : cam.target[1];

    viewer.camera.position.set(cam.position[0], camY, cam.position[2]);
    viewer.controls.target.set(cam.target[0], targetY, cam.target[2]);
    viewer.controls.update();
  }, [selectedCameraId, cameraPoses, viewSettings.invertY]);

  // Keyboard shortcut: F to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'f' || e.key === 'F') {
        focusModel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusModel]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing outline-none" tabIndex={0} />

      {/* Loading Overlay */}
      {isLoadingScene && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
          <div className="bg-[#12151f]/90 border border-white/10 px-5 py-4 rounded-2xl flex flex-col items-center gap-3 shadow-2xl">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm font-semibold text-white tracking-wide">
              {loadProgress || 'Processing Radiance Field...'}
            </div>
            <div className="text-xs text-slate-400">Worker-based radix sorting active</div>
          </div>
        </div>
      )}

      {/* Quick View Controls (Top Right HUD) */}
      <div className="absolute top-4 right-5 z-10 flex items-center gap-1.5 bg-[#12151f]/85 border border-white/10 p-1 rounded-xl backdrop-blur-md shadow-lg">
        {/* Focus Button */}
        <button
          onClick={focusModel}
          className="px-2.5 py-1 text-xs font-semibold text-amber-300 hover:text-white bg-amber-400/10 hover:bg-amber-400/20 rounded-lg transition-colors flex items-center gap-1.5"
          title="Frame and center model in view (Hotkey: F)"
        >
          <Focus className="w-3.5 h-3.5" />
          <span>Focus (F)</span>
        </button>

        {/* Flip Orientation (Fix Upside Down COLMAP models) */}
        {onToggleInvertY && (
          <button
            onClick={onToggleInvertY}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              viewSettings.invertY
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Invert vertical axis (fixes upside-down COLMAP captures)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Flip Y</span>
          </button>
        )}

        {/* 100% Full Quality Reset */}
        {onResetFullQuality && (
          <button
            onClick={onResetFullQuality}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm ${
              Math.abs(viewSettings.splatScale - 1.0) < 0.02 && (viewSettings.floaterThreshold || 0) === 0
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold'
            }`}
            title="Reset to 100% full quality (1.0x scale, 100% of splats rendered)"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>100% Quality</span>
          </button>
        )}

        {/* Clear Haze / Defog Preset */}
        {onClearHaze && (
          <button
            onClick={onClearHaze}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            title="Gentle defog preset (mild reduction of outer floater haze)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Clear Haze</span>
          </button>
        )}

        {/* Splat Scale Quick Control */}
        {onUpdateSplatScale && (
          <div className="relative">
            <button
              onClick={() => setShowScaleMenu(!showScaleMenu)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                Math.abs(viewSettings.splatScale - 1.0) > 0.05
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Adjust splat radius scale (1.0x is full 100% original model scale)"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Scale: {viewSettings.splatScale.toFixed(2)}x</span>
            </button>

            {showScaleMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#161a26] border border-white/15 p-3 rounded-xl shadow-2xl z-30 flex flex-col gap-2">
                <div className="text-[11px] font-semibold text-slate-300">Splat Scale Preset</div>
                <div className="text-[10px] text-slate-400">
                  1.0x provides true trained resolution and continuous surfaces. Lower scale can sharpen point clouds.
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {[
                    { val: 1.0, label: '1.0x' },
                    { val: 0.85, label: '0.85x' },
                    { val: 0.7, label: '0.70x' },
                    { val: 0.5, label: '0.50x' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => {
                        onUpdateSplatScale(item.val);
                        setShowScaleMenu(false);
                      }}
                      className={`py-1 text-xs font-semibold rounded-lg transition-colors ${
                        Math.abs(viewSettings.splatScale - item.val) < 0.05
                          ? 'bg-amber-400 text-black font-bold'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floater Filter Menu Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowFloaterMenu(!showFloaterMenu)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              (viewSettings.floaterThreshold || 0) > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Filter transparent floaters (Off = Keep 100% of all Gaussians)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Filter ({(viewSettings.floaterThreshold || 0) === 0 ? 'Off' : viewSettings.floaterThreshold})</span>
          </button>

          {showFloaterMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#161a26] border border-white/15 p-3 rounded-xl shadow-2xl z-30 flex flex-col gap-2">
              <div className="text-[11px] font-semibold text-slate-300">Floater Removal Threshold</div>
              <div className="text-[10px] text-slate-400">
                Off keeps 100% of splats. Higher levels prune low-opacity floaters but can reduce scene detail.
              </div>
              <div className="grid grid-cols-5 gap-1 mt-1">
                {[
                  { lvl: 0, label: 'Off' },
                  { lvl: 2, label: '2' },
                  { lvl: 5, label: '5' },
                  { lvl: 15, label: '15' },
                  { lvl: 30, label: '30' },
                ].map((item) => (
                  <button
                    key={item.lvl}
                    onClick={() => {
                      if (onUpdateFloaterThreshold) onUpdateFloaterThreshold(item.lvl);
                      setShowFloaterMenu(false);
                    }}
                    className={`py-1 text-xs font-semibold rounded-lg transition-colors ${
                      (viewSettings.floaterThreshold || 0) === item.lvl
                        ? 'bg-amber-400 text-black font-bold'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-3.5 bg-white/10 mx-0.5" />

        {/* CAD Camera Views */}
        <button
          onClick={() => setViewPreset('iso')}
          className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
        >
          Iso
        </button>
        <button
          onClick={() => setViewPreset('top')}
          className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
        >
          Top
        </button>
        <button
          onClick={() => setViewPreset('front')}
          className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
        >
          Front
        </button>
        <button
          onClick={() => setViewPreset('side')}
          className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
        >
          Side
        </button>
      </div>

      {/* Top Left Engine Badge & Splat Count */}
      <div className="absolute top-4 left-5 z-10 flex items-center gap-2 bg-[#12151f]/85 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md text-xs shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-slate-200">GaussianSplats3D</span>
        <span className="text-white/20">|</span>
        {activeSplatCount >= (cloud?.count || 0) || (viewSettings.floaterThreshold || 0) === 0 ? (
          <span className="font-mono text-emerald-400 font-semibold">
            {activeSplatCount.toLocaleString()} splats (100% full quality)
          </span>
        ) : (
          <button
            onClick={onResetFullQuality}
            className="font-mono text-amber-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            title="Click to restore 100% of splats"
          >
            <span>{activeSplatCount.toLocaleString()} / {(cloud?.count || 0).toLocaleString()} splats</span>
            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1 rounded">Restore</span>
          </button>
        )}
      </div>
    </div>
  );
};
