import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { calculateOrbitalPosition, calculateGrid, getAlphaBoundingBox, getFittingScale, mergeBounds, calculateGroundingOffset } from './math.js';
export * from './ui/BillboardBackerUI.js';

export interface BakeOptions {
  model: THREE.Object3D | string;
  frameCount: number;
  distance?: number;
  elevation?: number; // In degrees
  resolution?: number; // Output size of each frame (e.g. 256)
  padding?: number; // Pixel gap between frames
  transparent?: boolean;
  includeTop?: boolean;
  includeBottom?: boolean;
  isAutoDistance?: boolean;
  margin?: number;
  zoom?: number; // Zoom multiplier (default 1.0)
  aspectRatio?: number; // width / height (default 1.0)
  isAutoAspect?: boolean;
  isGrounded?: boolean;
  verticalOffset?: number; // Internal or manual vertical shift
  onProgress?: (ratio: number) => void;
}

export class SpriteBaker {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private loader: GLTFLoader;
  private isInternalRenderer: boolean = false;
  private onWebGLContextLost: (e: Event) => void;
  private onWebGLContextRestored: () => void;

  constructor(renderer?: THREE.WebGLRenderer) {
    if (renderer) {
      this.renderer = renderer;
      this.isInternalRenderer = false;
    } else {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.isInternalRenderer = true;
    }
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.loader = new GLTFLoader();

    // Add default lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);

    // Context handling
    this.onWebGLContextLost = (e: Event) => {
      e.preventDefault();
      this.onContextLost?.();
    };

    this.onWebGLContextRestored = () => {
      this.onContextRestored?.();
    };

    this.renderer.getContext().canvas.addEventListener('webglcontextlost', this.onWebGLContextLost, false);
    this.renderer.getContext().canvas.addEventListener('webglcontextrestored', this.onWebGLContextRestored, false);
  }

  public onContextLost?: () => void;
  public onContextRestored?: () => void;

  public async bake(options: BakeOptions): Promise<string> {
    const {
      frameCount,
      distance = 5,
      elevation = 30,
      resolution = 256,
      padding = 0,
      transparent = true,
      includeTop = false,
      includeBottom = false,
      zoom = 1.0,
      aspectRatio = 1.0
    } = options;

    const frameW = Math.round(resolution * aspectRatio);
    const frameH = resolution;

    let object: THREE.Object3D;
    if (typeof options.model === 'string') {
      const gltf = await this.loader.loadAsync(options.model);
      object = gltf.scene;
    } else {
      object = options.model;
    }

    // Centering logic
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());

    this.scene.add(object);

    // Save state
    const originalSize = new THREE.Vector2();
    this.renderer.getSize(originalSize);
    const originalPixelRatio = this.renderer.getPixelRatio();
    const originalClearAlpha = this.renderer.getClearAlpha();

