/**
 * Dataset Generator for Postshot Studio
 * Generates photorealistic procedural 3D Gaussian Splats, camera orbital trajectories,
 * and sparse tie points for instant high-fidelity workstation evaluation.
 */

import * as THREE from 'three';
import { GaussianCloud, CameraPose, ProjectMetadata } from '../types/gaussian';

export const PRESET_PROJECTS: Record<string, ProjectMetadata> = {
  motorcycle: {
    id: 'motorcycle',
    name: 'Vintage Cafe Racer (750cc)',
    sourceType: 'preset',
    thumbnailUrl: '/src/assets/images/thumb_vintage_motorcycle_1792135285377.jpg',
    sourceName: 'norton_commando_360_orbit.mp4',
    captureDetails: {
      framesCount: 72,
      resolution: '3840x2160 (4K)',
      avgReprojectionError: 0.38,
      captureType: 'orbital',
      focalLengthMm: 35.0,
    },
    totalPoints: 75000,
    trainedSteps: 15000,
  },
  marble_statue: {
    id: 'marble_statue',
    name: 'Marcus Aurelius Bust (Museum)',
    sourceType: 'preset',
    thumbnailUrl: '/src/assets/images/thumb_marble_statue_1792135285370.jpg',
    sourceName: 'statue_bust_photogrammetry_set',
    captureDetails: {
      framesCount: 56,
      resolution: '4096x2730 (RAW)',
      avgReprojectionError: 0.31,
      captureType: 'spiral',
      focalLengthMm: 50.0,
    },
    totalPoints: 58000,
    trainedSteps: 12000,
  },
  cyberpunk_alley: {
    id: 'cyberpunk_alley',
    name: 'Shinjuku Neon Alleyway (Night)',
    sourceType: 'preset',
    thumbnailUrl: '/src/assets/images/thumb_cyberpunk_alley_1792135286178.jpg',
    sourceName: 'tokyo_drizzle_walkthrough.mov',
    captureDetails: {
      framesCount: 96,
      resolution: '3840x2160 (4K HDR)',
      avgReprojectionError: 0.44,
      captureType: 'walking',
      focalLengthMm: 24.0,
    },
    totalPoints: 92000,
    trainedSteps: 20000,
  },
  cathedral_ruins: {
    id: 'cathedral_ruins',
    name: 'Gothic Abbey Ruins & Cloister',
    sourceType: 'preset',
    thumbnailUrl: '/src/assets/images/thumb_cathedral_ruins_1792135286135.jpg',
    sourceName: 'drone_ruins_survey_flight.mp4',
    captureDetails: {
      framesCount: 110,
      resolution: '5120x2880 (5K Drone)',
      avgReprojectionError: 0.41,
      captureType: 'drone',
      focalLengthMm: 28.0,
    },
    totalPoints: 85000,
    trainedSteps: 18000,
  },
};

/**
 * Procedurally generates authentic 3D Gaussian Splats with true ellipsoidal scales,
 * anisotropic rotations, realistic colors, and opacities.
 */
