import * as THREE from 'three';
export interface BakeOptions {
    model: THREE.Object3D | string;
    frameCount: number;
    distance?: number;
    elevation?: number;
    resolution?: number;
    transparent?: boolean;
}
export declare class SpriteBaker {
    private renderer;
    private scene;
    private camera;
    private loader;
    constructor();
    bake(options: BakeOptions): Promise<string>;
    getRenderer(): THREE.WebGLRenderer;
}
//# sourceMappingURL=index.d.ts.map