import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SpriteBaker, BakeOptions } from '../index.js';
import { calculateAutoDistance } from '../math.js';

export interface BillboardBackerUIOptions {
  container: HTMLElement;
  initialModel?: string | THREE.Object3D;
  theme?: 'dark' | 'light' | Record<string, string>;
  onBakeComplete?: (dataUrl: string) => void;
  initialParams?: Partial<BakeOptions>;
}

export class BillboardBackerUI extends EventTarget {
  private container: HTMLElement;
  private baker: SpriteBaker;
  private options: BillboardBackerUIOptions;
  private params: Required<BakeOptions>;
  
  // DOM Elements
  private uiContainer!: HTMLDivElement;
  private viewportEl!: HTMLDivElement;
  private previewImageEl!: HTMLImageElement;
  private bakedImageEl!: HTMLImageElement;
  private bakeBtn!: HTMLButtonElement;
  private viewportOverlay!: HTMLDivElement;
  private previewOverlay!: HTMLDivElement;
  private currentCameraIndex: number = 0;

  // Three.js Preview
  private renderer: THREE.WebGLRenderer;
  private previewScene: THREE.Scene;
  private previewCamera: THREE.PerspectiveCamera;
  private previewControls: OrbitControls;
  private previewModel: THREE.Object3D | null = null;
  private orbitRing: THREE.Mesh;
  private markersGroup: THREE.Group;
  private animationId: number = 0;

