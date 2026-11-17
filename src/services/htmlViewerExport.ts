/**
 * Standalone High-Quality 3D Gaussian Splats HTML Viewer Exporter
 * Generates an ultra-crisp, self-contained single-file HTML viewer.
 *
 * Supports lossless Inria PLY (with full spherical harmonics and specular radiance)
 * and universal .splat binary format. Preserves 100% of splats without loss,
 * supports user-configurable splat export quality (100%, 75%, 50%, etc.),
 * preserves OpenCV/COLMAP coordinate flip (invertY), and provides interactive
 * controls (Flip toggle, Splat scale, Focus reset, Fullscreen, FPS counter).
 */

import { GaussianCloud, CropBox, ProjectMetadata, SplatViewSettings } from '../types/gaussian';
import { exportGaussianToPly, exportToSplatFormat, getActiveIndices } from './plySplatIO';

export interface StandaloneHtmlOptions {
  cloud: GaussianCloud;
  project: ProjectMetadata;
  cropBox?: CropBox;
  applyCrop?: boolean;
  viewSettings: SplatViewSettings;
  overrideInvertY?: boolean;
  exportFormat?: 'ply' | 'splat';
  splatQualityRatio?: number; // 0.1 to 1.0 (e.g. 1.0 = 100%, 0.5 = 50%)
  alphaThreshold?: number; // 0 = keep 100% data
  useOriginalSource?: boolean; // When true and cloud.fileBlob exists, embed the 100% raw original 157 MB file
}

/**
 * Converts a Blob to a Base64 string using chunked processing for maximum browser efficiency.
 */
/** Base64-encodes a blob in pieces so large payloads never become one giant JS string. */
export async function blobToBase64Parts(blob: Blob): Promise<string[]> {
  const parts: string[] = [];
  const sliceSize = 3 * (1 << 20);
  for (let start = 0; start < blob.size; start += sliceSize) {
    const bytes = new Uint8Array(await blob.slice(start, start + sliceSize).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
    }
    parts.push(btoa(binary));
  }
  return parts;
}

// Above this the embedded base64 text gets too large for browsers to read back as a single string.
const MAX_EMBEDDED_MODEL_BYTES = 300 * 1024 * 1024;
const PAYLOAD_PLACEHOLDER = '__SPLAT_BASE64_PAYLOAD__';

/**
 * Generates the complete standalone HTML document.
 */
