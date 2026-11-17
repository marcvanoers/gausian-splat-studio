declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three';

  export enum SceneFormat {
    Splat = 0,
    KSplat = 1,
    Ply = 2,
    Spz = 3,
  }

  export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
    Debug = 4,
  }

  export enum RenderMode {
    Always = 0,
    OnChange = 1,
    Never = 2,
  }

  export enum SplatRenderMode {
    ThreeD = 0,
    TwoD = 1,
  }

  export interface ViewerOptions {
    rootElement?: HTMLElement | null;
    camera?: THREE.PerspectiveCamera | THREE.Camera;
    renderer?: THREE.WebGLRenderer;
    cameraUp?: [number, number, number];
    initialCameraPosition?: [number, number, number];
    initialCameraLookAt?: [number, number, number];
    dropInMode?: boolean;
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    sharedMemoryForWorkers?: boolean;
    gpuAcceleratedSort?: boolean;
    integerBasedSort?: boolean;
    halfPrecisionCovariancesOnGPU?: boolean;
    devicePixelRatio?: number;
    antialiased?: boolean;
    splatAlphaRemovalThreshold?: number;
    logLevel?: LogLevel;
    sphericalHarmonicsDegree?: number;
  }

  export interface AddSplatSceneOptions {
    format?: SceneFormat;
    splatAlphaRemovalThreshold?: number;
    showLoadingUI?: boolean;
    position?: [number, number, number];
    rotation?: [number, number, number, number] | THREE.Quaternion;
    scale?: [number, number, number];
    progressiveLoad?: boolean;
    onProgress?: (percent: number, percentLabel: string, loaderStatus: any) => void;
  }

  export class SplatMesh extends THREE.Mesh {
    scenes: any[];
    getSplatCount(): number;
    getMaxSplatCount(): number;
    material: THREE.ShaderMaterial;
    splatRenderMode: SplatRenderMode;
    setSplatScale(scale: number): void;
    getSplatScale(): number;
    setPointCloudModeEnabled(enabled: boolean): void;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    threeScene: THREE.Scene;
    controls: any;
    splatMesh: SplatMesh;
    splatAlphaRemovalThreshold: number;
    init(): void;
    start(): void;
    stop(): void;
    dispose(): Promise<void>;
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>;
    removeSplatScene(index: number, showLoadingUI?: boolean): Promise<void>;
    removeSplatScenes(indexes: number[], showLoadingUI?: boolean): Promise<void>;
    getSplatMesh(): SplatMesh;
    getSceneCount(): number;
    setRenderMode(renderMode: RenderMode): void;
    setActiveSphericalHarmonicsDegrees(degrees: number): void;
    update(renderer?: THREE.WebGLRenderer, camera?: THREE.Camera): void;
    forceRenderNextFrame(): void;
  }

  export class DropInViewer extends THREE.Group {
    constructor(options?: ViewerOptions);
    viewer: Viewer;
    splatMesh: SplatMesh | null;
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>;
    removeSplatScene(index: number): Promise<void>;
    dispose(): void;
  }

  export class PlyParser {
    static parseToUncompressedSplatArray(plyBuffer: ArrayBuffer, outSphericalHarmonicsDegree?: number): any;
    static parseToUncompressedSplatBuffer(plyBuffer: ArrayBuffer, outSphericalHarmonicsDegree?: number): any;
  }

  export class SplatParser {
    static parseStandardSplatToUncompressedSplatArray(splatBuffer: ArrayBuffer): any;
  }

  export class PlyLoader {
    static loadFromFileData(data: ArrayBuffer, ...args: any[]): Promise<any>;
    static loadFromURL(url: string, ...args: any[]): Promise<any>;
  }

  export class SplatLoader {
    static loadFromFileData(data: ArrayBuffer, ...args: any[]): Promise<any>;
    static loadFromURL(url: string, ...args: any[]): Promise<any>;
  }

  export class SplatBuffer {
    getSplatCount(): number;
  }
}