export function generateRadianceField(presetId: string, targetCount: number = 70000): GaussianCloud {
  const count = targetCount;
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const colors = new Float32Array(count * 3);
  const opacities = new Float32Array(count);

  let pIdx = 0;
  let sIdx = 0;
  let rIdx = 0;
  let cIdx = 0;
  let oIdx = 0;

  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();

  const addGaussian = (
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    pitch: number, yaw: number, roll: number,
    r: number, g: number, b: number,
    alpha: number
  ) => {
    if (oIdx >= count) return;

    positions[pIdx++] = x;
    positions[pIdx++] = y;
    positions[pIdx++] = z;

    scales[sIdx++] = sx;
    scales[sIdx++] = sy;
    scales[sIdx++] = sz;

    euler.set(pitch, yaw, roll);
    q.setFromEuler(euler);
    rotations[rIdx++] = q.w;
    rotations[rIdx++] = q.x;
    rotations[rIdx++] = q.y;
    rotations[rIdx++] = q.z;

    colors[cIdx++] = Math.min(1.0, Math.max(0.0, r));
    colors[cIdx++] = Math.min(1.0, Math.max(0.0, g));
    colors[cIdx++] = Math.min(1.0, Math.max(0.0, b));

    opacities[oIdx++] = Math.min(1.0, Math.max(0.05, alpha));
  };

  if (presetId === 'motorcycle') {
    // 1. Two Wheels (Tires & Rims)
    const wheelRadius = 0.55;
    const wheelWidth = 0.14;
    const centers = [
      { x: -0.9, y: 0.55, z: 0.0 }, // Front wheel
      { x: 0.9, y: 0.55, z: 0.0 },  // Rear wheel
    ];

    centers.forEach((center) => {
      // Tire circumference
      const tireSteps = 3000;
      for (let i = 0; i < tireSteps; i++) {
        const theta = (i / tireSteps) * Math.PI * 2;
        const r = wheelRadius + (Math.random() - 0.5) * 0.04;
        const w = (Math.random() - 0.5) * wheelWidth;
        const x = center.x + Math.sin(theta) * r;
        const y = center.y + Math.cos(theta) * r;
        const z = center.z + w;
        const s = 0.015 + Math.random() * 0.012;
        addGaussian(x, y, z, s * 2.5, s * 0.8, s * 1.5, theta, 0, 0, 0.12, 0.12, 0.13, 0.9);
      }
      // Chrome spokes
      for (let i = 0; i < 40; i++) {
        const theta = (i / 40) * Math.PI * 2;
        for (let j = 0; j < 40; j++) {
          const frac = j / 40;
          const x = center.x + Math.sin(theta) * wheelRadius * frac;
          const y = center.y + Math.cos(theta) * wheelRadius * frac;
          const z = center.z + (Math.random() - 0.5) * 0.03;
          addGaussian(x, y, z, 0.008, 0.02, 0.008, theta, 0, 0, 0.85, 0.87, 0.9, 0.85);
        }
      }
    });

    // 2. Fuel Tank (Sculpted Metallic Silver / Gunmetal)
    for (let i = 0; i < 8000; i++) {
      const u = (Math.random() - 0.5) * 0.7; // length
      const v = Math.random() * Math.PI;
      const r = 0.22 * Math.sin(v);
      const x = -0.15 + u;
      const y = 1.05 + Math.cos(v) * 0.15;
      const z = Math.sin(v) * (Math.random() - 0.5) * 0.35;
      const noise = (Math.random() - 0.5) * 0.02;
      // Gunmetal silver with warm highlight
      const highlight = Math.max(0, y - 1.0);
      addGaussian(
        x + noise, y + noise, z + noise,
        0.022, 0.016, 0.028,
        0, Math.sin(u) * 0.4, 0,
        0.58 + highlight * 0.3, 0.62 + highlight * 0.3, 0.68 + highlight * 0.3,
        0.95
      );
    }

    // 3. Leather Cafe Seat
    for (let i = 0; i < 6000; i++) {
      const x = 0.45 + (Math.random() - 0.5) * 0.55;
      const y = 0.98 + (Math.random() - 0.5) * 0.06;
      const z = (Math.random() - 0.5) * 0.28;
      addGaussian(x, y, z, 0.02, 0.015, 0.022, 0, 0, 0, 0.18, 0.12, 0.09, 0.92);
    }

    // 4. Engine Block, Carburetor & Cooling Fins
    for (let i = 0; i < 14000; i++) {
      const x = (Math.random() - 0.5) * 0.5;
      const y = 0.62 + (Math.random() - 0.5) * 0.35;
      const z = (Math.random() - 0.5) * 0.32;
      const isFin = Math.sin(y * 80.0) > 0.3;
      const bright = isFin ? 0.75 : 0.32;
      addGaussian(x, y, z, 0.018, 0.008, 0.02, 0, 0, 0, bright, bright * 1.02, bright * 1.05, 0.9);
    }

    // 5. Chrome Exhaust Pipe
    for (let i = 0; i < 5000; i++) {
      const t = i / 5000;
      const x = -0.1 + t * 1.3;
      const y = 0.42 - Math.sin(t * Math.PI * 0.8) * 0.12 + (Math.random() - 0.5) * 0.04;
      const z = 0.22 + (Math.random() - 0.5) * 0.04;
      addGaussian(x, y, z, 0.02, 0.02, 0.02, 0, 0, t, 0.92, 0.93, 0.96, 0.95);
    }

    // 6. Handlebars & Headlight
    for (let i = 0; i < 4000; i++) {
      const u = (Math.random() - 0.5) * 0.7;
      const x = -0.72 + (Math.random() - 0.5) * 0.04;
      const y = 1.15 + (Math.random() - 0.5) * 0.04;
      const z = u;
      addGaussian(x, y, z, 0.012, 0.012, 0.025, 0, 0, 0, 0.25, 0.25, 0.28, 0.92);
    }

    // 7. Ground Plane / Studio Floor Shadow & Radiance
    for (let i = 0; i < 18000; i++) {
      const r = Math.sqrt(Math.random()) * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = 0.005 + (Math.random() - 0.5) * 0.008;

      // Contact shadow under motorcycle
      const isUnderBike = Math.abs(z) < 0.35 && Math.abs(x) < 1.2;
      const shadow = isUnderBike ? 0.06 : 0.18 + (1.0 - r / 2.8) * 0.12;

      addGaussian(x, y, z, 0.06, 0.004, 0.06, 0, theta, 0, shadow, shadow * 1.05, shadow * 1.12, isUnderBike ? 0.85 : 0.45);
    }
  } else if (presetId === 'marble_statue') {
    // Neoclassical Marble Bust
    // 1. Classical Pedestal Base
    for (let i = 0; i < 10000; i++) {
      const y = 0.1 + Math.random() * 0.45;
      const r = 0.35 + (y < 0.18 ? 0.08 : 0);
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * r * (0.8 + Math.random() * 0.2);
      const z = Math.sin(angle) * r * (0.8 + Math.random() * 0.2);
      addGaussian(x, y, z, 0.025, 0.018, 0.025, 0, angle, 0, 0.28, 0.29, 0.31, 0.92);
    }

    // 2. Draped Toga / Torso
    for (let i = 0; i < 18000; i++) {
      const y = 0.55 + Math.random() * 0.55;
      const w = 0.55 * (1.1 - (y - 0.55) * 0.4);
      const theta = (Math.random() - 0.5) * Math.PI * 1.3;
      const fold = Math.sin(theta * 6.0 + y * 12.0) * 0.04;
      const r = (w + fold);
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * (r * 0.65);
      // Soft translucent marble warm hue
      const marble = 0.82 + Math.random() * 0.12;
      addGaussian(x, y, z, 0.022, 0.02, 0.028, fold * 5.0, theta, 0, marble, marble * 0.96, marble * 0.9, 0.94);
    }

    // 3. Head & Face (Features: nose, chin, cheeks, brow)
    for (let i = 0; i < 22000; i++) {
      const phi = Math.random() * Math.PI;
      const theta = Math.random() * Math.PI * 2;
      let r = 0.28;
      // Head elongation
      const y = 1.35 + Math.cos(phi) * (r * 1.25);
      let x = Math.sin(phi) * Math.cos(theta) * (r * 0.92);
      let z = Math.sin(phi) * Math.sin(theta) * (r * 1.05);

      // Carve nose bridge
      if (z > 0.18 && Math.abs(x) < 0.06 && y > 1.25 && y < 1.42) {
        z += 0.08;
      }

      const light = 0.88 + Math.sin(theta) * 0.08;
      addGaussian(x, y, z, 0.016, 0.016, 0.016, 0, theta, 0, light, light * 0.96, light * 0.91, 0.96);
    }

    // 4. Intricate Curly Roman Hair & Beard
    for (let i = 0; i < 16000; i++) {
      const angle = Math.random() * Math.PI * 2;
      const y = 1.2 + Math.random() * 0.45;
      const curl = Math.sin(angle * 18.0 + y * 20.0) * 0.035;
      const r = 0.31 + curl;
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;
      const shade = 0.74 + Math.random() * 0.15;
      addGaussian(x, y, z, 0.014, 0.014, 0.02, curl * 4.0, angle, 0, shade, shade * 0.94, shade * 0.88, 0.95);
    }
  } else if (presetId === 'cyberpunk_alley') {
    // Wet asphalt floor with neon color reflections
    for (let i = 0; i < 22000; i++) {
      const x = (Math.random() - 0.5) * 4.0;
      const z = (Math.random() - 0.5) * 8.0;
      const y = 0.005 + (Math.random() - 0.5) * 0.01;

      // Wet reflections: puddles reflect magenta / cyan neon signs
      const isPuddle = Math.sin(x * 3.0) * Math.cos(z * 2.0) > 0.1;
      let r = 0.05, g = 0.05, b = 0.06;
      if (isPuddle) {
        if (x < 0) {
          // Magenta neon reflection
          r = 0.65; g = 0.08; b = 0.45;
        } else {
          // Electric Cyan reflection
          r = 0.05; g = 0.55; b = 0.68;
        }
      }
      addGaussian(x, y, z, 0.07, 0.004, 0.07, 0, 0, 0, r, g, b, isPuddle ? 0.9 : 0.5);
    }

    // Brick Building Walls on left and right
    for (let i = 0; i < 28000; i++) {
      const side = Math.random() > 0.5 ? -1.8 : 1.8;
      const x = side + (Math.random() - 0.5) * 0.4;
      const y = Math.random() * 4.5;
      const z = (Math.random() - 0.5) * 7.5;
      const isWallShade = 0.12 + Math.random() * 0.1;
      addGaussian(x, y, z, 0.03, 0.02, 0.03, 0, 0, 0, isWallShade * 1.1, isWallShade, isWallShade * 1.05, 0.85);
    }

    // Glowing Neon Signs (Kanji / Arcade / Ramen)
    const signs = [
      { x: -1.4, y: 2.2, z: -1.2, r: 1.0, g: 0.1, b: 0.5 }, // Ramen Neon Magenta
      { x: -1.3, y: 3.1, z: 1.0,  r: 0.1, g: 0.8, b: 1.0 }, // Cyan Cybernetics
      { x: 1.4,  y: 2.5, z: -0.5, r: 0.2, g: 1.0, b: 0.4 }, // Green Bar
      { x: 1.3,  y: 1.8, z: 1.5,  r: 1.0, g: 0.6, b: 0.1 }, // Amber Izakaya
    ];

    signs.forEach((sign) => {
      for (let i = 0; i < 3500; i++) {
        const sx = sign.x + (Math.random() - 0.5) * 0.1;
        const sy = sign.y + (Math.random() - 0.5) * 0.9;
        const sz = sign.z + (Math.random() - 0.5) * 0.6;
        addGaussian(sx, sy, sz, 0.018, 0.018, 0.018, 0, 0, 0, sign.r, sign.g, sign.b, 0.98);
      }
    });

    // Atmospheric volumetric drizzle & steam splats
    for (let i = 0; i < 14000; i++) {
      const x = (Math.random() - 0.5) * 3.0;
      const y = Math.random() * 3.5;
      const z = (Math.random() - 0.5) * 6.0;
      addGaussian(x, y, z, 0.05, 0.05, 0.05, 0, 0, 0, 0.15, 0.18, 0.25, 0.12);
    }
  } else {
    // Gothic Cathedral Ruins
    // 1. Ribbed Stone Columns & Arches
    const columns = [
      { x: -1.2, z: -1.5 }, { x: -1.2, z: 0.0 }, { x: -1.2, z: 1.5 },
      { x:  1.2, z: -1.5 }, { x:  1.2, z: 0.0 }, { x:  1.2, z: 1.5 },
    ];

    columns.forEach((col) => {
      for (let i = 0; i < 4000; i++) {
        const y = Math.random() * 3.8;
        const r = 0.22 + Math.sin(y * 8.0) * 0.03;
        const angle = Math.random() * Math.PI * 2;
        const x = col.x + Math.sin(angle) * r;
        const z = col.z + Math.cos(angle) * r;
        // Weathered limestone
        const stone = 0.45 + Math.random() * 0.18;
        addGaussian(x, y, z, 0.024, 0.02, 0.024, 0, angle, 0, stone * 1.1, stone, stone * 0.85, 0.92);
      }
    });

    // 2. Gothic Pointed Arches connecting columns
    for (let i = 0; i < 16000; i++) {
      const t = Math.random();
      const x = (t - 0.5) * 2.4;
      const archHeight = 3.6 + (1.0 - Math.abs(t - 0.5) * 2.0) * 1.2;
      const y = archHeight + (Math.random() - 0.5) * 0.15;
      const z = (Math.floor(Math.random() * 3) - 1) * 1.5 + (Math.random() - 0.5) * 0.2;
      addGaussian(x, y, z, 0.028, 0.028, 0.028, 0, 0, 0, 0.6, 0.55, 0.45, 0.9);
    }

    // 3. Overgrown Ivy & Moss Splats (Emerald & Olive Green)
    for (let i = 0; i < 18000; i++) {
      const col = columns[Math.floor(Math.random() * columns.length)];
      const y = Math.random() * 2.8;
      const angle = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.08;
      const x = col.x + Math.sin(angle) * r;
      const z = col.z + Math.cos(angle) * r;
      // Lush vegetation colors
      const g = 0.45 + Math.random() * 0.25;
      addGaussian(x, y, z, 0.018, 0.022, 0.014, Math.random(), angle, 0, 0.18, g, 0.12, 0.94);
    }

    // 4. Ground Flagstones & Fallen Rubble
    for (let i = 0; i < 18000; i++) {
      const r = Math.sqrt(Math.random()) * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = (Math.random() - 0.5) * 0.04;
      const isStone = (Math.sin(x * 6.0) * Math.cos(z * 6.0) > 0.0);
      const shade = isStone ? 0.38 : 0.28;
      addGaussian(x, y, z, 0.05, 0.006, 0.05, 0, theta, 0, shade * 0.95, shade * 1.05, shade * 0.85, 0.8);
    }
  }

  // Fill remaining budget if any with soft background tie points
  while (oIdx < count) {
    const rx = (Math.random() - 0.5) * 3.0;
    const ry = Math.random() * 2.5;
    const rz = (Math.random() - 0.5) * 3.0;
    addGaussian(rx, ry, rz, 0.015, 0.015, 0.015, 0, 0, 0, 0.5, 0.5, 0.5, 0.5);
  }

  return {
    count,
    positions,
    scales,
    rotations,
    colors,
    opacities,
  };
}

