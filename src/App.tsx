/**
 * Postshot 3D Gaussian Splatting Studio - Main Application Entry
 * Full recreation of Jawset Postshot: ingestion from video/photos,
 * progressive radiance field optimization, real-time 3DGS rendering,
 * crop box editing, camera flight sequencer, and PLY/SPLAT export.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GaussianCloud,
  CameraPose,
  CameraKeyframe,
  RenderMode,
  SplatViewSettings,
  CropBox,
  TrainingState,
  ProjectMetadata,
} from './types/gaussian';
import {
  generateRadianceField,
  generateCameraTrajectory,
  PRESET_PROJECTS,
} from './services/datasetGenerator';
import { TrainingEngine } from './services/trainingEngine';
import { pruneGiantSplats } from './services/plySplatIO';
import { Viewport3D } from './components/Viewport3D';
import { TopBar } from './components/TopBar';
import { BottomControlDock } from './components/BottomControlDock';
import { MediaImportModal } from './components/MediaImportModal';
import { ExportModal } from './components/ExportModal';
import { CameraTrajectoryInspector } from './components/CameraTrajectoryInspector';
import { WorkflowGuideModal } from './components/WorkflowGuideModal';

export default function App() {
  // Current active project
  const [currentProject, setCurrentProject] = useState<ProjectMetadata>(
    PRESET_PROJECTS.motorcycle
  );

  // Gaussian cloud & training engine
  const [cloud, setCloud] = useState<GaussianCloud | null>(null);
  const [cameraPoses, setCameraPoses] = useState<CameraPose[]>([]);
  const trainingEngineRef = useRef<TrainingEngine | null>(null);

  const [trainingState, setTrainingState] = useState<TrainingState>({
    step: 15000,
    maxSteps: 30000,
    isTraining: false,
    loss: 0.024,
    psnr: 31.8,
    activeGaussians: 75000,
    lossHistory: [0.42, 0.28, 0.16, 0.09, 0.055, 0.038, 0.028, 0.024],
    psnrHistory: [14.5, 18.2, 22.8, 26.4, 28.9, 30.2, 31.2, 31.8],
    densifyInterval: 500,
    pruneThreshold: 0.05,
  });

  // Active workstation tab
  const [activeTab, setActiveTab] = useState<'training' | 'rendering' | 'crop' | 'sequencer'>(
    'rendering'
  );

  // Render & Viewport Settings
  const [renderMode, setRenderMode] = useState<RenderMode>('radiance');
  const [viewSettings, setViewSettings] = useState<SplatViewSettings>({
    splatScale: 1.0,
    opacityMultiplier: 1.0,
    maxSplatSize: 2.0, // full fidelity default
    displayBudget: 2000000, // viewport splat rendering limit: 100% of splats at smooth 60 FPS
    floaterThreshold: 0, // 0 = keep 100% of all Gaussians, zero reduction
    invertY: false, // flip Y axis for COLMAP/OpenCV inverted captures
    shDegree: 1, // Spherical Harmonics degree 1 for photorealistic specular reflection
    depthSorting: true,
    showCameras: true,
    showGroundGrid: true,
    showCropBox: true,
    backgroundColor: '#0c0d12',
    fov: 50,
  });

  // Reference to original unpruned cloud with intact raw fileBlob
  const originalCloudRef = useRef<GaussianCloud | null>(null);

  // Crop Box state
  const [cropBox, setCropBox] = useState<CropBox>({
    enabled: false,
    min: [-2.0, 0.0, -2.0],
    max: [2.0, 2.5, 2.0],
    floorClipY: 0.0,
  });

  // Camera Sequencer Keyframes
  const [keyframes, setKeyframes] = useState<CameraKeyframe[]>([
    { id: 'kf_1', time: 0.0, position: [2.2, 1.2, 2.2], target: [0, 0.75, 0], fov: 50 },
    { id: 'kf_2', time: 0.33, position: [-2.0, 1.4, 1.8], target: [0, 0.75, 0], fov: 50 },
    { id: 'kf_3', time: 0.66, position: [-2.2, 0.8, -2.0], target: [0, 0.75, 0], fov: 50 },
    { id: 'kf_4', time: 1.0, position: [2.2, 1.2, 2.2], target: [0, 0.75, 0], fov: 50 },
  ]);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Selected camera pose for alignment inspection
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTrajectoryModalOpen, setIsTrajectoryModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  // FPS monitor
  const [fps, setFps] = useState(60);

  // Initialize dataset
  const loadPreset = useCallback((presetId: string) => {
    const meta = PRESET_PROJECTS[presetId] || PRESET_PROJECTS.motorcycle;
    setCurrentProject(meta);

    const fullCloud = generateRadianceField(meta.id, meta.totalPoints);
    const poses = generateCameraTrajectory(meta.id, meta.captureDetails.framesCount);

    setCloud(fullCloud);
    originalCloudRef.current = fullCloud;
    setCameraPoses(poses);

    // Reset view to 100% full quality
    setViewSettings((prev) => ({
      ...prev,
      splatScale: 1.0,
      floaterThreshold: 0,
      maxSplatSize: 2.0,
      displayBudget: 2000000,
      shDegree: 1,
    }));

    // Initialize Training Engine
    const engine = new TrainingEngine(fullCloud, (state, newCloud) => {
      setTrainingState({ ...state });
      setCloud({ ...newCloud });
    });
    trainingEngineRef.current = engine;
    setTrainingState(engine.getState());
  }, []);

  useEffect(() => {
    loadPreset('motorcycle');
  }, [loadPreset]);

  // Handle custom dataset uploaded by user
  const handleCustomDatasetLoaded = (
    metadata: ProjectMetadata,
    newCloud: GaussianCloud,
    newPoses: CameraPose[]
  ) => {
    setCurrentProject(metadata);
    setCloud(newCloud);
    originalCloudRef.current = newCloud;
    setCameraPoses(newPoses);

    // Preserve 100% of splats and full 1.0x resolution on opening models
    setViewSettings((prev) => ({
      ...prev,
      splatScale: 1.0,
      floaterThreshold: 0,
      maxSplatSize: 2.0,
      displayBudget: 2000000,
      shDegree: 1,
    }));

    // Auto-fit 3D crop box to loaded model bounds if present
    if (newCloud.bounds) {
      const b = newCloud.bounds;
      const spanX = Math.max(0.1, b.max[0] - b.min[0]);
      const spanY = Math.max(0.1, b.max[1] - b.min[1]);
      const spanZ = Math.max(0.1, b.max[2] - b.min[2]);
      const padX = spanX * 0.05 || 0.5;
      const padY = spanY * 0.05 || 0.5;
      const padZ = spanZ * 0.05 || 0.5;

      setCropBox({
        enabled: true,
        min: [
          Number((b.min[0] - padX).toFixed(2)),
          Number((b.min[1] - padY).toFixed(2)),
          Number((b.min[2] - padZ).toFixed(2)),
        ],
        max: [
          Number((b.max[0] + padX).toFixed(2)),
          Number((b.max[1] + padY).toFixed(2)),
          Number((b.max[2] + padZ).toFixed(2)),
        ],
        floorClipY: Number((b.min[1] - padY).toFixed(2)),
      });
    }

    const engine = new TrainingEngine(newCloud, (state, updatedCloud) => {
      setTrainingState({ ...state });
      setCloud({ ...updatedCloud });
    });
    trainingEngineRef.current = engine;
    setTrainingState(engine.getState());
  };

  // Optimization Handlers
  const handleToggleTraining = () => {
    if (!trainingEngineRef.current) return;
    if (trainingState.isTraining) {
      trainingEngineRef.current.pauseTraining();
    } else {
      trainingEngineRef.current.startTraining(200);
    }
  };

  const handleStepTraining = () => {
    if (!trainingEngineRef.current) return;
    trainingEngineRef.current.stepTraining(500);
  };

  const handleResetTraining = () => {
    if (!trainingEngineRef.current) return;
    trainingEngineRef.current.resetToSparse();
  };

  const handlePruneFloaters = () => {
    if (!trainingEngineRef.current) return;
    trainingEngineRef.current.pruneFloaters(0.15);
  };

  const handlePruneGiantSplats = () => {
    if (!cloud) return;
    const prunedCloud = pruneGiantSplats(cloud, 0.35);
    setCloud(prunedCloud);
    if (trainingEngineRef.current) {
      trainingEngineRef.current.setFullCloud(prunedCloud);
    }
  };

  const handleResetFullQuality = () => {
    if (originalCloudRef.current) {
      setCloud(originalCloudRef.current);
    }
    setViewSettings((prev) => ({
      ...prev,
      splatScale: 1.0,
      floaterThreshold: 0,
      maxSplatSize: 2.0,
      displayBudget: 2000000,
      shDegree: 1,
    }));
  };

  const handleClearHaze = () => {
    // Gentle non-destructive haze reduction without permanently discarding splats
    setViewSettings((prev) => ({
      ...prev,
      splatScale: 0.95,
      floaterThreshold: 3,
      maxSplatSize: 1.0,
    }));
  };

  const handleAutoFitCrop = () => {
    if (!cloud || !cloud.bounds) return;
    const b = cloud.bounds;
    const spanX = Math.max(0.1, b.max[0] - b.min[0]);
    const spanY = Math.max(0.1, b.max[1] - b.min[1]);
    const spanZ = Math.max(0.1, b.max[2] - b.min[2]);
    const padX = spanX * 0.05 || 0.5;
    const padY = spanY * 0.05 || 0.5;
    const padZ = spanZ * 0.05 || 0.5;

    setCropBox({
      enabled: true,
      min: [
        Number((b.min[0] - padX).toFixed(2)),
        Number((b.min[1] - padY).toFixed(2)),
        Number((b.min[2] - padZ).toFixed(2)),
      ],
      max: [
        Number((b.max[0] + padX).toFixed(2)),
        Number((b.max[1] + padY).toFixed(2)),
        Number((b.max[2] + padZ).toFixed(2)),
      ],
      floorClipY: Number((b.min[1] - padY).toFixed(2)),
    });
  };

  // Camera Sequencer Handlers
  const handleAddKeyframe = () => {
    const newId = `kf_${Date.now()}`;
    const newKf: CameraKeyframe = {
      id: newId,
      time: Math.min(1.0, animationProgress + 0.1),
      position: [1.8, 1.0, 2.0],
      target: [0, 0.7, 0],
      fov: 50,
    };
    const updated = [...keyframes, newKf].sort((a, b) => a.time - b.time);
    setKeyframes(updated);
  };

  const handleDeleteKeyframe = (id: string) => {
    if (keyframes.length <= 2) return;
    setKeyframes(keyframes.filter((k) => k.id !== id));
  };

  const handleTogglePlayAnimation = () => {
    setIsPlayingAnimation(!isPlayingAnimation);
  };

  // Animation Loop for Flight Sequencer
  useEffect(() => {
    if (!isPlayingAnimation) return;

    let reqId: number;
    let lastT = performance.now();
    const flightDurationSec = 6.0;

    const loop = (t: number) => {
      const dt = (t - lastT) / 1000;
      lastT = t;

      setAnimationProgress((prev) => {
        const next = prev + dt / flightDurationSec;
        return next >= 1.0 ? 0.0 : next;
      });

      reqId = requestAnimationFrame(loop);
    };

    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, [isPlayingAnimation]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0c0d12] flex flex-col font-sans select-none">
      {/* 1. Strict Top Bar Contract Header */}
      <TopBar
        currentProject={currentProject}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenTrajectoryModal={() => setIsTrajectoryModalOpen(true)}
        onOpenWorkflowModal={() => setIsWorkflowModalOpen(true)}
        isTraining={trainingState.isTraining}
        onToggleTraining={handleToggleTraining}
      />

      {/* 2. Full-Screen Interactive 3D Splatting Viewport (100% Unobstructed Center) */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Minimal Spec Watermark / HUD Badge (Top-Left) */}
        <div className="absolute top-4 left-5 z-10 pointer-events-none flex flex-col gap-1 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-white">{currentProject.name}</span>
            <span className="text-[11px] text-amber-400 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
              3DGS
            </span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
            <span>{trainingState.activeGaussians.toLocaleString()} Gaussians</span>
            <span>·</span>
            <span>{cameraPoses.length} Views</span>
            <span>·</span>
            <span>{fps} FPS</span>
          </div>
        </div>

        {/* Viewport Canvas */}
        <Viewport3D
          cloud={cloud}
          cameraPoses={cameraPoses}
          keyframes={keyframes}
          isPlayingAnimation={isPlayingAnimation}
          animationProgress={animationProgress}
          renderMode={renderMode}
          viewSettings={viewSettings}
          cropBox={cropBox}
          selectedCameraId={selectedCameraId}
          onSelectCamera={setSelectedCameraId}
          onFpsUpdate={setFps}
          onToggleInvertY={() => setViewSettings((prev) => ({ ...prev, invertY: !prev.invertY }))}
          onUpdateFloaterThreshold={(val) => setViewSettings((prev) => ({ ...prev, floaterThreshold: val }))}
          onUpdateSplatScale={(scale) => setViewSettings((prev) => ({ ...prev, splatScale: scale }))}
          onClearHaze={handleClearHaze}
          onResetFullQuality={handleResetFullQuality}
        />
      </main>

      {/* 3. Consolidated Collapsible Bottom Control Dock */}
      <BottomControlDock
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        trainingState={trainingState}
        onToggleTraining={handleToggleTraining}
        onStepTraining={handleStepTraining}
        onResetTraining={handleResetTraining}
        onPruneFloaters={handlePruneFloaters}
        onPruneGiantSplats={handlePruneGiantSplats}
        onAutoFitCrop={handleAutoFitCrop}
        renderMode={renderMode}
        setRenderMode={setRenderMode}
        viewSettings={viewSettings}
        setViewSettings={setViewSettings}
        cropBox={cropBox}
        setCropBox={setCropBox}
        keyframes={keyframes}
        onAddKeyframe={handleAddKeyframe}
        onDeleteKeyframe={handleDeleteKeyframe}
        isPlayingAnimation={isPlayingAnimation}
        onTogglePlayAnimation={handleTogglePlayAnimation}
        animationProgress={animationProgress}
        onSeekAnimation={setAnimationProgress}
        fps={fps}
      />

      {/* 4. Modals */}
      <MediaImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSelectPreset={loadPreset}
        onCustomDatasetLoaded={handleCustomDatasetLoaded}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        cloud={cloud}
        cropBox={cropBox}
        cameraPoses={cameraPoses}
        currentProject={currentProject}
        viewSettings={viewSettings}
      />

      <CameraTrajectoryInspector
        isOpen={isTrajectoryModalOpen}
        onClose={() => setIsTrajectoryModalOpen(false)}
        cameraPoses={cameraPoses}
        selectedCameraId={selectedCameraId}
        onSelectCamera={setSelectedCameraId}
        currentProject={currentProject}
      />

      <WorkflowGuideModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        onSwitchToPointCloud={() => setRenderMode('pointcloud')}
        onSwitchToRadiance={() => setRenderMode('radiance')}
        onResetToSparse={handleResetTraining}
      />
    </div>
  );
}
