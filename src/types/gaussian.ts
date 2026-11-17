/**
 * Postshot 3D Gaussian Splatting Studio - Core Data Types
 */

export interface GaussianCloud {
  count: number;
  positions: Float32Array; // 3 floats per gaussian: x, y, z
  scales: Float32Array;    // 3 floats per gaussian: sx, sy, sz (linear scale)
  rotations: Float32Array; // 4 floats per gaussian: qw, qx, qy, qz (quaternion)
  colors: Float32Array;    // 3 floats per gaussian: r, g, b in [0, 1]
  opacities: Float32Array; // 1 float per gaussian: alpha in [0, 1]
  // Optional spherical harmonics or tags
  harmonics?: Float32Array;
  // Optional raw file blob for native 3DGS loading
  fileBlob?: Blob;
  // Bounding box & centroid cache
  bounds?: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
    radius: number;
  };
}

export interface CameraPose {
  id: string;
  index: number;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
  fov: number; // in degrees
  reprojectionError: number; // in pixels (e.g. 0.42 px)
  inliersCount: number;
  thumbnailUrl?: string;
  frameTimestamp?: number;
}

export interface CameraKeyframe {
  id: string;
  time: number; // 0.0 to 1.0 (normalized timeline)
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export type RenderMode =
  | 'radiance'    // Full 3D Gaussian Splatting with alpha blending & covariance
  | 'pointcloud'  // Sparse SfM tie point cloud + camera rays
  | 'ellipsoids'  // 3D Oriented Covariance Ellipsoids / Rings wireframe
  | 'depth'       // False color depth buffer view
  | 'density';    // Spatial density heatmap view

export interface CropBox {
  enabled: boolean;
  min: [number, number, number];
  max: [number, number, number];
  floorClipY?: number;
}

export interface TrainingState {
  step: number;
  maxSteps: number;
  isTraining: boolean;
  loss: number;
  psnr: number;
  activeGaussians: number;
  lossHistory: number[];
  psnrHistory: number[];
  densifyInterval: number;
  pruneThreshold: number;
}

export interface SplatViewSettings {
  splatScale: number; // 0.1 to 3.0 (default 1.0)
  opacityMultiplier: number; // 0.1 to 2.0 (default 1.0)
  maxSplatSize: number; // cutoff for giant background floaters (default: 2.0)
  displayBudget: number; // viewport splat rendering limit for high FPS (e.g. 2000000 for full)
  floaterThreshold: number; // alpha floater removal threshold (0 = keep 100% of splats, >0 filters low-alpha)
  invertY: boolean; // flip OpenCV Y-down to Three.js Y-up for upside-down captures
  shDegree: number; // 0, 1, 2, 3
  depthSorting: boolean;
  showCameras: boolean;
  showGroundGrid: boolean;
  showCropBox: boolean;
  backgroundColor: string; // hex
  fov: number;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  sourceType: 'preset' | 'video' | 'images' | 'ply' | 'splat' | 'psht';
  thumbnailUrl: string;
  sourceName: string;
  captureDetails: {
    framesCount: number;
    resolution: string;
    avgReprojectionError: number;
    captureType: 'orbital' | 'drone' | 'walking' | 'spiral';
    focalLengthMm: number;
  };
  totalPoints: number;
  trainedSteps: number;
}