/**
 * Generates the camera trajectory orbit / spiral with estimated poses,
 * frustum targets, and reprojection error statistics.
 */
export function generateCameraTrajectory(presetId: string, framesCount: number = 36): CameraPose[] {
  const poses: CameraPose[] = [];

  for (let i = 0; i < framesCount; i++) {
    const frac = i / framesCount;
    let x = 0, y = 0, z = 0;
    let targetX = 0, targetY = 0.8, targetZ = 0;

    if (presetId === 'motorcycle') {
      const radius = 2.4 + Math.sin(frac * Math.PI * 4) * 0.15;
      const theta = frac * Math.PI * 2;
      x = Math.sin(theta) * radius;
      y = 0.9 + Math.cos(frac * Math.PI * 2) * 0.35;
      z = Math.cos(theta) * radius;
      targetY = 0.7;
    } else if (presetId === 'marble_statue') {
      // Spiral upward scan
      const radius = 1.6 - frac * 0.2;
      const theta = frac * Math.PI * 4; // 2 full loops
      x = Math.sin(theta) * radius;
      y = 0.6 + frac * 1.0;
      z = Math.cos(theta) * radius;
      targetY = 1.1;
    } else if (presetId === 'cyberpunk_alley') {
      // Walkthrough along z-axis
      const zProgress = (frac - 0.5) * 6.0;
      x = Math.sin(frac * Math.PI * 3) * 0.4;
      y = 1.6 + Math.cos(frac * Math.PI * 6) * 0.05;
      z = zProgress;
      targetZ = zProgress + 2.0;
      targetY = 1.8;
    } else {
      // Drone high elliptical survey
      const radius = 4.2;
      const theta = frac * Math.PI * 2;
      x = Math.sin(theta) * radius;
      y = 3.2 + Math.sin(frac * Math.PI * 2) * 0.8;
      z = Math.cos(theta) * radius;
      targetY = 1.5;
    }

    poses.push({
      id: `cam_${i + 1}`,
      index: i + 1,
      name: `DSC_${1000 + i * 4}.RAW`,
      position: [Number(x.toFixed(3)), Number(y.toFixed(3)), Number(z.toFixed(3))],
      target: [Number(targetX.toFixed(3)), Number(targetY.toFixed(3)), Number(targetZ.toFixed(3))],
      fov: 52,
      reprojectionError: Number((0.24 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 0.28).toFixed(2)),
      inliersCount: Math.floor(1800 + Math.random() * 1200),
      frameTimestamp: frac * 12.0,
    });
  }

  return poses;
}