    try {
      this.renderer.setSize(frameW, frameH);
      this.renderer.setClearAlpha(transparent ? 0 : 1);
      this.camera.aspect = aspectRatio;
      this.camera.updateProjectionMatrix();

      const totalFrames = frameCount + (includeTop ? 1 : 0) + (includeBottom ? 1 : 0);
      const { rows, cols } = calculateGrid(totalFrames);
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = cols * frameW + (cols - 1) * padding;
      finalCanvas.height = rows * frameH + (rows - 1) * padding;
      const ctx = finalCanvas.getContext('2d')!;

      const elevationRad = THREE.MathUtils.degToRad(elevation);

      for (let i = 0; i < totalFrames; i++) {
        if (i < frameCount) {
          const azimuthRad = (i / frameCount) * Math.PI * 2;
          const pos = calculateOrbitalPosition(distance / zoom, azimuthRad, elevationRad, center);
          this.camera.position.set(pos.x, pos.y, pos.z);
        } else if (includeTop && i === frameCount) {
          this.camera.position.set(center.x, center.y + distance / zoom, center.z);
        } else {
          this.camera.position.set(center.x, center.y - distance / zoom, center.z);
        }

        const col = i % cols;
        const row = Math.floor(i / cols);

        const renderTarget = center.clone();
        if (options.verticalOffset) {
          renderTarget.y += options.verticalOffset;
        }

        this.camera.lookAt(renderTarget);
        this.renderer.render(this.scene, this.camera);

        if (options.onProgress) {
          options.onProgress((i + 1) / totalFrames);
        }

        ctx.drawImage(this.renderer.domElement, col * (frameW + padding), row * (frameH + padding));
      }

      return finalCanvas.toDataURL('image/png');
    } finally {
      this.scene.remove(object);
      // Restore state
      this.renderer.setSize(originalSize.x, originalSize.y, false);
      this.renderer.setPixelRatio(originalPixelRatio);
      this.renderer.setClearAlpha(originalClearAlpha);
    }
  }

  public async captureFrame(options: BakeOptions, index: number = 0): Promise<string> {
    const {
      distance = 5,
      elevation = 30,
      resolution = 256,
      transparent = true,
      includeTop = false,
      zoom = 1.0,
      aspectRatio = 1.0
    } = options;

    const frameW = Math.round(resolution * aspectRatio);
    const frameH = resolution;

    let object: THREE.Object3D;
    if (typeof options.model === 'string') {
      const gltf = await this.loader.loadAsync(options.model);
      object = gltf.scene;
    } else {
      object = options.model;
    }

    this.scene.add(object);

    // Save state
    const originalSize = new THREE.Vector2();
    this.renderer.getSize(originalSize);
    const originalPixelRatio = this.renderer.getPixelRatio();
    const originalClearAlpha = this.renderer.getClearAlpha();

    try {
      this.renderer.setSize(frameW, frameH);
      this.renderer.setClearAlpha(transparent ? 0 : 1);
      this.camera.aspect = aspectRatio;
      this.camera.updateProjectionMatrix();

      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const elevationRad = THREE.MathUtils.degToRad(elevation);

      if (index < options.frameCount) {
        const azimuthRad = (index / options.frameCount) * Math.PI * 2;
        const pos = calculateOrbitalPosition(distance / zoom, azimuthRad, elevationRad, center);
        this.camera.position.set(pos.x, pos.y, pos.z);
      } else if (includeTop && index === options.frameCount) {
        this.camera.position.set(center.x, center.y + distance / zoom, center.z);
      } else {
        this.camera.position.set(center.x, center.y - distance / zoom, center.z);
      }

      const renderTarget = center.clone();
      if (options.verticalOffset) {
        renderTarget.y += options.verticalOffset;
      }
      this.camera.lookAt(renderTarget);

      this.renderer.render(this.scene, this.camera);
      const dataUrl = this.renderer.domElement.toDataURL('image/png');
      return dataUrl;
    } finally {
      this.scene.remove(object);
      // Restore state
      this.renderer.setSize(originalSize.x, originalSize.y, false);
      this.renderer.setPixelRatio(originalPixelRatio);
      this.renderer.setClearAlpha(originalClearAlpha);
    }
  }

  private capturePixelData(options: BakeOptions, index: number = 0): Uint8Array {
    const {
      distance = 5,
      elevation = 30,
      resolution = 128,
      includeTop = false,
      zoom = 1.0,
      aspectRatio = 1.0
    } = options;

    const frameW = Math.round(resolution * aspectRatio);
    const frameH = resolution;

    const object = options.model instanceof THREE.Object3D ? options.model : null;
    if (!object) return new Uint8Array(0);

    this.scene.add(object);

    // Save state
    const originalSize = new THREE.Vector2();
    this.renderer.getSize(originalSize);
    const originalPixelRatio = this.renderer.getPixelRatio();
    const originalClearAlpha = this.renderer.getClearAlpha();

    try {
      this.renderer.setSize(frameW, frameH);
      this.renderer.setClearAlpha(0);
      this.camera.aspect = aspectRatio;
      this.camera.updateProjectionMatrix();

      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const elevationRad = THREE.MathUtils.degToRad(elevation);

      if (index < options.frameCount) {
        const azimuthRad = (index / options.frameCount) * Math.PI * 2;
        const pos = calculateOrbitalPosition(distance / zoom, azimuthRad, elevationRad, center);
        this.camera.position.set(pos.x, pos.y, pos.z);
      } else if (includeTop && index === options.frameCount) {
        this.camera.position.set(center.x, center.y + distance / zoom, center.z);
      } else {
        this.camera.position.set(center.x, center.y - distance / zoom, center.z);
      }

      const renderTarget = center.clone();
      if (options.verticalOffset) {
        renderTarget.y += options.verticalOffset;
      }
      this.camera.lookAt(renderTarget);

      this.renderer.render(this.scene, this.camera);

      const pixels = new Uint8Array(frameW * frameH * 4);
      const gl = this.renderer.getContext();
      gl.readPixels(0, 0, frameW, frameH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // WebGL reads from bottom-to-top; flip vertically for getAlphaBoundingBox
      const flipped = new Uint8Array(frameW * frameH * 4);
      for (let y = 0; y < frameH; y++) {
        const srcOffset = (frameH - 1 - y) * frameW * 4;
        const dstOffset = y * frameW * 4;
        flipped.set(pixels.subarray(srcOffset, srcOffset + frameW * 4), dstOffset);
      }
      return flipped;
    } finally {
      this.scene.remove(object);
      // Restore state
      this.renderer.setSize(originalSize.x, originalSize.y, false);
      this.renderer.setPixelRatio(originalPixelRatio);
      this.renderer.setClearAlpha(originalClearAlpha);
    }
  }

  public async findOptimalDistance(options: BakeOptions, index: number = 0, margin: number = 0.05): Promise<number> {
    const { distance = 5 } = options;
    const PROBE_RES = 128;
    const pixelData = this.capturePixelData({ ...options, resolution: PROBE_RES, zoom: options.zoom || 1.0 }, index);
    const bounds = getAlphaBoundingBox(pixelData, PROBE_RES, PROBE_RES);
    const scale = getFittingScale(bounds, margin);
    return distance / scale;
  }

  public async findGlobalOptimalDistance(
    options: BakeOptions,
    margin: number = 0.05
  ): Promise<{ distance: number; aspectRatio: number; verticalOffset: number }> {
    const { distance = 5, includeTop = false, includeBottom = false } = options;
    const PROBE_RES = 128;
    let globalBounds: [number, number, number, number] = [1, 0, 1, 0]; // [minX, maxX, minY, maxY]
    let foundAny = false;

    // Probe ALL azimuthal angles to find absolute worst-case bounds
    for (let i = 0; i < options.frameCount; i++) {
      const pixelData = this.capturePixelData(
        { ...options, resolution: PROBE_RES, zoom: options.zoom || 1.0, aspectRatio: 1.0 },
        i
      );
      const bounds = getAlphaBoundingBox(pixelData, PROBE_RES, PROBE_RES);
      if (bounds[1] > bounds[0] && bounds[3] > bounds[2]) {
        globalBounds = foundAny ? mergeBounds(globalBounds, bounds) : bounds;
        foundAny = true;
      }
    }

    // Probe Top/Bottom
    const extraIndices = [];
    if (includeTop) extraIndices.push(options.frameCount);
    if (includeBottom) extraIndices.push(options.frameCount + (includeTop ? 1 : 0));

    for (const idx of extraIndices) {
      const pixelData = this.capturePixelData(
        { ...options, resolution: PROBE_RES, zoom: options.zoom || 1.0, aspectRatio: 1.0 },
        idx
      );
      const bounds = getAlphaBoundingBox(pixelData, PROBE_RES, PROBE_RES);
      if (bounds[1] > bounds[0] && bounds[3] > bounds[2]) {
        globalBounds = foundAny ? mergeBounds(globalBounds, bounds) : bounds;
        foundAny = true;
      }
    }

    if (!foundAny) return { distance, aspectRatio: 1.0, verticalOffset: 0 };

    const [minX, maxX, minY, maxY] = globalBounds;
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    // targetSize (vertical) = 1.0 - margin * 2
    const targetSize = Math.max(0.01, 1.0 - margin * 2);

    // We fit to the VERTICAL dimension primarily
    const verticalScale = targetSize / contentH;
    const optimalDistance = distance / verticalScale;

    // Account for margin symmetrically
    const paddedW = Math.min(1.0, contentW + margin * 2);
    const paddedH = Math.min(1.0, contentH + margin * 2);
    const aspectRatio = paddedW / paddedH;

    let verticalOffset = 0;
    if (options.isGrounded) {
      verticalOffset = calculateGroundingOffset(globalBounds, optimalDistance, 45, margin);
    }

    return {
      distance: optimalDistance,
      aspectRatio,
      verticalOffset
    };
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public dispose() {
    const canvas = this.renderer.getContext().canvas;
    canvas.removeEventListener('webglcontextlost', this.onWebGLContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onWebGLContextRestored);

    if (this.isInternalRenderer) {
      this.renderer.dispose();
    }
    this.scene.clear();
  }
}
