/**
 * Export Modal for Postshot Studio
 * Downloads standard 3DGS PLY (binary/ASCII), .splat binary format,
 * transforms.json camera poses, and ultra-high-quality standalone HTML web viewer.
 * Includes user-configurable splat amount/density control (100% full data, 50%, etc.),
 * format selection (Original Lossless Source vs Optimized PLY vs SPLAT), and alpha culling control.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileCode,
  Layers,
  Camera,
  Check,
  Globe,
  RotateCw,
  Sparkles,
  Loader2,
  AlertCircle,
  Gauge,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { GaussianCloud, CameraPose, CropBox, ProjectMetadata, SplatViewSettings } from '../types/gaussian';
import {
  exportGaussianToPly,
  exportToSplatFormat,
  exportCameraTransforms,
  getActiveIndices,
} from '../services/plySplatIO';
import { generateStandaloneHtml } from '../services/htmlViewerExport';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloud: GaussianCloud | null;
  cropBox: CropBox;
  cameraPoses: CameraPose[];
  currentProject: ProjectMetadata;
  viewSettings: SplatViewSettings;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  cloud,
  cropBox,
  cameraPoses,
  currentProject,
  viewSettings,
}) => {
  // Crop should NOT be applied by default unless user explicitly wants to crop
  const [applyCrop, setApplyCrop] = useState(false);
  const [applyFlip, setApplyFlip] = useState(viewSettings.invertY);
  const [qualityRatio, setQualityRatio] = useState<number>(1.0); // 1.0 = 100% full data
  const [htmlFormat, setHtmlFormat] = useState<'ply' | 'splat'>('ply'); // 'ply' = ultra high fidelity with spherical harmonics
  const [useOriginalSource, setUseOriginalSource] = useState<boolean>(true); // Embed 100% untouched source when available
  const [alphaFilter, setAlphaFilter] = useState<number>(0); // 0 = keep 100% data, 0 cut
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasOriginalBlob = Boolean(cloud?.fileBlob);
  const originalBlobSizeMb = cloud?.fileBlob ? (cloud.fileBlob.size / (1024 * 1024)).toFixed(1) : null;

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setApplyCrop(false);
      setApplyFlip(viewSettings.invertY);
      setQualityRatio(1.0);
      setHtmlFormat('ply');
      setUseOriginalSource(Boolean(cloud?.fileBlob));
      setAlphaFilter(0);
      setErrorMessage(null);
    }
  }, [isOpen, viewSettings.invertY, cloud]);

  if (!isOpen || !cloud) return null;

  const activeIndices = getActiveIndices(cloud, applyCrop ? cropBox : undefined, qualityRatio);
  const exportSplatCount = activeIndices.length;
  const qualityPercent = Math.round(qualityRatio * 100);

  // File size calculations
  const isLosslessOriginalActive = Boolean(
    useOriginalSource && hasOriginalBlob && qualityRatio >= 0.999 && !applyCrop && htmlFormat === 'ply'
  );

  const estHtmlMb = isLosslessOriginalActive && cloud.fileBlob
    ? ((cloud.fileBlob.size * 1.34) / (1024 * 1024)).toFixed(0)
    : (
        (exportSplatCount * (htmlFormat === 'ply' ? 68 : 32) * 1.34) /
        (1024 * 1024)
      ).toFixed(1);

  const estPlyMb = isLosslessOriginalActive && cloud.fileBlob
    ? (cloud.fileBlob.size / (1024 * 1024)).toFixed(1)
    : ((exportSplatCount * 68) / (1024 * 1024)).toFixed(1);

  const estSplatMb = ((exportSplatCount * 32) / (1024 * 1024)).toFixed(1);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess(filename);
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const handleExportBinaryPly = () => {
    setIsExporting(true);
    setExportMessage(`Generating Binary PLY with ${exportSplatCount.toLocaleString()} splats...`);
    setTimeout(() => {
      let blob: Blob;
      if (isLosslessOriginalActive && cloud.fileBlob && !applyFlip) {
        blob = cloud.fileBlob;
      } else {
        const activeCrop = applyCrop ? cropBox : undefined;
        blob = exportGaussianToPly(cloud, activeCrop, true, applyFlip, qualityRatio);
      }
      triggerDownload(
        blob,
        `${currentProject.id}_${qualityPercent}pct_splats${applyFlip ? '_flipped' : ''}.ply`
      );
      setIsExporting(false);
      setExportMessage(null);
    }, 60);
  };

  const handleExportAsciiPly = () => {
    setIsExporting(true);
    setExportMessage('Generating ASCII PLY...');
    setTimeout(() => {
      const activeCrop = applyCrop ? cropBox : undefined;
      const blob = exportGaussianToPly(cloud, activeCrop, false, applyFlip, qualityRatio);
      triggerDownload(blob, `${currentProject.id}_ascii_${qualityPercent}pct${applyFlip ? '_flipped' : ''}.ply`);
      setIsExporting(false);
      setExportMessage(null);
    }, 60);
  };

  const handleExportSplat = () => {
    setIsExporting(true);
    setExportMessage(`Exporting universal 32-byte .splat buffer (${exportSplatCount.toLocaleString()} splats)...`);
    setTimeout(() => {
      const activeCrop = applyCrop ? cropBox : undefined;
      const blob = exportToSplatFormat(cloud, activeCrop, applyFlip, qualityRatio);
      triggerDownload(blob, `${currentProject.id}_${qualityPercent}pct${applyFlip ? '_flipped' : ''}.splat`);
      setIsExporting(false);
      setExportMessage(null);
    }, 60);
  };

  const handleExportTransforms = () => {
    setIsExporting(true);
    setExportMessage('Exporting COLMAP / NeRF transforms.json...');
    setTimeout(() => {
      const blob = exportCameraTransforms(cameraPoses, currentProject.name, applyFlip);
      triggerDownload(blob, 'transforms.json');
      setIsExporting(false);
      setExportMessage(null);
    }, 60);
  };

  const handleExportHtmlViewer = async () => {
    try {
      setIsExporting(true);
      const modeLabel = isLosslessOriginalActive
        ? `Lossless Source (${originalBlobSizeMb} MB, all spherical harmonics)`
        : `${exportSplatCount.toLocaleString()} splats (${qualityPercent}%, ${htmlFormat.toUpperCase()})`;
      setExportMessage(`Packaging ${modeLabel} into standalone HTML...`);

      const blob = await generateStandaloneHtml({
        cloud,
        project: currentProject,
        cropBox,
        applyCrop,
        viewSettings,
        overrideInvertY: applyFlip,
        exportFormat: htmlFormat,
        splatQualityRatio: qualityRatio,
        alphaThreshold: alphaFilter,
        useOriginalSource: isLosslessOriginalActive,
      });

      triggerDownload(blob, `${currentProject.id}_${qualityPercent}pct_3dgs_viewer.html`);
    } catch (err: any) {
      console.error('Failed to export HTML viewer:', err);
      setErrorMessage('Error generating HTML viewer: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
      setExportMessage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#141724] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0e111a]">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Export Radiance Field &amp; Splats</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Postshot 3D Engine
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose your quality level, splat density, and export standalone 3D web viewers or standard files.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between gap-3 text-red-300 text-xs animate-shake">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white font-bold p-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Global Controls Section */}
        <div className="px-6 py-4 bg-[#0a0d16] border-b border-white/10 space-y-3.5">
          {/* Original Source Detected Banner & Toggle */}
          {hasOriginalBlob && (
            <div className="bg-gradient-to-r from-blue-500/15 via-blue-500/10 to-transparent border border-blue-500/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Original Lossless Source Available</span>
                    <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded">
                      {originalBlobSizeMb} MB
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Contains all higher-order spherical harmonics (specular shine &amp; car reflections).
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseOriginalSource(!useOriginalSource);
                  if (!useOriginalSource) {
                    setApplyCrop(false);
                    setQualityRatio(1.0);
                    setHtmlFormat('ply');
                  }
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  useOriginalSource && !applyCrop && qualityRatio >= 0.999
                    ? 'bg-blue-500 text-white border-blue-400 shadow-md font-bold'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {useOriginalSource && !applyCrop && qualityRatio >= 0.999
                  ? '✓ Using Original Source'
                  : 'Use Original Source'}
              </button>
            </div>
          )}

          {/* Quality & Splat Density Section */}
          <div className="bg-[#121624] border border-white/10 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Splat Density &amp; Export Quality
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {exportSplatCount.toLocaleString()} splats ({qualityPercent}%)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Total: {cloud.count.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '100% (All Data)', value: 1.0, desc: 'Maximum visual quality' },
                { label: '75% (High)', value: 0.75, desc: 'Balanced fidelity' },
                { label: '50% (Balanced)', value: 0.5, desc: 'Half data / small size' },
                { label: '25% (Light)', value: 0.25, desc: 'Fast mobile load' },
              ].map((preset) => {
                const isActive = Math.abs(qualityRatio - preset.value) < 0.01;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setQualityRatio(preset.value);
                      if (preset.value < 0.999) {
                        setUseOriginalSource(false);
                      }
                    }}
                    className={`p-2 rounded-lg text-left transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold shadow-md'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-semibold">{preset.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">{preset.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Range Slider for Fine Adjustment */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Custom Splat Percentage</span>
                <span className="font-mono text-amber-300">{qualityPercent}% of data</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.0"
                step="0.05"
                value={qualityRatio}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setQualityRatio(val);
                  if (val < 0.999) setUseOriginalSource(false);
                }}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>10% (~{(cloud.count * 0.1).toLocaleString(undefined, { maximumFractionDigits: 0 })} splats)</span>
                <span>50% (~{(cloud.count * 0.5).toLocaleString(undefined, { maximumFractionDigits: 0 })} splats)</span>
                <span>100% ({cloud.count.toLocaleString()} splats - All data)</span>
              </div>
            </div>
          </div>

          {/* Orientation and Filter Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            {/* 1. Crop Box Checkbox (Defaulted to false so original data is never discarded by mistake) */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={applyCrop}
                onChange={(e) => {
                  setApplyCrop(e.target.checked);
                  if (e.target.checked) setUseOriginalSource(false);
                }}
                className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
              />
              <span className="font-medium">Apply 3D Crop Bounding Box</span>
            </label>

            {/* 2. Flip / Invert Y Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={applyFlip}
                onChange={(e) => setApplyFlip(e.target.checked)}
                className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
              />
              <span className="font-medium flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Invert Vertical Axis (Flip Y)</span>
                {viewSettings.invertY && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                    Viewport Active
                  </span>
                )}
              </span>
            </label>

            {/* 3. Alpha Filter Culling */}
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="text-[11px] text-slate-400">Data Culling:</span>
              <button
                type="button"
                onClick={() => setAlphaFilter(alphaFilter === 0 ? 5 : 0)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors border ${
                  alphaFilter === 0
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                }`}
                title="Threshold 0 keeps 100% of all Gaussians. Threshold 5 trims faint background floaters."
              >
                {alphaFilter === 0 ? 'Keep 100% Data (0 Culling)' : 'Trim Floaties (Alpha < 5)'}
              </button>
            </div>
          </div>
        </div>

        {/* PSHT Source Banner */}
        {currentProject.sourceType === 'psht' && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                Loaded from Postshot project <strong>{currentProject.name}.psht</strong>. Ready to convert &amp; save to standard Inria <strong>.PLY</strong> below.
              </span>
            </div>
            <button
              onClick={handleExportBinaryPly}
              disabled={isExporting}
              className="px-2.5 py-1 text-[11px] font-semibold bg-purple-400 hover:bg-purple-300 text-slate-950 rounded-md whitespace-nowrap cursor-pointer transition-colors shadow-sm"
            >
              Quick Save .PLY
            </button>
          </div>
        )}

        {/* Export Formats List */}
        <div className="p-6 space-y-3.5 overflow-y-auto">
          {/* Format 1: Standalone High-Quality HTML Viewer */}
          <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-xl hover:border-emerald-400/60 transition-all shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-400/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>Standalone 3DGS HTML Web Viewer</span>
                    <span className="text-[10px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      {isLosslessOriginalActive
                        ? `Original Source (${originalBlobSizeMb} MB)`
                        : `${qualityPercent}% Splat Density`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5 max-w-md">
                    {isLosslessOriginalActive
                      ? `Embeds the complete original ${originalBlobSizeMb} MB file with full spherical harmonics, glossy car reflections, and corrected quaternions (zero needles). Matches the in-app view 1:1.`
                      : 'Self-contained single-file HTML viewer with smooth, surface-tangent 3D Gaussian ellipsoids and full orbit controls.'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleExportHtmlViewer}
                disabled={isExporting}
                className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-md cursor-pointer ml-3 shrink-0"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Export HTML ({estHtmlMb} MB)</span>
              </button>
            </div>

            {/* Viewer Quality Mode Selector */}
            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-emerald-500/20 text-xs gap-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Embedded Quality Mode:</span>
              </span>
              <div className="flex items-center gap-2">
                {hasOriginalBlob && !applyCrop && qualityRatio >= 0.999 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseOriginalSource(true);
                      setHtmlFormat('ply');
                    }}
                    className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-all ${
                      useOriginalSource
                        ? 'bg-blue-400 text-slate-950 font-bold shadow'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                    title="Embeds the complete 157 MB original file with full spherical harmonics and reflections (matches in-app viewer 1:1)"
                  >
                    Original Lossless ({originalBlobSizeMb} MB)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setUseOriginalSource(false);
                    setHtmlFormat('ply');
                  }}
                  className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-all ${
                    !useOriginalSource && htmlFormat === 'ply'
                      ? 'bg-emerald-400 text-slate-950 font-bold shadow'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                  title="Optimized 68-byte format with corrected surface-tangent quaternions (zero needles/porcupine effect)"
                >
                  Optimized 3DGS (~56 MB)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseOriginalSource(false);
                    setHtmlFormat('splat');
                  }}
                  className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-all ${
                    htmlFormat === 'splat'
                      ? 'bg-emerald-400 text-slate-950 font-bold shadow'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                  title="Compact 32-byte layout for lightweight file size"
                >
                  Compact .SPLAT (~26 MB)
                </button>
              </div>
            </div>
          </div>

          {/* Format 2: Inria Binary PLY */}
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:border-amber-400/40 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                <FileCode className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Standard 3DGS Binary (.PLY)</span>
                  <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                    Inria / UE5 / SuperSplat
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Positions, scales, rotation quaternions, spherical harmonics, and logit opacity.
                  {qualityPercent < 100 && ` (${qualityPercent}% splats: ${exportSplatCount.toLocaleString()})`}
                  {applyFlip && ' • Flipped baked in'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button
                onClick={handleExportAsciiPly}
                disabled={isExporting}
                title="Download ASCII PLY text format"
                className="px-2.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap"
              >
                ASCII
              </button>
              <button
                onClick={handleExportBinaryPly}
                disabled={isExporting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Binary PLY ({estPlyMb} MB)</span>
              </button>
            </div>
          </div>

          {/* Format 3: .splat Binary Format */}
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-400/40 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Compact Binary (.SPLAT)</span>
                  <span className="text-[10px] bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                    32-byte Web Standard
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Universal compact format with smooth quaternions for fast web streaming &amp; antimatter15 viewers.
                  {qualityPercent < 100 && ` (${qualityPercent}% splats: ${exportSplatCount.toLocaleString()})`}
                </div>
              </div>
            </div>
            <button
              onClick={handleExportSplat}
              disabled={isExporting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ml-3 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download .splat ({estSplatMb} MB)</span>
            </button>
          </div>

          {/* Format 4: transforms.json */}
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:border-purple-400/40 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-purple-400/10 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Camera Poses (transforms.json)</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  COLMAP / NeRF format camera extrinsics &amp; intrinsics matrices for {cameraPoses.length} viewpoints.
                </div>
              </div>
            </div>
            <button
              onClick={handleExportTransforms}
              disabled={isExporting}
              className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ml-3 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>

        {/* Processing Indicator */}
        {isExporting && exportMessage && (
          <div className="mx-6 mb-3 p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <span>{exportMessage}</span>
          </div>
        )}

        {/* Download Feedback */}
        {downloadSuccess && (
          <div className="mx-6 mb-4 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">Exported {downloadSuccess} successfully!</span>
          </div>
        )}
      </div>
    </div>
  );
};
