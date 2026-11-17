/**
 * Postshot 3D Gaussian Splatting Optimization & Densification Engine
 * Simulates progressive iterative training (steps 0 to 30,000),
 * adaptive densification, splitting, cloning, floater pruning,
 * and loss/PSNR metric convergence.
 */

import { GaussianCloud, TrainingState } from '../types/gaussian';
import { selectHarmonics } from './plySplatIO';

export class TrainingEngine {
  private fullCloud: GaussianCloud;
  private currentCloud: GaussianCloud;
  private state: TrainingState;
  private onStateChange: (state: TrainingState, cloud: GaussianCloud) => void;
  private intervalId: number | null = null;

  constructor(
    fullCloud: GaussianCloud,
    onStateChange: (state: TrainingState, cloud: GaussianCloud) => void
  ) {
    this.fullCloud = fullCloud;
    this.onStateChange = onStateChange;

    // Start with fully-converged state by default for instant gratification
    this.state = {
      step: 15000,
      maxSteps: 30000,
      isTraining: false,
      loss: 0.024,
      psnr: 31.8,
      activeGaussians: fullCloud.count,
      lossHistory: [0.42, 0.28, 0.16, 0.09, 0.055, 0.038, 0.028, 0.024],
      psnrHistory: [14.5, 18.2, 22.8, 26.4, 28.9, 30.2, 31.2, 31.8],
      densifyInterval: 500,
      pruneThreshold: 0.05,
    };

    this.currentCloud = this.fullCloud;
  }

  public getState(): TrainingState {
    return { ...this.state };
  }

  public getCloud(): GaussianCloud {
    return this.currentCloud;
  }

  public setFullCloud(newFullCloud: GaussianCloud) {
    this.fullCloud = newFullCloud;
    this.currentCloud = newFullCloud;
    this.state.activeGaussians = newFullCloud.count;
    this.state.step = 15000;
    this.state.isTraining = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onStateChange(this.state, this.currentCloud);
  }

  public startTraining(speedStepsPerSec: number = 250) {
    if (this.state.isTraining) return;

    this.state.isTraining = true;
    this.onStateChange(this.state, this.currentCloud);

    const tickMs = 50;
    const stepsPerTick = Math.max(10, Math.floor((speedStepsPerSec * tickMs) / 1000));

    this.intervalId = window.setInterval(() => {
      this.stepTraining(stepsPerTick);
      if (this.state.step >= this.state.maxSteps) {
        this.pauseTraining();
      }
    }, tickMs);
  }

  public pauseTraining() {
    this.state.isTraining = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onStateChange(this.state, this.currentCloud);
  }

  public resetToSparse() {
    this.pauseTraining();
    this.state.step = 0;
    this.state.loss = 0.45;
    this.state.psnr = 13.8;
    this.state.lossHistory = [0.45];
    this.state.psnrHistory = [13.8];

    // Subsample sparse tie points (8% of total)
    const sparseRatio = 0.08;
    const sparseCount = Math.floor(this.fullCloud.count * sparseRatio);
    const subCloud = this.sliceCloud(this.fullCloud, sparseCount, true);
    this.currentCloud = subCloud;
    this.state.activeGaussians = sparseCount;

    this.onStateChange(this.state, this.currentCloud);
  }

  public stepTraining(deltaSteps: number = 200) {
    const nextStep = Math.min(this.state.maxSteps, this.state.step + deltaSteps);
    this.state.step = nextStep;

    const progress = nextStep / this.state.maxSteps;

    // Realistic exponential decay for L1 + D-SSIM loss
    this.state.loss = Number((0.015 + 0.43 * Math.exp(-progress * 5.0)).toFixed(4));
    // Logarithmic increase for PSNR
    this.state.psnr = Number((14.0 + 19.5 * Math.log10(1 + progress * 9.0)).toFixed(1));

    if (this.state.step % 500 < deltaSteps) {
      this.state.lossHistory.push(this.state.loss);
      if (this.state.lossHistory.length > 30) this.state.lossHistory.shift();

      this.state.psnrHistory.push(this.state.psnr);
      if (this.state.psnrHistory.length > 30) this.state.psnrHistory.shift();
    }

    // Densification: dynamically scale cloud size from 8% to 100%
    const currentRatio = 0.08 + 0.92 * Math.min(1.0, progress * 1.5);
    const targetCount = Math.floor(this.fullCloud.count * currentRatio);

    if (Math.abs(targetCount - this.currentCloud.count) > 1000 || nextStep >= this.state.maxSteps) {
      this.currentCloud = this.sliceCloud(this.fullCloud, targetCount, progress < 0.3);
      this.state.activeGaussians = this.currentCloud.count;
    }

    this.onStateChange(this.state, this.currentCloud);
  }

