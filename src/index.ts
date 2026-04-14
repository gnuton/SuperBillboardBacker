import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { calculateOrbitalPosition, calculateGrid, getAlphaBoundingBox, getFittingScale } from './math.js';
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
}

export class SpriteBaker {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private loader: GLTFLoader;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.loader = new GLTFLoader();
    
    // Add default lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  public async bake(options: BakeOptions): Promise<string> {
    const {
      frameCount,
      distance = 5,
      elevation = 30,
      resolution = 256,
      padding = 0,
      transparent = true,
      includeTop = false,
      includeBottom = false
    } = options;

    let object: THREE.Object3D;
    if (typeof options.model === 'string') {
      const gltf = await this.loader.loadAsync(options.model);
      object = gltf.scene;
    } else {
      object = options.model;
    }

    // Centering logic (Architect/Mathematician collaboration)
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Auto-distance if not provided? Maybe later.
    
    this.scene.add(object);
    this.renderer.setSize(resolution, resolution);
    this.renderer.setClearAlpha(transparent ? 0 : 1);

    const totalFrames = frameCount + (includeTop ? 1 : 0) + (includeBottom ? 1 : 0);
    const { rows, cols } = calculateGrid(totalFrames);
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = cols * resolution + (cols - 1) * padding;
    finalCanvas.height = rows * resolution + (rows - 1) * padding;
    const ctx = finalCanvas.getContext('2d')!;

    const elevationRad = THREE.MathUtils.degToRad(elevation);

    for (let i = 0; i < totalFrames; i++) {
      if (i < frameCount) {
        // Standard orbital camera
        const azimuthRad = (i / frameCount) * Math.PI * 2;
        const pos = calculateOrbitalPosition(distance, azimuthRad, elevationRad, center);
        this.camera.position.set(pos.x, pos.y, pos.z);
      } else if (includeTop && i === frameCount) {
        // Top camera
        this.camera.position.set(center.x, center.y + distance, center.z);
      } else if (includeBottom) {
        // Bottom camera (always the last one if both are present)
        this.camera.position.set(center.x, center.y - distance, center.z);
      }
      
      this.camera.lookAt(center);
      this.renderer.render(this.scene, this.camera);
      
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      ctx.drawImage(
        this.renderer.domElement,
        col * (resolution + padding),
        row * (resolution + padding)
      );
    }

    // Cleanup
    this.scene.remove(object);

    return finalCanvas.toDataURL('image/png');
  }

  /**
   * Captures a single frame from the orbit.
   * Useful for real-time previews.
   */
  public async captureFrame(options: BakeOptions, index: number = 0): Promise<string> {
    const {
      distance = 5,
      elevation = 30,
      resolution = 256,
      transparent = true,
      includeTop = false,
      includeBottom = false
    } = options;

    let object: THREE.Object3D;
    if (typeof options.model === 'string') {
      const gltf = await this.loader.loadAsync(options.model);
      object = gltf.scene;
    } else {
      object = options.model;
    }

    this.scene.add(object);
    this.renderer.setSize(resolution, resolution);
    this.renderer.setClearAlpha(transparent ? 0 : 1);

    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const elevationRad = THREE.MathUtils.degToRad(elevation);
    
    if (index < options.frameCount) {
      const azimuthRad = (index / options.frameCount) * Math.PI * 2;
      const pos = calculateOrbitalPosition(distance, azimuthRad, elevationRad, center);
      this.camera.position.set(pos.x, pos.y, pos.z);
    } else if (includeTop && index === options.frameCount) {
      this.camera.position.set(center.x, center.y + distance, center.z);
    } else {
      this.camera.position.set(center.x, center.y - distance, center.z);
    }
    
    this.camera.lookAt(center);
    
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');

    this.scene.remove(object);
    return dataUrl;
  }

  /**
   * Internal helper for fast pixel analysis.
   * Renders a frame and reads raw pixel data without the overhead of encoding/decoding image formats.
   */
  private capturePixelData(options: BakeOptions, index: number = 0): Uint8Array {
    const {
      distance = 5,
      elevation = 30,
      resolution = 128,
      includeTop = false,
    } = options;

    const object = options.model instanceof THREE.Object3D ? options.model : null;
    if (!object) return new Uint8Array(0);

    this.scene.add(object);
    this.renderer.setSize(resolution, resolution);
    this.renderer.setClearAlpha(0);

    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const elevationRad = THREE.MathUtils.degToRad(elevation);
    
    if (index < options.frameCount) {
      const azimuthRad = (index / options.frameCount) * Math.PI * 2;
      const pos = calculateOrbitalPosition(distance, azimuthRad, elevationRad, center);
      this.camera.position.set(pos.x, pos.y, pos.z);
    } else if (includeTop && index === options.frameCount) {
      this.camera.position.set(center.x, center.y + distance, center.z);
    } else {
      this.camera.position.set(center.x, center.y - distance, center.z);
    }
    
    this.camera.lookAt(center);
    this.renderer.render(this.scene, this.camera);
    
    // Read pixels from the current frame buffer
    const pixels = new Uint8Array(resolution * resolution * 4);
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, resolution, resolution, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    this.scene.remove(object);
    return pixels;
  }

  /**
   * Performs visual pixel analysis to find the optimal camera distance for a tight fit.
   * 
   * @param options - Standard bake options (model, resolution, etc)
   * @param index - The camera index to sample for fitting
   * @param margin - Safety padding (0.0 to 1.0)
   */
  public async findOptimalDistance(options: BakeOptions, index: number = 0, margin: number = 0.05): Promise<number> {
    const { distance = 5 } = options;
    
    // We render at a low resolution for performance
    const PROBE_RES = 128; 
    
    // Direct pixel capture (instant vs previous async Image load)
    const pixelData = this.capturePixelData({ ...options, resolution: PROBE_RES }, index);
    const bounds = getAlphaBoundingBox(pixelData, PROBE_RES, PROBE_RES);
    const scale = getFittingScale(bounds, margin);
    
    // newDist = currentDist / scale
    // (Since distance is inversely proportional to apparent size)
    const optimalDist = distance / scale;
    return optimalDist;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
}
