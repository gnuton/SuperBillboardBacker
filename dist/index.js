import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { calculateOrbitalPosition, calculateGrid } from './math.js';
export class SpriteBaker {
    renderer;
    scene;
    camera;
    loader;
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
    async bake(options) {
        const { frameCount, distance = 5, elevation = 30, resolution = 256, transparent = true } = options;
        let object;
        if (typeof options.model === 'string') {
            const gltf = await this.loader.loadAsync(options.model);
            object = gltf.scene;
        }
        else {
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
        const { rows, cols } = calculateGrid(frameCount);
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = cols * resolution;
        finalCanvas.height = rows * resolution;
        const ctx = finalCanvas.getContext('2d');
        const elevationRad = THREE.MathUtils.degToRad(elevation);
        for (let i = 0; i < frameCount; i++) {
            const azimuthRad = (i / frameCount) * Math.PI * 2;
            const pos = calculateOrbitalPosition(distance, azimuthRad, elevationRad, center);
            this.camera.position.set(pos.x, pos.y, pos.z);
            this.camera.lookAt(center);
            this.renderer.render(this.scene, this.camera);
            const col = i % cols;
            const row = Math.floor(i / cols);
            ctx.drawImage(this.renderer.domElement, col * resolution, row * resolution);
        }
        // Cleanup
        this.scene.remove(object);
        return finalCanvas.toDataURL('image/png');
    }
    getRenderer() {
        return this.renderer;
    }
}
//# sourceMappingURL=index.js.map