  private sliceCloud(source: GaussianCloud, count: number, isSparse: boolean): GaussianCloud {
    const safeCount = Math.min(source.count, count);
    const positions = new Float32Array(safeCount * 3);
    const scales = new Float32Array(safeCount * 3);
    const rotations = new Float32Array(safeCount * 4);
    const colors = new Float32Array(safeCount * 3);
    const opacities = new Float32Array(safeCount);

    positions.set(source.positions.subarray(0, safeCount * 3));
    rotations.set(source.rotations.subarray(0, safeCount * 4));
    colors.set(source.colors.subarray(0, safeCount * 3));
    opacities.set(source.opacities.subarray(0, safeCount));

    // If early training, blur/enlarge scales
    const scaleFactor = isSparse ? 2.5 : 1.0;
    const srcScales = source.scales;
    for (let i = 0; i < safeCount * 3; i++) {
      scales[i] = srcScales[i] * scaleFactor;
    }

    return {
      count: safeCount,
      positions,
      scales,
      rotations,
      colors,
      opacities,
      harmonics: source.harmonics
        ? source.harmonics.slice(0, safeCount * Math.floor(source.harmonics.length / source.count))
        : undefined,
      bounds: source.bounds,
    };
  }

  public pruneFloaters(threshold: number = 0.15): number {
    const count = this.currentCloud.count;
    const opacities = this.currentCloud.opacities;

    const keptIndices: number[] = [];
    for (let i = 0; i < count; i++) {
      if (opacities[i] >= threshold) {
        keptIndices.push(i);
      }
    }

    const prunedCount = count - keptIndices.length;
    if (prunedCount <= 0) return 0;

    const newCount = keptIndices.length;
    const positions = new Float32Array(newCount * 3);
    const scales = new Float32Array(newCount * 3);
    const rotations = new Float32Array(newCount * 4);
    const colors = new Float32Array(newCount * 3);
    const newOpacities = new Float32Array(newCount);

    const oldPos = this.currentCloud.positions;
    const oldScales = this.currentCloud.scales;
    const oldRot = this.currentCloud.rotations;
    const oldCol = this.currentCloud.colors;

    for (let i = 0; i < newCount; i++) {
      const src = keptIndices[i];
      positions[i * 3] = oldPos[src * 3];
      positions[i * 3 + 1] = oldPos[src * 3 + 1];
      positions[i * 3 + 2] = oldPos[src * 3 + 2];

      scales[i * 3] = oldScales[src * 3];
      scales[i * 3 + 1] = oldScales[src * 3 + 1];
      scales[i * 3 + 2] = oldScales[src * 3 + 2];

      rotations[i * 4] = oldRot[src * 4];
      rotations[i * 4 + 1] = oldRot[src * 4 + 1];
      rotations[i * 4 + 2] = oldRot[src * 4 + 2];
      rotations[i * 4 + 3] = oldRot[src * 4 + 3];

      colors[i * 3] = oldCol[src * 3];
      colors[i * 3 + 1] = oldCol[src * 3 + 1];
      colors[i * 3 + 2] = oldCol[src * 3 + 2];

      newOpacities[i] = opacities[src];
    }

    this.currentCloud = {
      count: newCount,
      positions,
      scales,
      rotations,
      colors,
      opacities: newOpacities,
      harmonics: selectHarmonics(this.currentCloud, keptIndices),
      bounds: this.currentCloud.bounds,
    };
    this.state.activeGaussians = newCount;
    this.onStateChange(this.state, this.currentCloud);

    return prunedCount;
  }
}
