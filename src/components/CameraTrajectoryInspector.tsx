/**
 * Camera Trajectory & Pose Inspector for Postshot Studio
 * Lists estimated Structure-from-Motion camera poses, inlier counts,
 * reprojection error statistics, and allows jumping camera to any frame view.
 */

import React from 'react';
import { X, Camera, CheckCircle2, Crosshair } from 'lucide-react';
import { CameraPose, ProjectMetadata } from '../types/gaussian';

interface CameraTrajectoryInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  cameraPoses: CameraPose[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string | null) => void;
  currentProject: ProjectMetadata;
}

export const CameraTrajectoryInspector: React.FC<CameraTrajectoryInspectorProps> = ({
  isOpen,
  onClose,
  cameraPoses,
  selectedCameraId,
  onSelectCamera,
  currentProject,
}) => {
  if (!isOpen) return null;

  const avgError =
    cameraPoses.reduce((sum, c) => sum + c.reprojectionError, 0) / (cameraPoses.length || 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-[#141724] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white">Camera Alignment & Trajectory Inspector</h2>
            <p className="text-xs text-slate-400">
              {cameraPoses.length} calibrated camera poses · Mean Reprojection Error: {avgError.toFixed(2)} px
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {cameraPoses.map((cam) => {
              const isSelected = cam.id === selectedCameraId;
              return (
                <div
                  key={cam.id}
                  onClick={() => onSelectCamera(cam.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 text-white shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{cam.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Pos: [{cam.position.join(', ')}]
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-medium text-amber-300">
                      {cam.reprojectionError} px
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {cam.inliersCount} inliers
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#0e111a] border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Click any camera view above to align 3D viewport to that frame.</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
