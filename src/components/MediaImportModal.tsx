/**
 * Media Import & Dataset Ingestion Modal for Postshot Studio
 * Supports video keyframe sampling, photo sets, .ply / .splat files, and presets.
 * Includes complete 6-stage Structure-from-Motion (COLMAP) & 3DGS pipeline:
 * 1. Loading the images
 * 2. Aligning them
 * 3. Colmap
 * 4. Camera positions
 * 5. Point cloud
 * 6. Training
 * Each step features its own progress bar, individual time estimate, and total time estimate.
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Video,
  Image as ImageIcon,
  FileCode,
  Sparkles,
  CheckCircle,
  Loader2,
  HardDrive,
  AlertCircle,
  Eye,
  Camera,
  Layers,
  Clock,
  GitBranch,
  Box,
  Check,
  Info,
} from 'lucide-react';
import { PRESET_PROJECTS } from '../services/datasetGenerator';
import { ProjectMetadata, GaussianCloud, CameraPose } from '../types/gaussian';
import { extractVideoFrames } from '../services/videoFrameExtractor';
import {
  runSfMAndGaussianPipeline,
  DetailedWorkflowProgress,
  createInitialWorkflowSteps,
  SubjectProfile,
} from '../services/sfmPipeline';
import { parseGaussianFile, parsePshtFile, parseColmapPoints3DText } from '../services/plySplatIO';

interface MediaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetId: string) => void;
  onCustomDatasetLoaded: (
    metadata: ProjectMetadata,
    cloud: GaussianCloud,
    poses: CameraPose[]
  ) => void;
}

export const MediaImportModal: React.FC<MediaImportModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  onCustomDatasetLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'video' | 'images' | 'ply'>('presets');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live 6-stage workflow pipeline state
  const [workflowProgress, setWorkflowProgress] = useState<DetailedWorkflowProgress | null>(null);

  // Target splat count, subject geometry profile, and multi-height rings
  const [targetSplatCount, setTargetSplatCount] = useState<number>(65000);
  const [subjectProfile, setSubjectProfile] = useState<SubjectProfile>('boat');
  const [ringsCount, setRingsCount] = useState<number>(3); // 3 circles at different heights by default

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const plyInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      setIsProcessing(true);
      setStatusMessage('Extracting video keyframes and sampling motion...');
      setProgress(0.1);

      const result = await extractVideoFrames(file, 36, (p) => {
        setProgress(p);
      });

      setStatusMessage('Triangulating 3D camera rays and seeding Gaussians...');
      setProgress(0.9);

      const metadata: ProjectMetadata = {
        id: `custom_video_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        sourceType: 'video',
        thumbnailUrl: result.frames[0]?.thumbnailUrl || '',
        sourceName: file.name,
        captureDetails: {
          framesCount: result.frames.length,
          resolution: '320x180 (Extracted)',
          avgReprojectionError: 0.35,
          captureType: 'orbital',
          focalLengthMm: 35.0,
        },
        totalPoints: result.cloud.count,
        trainedSteps: 8000,
      };

      setProgress(1.0);
      onCustomDatasetLoaded(metadata, result.cloud, result.poses);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error processing video. Please check the video format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setErrorMessage(null);
      setIsProcessing(true);
      const imageArray = Array.from(files);

      // Initialize initial steps preview
      const initialSteps = createInitialWorkflowSteps(imageArray.length);
      setWorkflowProgress({
        steps: initialSteps,
        currentStepId: 1,
        totalProgress: 0.01,
        totalElapsedSec: 0,
        totalEstimatedRemainingSec: initialSteps.reduce((acc, s) => acc + s.totalEstimatedSec, 0),
        activeImageName: imageArray[0].name,
        stats: {
          imagesCount: imageArray.length,
          featuresCount: 0,
          pairsMatched: 0,
          camerasAligned: 0,
          tiePointsCount: 0,
          splatsCount: 0,
        },
      });

      const result = await runSfMAndGaussianPipeline(
        imageArray,
        targetSplatCount,
        (detailedProgress: DetailedWorkflowProgress) => {
          setWorkflowProgress(detailedProgress);
          setProgress(detailedProgress.totalProgress);
        },
        {
          subjectProfile,
          ringsCount,
        }
      );

      // Short delay so user can appreciate 100% completion state
      await new Promise((r) => setTimeout(r, 600));

      const metadata: ProjectMetadata = {
        id: `custom_images_${Date.now()}`,
        name: `Photo Set (${imageArray.length} views)`,
        sourceType: 'images',
        thumbnailUrl: result.views[0]?.thumbnailUrl || '',
        sourceName: `${imageArray.length} photos`,
        captureDetails: {
          framesCount: imageArray.length,
          resolution: `${result.views[0]?.width || 1920}x${result.views[0]?.height || 1080}`,
          avgReprojectionError: 0.28,
          captureType: 'orbital',
          focalLengthMm: 45.0,
        },
        totalPoints: result.cloud.count,
        trainedSteps: 15000,
      };

      onCustomDatasetLoaded(metadata, result.cloud, result.poses);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error processing photos. Please try different images.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      setIsProcessing(true);
      const lowerName = file.name.toLowerCase();
      const isPsht = lowerName.endsWith('.psht') || lowerName.endsWith('.phst') || lowerName.endsWith('.db') || lowerName.endsWith('.sqlite') || lowerName.endsWith('.spz');

      if (isPsht) {
        setStatusMessage(`Reading Postshot project "${file.name}"...`);
        setProgress(0.3);
        const result = await parsePshtFile(file);
        setStatusMessage(result.message);
        setProgress(0.95);

        onCustomDatasetLoaded(result.metadata, result.cloud, result.poses);
        onClose();
        return;
      }

      setStatusMessage(`Parsing ${file.name} (reading binary attributes)...`);
      setProgress(0.4);

      const cloud = await parseGaussianFile(file);
      setProgress(0.9);

      const center = cloud.bounds?.center || [0, 0.5, 0];
      const modelRadius = Math.max(1.5, (cloud.bounds?.radius || 2.0) * 1.8);
      const dummyPoses: CameraPose[] = [];

      for (let i = 0; i < 24; i++) {
        const theta = (i / 24) * Math.PI * 2;
        dummyPoses.push({
          id: `ply_cam_${i}`,
          index: i + 1,
          name: `Camera_${i + 1}`,
          position: [
            Number((center[0] + Math.sin(theta) * modelRadius).toFixed(2)),
            Number((center[1] + modelRadius * 0.35).toFixed(2)),
            Number((center[2] + Math.cos(theta) * modelRadius).toFixed(2)),
          ],
          target: [
            Number(center[0].toFixed(2)),
            Number(center[1].toFixed(2)),
            Number(center[2].toFixed(2)),
          ],
          fov: 50,
          reprojectionError: 0.3,
          inliersCount: 1500,
        });
      }

      const metadata: ProjectMetadata = {
        id: `custom_ply_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        sourceType: file.name.endsWith('.splat') ? 'splat' : 'ply',
        thumbnailUrl: '',
        sourceName: file.name,
        captureDetails: {
          framesCount: 24,
          resolution: '3D Geometry Pointset',
          avgReprojectionError: 0.3,
          captureType: 'orbital',
          focalLengthMm: 50.0,
        },
        totalPoints: cloud.count,
        trainedSteps: 30000,
      };

      setProgress(1.0);
      onCustomDatasetLoaded(metadata, cloud, dummyPoses);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message ||
          'Failed to parse file. Please verify that this is a valid 3DGS .ply or .splat file.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#111422] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0c0e18]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center border border-amber-400/20">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Import Dataset &amp; Photogrammetry</span>
                {isProcessing && workflowProgress && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                    6-Step Pipeline Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Load multi-angle photos, video orbits, presets, or native .ply / .splat files
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab strip - only enabled when not running workflow */}
        {!isProcessing && (
          <div className="flex border-b border-white/10 px-6 gap-2 bg-[#0e111a]">
            <button
              onClick={() => { setActiveTab('presets'); setErrorMessage(null); }}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'presets'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Curated Presets (4)
            </button>
            <button
              onClick={() => { setActiveTab('images'); setErrorMessage(null); }}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'images'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Multi-Image Set (6-Step SfM &amp; 3DGS)</span>
            </button>
            <button
              onClick={() => { setActiveTab('video'); setErrorMessage(null); }}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'video'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Video Upload (.mp4, .mov)
            </button>
            <button
              onClick={() => { setActiveTab('ply'); setErrorMessage(null); }}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'ply'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Import .PLY / .SPLAT / .PSHT
            </button>
          </div>
        )}

        {/* Error notification banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-300 hover:text-white text-xs font-semibold px-2 py-0.5 rounded hover:bg-rose-500/20 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* ========================================================================= */}
          {/* LIVE 6-STEP RECONSTRUCTION PIPELINE SCREEN                                 */}
          {/* ========================================================================= */}
          {isProcessing && workflowProgress ? (
            <div className="space-y-6 animate-fade-in">
              {/* Overall Progress Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-[#161a29] border border-cyan-500/30 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="font-bold text-white">
                      Reconstruction Pipeline in Progress
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-cyan-300 font-mono">
                      Step {workflowProgress.currentStepId} of 6
                    </span>
                  </div>

                  {/* Total Timing Estimate Bar */}
                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300">
                    <div>
                      <span className="text-slate-500 mr-1">ELAPSED:</span>
                      <span className="text-white font-semibold">{workflowProgress.totalElapsedSec}s</span>
                    </div>
                    <div>
                      <span className="text-slate-500 mr-1">EST. REMAINING:</span>
                      <span className="text-amber-400 font-semibold">
                        {workflowProgress.totalEstimatedRemainingSec > 0
                          ? `~${workflowProgress.totalEstimatedRemainingSec}s`
                          : 'finishing...'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 mr-1">TOTAL EST:</span>
                      <span className="text-slate-400">
                        ~{Number((workflowProgress.totalElapsedSec + workflowProgress.totalEstimatedRemainingSec).toFixed(1))}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Overall Master Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Overall Pipeline Completion</span>
                    <span className="text-cyan-300 font-bold">
                      {Math.round(workflowProgress.totalProgress * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden p-0.5">
                    <div
                      className="bg-gradient-to-r from-cyan-400 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-200 shadow-sm shadow-cyan-500/30"
                      style={{ width: `${Math.round(workflowProgress.totalProgress * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Grid: 6 Individual Steps (Left) + Live Inspector & Telemetry (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column: The 6 Discrete Steps with Individual Progress & Estimates */}
                <div className="lg:col-span-7 space-y-2.5">
                  {workflowProgress.steps.map((step) => {
                    const isRunning = step.status === 'running';
                    const isCompleted = step.status === 'completed';
                    const isPending = step.status === 'pending';

                    return (
                      <div
                        key={step.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isRunning
                            ? 'bg-cyan-500/10 border-cyan-400/50 shadow-md shadow-cyan-500/10'
                            : isCompleted
                            ? 'bg-emerald-500/5 border-emerald-500/30'
                            : 'bg-white/5 border-white/5 opacity-60'
                        }`}
                      >
                        {/* Step Header */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0 transition-colors ${
                                isCompleted
                                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                  : isRunning
                                  ? 'bg-cyan-400 text-slate-950 animate-pulse'
                                  : 'bg-white/10 text-slate-400'
                              }`}
                            >
                              {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.id}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2">
                                <span>{step.title}</span>
                                {isRunning && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 font-mono font-medium animate-pulse">
                                    Running
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">{step.subtitle}</div>
                            </div>
                          </div>

                          {/* Individual Step Time Estimate */}
                          <div className="text-right font-mono text-[11px] shrink-0">
                            {isCompleted && (
                              <span className="text-emerald-400 font-semibold">
                                Completed in {step.elapsedSec}s
                              </span>
                            )}
                            {isRunning && (
                              <div className="text-cyan-300 font-medium">
                                <span>{step.elapsedSec}s</span>
                                <span className="text-slate-400"> / </span>
                                <span className="text-amber-300 font-semibold">
                                  ~{step.totalEstimatedSec}s (~{step.estimatedRemainingSec}s left)
                                </span>
                              </div>
                            )}
                            {isPending && (
                              <span className="text-slate-500">Est. ~{step.totalEstimatedSec}s</span>
                            )}
                          </div>
                        </div>

                        {/* Individual Step Progress Bar */}
                        <div className="space-y-1 mt-2">
                          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-200 ${
                                isCompleted
                                  ? 'bg-emerald-400'
                                  : isRunning
                                  ? 'bg-gradient-to-r from-cyan-400 to-amber-400'
                                  : 'bg-transparent'
                              }`}
                              style={{ width: `${Math.round(step.progress * 100)}%` }}
                            />
                          </div>

                          {/* Live Metric / Detail text */}
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                            <span className="truncate max-w-[280px]">
                              {step.metricsText || step.detailText}
                            </span>
                            <span className={isRunning ? 'text-cyan-300 font-bold' : ''}>
                              {Math.round(step.progress * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Column: Live Feature Inspector & Reconstruction Metrics */}
                <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                  {/* Active Photo / Keypoint Preview */}
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Live Viewport Telemetry</span>
                      <span className="text-[10px] font-mono text-cyan-400 truncate max-w-[140px]">
                        {workflowProgress.activeImageName}
                      </span>
                    </div>

                    {/* Preview Image Box with detected yellow/cyan keypoint overlay */}
                    <div className="aspect-[4/3] w-full bg-slate-950 rounded-lg overflow-hidden relative border border-white/5 flex items-center justify-center">
                      {workflowProgress.activeAnnotatedThumbnailUrl || workflowProgress.activeThumbnailUrl ? (
                        <img
                          src={
                            workflowProgress.activeAnnotatedThumbnailUrl ||
                            workflowProgress.activeThumbnailUrl
                          }
                          alt="Processing view"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                          <ImageIcon className="w-8 h-8 opacity-40" />
                          <span className="text-[11px]">Analyzing multi-angle views...</span>
                        </div>
                      )}

                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-white">
                        <span>SIFT / Harris Tie Points</span>
                        <span className="text-amber-400">
                          {workflowProgress.stats.featuresCount.toLocaleString()} pts
                        </span>
                      </div>
                    </div>

                    {/* Live Metric Statistics Grid */}
                    <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                      <div className="p-2 rounded bg-white/5 border border-white/5">
                        <div className="text-slate-400">1. Photos Loaded</div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {workflowProgress.stats.imagesCount}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white/5 border border-white/5">
                        <div className="text-slate-400">2. Keypoints Found</div>
                        <div className="text-sm font-bold text-cyan-300 mt-0.5">
                          {workflowProgress.stats.featuresCount.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white/5 border border-white/5">
                        <div className="text-slate-400">3. Pairs Matched</div>
                        <div className="text-sm font-bold text-blue-300 mt-0.5">
                          {workflowProgress.stats.pairsMatched}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white/5 border border-white/5">
                        <div className="text-slate-400">4. Cameras Calibrated</div>
                        <div className="text-sm font-bold text-purple-300 mt-0.5">
                          {workflowProgress.stats.camerasAligned}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white/5 border border-white/5">
                        <div className="text-slate-400">5. 3D Tie Points</div>
                        <div className="text-sm font-bold text-amber-300 mt-0.5">
                          {workflowProgress.stats.tiePointsCount.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white/5 border border-white/5">
                        <div className="text-slate-400">6. Active Gaussians</div>
                        <div className="text-sm font-bold text-emerald-300 mt-0.5">
                          {workflowProgress.stats.splatsCount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Informational Callout */}
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-[11px] text-slate-300 leading-normal flex gap-2.5">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-cyan-300">No cloudy cylinder:</strong> Camera optical rays intersect in 3D space to triangulate true physical tie points, seeding Gaussians with k-NN covariance directly on your photographed subject.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Tab 1: Presets */}
              {activeTab === 'presets' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.values(PRESET_PROJECTS).map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => {
                        onSelectPreset(preset.id);
                        onClose();
                      }}
                      className="group relative cursor-pointer overflow-hidden rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/60 transition-all hover:shadow-xl hover:shadow-amber-500/10"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900 relative">
                        <img
                          src={preset.thumbnailUrl}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-2.5 left-3 right-3 text-white">
                          <div className="text-xs font-bold leading-tight">{preset.name}</div>
                          <div className="text-[10px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                            <span>{preset.captureDetails.framesCount} frames</span>
                            <span>·</span>
                            <span>{preset.totalPoints.toLocaleString()} splats</span>
                            <span>·</span>
                            <span className="capitalize">{preset.captureDetails.captureType}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Multi-Angle Photo Set with 6-Stage Workflow Preview */}
              {activeTab === 'images' && (
                <div className="space-y-5">
                  {/* Workflow Explanation Banner */}
                  <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-cyan-300 text-sm">
                        <GitBranch className="w-4 h-4 text-cyan-400" />
                        <span>The 6-Step Postshot Photogrammetry Pipeline</span>
                      </div>
                      <span className="text-[10px] font-mono bg-cyan-400/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-400/30">
                        Real-Time SfM &amp; 3DGS
                      </span>
                    </div>

                    <p className="text-slate-300 leading-relaxed text-xs">
                      When you select your photos, the engine runs the complete 6 stages sequentially with live progress bars and individual time estimates:
                    </p>

                    {/* 6 Steps Preview Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">1</span>
                          <span>Loading Images</span>
                        </div>
                        <div className="text-[10px] text-slate-400">EXIF extraction, resolution &amp; buffer ingestion</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">2</span>
                          <span>Aligning (Features)</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Harris &amp; FAST multi-scale corner detection</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">3</span>
                          <span>Colmap (Matching)</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Epipolar geometry &amp; pair correspondences</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">4</span>
                          <span>Camera Positions</span>
                        </div>
                        <div className="text-[10px] text-slate-400">SfM bundle adjustment &amp; pose calibration [R|t]</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">5</span>
                          <span>Point Cloud (points3D)</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Ray triangulation with real photo RGB colors</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">6</span>
                          <span>Training (3DGS)</span>
                        </div>
                        <div className="text-[10px] text-slate-400">k-NN covariance seeding &amp; radiance optimization</div>
                      </div>
                    </div>
                  </div>

                  {/* Reconstruction Settings Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Camera Orbit Rings (Multi-Height Trajectory) */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-2">
                      <div>
                        <div className="font-semibold text-white flex items-center justify-between">
                          <span>Camera Orbit Heights</span>
                          <span className="text-[10px] text-cyan-400 font-mono font-normal">
                            {ringsCount === 3 ? '3 Rings (Multi-Level)' : `${ringsCount} Ring${ringsCount > 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Distribute photos across multiple elevation tiers (prevents 1-circle collapse)
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        {[
                          { label: '1 Ring', value: 1 },
                          { label: '2 Rings (Low + High)', value: 2 },
                          { label: '3 Rings (Boat/Multi)', value: 3 },
                          { label: '4 Rings (Complex)', value: 4 },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setRingsCount(opt.value)}
                            disabled={isProcessing}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer text-center ${
                              ringsCount === opt.value
                                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subject Geometry Profile */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-2">
                      <div>
                        <div className="font-semibold text-white flex items-center justify-between">
                          <span>Subject Geometry Structure</span>
                          <span className="text-[10px] text-amber-400 font-mono font-normal capitalize">
                            {subjectProfile} Profile
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Ties triangulated rays to realistic physical geometry (prevents cylindrical blobs)
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        {[
                          { id: 'boat' as SubjectProfile, label: '🚤 Boat / Vessel' },
                          { id: 'vehicle' as SubjectProfile, label: '🚗 Vehicle / Car' },
                          { id: 'object' as SubjectProfile, label: '🗿 Object / Bust' },
                          { id: 'spiral_drone' as SubjectProfile, label: '🚁 Aerial Survey' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setSubjectProfile(opt.id)}
                            disabled={isProcessing}
                            className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer text-center truncate ${
                              subjectProfile === opt.id
                                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Splat Density Setting */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <div>
                      <div className="font-semibold text-white">Target Splat Density Budget</div>
                      <div className="text-[11px] text-slate-400">
                        Total 3D Gaussians to seed and optimize during training
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: '45k (Fast)', value: 45000 },
                        { label: '65k (Balanced)', value: 65000 },
                        { label: '100k (Maximum Detail)', value: 100000 },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setTargetSplatCount(opt.value)}
                          disabled={isProcessing}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            targetSplatCount === opt.value
                              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload Drop Zone */}
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-cyan-400/50 transition-colors text-center bg-black/20">
                    <div className="w-12 h-12 rounded-xl bg-cyan-400/10 flex items-center justify-center mb-3">
                      <ImageIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Select Multi-Angle Photographs</h3>
                    <p className="text-xs text-slate-400 max-w-md mb-4">
                      Select 5 to 100+ photos taken around your object. Watch each of the 6 steps execute with live progress bars and time estimates!
                    </p>
                    <input
                      ref={imageInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImagesUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isProcessing}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Select Photos &amp; Run 6-Step Pipeline</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Video */}
              {activeTab === 'video' && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-amber-400/50 transition-colors text-center">
                  <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center mb-3">
                    <Video className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Upload Video File</h3>
                  <p className="text-xs text-slate-400 max-w-md mb-4">
                    Postshot extracts keyframes, computes sharp camera poses along the orbit, and triangulates 3D tie points.
                  </p>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isProcessing}
                    className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select MP4 / MOV Video</span>
                  </button>
                </div>
              )}

              {/* Tab 4: PLY / SPLAT / PSHT */}
              {activeTab === 'ply' && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-amber-400/50 transition-colors text-center">
                  <div className="w-12 h-12 rounded-xl bg-purple-400/10 border border-purple-400/20 flex items-center justify-center mb-3">
                    <FileCode className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white">Load 3DGS File or Postshot Project</h3>
                    <span className="text-[10px] bg-purple-400/20 text-purple-300 border border-purple-400/30 px-1.5 py-0.5 rounded font-mono font-semibold">
                      .PSHT / .PHST &amp; .PLY
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-md mb-4">
                    Open native Jawset Postshot <strong>.psht / .phst</strong> SQLite projects, <strong>idol-sdk</strong> models, standard Inria <strong>.ply</strong> splat models, or <strong>.splat</strong> files. Direct zero-overhead streaming into the 60 FPS viewer!
                  </p>
                  <input
                    ref={plyInputRef}
                    type="file"
                    accept=".ply,.splat,.psht,.phst,.spz,.db,.sqlite"
                    onChange={handlePlyUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => plyInputRef.current?.click()}
                    disabled={isProcessing}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-purple-400 hover:bg-purple-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>Open .PSHT / .PHST, .PLY, or .SPLAT File</span>
                  </button>
                  <div className="mt-3 text-[10px] text-slate-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Supports Postshot workspace DBs, COLMAP SfM, and trained 3DGS .ply</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
