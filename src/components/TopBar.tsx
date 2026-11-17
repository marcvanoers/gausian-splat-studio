/**
 * TopBar Component - Strict Top Bar Contract compliance:
 * [Brand title, one line] - [4-5 nav links, 1-2 word labels, single-line] - [1 primary action]
 */

import React from 'react';
import { Camera, Layers, Box, Film, Download, FolderOpen, GitBranch } from 'lucide-react';
import { ProjectMetadata } from '../types/gaussian';

interface TopBarProps {
  currentProject: ProjectMetadata;
  activeTab: 'training' | 'rendering' | 'crop' | 'sequencer';
  setActiveTab: (tab: 'training' | 'rendering' | 'crop' | 'sequencer') => void;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
  onOpenTrajectoryModal: () => void;
  onOpenWorkflowModal?: () => void;
  isTraining: boolean;
  onToggleTraining: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentProject,
  activeTab,
  setActiveTab,
  onOpenImportModal,
  onOpenExportModal,
  onOpenTrajectoryModal,
  onOpenWorkflowModal,
}) => {
  return (
    <header className="relative z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0f1117]/90 border-b border-white/10 backdrop-blur-md">
      {/* Zone 1: Single Brand Wordmark */}
      <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-amber-500/10">
          <Layers className="w-4 h-4 text-slate-950 font-bold" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold tracking-tight text-white">Postshot</span>
          <span className="text-xs text-slate-400 font-mono tracking-wide">STUDIO</span>
        </div>
      </div>

      {/* Zone 2: Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-300">
        <button
          onClick={() => setActiveTab('training')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'training'
              ? 'bg-white/10 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Optimization</span>
        </button>

        <button
          onClick={() => setActiveTab('rendering')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'rendering'
              ? 'bg-white/10 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Shading</span>
        </button>

        <button
          onClick={() => setActiveTab('crop')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'crop'
              ? 'bg-white/10 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Crop & Prune</span>
        </button>

        <button
          onClick={() => setActiveTab('sequencer')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'sequencer'
              ? 'bg-white/10 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Camera Sequencer</span>
        </button>

        <button
          onClick={onOpenTrajectoryModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Trajectory Poses</span>
        </button>

        {onOpenWorkflowModal && (
          <button
            onClick={onOpenWorkflowModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-amber-300 hover:text-white hover:bg-amber-400/20 transition-colors whitespace-nowrap shrink-0 border border-amber-400/30 bg-amber-400/10 ml-1 font-semibold"
            title="Inspect the COLMAP Structure-from-Motion & 3DGS Reconstruction Pipeline"
          >
            <GitBranch className="w-3.5 h-3.5 text-amber-400" />
            <span>COLMAP SfM Workflow</span>
          </button>
        )}
      </nav>

      {/* Zone 3: 1 Primary Action + Project Switcher */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenImportModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Open Postshot .PSHT, .PLY, .SPLAT, or import new photo set"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Project:</span>
          <span className="text-white max-w-[130px] truncate">{currentProject.name}</span>
          {currentProject.sourceType === 'images' && (
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono font-semibold">
              SfM
            </span>
          )}
          {currentProject.sourceType === 'psht' && (
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-mono font-semibold">
              PSHT
            </span>
          )}
        </button>

        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          title="Save and export to standard 3DGS .PLY file"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save as .PLY</span>
        </button>
      </div>
    </header>
  );
};
