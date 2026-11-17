/**
 * Sleek Consolidated Bottom Control Dock for Postshot Studio
 * Pinned bottom-center (zero viewport occlusion), collapsible drawer,
 * housing Optimization, Shading, Crop Box, and Camera Sequencer.
 */

import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ChevronUp,
  ChevronDown,
  Layers,
  Camera,
  Box,
  Film,
  Sparkles,
  Scissors,
  Eye,
  Grid,
  Crosshair,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  RenderMode,
  SplatViewSettings,
  CropBox,
  TrainingState,
  CameraKeyframe,
} from '../types/gaussian';

interface BottomControlDockProps {
  activeTab: 'training' | 'rendering' | 'crop' | 'sequencer';
  setActiveTab: (tab: 'training' | 'rendering' | 'crop' | 'sequencer') => void;
  trainingState: TrainingState;
  onToggleTraining: () => void;
  onStepTraining: () => void;
  onResetTraining: () => void;
  onPruneFloaters: () => void;
  onPruneGiantSplats: () => void;
  onAutoFitCrop: () => void;
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  viewSettings: SplatViewSettings;
  setViewSettings: React.Dispatch<React.SetStateAction<SplatViewSettings>>;
  cropBox: CropBox;
  setCropBox: React.Dispatch<React.SetStateAction<CropBox>>;
  keyframes: CameraKeyframe[];
  onAddKeyframe: () => void;
  onDeleteKeyframe: (id: string) => void;
  isPlayingAnimation: boolean;
  onTogglePlayAnimation: () => void;
  animationProgress: number;
  onSeekAnimation: (progress: number) => void;
  fps: number;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  activeTab,
  setActiveTab,
  trainingState,
  onToggleTraining,
  onStepTraining,
  onResetTraining,
  onPruneFloaters,
  onPruneGiantSplats,
  onAutoFitCrop,
  renderMode,
  setRenderMode,
  viewSettings,
  setViewSettings,
  cropBox,
  setCropBox,
  keyframes,
  onAddKeyframe,
  onDeleteKeyframe,
  isPlayingAnimation,
  onTogglePlayAnimation,
  animationProgress,
  onSeekAnimation,
  fps,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-20 transition-all duration-300 w-[94vw] max-w-[940px] ${
        isCollapsed ? 'bottom-2 translate-y-[calc(100%-36px)]' : 'bottom-5'
      }`}
    >
      {/* Drawer Toggle Header Tab */}
      <div className="flex justify-center -mb-px">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 px-4 py-1 text-xs font-semibold tracking-wide text-slate-300 bg-[#141721] hover:bg-[#1a1f2c] border-t border-x border-white/10 rounded-t-lg shadow-lg backdrop-blur-md transition-colors"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Hide Controls</span>
            </>
          )}
          <span className="text-[10px] font-mono text-slate-400 ml-1">
            {trainingState.activeGaussians.toLocaleString()} splats · {fps} FPS
          </span>
        </button>
      </div>

      {/* Main Glassmorphic Dock Container */}
      <div className="bg-[#12151f]/95 border border-white/10 rounded-2xl shadow-2xl p-4 text-slate-200">
        {/* Tab Navigation Strip */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 gap-2">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('training')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'training'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Optimization</span>
            </button>

            <button
              onClick={() => setActiveTab('rendering')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'rendering'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Shading</span>
            </button>

            <button
              onClick={() => setActiveTab('crop')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'crop'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Crop & Prune</span>
            </button>

            <button
              onClick={() => setActiveTab('sequencer')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'sequencer'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Flight Sequencer</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-400 tabular-nums">
            <div>
              <span className="text-slate-500 mr-1.5">STEP</span>
              <span className="text-white font-medium">{trainingState.step.toLocaleString()}</span>
              <span className="text-slate-600 mx-1">/</span>
              <span>{trainingState.maxSteps.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">LOSS</span>
              <span className="text-amber-400 font-medium">{trainingState.loss.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">PSNR</span>
              <span className="text-emerald-400 font-medium">{trainingState.psnr.toFixed(1)} dB</span>
            </div>
          </div>
        </div>

        {/* Tab 1: Optimization / Training Controls */}
        {activeTab === 'training' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleTraining}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    trainingState.isTraining
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {trainingState.isTraining ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause Optimization</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Optimization</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onStepTraining}
                  disabled={trainingState.isTraining}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-lg transition-colors"
                  title="Run next 500 optimization steps"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Step (+500)</span>
                </button>

                <button
                  onClick={onResetTraining}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                  title="Reset reconstruction to sparse SfM tie points"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to SfM</span>
                </button>
              </div>

              {/* Loss / PSNR sparkline */}
              <div className="flex items-center gap-3 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
                <div className="text-[11px] font-mono text-slate-400">
                  <div className="text-slate-500 text-[10px]">CONVERGENCE CURVE</div>
                  <div className="text-slate-200">
                    L1+SSIM: <span className="text-amber-400 font-semibold">{trainingState.loss}</span>
                  </div>
                </div>
                <div className="h-6 w-24 flex items-end gap-0.5">
                  {trainingState.lossHistory.map((val, idx) => {
                    const heightPercent = Math.min(100, Math.max(10, (val / 0.45) * 100));
                    return (
                      <div
                        key={idx}
                        className="flex-1 bg-amber-400/80 rounded-t-sm transition-all"
                        style={{ height: `${heightPercent}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Optimization Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>Adaptive Densification & Splitting (Step {trainingState.step} / {trainingState.maxSteps})</span>
                <span>{((trainingState.step / trainingState.maxSteps) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-150"
                  style={{ width: `${(trainingState.step / trainingState.maxSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Shading & Splat Appearance */}
        {activeTab === 'rendering' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Render Modes */}
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400 font-medium">Render Mode</div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(
                    [
                      { id: 'radiance', label: 'Radiance Field (3DGS)' },
                      { id: 'ellipsoids', label: 'Ellipsoid Rings' },
                      { id: 'pointcloud', label: 'Point Cloud (SfM)' },
                      { id: 'depth', label: 'Depth Map' },
                      { id: 'density', label: 'Density Heatmap' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setRenderMode(m.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        renderMode === m.id
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders: Splat Scale & Opacity */}
              <div className="flex items-center gap-4">
                <div className="space-y-1 min-w-[110px]">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Splat Scale</span>
                    <span className="font-mono text-white">{viewSettings.splatScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={viewSettings.splatScale}
                    onChange={(e) =>
                      setViewSettings((prev) => ({ ...prev, splatScale: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                  />
                </div>

                <div className="space-y-1 min-w-[110px]">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Opacity Boost</span>
                    <span className="font-mono text-white">{viewSettings.opacityMultiplier.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={viewSettings.opacityMultiplier}
                    onChange={(e) =>
                      setViewSettings((prev) => ({
                        ...prev,
                        opacityMultiplier: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                  />
                </div>

                {/* Max Splat Size Cutoff Slider */}
                <div className="space-y-1 min-w-[120px]">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span title="Hides giant background floaters/outer bubbles">Max Splat Size</span>
                    <span className="font-mono text-amber-300">{(viewSettings.maxSplatSize ?? 1.0).toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="2.5"
                    step="0.05"
                    value={viewSettings.maxSplatSize ?? 1.0}
                    onChange={(e) =>
                      setViewSettings((prev) => ({
                        ...prev,
                        maxSplatSize: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                  />
                </div>
              </div>

              {/* Viewport Display Budget */}
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400 font-medium">Viewport LOD (FPS)</div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg text-[11px]">
                  <button
                    onClick={() => setViewSettings((prev) => ({ ...prev, displayBudget: 300000 }))}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      viewSettings.displayBudget === 300000
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    300k (Fast 60fps)
                  </button>
                  <button
                    onClick={() => setViewSettings((prev) => ({ ...prev, displayBudget: 600000 }))}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      viewSettings.displayBudget === 600000
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    600k (Balanced)
                  </button>
                  <button
                    onClick={() => setViewSettings((prev) => ({ ...prev, displayBudget: 2000000 }))}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      viewSettings.displayBudget >= 2000000
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Splats
                  </button>
                </div>
              </div>

              {/* View Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setViewSettings((prev) => ({ ...prev, showCameras: !prev.showCameras }))
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    viewSettings.showCameras
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                  title="Toggle camera frustum pyramids"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Cameras</span>
                </button>

                <button
                  onClick={() =>
                    setViewSettings((prev) => ({ ...prev, showGroundGrid: !prev.showGroundGrid }))
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    viewSettings.showGroundGrid
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                  title="Toggle ground reference grid"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>

                <button
                  onClick={() =>
                    setViewSettings((prev) => ({ ...prev, invertY: !prev.invertY }))
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    viewSettings.invertY
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                  title="Invert vertical axis (flips upside-down COLMAP captures)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Flip Y</span>
                </button>
              </div>

              {/* Floater Filter Removal Slider */}
              <div className="space-y-1 min-w-[130px]">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span title="Filters transparent floaters and outer haze (0 = 100% full splats)">Floater Filter</span>
                  <span className="font-mono text-emerald-400">
                    {(viewSettings.floaterThreshold || 0) === 0 ? 'Off (100%)' : viewSettings.floaterThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={viewSettings.floaterThreshold ?? 0}
                  onChange={(e) =>
                    setViewSettings((prev) => ({
                      ...prev,
                      floaterThreshold: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Crop Box & Pruning */}
        {activeTab === 'crop' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    setCropBox((prev) => ({ ...prev, enabled: !prev.enabled }))
                  }
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    cropBox.enabled
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>{cropBox.enabled ? 'Crop Active' : 'Enable 3D Crop Box'}</span>
                </button>

                <button
                  onClick={onAutoFitCrop}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 rounded-lg transition-colors"
                  title="Fit crop box tightly around model to remove outer bubble"
                >
                  <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Fit Bounding Box</span>
                </button>

                <button
                  onClick={onPruneGiantSplats}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg transition-colors"
                  title="Remove oversized background floaters & sky shells"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Prune Giant Blobs (&gt; 0.35m)</span>
                </button>

                <button
                  onClick={onPruneFloaters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg transition-colors"
                  title="Prune low opacity floaters and background outliers"
                >
                  <Scissors className="w-3.5 h-3.5 text-red-400" />
                  <span>Prune Low Alpha (&lt; 0.15)</span>
                </button>
              </div>

              {/* Floor Clip Y slider */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <span className="text-xs text-slate-400 whitespace-nowrap">Floor Clip Y:</span>
                <input
                  type="range"
                  min="-5.0"
                  max="5.0"
                  step="0.05"
                  value={cropBox.floorClipY ?? 0.0}
                  onChange={(e) =>
                    setCropBox((prev) => ({ ...prev, floorClipY: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                />
                <span className="font-mono text-xs text-white">
                  {(cropBox.floorClipY ?? 0.0).toFixed(2)}m
                </span>
              </div>
            </div>

            {/* Max Splat Size Cutoff Slider under Crop */}
            <div className="flex items-center gap-4 bg-black/20 p-2.5 rounded-lg border border-white/5 text-xs">
              <span className="text-slate-400">Max Splat Filter:</span>
              <input
                type="range"
                min="0.05"
                max="2.5"
                step="0.05"
                value={viewSettings.maxSplatSize ?? 1.0}
                onChange={(e) =>
                  setViewSettings((prev) => ({
                    ...prev,
                    maxSplatSize: parseFloat(e.target.value),
                  }))
                }
                className="w-48 accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
              />
              <span className="font-mono text-amber-300">
                {(viewSettings.maxSplatSize ?? 1.0).toFixed(2)}m cutoff
              </span>
              <span className="text-slate-500 text-[11px]">
                (Shrink this slider to slice off translucent sky/background bubbles)
              </span>
            </div>

            {cropBox.enabled && (
              <div className="grid grid-cols-3 gap-3 text-xs bg-black/20 p-2.5 rounded-lg border border-white/5">
                <div>
                  <div className="text-slate-400 text-[10px] mb-1">X Bounds (Width)</div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="0.2"
                      value={cropBox.min[0]}
                      onChange={(e) =>
                        setCropBox((prev) => ({
                          ...prev,
                          min: [parseFloat(e.target.value), prev.min[1], prev.min[2]],
                        }))
                      }
                      className="w-16 bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[11px]"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="number"
                      step="0.2"
                      value={cropBox.max[0]}
                      onChange={(e) =>
                        setCropBox((prev) => ({
                          ...prev,
                          max: [parseFloat(e.target.value), prev.max[1], prev.max[2]],
                        }))
                      }
                      className="w-16 bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[10px] mb-1">Y Bounds (Height)</div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="0.2"
                      value={cropBox.min[1]}
                      onChange={(e) =>
                        setCropBox((prev) => ({
                          ...prev,
                          min: [prev.min[0], parseFloat(e.target.value), prev.min[2]],
                        }))
                      }
                      className="w-16 bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[11px]"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="number"
                      step="0.2"
                      value={cropBox.max[1]}
                      onChange={(e) =>
                        setCropBox((prev) => ({
                          ...prev,
                          max: [prev.max[0], parseFloat(e.target.value), prev.max[2]],
                        }))
                      }
                      className="w-16 bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[10px] mb-1">Z Bounds (Depth)</div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="0.2"
                      value={cropBox.min[2]}
                      onChange={(e) =>
                        setCropBox((prev) => ({
                          ...prev,
                          min: [prev.min[0], prev.min[1], parseFloat(e.target.value)],
                        }))
                      }
                      className="w-16 bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[11px]"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="number"
                      step="0.2"
                      value={cropBox.max[2]}
                      onChange={(e) =>
                        setCropBox((prev) => ({
                          ...prev,
                          max: [prev.max[0], prev.max[1], parseFloat(e.target.value)],
                        }))
                      }
                      className="w-16 bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Camera Sequencer */}
        {activeTab === 'sequencer' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={onTogglePlayAnimation}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm"
                >
                  {isPlayingAnimation ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause Flight</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play Flight</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onAddKeyframe}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Keyframe</span>
                </button>

                <div className="text-xs text-slate-400 font-mono">
                  {keyframes.length} keyframes set
                </div>
              </div>

              {/* Timeline scrubber */}
              <div className="flex-1 max-w-[320px] flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.005"
                  value={animationProgress}
                  onChange={(e) => onSeekAnimation(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                />
                <span className="text-xs font-mono text-slate-300 min-w-[40px]">
                  {(animationProgress * 5).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Keyframe markers pill strip */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {keyframes.map((kf, idx) => (
                <div
                  key={kf.id}
                  className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded text-[11px] text-slate-300 whitespace-nowrap"
                >
                  <span className="font-semibold text-amber-400">#{idx + 1}</span>
                  <span className="font-mono text-slate-400">{(kf.time * 5).toFixed(1)}s</span>
                  {keyframes.length > 2 && (
                    <button
                      onClick={() => onDeleteKeyframe(kf.id)}
                      className="text-slate-500 hover:text-red-400 ml-1"
                      title="Remove keyframe"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
