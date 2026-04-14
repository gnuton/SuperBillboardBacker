import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SpriteBaker } from '../../src/index';
import { calculateAutoDistance } from '../../src/math';

const App = () => {
  const [frameCount, setFrameCount] = useState(16);
  const [distance, setDistance] = useState(5);
  const [elevation, setElevation] = useState(30);
  const [resolution, setResolution] = useState(256);
  const [padding, setPadding] = useState(2);
  const [isBaking, setIsBaking] = useState(false);
  const [bakedImage, setBakedImage] = useState<string | null>(null);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [firstFramePreview, setFirstFramePreview] = useState<string | null>(null);
  const [isAutoDistance, setIsAutoDistance] = useState(true);
  const [distanceMode, setDistanceMode] = useState<'best-fit' | '360-n'>('best-fit');
  
  // Refs for animation loop (avoiding stale closures)
  const paramsRef = useRef({ distance, elevation, frameCount });
  useEffect(() => {
    paramsRef.current = { distance, elevation, frameCount };
  }, [distance, elevation, frameCount]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const bakerRef = useRef<SpriteBaker | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const previewModelRef = useRef<THREE.Object3D | null>(null);
  const markersGroupRef = useRef<THREE.Group>(new THREE.Group());

  // Initialize objects once
  if (!bakerRef.current) bakerRef.current = new SpriteBaker();
  if (!sceneRef.current) sceneRef.current = new THREE.Scene();

  useEffect(() => {
    if (!viewportRef.current || !sceneRef.current) return;
    const scene = sceneRef.current!;

    const width = viewportRef.current.clientWidth;
    const height = viewportRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    viewportRef.current.appendChild(renderer.domElement);
    scene.background = new THREE.Color(0x050505);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Orbit Path Visualization (Mathematician requirement)
    const orbitRing = new THREE.Mesh(
      new THREE.TorusGeometry(distance, 0.02, 16, 100),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 })
    );
    orbitRing.rotation.x = Math.PI / 2;
    // We'll update positioning in the animate loop to follow the elevation/model center
    scene.add(orbitRing);
    
    // Camera Markers Group
    scene.add(markersGroupRef.current);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      
      // Update orbit ring based on elevation and center
      const { distance: d, elevation: e, frameCount: fc } = paramsRef.current;
      
      if (previewModelRef.current) {
        const box = new THREE.Box3().setFromObject(previewModelRef.current);
        const center = box.getCenter(new THREE.Vector3());
        orbitRing.position.set(center.x, center.y + d * Math.sin(THREE.MathUtils.degToRad(e)), center.z);
        // Scale radius based on distance at that height
        const radiusAtElevation = d * Math.cos(THREE.MathUtils.degToRad(e));
        orbitRing.scale.set(radiusAtElevation / d, radiusAtElevation / d, 1);
      } else {
        orbitRing.position.y = d * Math.sin(THREE.MathUtils.degToRad(e));
      }

      // Update camera markers
      const { distance: d2, elevation: e2, frameCount: fc2 } = paramsRef.current;
      const radiusAtElevationMk = d2 * Math.cos(THREE.MathUtils.degToRad(e2));
      const elevationRadMk = THREE.MathUtils.degToRad(e2);
      const elevationYMk = d2 * Math.sin(elevationRadMk);
      
      const boxMk = previewModelRef.current ? new THREE.Box3().setFromObject(previewModelRef.current) : new THREE.Box3();
      const centerMk = boxMk.getCenter(new THREE.Vector3());

      markersGroupRef.current.children.forEach((child, i) => {
        const azimuthRad = (i / fc2) * Math.PI * 2;
        child.position.set(
          centerMk.x + radiusAtElevationMk * Math.cos(azimuthRad),
          centerMk.y + elevationYMk,
          centerMk.z + radiusAtElevationMk * Math.sin(azimuthRad)
        );
        child.lookAt(centerMk);

        // Highlight current camera
        const mesh = child as THREE.Mesh;
        (mesh.material as THREE.MeshBasicMaterial).color.set(i === currentCameraIndex ? 0xff0000 : 0xffffff);
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const w = viewportRef.current!.clientWidth;
      const h = viewportRef.current!.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (viewportRef.current) {
        viewportRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync camera markers when frameCount changes
  useEffect(() => {
    const group = markersGroupRef.current;
    
    // Dispose old markers
    while (group.children.length) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      if (child.material) (child.material as THREE.Material).dispose();
      group.remove(child);
    }

    // Create new markers
    const markerGeom = new THREE.ConeGeometry(0.1, 0.2, 4);
    markerGeom.rotateX(Math.PI / 2); // Point towards center
    
    const createNumberTexture = (n: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.font = 'Bold 40px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.toString(), 32, 32);
      return new THREE.CanvasTexture(canvas);
    };

    for (let i = 0; i < frameCount; i++) {
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      
      // Add number label
      const spriteMat = new THREE.SpriteMaterial({ map: createNumberTexture(i + 1) });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.y = 0.3;
      sprite.scale.set(0.4, 0.4, 1);
      marker.add(sprite);

      group.add(marker);
    }
  }, [frameCount]);

  // Debounced real-time preview of the first frame
  useEffect(() => {
    const model = previewModelRef.current;
    if (!model || !bakerRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const url = await bakerRef.current!.captureFrame({
          model: model.clone(),
          frameCount,
          distance,
          elevation,
          resolution,
        }, currentCameraIndex);
        setFirstFramePreview(url);
      } catch (err) {
        console.error('Preview failed', err);
      }
    }, 150); // 150ms debounce

    return () => clearTimeout(timer);
  }, [distance, elevation, resolution, frameCount, currentCameraIndex]);

  // Handle Auto Distance calculation
  useEffect(() => {
    if (isAutoDistance && previewModelRef.current) {
      if (distanceMode === '360-n') {
        setDistance(360 / frameCount);
      } else {
        const autoD = calculateAutoDistance(previewModelRef.current);
        setDistance(autoD);
      }
    }
  }, [isAutoDistance, distanceMode, frameCount]); // Removed elevation dependency for stability

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      const scene = sceneRef.current!;
      if (previewModelRef.current) {
        scene.remove(previewModelRef.current);
      }
      previewModelRef.current = gltf.scene;
      scene.add(gltf.scene);
      
      // Focus camera on model via auto-distance if enabled
      if (isAutoDistance) {
        const autoD = calculateAutoDistance(gltf.scene);
        setDistance(autoD);
      } else {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        setDistance(maxDim * 2.5);
      }
    });
  };

  const handleBake = async () => {
    if (!previewModelRef.current || !bakerRef.current) return;
    setIsBaking(true);
    try {
      const dataUrl = await bakerRef.current!.bake({
        model: previewModelRef.current.clone(),
        frameCount,
        distance,
        elevation,
        resolution,
        padding,
      });
      setBakedImage(dataUrl);
    } catch (err) {
      console.error('Bake failed', err);
    } finally {
      setIsBaking(false);
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <h1 className="title">SuperBillboardBacker</h1>
        
        <div className="control-group">
          <label>Load 3D Model</label>
          <div className="help-text">Import a .glb or .gltf file. The viewport will center on your model automatically.</div>
          <input type="file" onChange={handleFileUpload} accept=".glb,.gltf" />
        </div>

        <div className="control-group">
          <label>n of cameras: {frameCount}</label>
          <div className="help-text">Total frames to capture around the orbit. Higher values mean smoother rotations.</div>
          <input 
            type="range" min="4" max="64" step="1" 
            value={frameCount} onChange={(e) => setFrameCount(parseInt(e.target.value))} 
          />
        </div>

        <div className="control-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={isAutoDistance} 
              onChange={(e) => setIsAutoDistance(e.target.checked)} 
            />
            Auto Distance
          </label>
          <div className="help-text">Automatically calculate the best level of zoom for the object.</div>
          
          {isAutoDistance && (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.7rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', color: distanceMode === 'best-fit' ? '#3b82f6' : '#666' }}>
                <input type="radio" name="distMode" checked={distanceMode === 'best-fit'} onChange={() => setDistanceMode('best-fit')} />
                Best Fit
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', color: distanceMode === '360-n' ? '#3b82f6' : '#666' }}>
                <input type="radio" name="distMode" checked={distanceMode === '360-n'} onChange={() => setDistanceMode('360-n')} />
                360 / N
              </label>
            </div>
          )}
        </div>

        <div className="control-group" style={{ opacity: isAutoDistance ? 0.5 : 1, pointerEvents: isAutoDistance ? 'none' : 'auto' }}>
          <label>Distance: {distance.toFixed(1)}</label>
          <div className="help-text">Camera orbit radius. Zoom in for detail or out to fit the whole model.</div>
          <input 
            type="range" min="1" max="100" step="0.1" 
            value={distance} onChange={(e) => setDistance(parseFloat(e.target.value))} 
            disabled={isAutoDistance}
          />
        </div>

        <div className="control-group">
          <label>Elevation: {elevation}&deg;</label>
          <div className="help-text">The vertical angle. 0&deg; is side-on, 90&deg; is directly from above.</div>
          <input 
            type="range" min="-90" max="90" step="1" 
            value={elevation} onChange={(e) => setElevation(parseInt(e.target.value))} 
          />
        </div>

        <div className="control-group">
          <label>Padding: {padding}px</label>
          <div className="help-text">Pixel gap between frames to prevent texture bleeding in shaders.</div>
          <input 
            type="range" min="0" max="64" step="1" 
            value={padding} onChange={(e) => setPadding(parseInt(e.target.value))} 
          />
        </div>

        <div className="control-group">
          <label>Resolution: {resolution}px</label>
          <div className="help-text">The output width/height of each capture in the final sprite sheet.</div>
          <select value={resolution} onChange={(e) => setResolution(parseInt(e.target.value))}>
            <option value={64}>64x64</option>
            <option value={128}>128x128</option>
            <option value={256}>256x256</option>
            <option value={512}>512x512</option>
            <option value={1024}>1024x1024</option>
            <option value={2048}>2048x2048</option>
          </select>
        </div>

        <button className="bake-btn" onClick={handleBake} disabled={isBaking || !previewModelRef.current}>
          {isBaking ? 'BAKING...' : 'BAKE SPRITES'}
        </button>
      </div>

      <div className="viewport-container" ref={viewportRef}>
        <div style={{ position: 'absolute', top: 20, left: 20, color: '#3b82f6', fontSize: '0.8rem', fontWeight: 600 }}>
          3D VIEWPORT • ORBIT PREVIEW
        </div>
      </div>

      <div className="result-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 className="title" style={{ fontSize: '1rem' }}>Camera Preview</h2>
          <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 600 }}>
            {currentCameraIndex + 1} / {frameCount}
          </div>
        </div>
        
        {firstFramePreview ? (
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <div className="help-text" style={{ marginBottom: '0.5rem' }}>Real-time sighting preview of selected camera</div>
            
            <div className="preview-nav-wrapper">
              <button 
                className="nav-arrow left" 
                onClick={() => setCurrentCameraIndex((prev) => (prev - 1 + frameCount) % frameCount)}
              >
                &lsaquo;
              </button>
              
              <img src={firstFramePreview} className="preview-image" alt="Camera preview" style={{ border: `2px solid ${isBaking ? '#333' : '#3b82f6'}`, background: '#000' }} />
              
              <button 
                className="nav-arrow right" 
                onClick={() => setCurrentCameraIndex((prev) => (prev + 1) % frameCount)}
              >
                &rsaquo;
              </button>
            </div>
          </div>
        ) : (
          <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '0.8rem', border: '1px dashed #333', borderRadius: 10, marginBottom: '1rem' }}>
            Load a model to see camera preview
          </div>
        )}

        <h2 className="title" style={{ fontSize: '1rem' }}>Generated Sprite Sheet</h2>
        {bakedImage ? (
          <>
            <img src={bakedImage} className="preview-image" alt="Baked output" />
            <button onClick={() => {
              const link = document.createElement('a');
              link.download = 'spritesheet.png';
              link.href = bakedImage;
              link.click();
            }}>Download PNG</button>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', textAlign: 'center' }}>
            Bake a model to see the result here.
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
