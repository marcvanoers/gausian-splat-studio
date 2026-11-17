/**
 * Instanced Gaussian Splat Mesh & Geometry Builder for Three.js
 */

import * as THREE from 'three';
import { GaussianCloud, RenderMode, SplatViewSettings, CropBox } from '../types/gaussian';
import { splatVertexShader, splatFragmentShader } from './splatShader';

export class SplatMeshManager {
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.InstancedBufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private currentCloud: GaussianCloud | null = null;

  // Sorting scratchpads
  private sortDepths: Float32Array = new Float32Array(0);
  private sortIndices: Int32Array = new Int32Array(0);
  private lastSortCameraPos: THREE.Vector3 = new THREE.Vector3();
  private lastSortCameraQuat: THREE.Quaternion = new THREE.Quaternion();

  public createMesh(cloud: GaussianCloud, viewSettings: SplatViewSettings, cropBox: CropBox): THREE.Mesh {
    this.dispose();
    this.currentCloud = cloud;

    const quadVertices = new Float32Array([
      -1.5, -1.5, 0.0,
       1.5, -1.5, 0.0,
       1.5,  1.5, 0.0,
      -1.5,  1.5, 0.0,
    ]);

    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(new THREE.BufferAttribute(quadIndices, 1));
    geometry.setAttribute('position', new THREE.BufferAttribute(quadVertices, 3));

    const budget = viewSettings.displayBudget || 450000;
    const step = cloud.count > budget ? Math.ceil(cloud.count / budget) : 1;
    const displayCount = Math.floor(cloud.count / step);

    let displayPositions = cloud.positions;
    let displayScales = cloud.scales;
    let displayRotations = cloud.rotations;
    let displayColors = cloud.colors;
    let displayOpacities = cloud.opacities;

    if (step > 1) {
      displayPositions = new Float32Array(displayCount * 3);
      displayScales = new Float32Array(displayCount * 3);
      displayRotations = new Float32Array(displayCount * 4);
      displayColors = new Float32Array(displayCount * 3);
      displayOpacities = new Float32Array(displayCount);

      for (let i = 0; i < displayCount; i++) {
        const src = i * step;
        displayPositions[i * 3] = cloud.positions[src * 3];
        displayPositions[i * 3 + 1] = cloud.positions[src * 3 + 1];
        displayPositions[i * 3 + 2] = cloud.positions[src * 3 + 2];

        displayScales[i * 3] = cloud.scales[src * 3];
        displayScales[i * 3 + 1] = cloud.scales[src * 3 + 1];
        displayScales[i * 3 + 2] = cloud.scales[src * 3 + 2];

        displayRotations[i * 4] = cloud.rotations[src * 4];
        displayRotations[i * 4 + 1] = cloud.rotations[src * 4 + 1];
        displayRotations[i * 4 + 2] = cloud.rotations[src * 4 + 2];
        displayRotations[i * 4 + 3] = cloud.rotations[src * 4 + 3];

        displayColors[i * 3] = cloud.colors[src * 3];
        displayColors[i * 3 + 1] = cloud.colors[src * 3 + 1];
        displayColors[i * 3 + 2] = cloud.colors[src * 3 + 2];

        displayOpacities[i] = cloud.opacities[src];
      }
    }

    // Instanced attributes
    geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(displayPositions, 3));
    geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(displayScales, 3));
    geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(displayRotations, 4));
    geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(displayColors, 3));
    geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(displayOpacities, 1));

    geometry.instanceCount = displayCount;

    const modeMap: Record<RenderMode, number> = {
      radiance: 0,
      pointcloud: 1,
      ellipsoids: 2,
      depth: 3,
      density: 4,
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: splatVertexShader,
      fragmentShader: splatFragmentShader,
      uniforms: {
        uViewportSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uFocalLength: { value: 600.0 },
        uSplatScale: { value: viewSettings.splatScale },
        uMaxSplatSize: { value: viewSettings.maxSplatSize ?? 2.0 },
        uOpacityMultiplier: { value: viewSettings.opacityMultiplier },
        uRenderMode: { value: modeMap['radiance'] },
        uCropEnabled: { value: cropBox.enabled },
        uCropMin: { value: new THREE.Vector3(...cropBox.min) },
        uCropMax: { value: new THREE.Vector3(...cropBox.max) },
        uFloorClipY: { value: cropBox.floorClipY ?? -999.0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;

    this.mesh = mesh;
    this.geometry = geometry;
    this.material = material;

    // Initialize sorting buffers for display count
    if (this.sortIndices.length < displayCount) {
      this.sortDepths = new Float32Array(displayCount);
      this.sortIndices = new Int32Array(displayCount);
    }
    for (let i = 0; i < displayCount; i++) {
      this.sortIndices[i] = i;
    }

    return mesh;
  }

  public updateUniforms(
    rendererWidth: number,
    rendererHeight: number,
    cameraFov: number,
    viewSettings: SplatViewSettings,
    cropBox: CropBox,
    renderMode: RenderMode
  ) {
    if (!this.material) return;

    const modeMap: Record<RenderMode, number> = {
      radiance: 0,
      pointcloud: 1,
      ellipsoids: 2,
      depth: 3,
      density: 4,
    };

    const fy = (rendererHeight / 2) / Math.tan(THREE.MathUtils.degToRad(cameraFov / 2));

    this.material.uniforms.uViewportSize.value.set(rendererWidth, rendererHeight);
    this.material.uniforms.uFocalLength.value = fy;
    this.material.uniforms.uSplatScale.value = viewSettings.splatScale;
    this.material.uniforms.uMaxSplatSize.value = viewSettings.maxSplatSize ?? 2.0;
    this.material.uniforms.uOpacityMultiplier.value = viewSettings.opacityMultiplier;
    this.material.uniforms.uRenderMode.value = modeMap[renderMode] ?? 0;

    this.material.uniforms.uCropEnabled.value = cropBox.enabled;
    this.material.uniforms.uCropMin.value.set(...cropBox.min);
    this.material.uniforms.uCropMax.value.set(...cropBox.max);
    this.material.uniforms.uFloorClipY.value = cropBox.floorClipY ?? -999.0;
  }

  public updateData(cloud: GaussianCloud) {
    if (!this.geometry) return;
    this.currentCloud = cloud;

    this.geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(cloud.positions, 3));
    this.geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(cloud.scales, 3));
    this.geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(cloud.rotations, 4));
    this.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(cloud.colors, 3));
    this.geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(cloud.opacities, 1));

    this.geometry.instanceCount = cloud.count;

    if (this.sortIndices.length < cloud.count) {
      this.sortDepths = new Float32Array(cloud.count);
      this.sortIndices = new Int32Array(cloud.count);
    }
  }

  /**
   * Sort splats from back to front along camera view direction
   * for accurate volumetric alpha blending. Throttled to prevent frame drops.
   */
  public sortSplats(camera: THREE.Camera, force: boolean = false) {
    if (!this.currentCloud || !this.geometry || this.geometry.instanceCount === 0) return;

    const count = this.geometry.instanceCount;
    // Don't run main-thread JavaScript sorting on over 80,000 instances
    if (count > 80000) return;

    // Check if camera moved enough to justify sorting
    const dist = camera.position.distanceTo(this.lastSortCameraPos);
    const quatAngle = camera.quaternion.angleTo(this.lastSortCameraQuat);
    if (!force && dist < 0.08 && quatAngle < 0.05) {
      return;
    }
    this.lastSortCameraPos.copy(camera.position);
    this.lastSortCameraQuat.copy(camera.quaternion);

    const posAttr = this.geometry.getAttribute('instancePosition') as THREE.InstancedBufferAttribute;
    const pos = posAttr.array as Float32Array;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const fx = forward.x;
    const fy = forward.y;
    const fz = forward.z;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const dx = pos[idx] - cx;
      const dy = pos[idx + 1] - cy;
      const dz = pos[idx + 2] - cz;
      this.sortDepths[i] = dx * fx + dy * fy + dz * fz;
      this.sortIndices[i] = i;
    }

    const indices = this.sortIndices;
    const depths = this.sortDepths;

    indices.subarray(0, count).sort((a, b) => depths[b] - depths[a]);
    this.reorderBufferAttributes(indices, count);
  }

  private reorderBufferAttributes(indices: Int32Array, count: number) {
    if (!this.geometry || !this.currentCloud) return;

    const posAttr = this.geometry.getAttribute('instancePosition') as THREE.InstancedBufferAttribute;
    const scaleAttr = this.geometry.getAttribute('instanceScale') as THREE.InstancedBufferAttribute;
    const rotAttr = this.geometry.getAttribute('instanceRotation') as THREE.InstancedBufferAttribute;
    const colAttr = this.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;
    const opAttr = this.geometry.getAttribute('instanceOpacity') as THREE.InstancedBufferAttribute;

    const origPos = this.currentCloud.positions;
    const origScale = this.currentCloud.scales;
    const origRot = this.currentCloud.rotations;
    const origCol = this.currentCloud.colors;
    const origOp = this.currentCloud.opacities;

    const pArray = posAttr.array as Float32Array;
    const sArray = scaleAttr.array as Float32Array;
    const rArray = rotAttr.array as Float32Array;
    const cArray = colAttr.array as Float32Array;
    const oArray = opAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const src = indices[i];
      const src3 = src * 3;
      const dst3 = i * 3;
      const src4 = src * 4;
      const dst4 = i * 4;

      pArray[dst3] = origPos[src3];
      pArray[dst3 + 1] = origPos[src3 + 1];
      pArray[dst3 + 2] = origPos[src3 + 2];

      sArray[dst3] = origScale[src3];
      sArray[dst3 + 1] = origScale[src3 + 1];
      sArray[dst3 + 2] = origScale[src3 + 2];

      rArray[dst4] = origRot[src4];
      rArray[dst4 + 1] = origRot[src4 + 1];
      rArray[dst4 + 2] = origRot[src4 + 2];
      rArray[dst4 + 3] = origRot[src4 + 3];

      cArray[dst3] = origCol[src3];
      cArray[dst3 + 1] = origCol[src3 + 1];
      cArray[dst3 + 2] = origCol[src3 + 2];

      oArray[i] = origOp[src];
    }

    posAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
    rotAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    opAttr.needsUpdate = true;
  }

  public dispose() {
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    this.mesh = null;
    this.currentCloud = null;
  }
}