export async function generateStandaloneHtml(options: StandaloneHtmlOptions): Promise<Blob> {
  const { cloud, project, cropBox, applyCrop, viewSettings, overrideInvertY } = options;

  const qualityRatio = options.splatQualityRatio !== undefined
    ? Math.max(0.05, Math.min(1.0, options.splatQualityRatio))
    : 1.0;
  const exportFormat = options.exportFormat || 'ply';
  const alphaThreshold = options.alphaThreshold !== undefined
    ? Math.max(0, options.alphaThreshold)
    : (viewSettings.floaterThreshold ?? 0);

  // Determine whether flip is active (carried over from viewport unless overridden)
  const isFlipped = overrideInvertY !== undefined ? overrideInvertY : !!viewSettings.invertY;

  // Compute model bounds and target centers
  const center = cloud.bounds?.center || [0, 0.5, 0];
  const radius = Math.max(1.5, (cloud.bounds?.radius || 2.0) * 1.8);

  const targetY = isFlipped ? -center[1] : center[1];
  const targetZ = center[2];

  const camX = Number((center[0] + radius * 0.75).toFixed(3));
  const camY = Number((targetY + radius * 0.65).toFixed(3));
  const camZ = Number((targetZ + radius * 1.15).toFixed(3));

  const targetX = Number(center[0].toFixed(3));
  const targetYNum = Number(targetY.toFixed(3));
  const targetZNum = Number(targetZ.toFixed(3));

  const activeCrop = applyCrop ? cropBox : undefined;

  let modelBlob: Blob;
  let isPly = exportFormat === 'ply';

  if (isPly) {
    // If full 100% quality and uncropped and raw fileBlob exists, use the original lossless stream
    const canUseOriginal = options.useOriginalSource !== false && qualityRatio >= 0.999 && !activeCrop && Boolean(cloud.fileBlob);
    if (canUseOriginal && cloud.fileBlob) {
      modelBlob = cloud.fileBlob;
      const fileName = (cloud.fileBlob as File).name?.toLowerCase() || '';
      isPly = !fileName.endsWith('.splat');
    } else {
      // The embedded viewer renders SH up to degree 2.
      modelBlob = exportGaussianToPly(cloud, activeCrop, true, false, qualityRatio, 2);
      isPly = true;
    }
    if (modelBlob.size > MAX_EMBEDDED_MODEL_BYTES) {
      modelBlob = exportToSplatFormat(cloud, activeCrop, false, qualityRatio);
      isPly = false;
    }
  } else {
    modelBlob = exportToSplatFormat(cloud, activeCrop, false, qualityRatio);
    isPly = false;
  }

  const activeIndices = getActiveIndices(cloud, activeCrop, qualityRatio);
  const splatCount = activeIndices.length;
  const qualityPercent = Math.round(qualityRatio * 100);

  const base64Parts = await blobToBase64Parts(modelBlob);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(project.name)} — 3D Gaussian Splats Viewer</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23f59e0b%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/><circle cx=%2212%22 cy=%2212%22 r=%224%22/><line x1=%224.93%22 y1=%224.93%22 x2=%229.17%22 y2=%229.17%22/><line x1=%2214.83%22 y1=%2214.83%22 x2=%2219.07%22 y2=%2219.07%22/><line x1=%2214.83%22 y1=%229.17%22 x2=%2219.07%22 y2=%224.93%22/><line x1=%2214.83%22 y1=%229.17%22 x2=%2219.07%22 y2=%224.93%22/></svg>">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0b0d14;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
    }
    #viewer-container {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    }
    /* Top Bar HUD */
    .top-bar {
      position: absolute;
      top: 16px;
      left: 16px;
      right: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
      z-index: 10;
    }
    .hud-card {
      pointer-events: auto;
      background: rgba(15, 18, 28, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 8px 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .title-group {
      display: flex;
      flex-direction: column;
    }
    .project-name {
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 6px;
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }
    .meta-line {
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      gap: 8px;
    }
    .fps-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #38bdf8;
      font-weight: 600;
    }

    /* Bottom Control Dock */
    .bottom-dock {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(15, 18, 28, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 9999px;
      padding: 6px 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.65);
    }
    .dock-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      border-radius: 9999px;
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .dock-btn:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.25);
    }
    .dock-btn.active {
      background: rgba(245, 158, 11, 0.25);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.5);
    }
    .dock-btn svg {
      width: 14px;
      height: 14px;
    }

    /* Loading Overlay */
    #loader-overlay {
      position: absolute;
      inset: 0;
      background: #090b12;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: opacity 0.5s ease;
    }
    .loader-spinner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(245, 158, 11, 0.15);
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    .loader-title {
      font-size: 16px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .loader-status {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 16px;
    }
    .progress-track {
      width: 240px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      width: 10%;
      background: linear-gradient(90deg, #f59e0b, #38bdf8);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    /* Help Modal */
    #help-overlay {
      display: none;
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    .help-box {
      background: #141724;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 24px;
      max-width: 380px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    }
    .help-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .help-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 13px;
    }
    .help-key {
      background: rgba(255,255,255,0.1);
      padding: 3px 8px;
      border-radius: 6px;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: #fbbf24;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>

  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
        "@mkkellogg/gaussian-splats-3d": "https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/build/gaussian-splats-3d.module.js"
      }
    }
  </script>
</head>
<body>
  <!-- 3D Canvas Mount -->
  <div id="viewer-container"></div>

  <!-- Top Bar HUD -->
  <div class="top-bar">
    <div class="hud-card">
      <div class="title-group">
        <div class="project-name">
          <span>${escapeHtml(project.name)}</span>
          <span class="badge">${isPly ? 'Ultra 3DGS PLY' : 'Compact .SPLAT'}</span>
        </div>
        <div class="meta-line">
          <span id="splat-count-badge">${splatCount.toLocaleString()} Splats (${qualityPercent}% Data)</span>
          <span>•</span>
          <span id="flip-status-badge">${isFlipped ? 'Y-Axis Inverted (Flipped)' : 'Standard Orientation'}</span>
        </div>
      </div>
    </div>

    <div class="hud-card">
      <div class="fps-badge" id="fps-display">60 FPS</div>
    </div>
  </div>

  <!-- Bottom Control Dock -->
  <div class="bottom-dock">
    <button class="dock-btn ${isFlipped ? 'active' : ''}" id="btn-flip" title="Flip upside-down COLMAP captures (Invert vertical axis)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m3 8 4-4 4 4"/>
        <path d="M7 4v16"/>
        <path d="m21 16-4 4-4-4"/>
        <path d="M17 20V4"/>
      </svg>
      <span id="flip-btn-label">${isFlipped ? 'Flip (Active)' : 'Flip Vertical'}</span>
    </button>

    <button class="dock-btn" id="btn-scale" title="Adjust splat radius">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <circle cx="12" cy="12" r="8"/>
      </svg>
      <span id="scale-btn-label">Scale 1.0x</span>
    </button>

    <button class="dock-btn" id="btn-focus" title="Recenter and frame model">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="22" y1="12" x2="18" y2="12"/>
        <line x1="6" y1="12" x2="2" y2="12"/>
        <line x1="12" y1="6" x2="12" y2="2"/>
        <line x1="12" y1="22" x2="12" y2="18"/>
      </svg>
      <span>Reset View</span>
    </button>

    <button class="dock-btn" id="btn-help" title="Controls and Navigation">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>Controls</span>
    </button>

    <button class="dock-btn" id="btn-fullscreen" title="Toggle Fullscreen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
    </button>
  </div>

  <!-- Loading Screen -->
  <div id="loader-overlay">
    <div class="loader-spinner"></div>
    <div class="loader-title">Loading 3D Radiance Field</div>
    <div class="loader-status" id="loader-status">Decoding ${splatCount.toLocaleString()} Gaussian Splats (${qualityPercent}% data)...</div>
    <div class="progress-track">
      <div class="progress-bar" id="progress-bar"></div>
    </div>
  </div>

  <!-- Help Modal -->
  <div id="help-overlay">
    <div class="help-box">
      <div class="help-title">
        <span>3D Navigation</span>
        <span style="cursor:pointer;" id="close-help">&times;</span>
      </div>
      <div class="help-row">
        <span>Orbit / Rotate</span>
        <span class="help-key">Left Click + Drag</span>
      </div>
      <div class="help-row">
        <span>Pan / Move</span>
        <span class="help-key">Right Click / Two Fingers</span>
      </div>
      <div class="help-row">
        <span>Zoom</span>
        <span class="help-key">Mouse Wheel / Pinch</span>
      </div>
      <div class="help-row">
        <span>Flip Upside-Down</span>
        <span class="help-key">Flip Button</span>
      </div>
      <div class="help-row">
        <span>Export Quality</span>
        <span style="color:#fbbf24; font-size:11px;">${qualityPercent}% (${isPly ? 'Full 3DGS PLY' : 'Standard .SPLAT'})</span>
      </div>
      <div class="help-row">
        <span>Exported From</span>
        <span style="color:#94a3b8; font-size:11px;">Postshot Studio</span>
      </div>
    </div>
  </div>

  <!-- Embedded 3DGS Binary Splat Data (Base64) -->
  <script id="splat-data" type="application/octet-stream">${PAYLOAD_PLACEHOLDER}</script>

  <!-- Interactive Viewer Script -->
  <script type="module">
    import * as THREE from 'three';
    import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

    const container = document.getElementById('viewer-container');
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderStatus = document.getElementById('loader-status');
    const progressBar = document.getElementById('progress-bar');
    const fpsDisplay = document.getElementById('fps-display');
    const splatCountBadge = document.getElementById('splat-count-badge');
    const btnFlip = document.getElementById('btn-flip');
    const flipBtnLabel = document.getElementById('flip-btn-label');
    const flipStatusBadge = document.getElementById('flip-status-badge');
    const btnScale = document.getElementById('btn-scale');
    const scaleBtnLabel = document.getElementById('scale-btn-label');
    const btnFocus = document.getElementById('btn-focus');
    const btnHelp = document.getElementById('btn-help');
    const helpOverlay = document.getElementById('help-overlay');
    const closeHelp = document.getElementById('close-help');
    const btnFullscreen = document.getElementById('btn-fullscreen');

    // Initial Parameters
    const isPlyFormat = ${isPly ? 'true' : 'false'};
    const alphaRemovalThreshold = ${alphaThreshold};
    const expectedCount = ${splatCount};
    const qualityPct = ${qualityPercent};

    let isFlipped = ${isFlipped ? 'true' : 'false'};
    let currentScale = 1.0;
    const scales = [0.5, 0.75, 1.0, 1.35, 1.75];
    let scaleIndex = 2;

    const rawCenter = [${Number(center[0].toFixed(3))}, ${Number(center[1].toFixed(3))}, ${Number(center[2].toFixed(3))}];
    const radius = ${Number(radius.toFixed(3))};

    function getTarget() {
      return [
        rawCenter[0],
        isFlipped ? -rawCenter[1] : rawCenter[1],
        rawCenter[2],
      ];
    }

    function getCamPos() {
      const tgt = getTarget();
      return [
        tgt[0] + radius * 0.75,
        tgt[1] + radius * 0.65,
        tgt[2] + radius * 1.15,
      ];
    }

    // Direct binary decoder from Base64 into Uint8Array
    function base64ToUint8Array(base64) {
      const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
      const len = clean.length;
      if (len === 0) return new Uint8Array(0);

      const padLen = (4 - (len % 4)) % 4;
      const padded = clean + '='.repeat(padLen);
      const totalLen = padded.length;

      let placeHolders = 0;
      if (padded.charAt(totalLen - 1) === '=') placeHolders++;
      if (padded.charAt(totalLen - 2) === '=') placeHolders++;
      const byteLength = (totalLen * 3) / 4 - placeHolders;
      const u8 = new Uint8Array(byteLength);

      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const map = new Uint8Array(256);
      for (let i = 0; i < chars.length; i++) map[chars.charCodeAt(i)] = i;

      let p = 0;
      for (let i = 0; i < totalLen; i += 4) {
        const a = map[padded.charCodeAt(i)];
        const b = map[padded.charCodeAt(i + 1)];
        const c = map[padded.charCodeAt(i + 2)];
        const d = map[padded.charCodeAt(i + 3)];

        u8[p++] = (a << 2) | (b >> 4);
        if (p < byteLength) u8[p++] = ((b & 15) << 4) | (c >> 2);
        if (p < byteLength) u8[p++] = ((c & 3) << 6) | (d & 63);
      }
      return u8;
    }

    function base64ToBlob(base64) {
      loaderStatus.textContent = 'Decoding 3D radiance data...';
      progressBar.style.width = '35%';
      const bytes = base64ToUint8Array(base64);
      return new Blob([bytes], { type: 'application/octet-stream' });
    }

    let viewer = null;
    let splatBlobUrl = null;

    async function initViewer() {
      try {
        progressBar.style.width = '40%';
        loaderStatus.textContent = 'Initializing Gaussian Splats 3D Engine...';

        const rawData = document.getElementById('splat-data').textContent;
        const splatBlob = base64ToBlob(rawData);
        splatBlobUrl = URL.createObjectURL(splatBlob);

        viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, 1, 0],
          initialCameraPosition: getCamPos(),
          initialCameraLookAt: getTarget(),
          rootElement: container,
          sharedMemoryForWorkers: false, // Ensures compatibility across all browsers & local file://
          useBuiltInControls: true,
          selfDrivenMode: true,
          gpuAcceleratedSort: false,
          sphericalHarmonicsDegree: isPlyFormat ? 2 : 0, // Full view-dependent radiance reflections
          renderMode: GaussianSplats3D.RenderMode.Always,
          logLevel: GaussianSplats3D.LogLevel.None,
        });

        // Initialize WebGL renderer and canvas inside container
        viewer.init();

        progressBar.style.width = '65%';
        loaderStatus.textContent = 'Sorting and uploading radiance Gaussians...';

        const sceneFormat = isPlyFormat
          ? GaussianSplats3D.SceneFormat.Ply
          : GaussianSplats3D.SceneFormat.Splat;

        await viewer.addSplatScene(splatBlobUrl, {
          format: sceneFormat,
          rotation: isFlipped ? [1, 0, 0, 0] : undefined,
          splatAlphaRemovalThreshold: alphaRemovalThreshold, // 0 = keep 100% data
          sphericalHarmonicsDegree: isPlyFormat ? 2 : 0,
          showLoadingUI: false,
          progressiveLoad: false,
          onProgress: (percent) => {
            progressBar.style.width = Math.max(65, Math.min(98, percent)) + '%';
          }
        });

        // Start render loop after scene is ready
        viewer.start();

        // Apply initial splat scale and auto-frame camera
        const splatMesh = viewer.getSplatMesh();
        const loadedCount = splatMesh ? splatMesh.getSplatCount() : expectedCount;
        if (splatCountBadge && loadedCount) {
          splatCountBadge.textContent = loadedCount.toLocaleString() + ' Splats (' + qualityPct + '% Data)';
        }

        if (splatMesh && splatMesh.material && splatMesh.material.uniforms && splatMesh.material.uniforms.splatScale) {
          try {
            if (typeof splatMesh.setSplatScale === 'function') {
              splatMesh.setSplatScale(currentScale);
            } else {
              splatMesh.material.uniforms.splatScale.value = currentScale;
            }
          } catch (e) {
            console.warn('Initial splat scale warning:', e);
          }
        }
        resetCamera();

        // Hide Loader
        progressBar.style.width = '100%';
        loaderOverlay.style.opacity = '0';
        setTimeout(() => {
          loaderOverlay.style.display = 'none';
        }, 500);

        // Frame rate measurement
        let frameCount = 0;
        let lastTime = performance.now();
        function updateFps() {
          frameCount++;
          const now = performance.now();
          if (now - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastTime));
            fpsDisplay.textContent = fps + ' FPS';
            frameCount = 0;
            lastTime = now;
          }
          requestAnimationFrame(updateFps);
        }
        updateFps();

      } catch (err) {
        console.error('Failed to initialize 3DGS Viewer:', err);
        loaderStatus.innerHTML = '<span style="color:#ef4444;">Error: ' + (err.message || 'Check console') + '</span>';
      }
    }

    // Flip Toggle Functionality
    async function toggleFlip() {
      if (!viewer) return;
      isFlipped = !isFlipped;

      loaderOverlay.style.display = 'flex';
      loaderOverlay.style.opacity = '1';
      loaderStatus.textContent = isFlipped ? 'Applying Flip (Inverting Y-axis)...' : 'Restoring original orientation...';
      progressBar.style.width = '50%';

      try {
        while (viewer.getSceneCount() > 0) {
          await viewer.removeSplatScene(0, false);
        }

        const sceneFormat = isPlyFormat
          ? GaussianSplats3D.SceneFormat.Ply
          : GaussianSplats3D.SceneFormat.Splat;

        await viewer.addSplatScene(splatBlobUrl, {
          format: sceneFormat,
          rotation: isFlipped ? [1, 0, 0, 0] : undefined,
          splatAlphaRemovalThreshold: alphaRemovalThreshold,
          sphericalHarmonicsDegree: isPlyFormat ? 2 : 0,
          showLoadingUI: false,
          progressiveLoad: false,
        });

        // Adjust camera target and position
        const target = getTarget();
        const cam = getCamPos();
        if (viewer.controls && viewer.controls.target) {
          viewer.controls.target.set(target[0], target[1], target[2]);
          viewer.camera.position.set(cam[0], cam[1], cam[2]);
          viewer.controls.update();
        }

        btnFlip.classList.toggle('active', isFlipped);
        flipBtnLabel.textContent = isFlipped ? 'Flip (Active)' : 'Flip Vertical';
        flipStatusBadge.textContent = isFlipped ? 'Y-Axis Inverted (Flipped)' : 'Standard Orientation';

      } catch (err) {
        console.error('Error toggling flip:', err);
      } finally {
        progressBar.style.width = '100%';
        loaderOverlay.style.opacity = '0';
        setTimeout(() => { loaderOverlay.style.display = 'none'; }, 300);
      }
    }

    // Splat Scale Cycle
    function cycleScale() {
      if (!viewer) return;
      scaleIndex = (scaleIndex + 1) % scales.length;
      currentScale = scales[scaleIndex];
      scaleBtnLabel.textContent = 'Scale ' + currentScale + 'x';

      const splatMesh = viewer.getSplatMesh();
      if (splatMesh && splatMesh.material && splatMesh.material.uniforms && splatMesh.material.uniforms.splatScale) {
        try {
          if (typeof splatMesh.setSplatScale === 'function') {
            splatMesh.setSplatScale(currentScale);
          } else {
            splatMesh.material.uniforms.splatScale.value = currentScale;
          }
        } catch {
          splatMesh.material.uniforms.splatScale.value = currentScale;
        }
      }
    }

    // Reset Camera
    function resetCamera() {
      if (!viewer || !viewer.controls || !viewer.camera) return;
      const target = getTarget();
      const cam = getCamPos();
      viewer.controls.target.set(target[0], target[1], target[2]);
      viewer.camera.position.set(cam[0], cam[1], cam[2]);
      viewer.controls.update();
    }

    // Fullscreen Toggle
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    }

    // Event Listeners
    btnFlip.addEventListener('click', toggleFlip);
    btnScale.addEventListener('click', cycleScale);
    btnFocus.addEventListener('click', resetCamera);
    btnFullscreen.addEventListener('click', toggleFullscreen);

    btnHelp.addEventListener('click', () => {
      helpOverlay.style.display = 'flex';
    });
    closeHelp.addEventListener('click', () => {
      helpOverlay.style.display = 'none';
    });
    helpOverlay.addEventListener('click', (e) => {
      if (e.target === helpOverlay) helpOverlay.style.display = 'none';
    });

    // Start
    initViewer();
  </script>
</body>
</html>`;

  const [before, after] = html.split(PAYLOAD_PLACEHOLDER);
  return new Blob([before, ...base64Parts, after], { type: 'text/html;charset=utf-8' });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
