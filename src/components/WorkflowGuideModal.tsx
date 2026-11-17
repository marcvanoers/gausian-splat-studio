/**
 * WorkflowGuideModal Component
 * Interactive visual guide explaining the 6-Step Photogrammetry & 3DGS Pipeline:
 * 1. Loading the images
 * 2. Aligning them
 * 3. Colmap
 * 4. Camera positions
 * 5. Point cloud
 * 6. Training
 */

import React from 'react';
import {
  X,
  Camera,
  Layers,
  Sparkles,
  GitBranch,
  Box,
  CheckCircle2,
  Eye,
  Info,
  Clock,
  Sliders,
  Check,
} from 'lucide-react';

interface WorkflowGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToPointCloud?: () => void;
  onSwitchToRadiance?: () => void;
  onResetToSparse?: () => void;
}

export const WorkflowGuideModal: React.FC<WorkflowGuideModalProps> = ({
  isOpen,
  onClose,
  onSwitchToPointCloud,
  onSwitchToRadiance,
  onResetToSparse,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#111420] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0c0e17]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>The 6-Step Postshot Reconstruction Workflow</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                  Full Pipeline Specification
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Detailed breakdown of how photos transform into high-fidelity 3D Gaussian Splats
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300 text-xs leading-relaxed">
          {/* Key Insight & Assessment Alert */}
          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex gap-3 text-slate-200">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <div className="text-sm font-semibold text-cyan-300">
                Workflow Assessment &amp; Validation
              </div>
              <p className="text-xs text-slate-300 leading-normal">
                Your 6-step breakdown is <strong>conceptually spot-on</strong> and mirrors the exact pipeline used in professional photogrammetry and Gaussian Splatting tools (such as Jawset Postshot, COLMAP, and Inria 3DGS). As you observed:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] ml-1">
                <li>
                  <strong className="text-white">Why the cloudy cylinder appeared previously:</strong> The earlier import code was placing random particles into an arbitrary cylinder rather than running steps 2–5.
                </li>
                <li>
                  <strong className="text-white">The role of COLMAP:</strong> In computer vision, "COLMAP" is the Structure-from-Motion engine that performs Step 3 (Feature Matching), Step 4 (Camera Positions), and Step 5 (Point Cloud Triangulation). Separating them into distinct stages gives you 100% clarity into the progress and timing of each operation.
                </li>
              </ul>
            </div>
          </div>

          {/* 6 Step Cards Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-3 flex items-center justify-between">
              <span>The 6 Distinct Pipeline Stages</span>
              <span className="text-[10px] font-mono text-slate-400 lowercase font-normal">
                each stage has an individual progress bar &amp; time estimate
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-400/20 text-cyan-300 font-mono font-bold flex items-center justify-center text-[11px]">
                      1
                    </span>
                    <Camera className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">Loading the images</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Reads photo files, extracts EXIF focal lengths, validates pixel dimensions, and loads images into analysis buffers.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Input Ingestion</span>
                  <span className="text-cyan-300">~0.06s / image</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-400/20 text-cyan-300 font-mono font-bold flex items-center justify-center text-[11px]">
                      2
                    </span>
                    <Sliders className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">Aligning them (Features)</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Runs multi-scale Harris &amp; FAST corner detection across images to extract high-contrast tie keypoints and local descriptors.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>SIFT / Harris Corners</span>
                  <span className="text-cyan-300">~0.12s / image</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-400/20 text-blue-300 font-mono font-bold flex items-center justify-center text-[11px]">
                      3
                    </span>
                    <GitBranch className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">Colmap (Matching)</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Correlates feature descriptors across overlapping image pairs and validates geometry using epipolar constraints.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Epipolar Inliers</span>
                  <span className="text-blue-300">~0.5s – 1.5s</span>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-400/20 text-purple-300 font-mono font-bold flex items-center justify-center text-[11px]">
                      4
                    </span>
                    <Camera className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">Camera positions</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Runs non-linear Bundle Adjustment to calibrate camera extrinsics [R|t], focal lengths, and minimize reprojection error.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>SfM Bundle Adjustment</span>
                  <span className="text-purple-300">~0.8s</span>
                </div>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 font-mono font-bold flex items-center justify-center text-[11px]">
                      5
                    </span>
                    <Box className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">Point cloud (points3D)</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Intersects multi-view optical rays in 3D space to triangulate true spatial tie points with authentic photo sRGB colors.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Ray Triangulation</span>
                  <span className="text-amber-300">~0.9s</span>
                </div>
              </div>

              {/* Step 6 */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-400/20 text-emerald-300 font-mono font-bold flex items-center justify-center text-[11px]">
                      6
                    </span>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">Training (3DGS)</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Seeds 3D Gaussians on tie points with k-NN covariance scaling; densifies and trains photometric loss to target budget.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>L1 + SSIM Radiance</span>
                  <span className="text-emerald-300">~1.2s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Deep-dive Q&A */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase">
              How the Time Estimates &amp; Progress Work
            </h3>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Dynamic Real-Time Time Estimator</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                As the engine runs, each step continuously tracks its elapsed duration:
                <br />
                <code className="text-amber-300 font-mono text-[11px]">
                  Estimated Remaining = (Elapsed Time / Current Progress) - Elapsed Time
                </code>
                <br />
                The overall progress bar sums the remaining time across all remaining steps, giving you a live, calibrated ETA (e.g. <em>&quot;Elapsed: 3.4s · Est. Remaining: ~4.1s · Total: ~7.5s&quot;</em>).
              </p>
            </div>
          </div>

          {/* Interactive Actions */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400">
              Inspect reconstructed tie points vs trained splats:
            </div>
            <div className="flex items-center gap-2">
              {onSwitchToPointCloud && (
                <button
                  onClick={() => {
                    onSwitchToPointCloud();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Inspect Step 5 (Point Cloud)</span>
                </button>
              )}
              {onSwitchToRadiance && (
                <button
                  onClick={() => {
                    onSwitchToRadiance();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Inspect Step 6 (Trained Radiance)</span>
                </button>
              )}
              {onResetToSparse && (
                <button
                  onClick={() => {
                    onResetToSparse();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <span>Reset to Sparse (SfM)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#0a0c14] border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Postshot Studio · 6-Step Structure from Motion &amp; 3DGS Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