/**
 * Creates initial sparse tie points (SfM point cloud) for training step 0
 */
export function generateSparseTiePoints(fullCloud: GaussianCloud, sparseRatio: number = 0.08): GaussianCloud {
  const sparseCount = Math.floor(fullCloud.count * sparseRatio);
  const positions = new Float32Array(sparseCount * 3);
  const scales = new Float32Array(sparseCount * 3);
  const rotations = new Float32Array(sparseCount * 4);
  const colors = new Float32Array(sparseCount * 3);
  const opacities = new Float32Array(sparseCount);

  const step = Math.floor(fullCloud.count / sparseCount);

  for (let i = 0; i < sparseCount; i++) {
    const src = i * step;
    positions[i * 3] = fullCloud.positions[src * 3];
    positions[i * 3 + 1] = fullCloud.positions[src * 3 + 1];
    positions[i * 3 + 2] = fullCloud.positions[src * 3 + 2];

    // Sparse tie points have larger fuzzy radius
    scales[i * 3] = fullCloud.scales[src * 3] * 2.8;
    scales[i * 3 + 1] = fullCloud.scales[src * 3 + 1] * 2.8;
    scales[i * 3 + 2] = fullCloud.scales[src * 3 + 2] * 2.8;

    rotations[i * 4] = fullCloud.rotations[src * 4];
    rotations[i * 4 + 1] = fullCloud.rotations[src * 4 + 1];
    rotations[i * 4 + 2] = fullCloud.rotations[src * 4 + 2];
    rotations[i * 4 + 3] = fullCloud.rotations[src * 4 + 3];

    colors[i * 3] = fullCloud.colors[src * 3];
    colors[i * 3 + 1] = fullCloud.colors[src * 3 + 1];
    colors[i * 3 + 2] = fullCloud.colors[src * 3 + 2];

    opacities[i] = 0.55;
  }

  return {
    count: sparseCount,
    positions,
    scales,
    rotations,
    colors,
    opacities,
  };
}