  constructor(options: BillboardBackerUIOptions) {
    super();
    this.options = options;
    this.container = options.container;
    this.baker = new SpriteBaker();
    
    // Default Parameters
    this.params = {
      model: '',
      frameCount: 16,
      distance: 5,
      elevation: 30,
      resolution: 256,
      padding: 2,
      transparent: true,
      includeTop: false,
      includeBottom: false,
      isAutoDistance: true,
      margin: 0.1,
      ...options.initialParams
    };

    // Initialize UI
    this.initDOM();
    
    // Initialize Three.js Preview
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.previewScene = new THREE.Scene();
    this.previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.previewCamera.position.set(5, 5, 5);
    
    this.viewportEl.appendChild(this.renderer.domElement);
    this.previewControls = new OrbitControls(this.previewCamera, this.renderer.domElement);
    this.previewControls.enableDamping = true;

    // Lights
    this.previewScene.add(new THREE.AmbientLight(0xffffff, 1));
    const dl = new THREE.DirectionalLight(0xffffff, 2);
    dl.position.set(5, 10, 7.5);
    this.previewScene.add(dl);

    // Orbit Path
    this.orbitRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.02, 16, 100),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 })
    );
    this.orbitRing.rotation.x = Math.PI / 2;
    this.previewScene.add(this.orbitRing);

    this.markersGroup = new THREE.Group();
    this.previewScene.add(this.markersGroup);

    // Resize Handler
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();

    // Start Loop
    this.animate = this.animate.bind(this);
    this.animate();

    if (options.theme) this.setTheme(options.theme);
    if (options.initialModel) this.loadModel(options.initialModel);
    
    this.updateMarkers();
    this.updateControlsUI();
  }

  private initDOM() {
    this.uiContainer = document.createElement('div');
    this.uiContainer.className = 'sbb-ui-container';
    this.container.appendChild(this.uiContainer);

    // Left Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'sbb-panel';
    sidebar.innerHTML = `
      <h1 class="sbb-title">SuperBillboardBacker</h1>
      
      <div class="sbb-control-group">
        <label class="sbb-label">Load 3D Model</label>
        <div class="sbb-help-text">Import .glb / .gltf</div>
        <input type="file" class="sbb-input sbb-file-input" accept=".glb,.gltf" />
      </div>

      <div class="sbb-control-group">
        <label class="sbb-label">n of cameras: <span class="sbb-val-frameCount">${this.params.frameCount}</span></label>
        <input type="range" class="sbb-input sbb-range-frameCount" min="4" max="64" step="1" value="${this.params.frameCount}" />
        <div style="display: flex; gap: 0.5rem; margin-top: 0.2rem">
          <label style="display:flex; align-items:center; gap:0.2rem; font-size:0.7rem; color:#888; text-transform:none">
            <input type="checkbox" class="sbb-check-top" ${this.params.includeTop ? 'checked' : ''}> Top
          </label>
          <label style="display:flex; align-items:center; gap:0.2rem; font-size:0.7rem; color:#888; text-transform:none">
            <input type="checkbox" class="sbb-check-bottom" ${this.params.includeBottom ? 'checked' : ''}> Bottom
          </label>
        </div>
      </div>

      <div class="sbb-control-group">
        <label class="sbb-label" style="text-transform:none">
          <input type="checkbox" class="sbb-check-auto" ${this.params.isAutoDistance ? 'checked' : ''}> Auto Distance (Visual Fit)
        </label>
        <div class="sbb-help-text">Analyzes frame to minimize empty space.</div>
      </div>

      <div class="sbb-control-group sbb-margin-group" style="display: ${this.params.isAutoDistance ? 'block' : 'none'}">
        <label class="sbb-label">Margin: <span class="sbb-val-margin">${Math.round(this.params.margin * 100)}</span>%</label>
        <input type="range" class="sbb-input sbb-range-margin" min="0" max="0.5" step="0.01" value="${this.params.margin}" />
      </div>

      <div class="sbb-control-group sbb-dist-manual" style="display: ${this.params.isAutoDistance ? 'none' : 'block'}">
        <label class="sbb-label">Distance: <span class="sbb-val-distance">${this.params.distance.toFixed(1)}</span></label>
        <input type="range" class="sbb-input sbb-range-distance" min="0.1" max="50" step="0.1" value="${this.params.distance}" />
      </div>

      <div class="sbb-control-group">
        <label class="sbb-label">Elevation: <span class="sbb-val-elevation">${this.params.elevation}</span>&deg;</label>
        <input type="range" class="sbb-input sbb-range-elevation" min="-90" max="90" step="1" value="${this.params.elevation}" />
      </div>

      <div class="sbb-control-group">
        <label class="sbb-label">Resolution</label>
        <select class="sbb-input sbb-select-resolution">
          <option value="64">64px</option>
          <option value="128">128px</option>
          <option value="256" selected>256px</option>
          <option value="512">512px</option>
          <option value="1024">1024px</option>
        </select>
      </div>

      <div class="sbb-control-group">
        <label class="sbb-label">Padding: <span class="sbb-val-padding">${this.params.padding}</span>px</label>
        <input type="range" class="sbb-input sbb-range-padding" min="0" max="64" step="1" value="${this.params.padding}" />
      </div>
    `;
    this.bakeBtn = document.createElement('button');
    this.bakeBtn.className = 'sbb-button sbb-button-primary';
    this.bakeBtn.innerText = 'BAKE SPRITES';
    this.bakeBtn.disabled = true;
    sidebar.appendChild(this.bakeBtn);
    this.uiContainer.appendChild(sidebar);

    // Center Viewport
    this.viewportEl = document.createElement('div');
    this.viewportEl.className = 'sbb-viewport';
    this.viewportEl.innerHTML = `
      <div style="position: absolute; top: 15px; left: 15px; color: var(--sbb-primary-color); font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">
        3D Viewport • Live Preview
      </div>
    `;
    this.uiContainer.appendChild(this.viewportEl);

    // Right Results Panel
    const results = document.createElement('div');
    results.className = 'sbb-panel';
    results.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center">
        <h2 class="sbb-title" style="font-size:0.9rem">Camera Preview</h2>
        <span class="sbb-cam-index" style="font-size:0.7rem; color:var(--sbb-text-secondary)">1 / 16</span>
      </div>
      <div class="sbb-preview-nav">
        <button class="sbb-nav-arrow left">&lsaquo;</button>
        <img class="sbb-preview-image" style="height: 180px; width:100%; object-fit:contain" alt="Preview">
        <button class="sbb-nav-arrow right">&rsaquo;</button>
      </div>

      <h2 class="sbb-title" style="font-size:0.9rem; margin-top:1rem">Generated Sheet</h2>
      <div style="flex:1; display:flex; flex-direction:column; gap:0.5rem">
        <img class="sbb-baked-image" alt="Output">
        <button class="sbb-button sbb-download-btn" style="display:none">Download PNG</button>
      </div>
    `;
    this.previewImageEl = results.querySelector('.sbb-preview-image') as HTMLImageElement;
    this.bakedImageEl = results.querySelector('.sbb-baked-image') as HTMLImageElement;

    // Viewport Overlay
    this.viewportOverlay = this.createOverlay('Measuring Model...');
    this.viewportEl.appendChild(this.viewportOverlay);

    // Preview Overlay
    this.previewOverlay = this.createOverlay('Capturing...');
    const previewNav = results.querySelector('.sbb-preview-nav') as HTMLElement;
    previewNav.appendChild(this.previewOverlay);

    this.uiContainer.appendChild(results);

    // Event Listeners
    this.setupEvents();
  }

  private setupEvents() {
    const listen = (sel: string, event: string, cb: any) => this.uiContainer.querySelector(sel)?.addEventListener(event, cb);
    
    listen('.sbb-file-input', 'change', (e: any) => {
      const file = e.target.files?.[0];
      if (file) this.loadModel(file);
    });

    listen('.sbb-range-frameCount', 'input', (e: any) => {
      this.setParams({ frameCount: parseInt(e.target.value) });
    });

    listen('.sbb-check-top', 'change', (e: any) => {
      this.setParams({ includeTop: e.target.checked });
    });

    listen('.sbb-check-bottom', 'change', (e: any) => {
      this.setParams({ includeBottom: e.target.checked });
    });

    listen('.sbb-check-auto', 'change', (e: any) => {
      this.setParams({ isAutoDistance: e.target.checked });
    });

    listen('.sbb-range-margin', 'input', (e: any) => {
      this.setParams({ margin: parseFloat(e.target.value) });
    });

    listen('.sbb-range-distance', 'input', (e: any) => {
      this.setParams({ distance: parseFloat(e.target.value) });
    });

    listen('.sbb-range-elevation', 'input', (e: any) => {
      this.setParams({ elevation: parseInt(e.target.value) });
    });

    listen('.sbb-select-resolution', 'change', (e: any) => {
      this.setParams({ resolution: parseInt(e.target.value) });
    });

    listen('.sbb-range-padding', 'input', (e: any) => {
      this.setParams({ padding: parseInt(e.target.value) });
    });

    listen('.sbb-nav-arrow.left', 'click', () => {
      const total = this.getTotalFrames();
      this.currentCameraIndex = (this.currentCameraIndex - 1 + total) % total;
      this.updateSightingInfo();
      this.refreshSighting();
    });

    listen('.sbb-nav-arrow.right', 'click', () => {
      const total = this.getTotalFrames();
      this.currentCameraIndex = (this.currentCameraIndex + 1) % total;
      this.updateSightingInfo();
      this.refreshSighting();
    });

    this.bakeBtn.addEventListener('click', () => this.bake());

    this.uiContainer.querySelector('.sbb-download-btn')?.addEventListener('click', () => {
      if (!this.bakedImageEl.src) return;
      const link = document.createElement('a');
      link.download = 'spritesheet.png';
      link.href = this.bakedImageEl.src;
      link.click();
    });
  }

  private getTotalFrames() {
    return this.params.frameCount + (this.params.includeTop ? 1 : 0) + (this.params.includeBottom ? 1 : 0);
  }

  private updateSightingInfo() {
    const el = this.uiContainer.querySelector('.sbb-cam-index') as HTMLElement;
    if (el) el.innerText = `${this.currentCameraIndex + 1} / ${this.getTotalFrames()}`;
  }

  public async loadModel(model: string | File | THREE.Object3D) {
    if (model instanceof THREE.Object3D) {
      this.setPreviewModel(model);
      return;
    }

    const url = typeof model === 'string' ? model : URL.createObjectURL(model);
    const loader = new GLTFLoader();
    
    try {
      const gltf = await loader.loadAsync(url);
      this.setPreviewModel(gltf.scene);
    } catch (err) {
      console.error('Failed to load model', err);
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
    }
  }

  private setPreviewModel(model: THREE.Object3D) {
    if (this.previewModel) this.previewScene.remove(this.previewModel);
    this.previewModel = model;
    this.previewScene.add(model);
    this.bakeBtn.disabled = false;
    
    if (this.params.isAutoDistance) {
      this.updateAutoDistance();
    }
    this.updateControlsUI();
    this.updateMarkers();
    this.refreshSighting();
    this.dispatchEvent(new CustomEvent('change', { detail: { type: 'model', model } }));
  }

  private async updateAutoDistance() {
    if (!this.previewModel || !this.params.isAutoDistance) return;
    
    this.setLoading(this.viewportOverlay, true, 'Analyzing Layout...');
    
    try {
      const optimal = await this.baker.findOptimalDistance({
        ...this.params,
        model: this.previewModel.clone()
      }, this.currentCameraIndex, this.params.margin);
      
      this.params.distance = optimal;
      this.updateControlsUI();
    } catch (err) {
      console.error('Auto distance failed', err);
    } finally {
      this.setLoading(this.viewportOverlay, false);
    }
  }

  private createOverlay(text: string): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'sbb-overlay';
    overlay.innerHTML = `
      <div class="sbb-spinner"></div>
      <div class="sbb-loading-text">${text}</div>
    `;
    return overlay;
  }

  private setLoading(overlay: HTMLDivElement, loading: boolean, text?: string) {
    if (loading) {
      overlay.classList.add('visible');
      if (text) {
        const textEl = overlay.querySelector('.sbb-loading-text');
        if (textEl) textEl.textContent = text;
      }
    } else {
      overlay.classList.remove('visible');
    }
  }

  public setParams(params: Partial<BakeOptions>) {
    Object.assign(this.params, params);
    
    if (params.frameCount !== undefined || params.includeTop !== undefined || params.includeBottom !== undefined) {
      this.updateMarkers();
      if (this.currentCameraIndex >= this.getTotalFrames()) {
        this.currentCameraIndex = 0;
      }
      this.updateSightingInfo();
    }

    this.updateControlsUI();
    this.refreshSighting();
    this.dispatchEvent(new CustomEvent('change', { detail: this.params }));
  }

  public getParams(): BakeOptions {
    return { ...this.params };
  }

  private updateControlsUI() {
    const setVal = (sel: string, val: any) => {
      const el = this.uiContainer.querySelector(sel);
      if (el) (el as any).value = val;
    };
    const setText = (sel: string, text: any) => {
      const el = this.uiContainer.querySelector(sel);
      if (el) (el as HTMLElement).innerText = text;
    };

    setVal('.sbb-range-frameCount', this.params.frameCount);
    setText('.sbb-val-frameCount', this.params.frameCount);
    
    setVal('.sbb-range-distance', this.params.distance);
    setText('.sbb-val-distance', this.params.distance.toFixed(1));
    
    setVal('.sbb-range-elevation', this.params.elevation);
    setText('.sbb-val-elevation', this.params.elevation);
    
    setVal('.sbb-range-padding', this.params.padding);
    setText('.sbb-val-padding', this.params.padding);

    setVal('.sbb-range-margin', this.params.margin);
    setText('.sbb-val-margin', Math.round(this.params.margin * 100));

    const marginGroup = this.uiContainer.querySelector('.sbb-margin-group') as HTMLElement;
    if (marginGroup) marginGroup.style.display = this.params.isAutoDistance ? 'block' : 'none';

    const distGroup = this.uiContainer.querySelector('.sbb-dist-manual') as HTMLElement;
    if (distGroup) distGroup.style.display = this.params.isAutoDistance ? 'none' : 'block';
  }

  private updateMarkers() {
    // Clear old
    while (this.markersGroup.children.length) {
      const child = this.markersGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      groupDispose(child);
      this.markersGroup.remove(child);
    }

    const total = this.getTotalFrames();
    const markerGeom = new THREE.ConeGeometry(0.1, 0.2, 4);
    markerGeom.rotateX(Math.PI / 2);

    for (let i = 0; i < total; i++) {
      const marker = new THREE.Mesh(markerGeom, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      
      // Number label sprite
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white'; ctx.font = 'Bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((i + 1).toString(), 32, 32);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
      sprite.position.y = 0.3;
      sprite.scale.set(0.4, 0.4, 1);
      marker.add(sprite);
      
      this.markersGroup.add(marker);
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate);
    this.previewControls.update();

    if (!this.previewModel) {
      this.markersGroup.visible = false;
      this.renderer.render(this.previewScene, this.previewCamera);
      return;
    }

    this.markersGroup.visible = true;
    const box = new THREE.Box3().setFromObject(this.previewModel);
    const center = box.getCenter(new THREE.Vector3());
    
    // Update Orbit Ring
    const eRad = THREE.MathUtils.degToRad(this.params.elevation);
    const radiusAtE = this.params.distance * Math.cos(eRad);
    const elevationY = this.params.distance * Math.sin(eRad);
    
    this.orbitRing.position.set(center.x, center.y + elevationY, center.z);
    this.orbitRing.scale.set(radiusAtE, radiusAtE, 1);

    // Update Markers
    this.markersGroup.children.forEach((child, i) => {
      if (i < this.params.frameCount) {
        const azimuth = (i / this.params.frameCount) * Math.PI * 2;
        child.position.set(
          center.x + radiusAtE * Math.cos(azimuth),
          center.y + elevationY,
          center.z + radiusAtE * Math.sin(azimuth)
        );
      } else if (this.params.includeTop && i === this.params.frameCount) {
        child.position.set(center.x, center.y + this.params.distance, center.z);
      } else {
        child.position.set(center.x, center.y - this.params.distance, center.z);
      }
      child.lookAt(center);
      
      // Highlight current
      const mesh = child as THREE.Mesh;
      (mesh.material as THREE.MeshBasicMaterial).color.set(i === this.currentCameraIndex ? 0xff0000 : 0xffffff);
    });

    this.renderer.render(this.previewScene, this.previewCamera);
  }

  private sightingTimer: any = null;
  private refreshSighting() {
    if (!this.previewModel) return;
    clearTimeout(this.sightingTimer);
    this.sightingTimer = setTimeout(async () => {
      this.setLoading(this.previewOverlay, true, 'Capturing...');
      try {
        const url = await this.baker.captureFrame({
          ...this.params,
          model: this.previewModel!.clone()
        }, this.currentCameraIndex);
        this.previewImageEl.src = url;
      } catch (err) {
        console.error('Sighting failed', err);
      } finally {
        this.setLoading(this.previewOverlay, false);
      }
    }, 150);
  }

  public async bake(): Promise<string> {
    if (!this.previewModel) return '';
    this.bakeBtn.innerText = 'BAKING...';
    this.bakeBtn.disabled = true;
    this.setLoading(this.previewOverlay, true, `Baking ${this.getTotalFrames()} Frames...`);
    this.dispatchEvent(new CustomEvent('bake-start'));

    try {
      const dataUrl = await this.baker.bake({
        ...this.params,
        model: this.previewModel.clone()
      });
      this.bakedImageEl.src = dataUrl;
      const downloadBtn = this.uiContainer.querySelector('.sbb-download-btn') as HTMLElement;
      if (downloadBtn) downloadBtn.style.display = 'block';
      
      this.dispatchEvent(new CustomEvent('bake-complete', { detail: { dataUrl } }));
      if (this.options.onBakeComplete) this.options.onBakeComplete(dataUrl);
      return dataUrl;
    } catch (err) {
      console.error('Bake failed', err);
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
      throw err;
    } finally {
      this.bakeBtn.innerText = 'BAKE SPRITES';
      this.bakeBtn.disabled = false;
      this.setLoading(this.previewOverlay, false);
    }
  }

  public setTheme(theme: 'dark' | 'light' | Record<string, string>) {
    this.uiContainer.classList.remove('sbb-theme-dark', 'sbb-theme-light');
    if (typeof theme === 'string') {
      this.uiContainer.classList.add(`sbb-theme-${theme}`);
    } else {
      for (const [key, value] of Object.entries(theme)) {
        this.uiContainer.style.setProperty(`--sbb-${key}`, value);
      }
    }
  }

  private handleResize() {
    const w = this.viewportEl.clientWidth;
    const h = this.viewportEl.clientHeight;
    this.renderer.setSize(w, h);
    this.previewCamera.aspect = w / h;
    this.previewCamera.updateProjectionMatrix();
  }

  public dispose() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    if (this.uiContainer.parentElement) {
      this.uiContainer.parentElement.removeChild(this.uiContainer);
    }
  }
}

function groupDispose(obj: THREE.Object3D) {
  obj.children.forEach(child => {
    if ((child as any).geometry) (child as any).geometry.dispose();
    if ((child as any).material) {
      if (Array.isArray((child as any).material)) {
        (child as any).material.forEach((m: any) => m.dispose());
      } else {
        (child as any).material.dispose();
      }
    }
    groupDispose(child);
  });
}
