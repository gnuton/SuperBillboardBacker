import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SpriteBaker } from '../../src/index';

const App = () => {
  const [frameCount, setFrameCount] = useState(16);
  const [distance, setDistance] = useState(5);
  const [elevation, setElevation] = useState(30);
  const [resolution, setResolution] = useState(256);
  const [padding, setPadding] = useState(2);
  const [isBaking, setIsBaking] = useState(false);
  const [bakedImage, setBakedImage] = useState<string | null>(null);
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const bakerRef = useRef<SpriteBaker>(new SpriteBaker());
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const previewModelRef = useRef<THREE.Object3D | null>(null);
  const markersGroupRef = useRef<THREE.Group>(new THREE.Group());

  useEffect(() => {
    if (!viewportRef.current) return;

    const width = viewportRef.current.clientWidth;
    const height = viewportRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    viewportRef.current.appendChild(renderer.domElement);

    const scene = sceneRef.current;
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
      if (previewModelRef.current) {
        const box = new THREE.Box3().setFromObject(previewModelRef.current);
        const center = box.getCenter(new THREE.Vector3());
        orbitRing.position.set(center.x, center.y + distance * Math.sin(THREE.MathUtils.degToRad(elevation)), center.z);
        // Scale radius based on distance at that height
        const radiusAtElevation = distance * Math.cos(THREE.MathUtils.degToRad(elevation));
        orbitRing.scale.set(radiusAtElevation / distance, radiusAtElevation / distance, 1);
      } else {
        orbitRing.position.y = distance * Math.sin(THREE.MathUtils.degToRad(elevation));
      }

      // Update camera markers
      const radiusAtElevation = distance * Math.cos(THREE.MathUtils.degToRad(elevation));
      const elevationRad = THREE.MathUtils.degToRad(elevation);
      const elevationY = distance * Math.sin(elevationRad);
      
      const box = previewModelRef.current ? new THREE.Box3().setFromObject(previewModelRef.current) : new THREE.Box3();
      const center = box.getCenter(new THREE.Vector3());

      markersGroupRef.current.children.forEach((child, i) => {
        const azimuthRad = (i / frameCount) * Math.PI * 2;
        child.position.set(
          center.x + radiusAtElevation * Math.cos(azimuthRad),
          center.y + elevationY,
          center.z + radiusAtElevation * Math.sin(azimuthRad)
        );
        child.lookAt(center);
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
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
      group.remove(child);
    }

    // Create new markers
    const markerGeom = new THREE.ConeGeometry(0.1, 0.2, 4);
    markerGeom.rotateX(Math.PI / 2); // Point towards center
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < frameCount; i++) {
      const marker = new THREE.Mesh(markerGeom, markerMat);
      group.add(marker);
    }
  }, [frameCount]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      if (previewModelRef.current) {
        sceneRef.current.remove(previewModelRef.current);
      }
      previewModelRef.current = gltf.scene;
      sceneRef.current.add(gltf.scene);
      
      // Focus camera on model
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      setDistance(maxDim * 2.5);
    });
  };

  const handleBake = async () => {
    if (!previewModelRef.current) return;
    setIsBaking(true);
    try {
      const dataUrl = await bakerRef.current.bake({
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
          <label>Load 3D Model (.glb, .gltf)</label>
          <input type="file" onChange={handleFileUpload} accept=".glb,.gltf" />
        </div>

        <div className="control-group">
          <label>n of cameras: {frameCount}</label>
          <input 
            type="range" min="4" max="64" step="1" 
            value={frameCount} onChange={(e) => setFrameCount(parseInt(e.target.value))} 
          />
        </div>

        <div className="control-group">
          <label>Distance: {distance.toFixed(1)}</label>
          <input 
            type="range" min="1" max="20" step="0.1" 
            value={distance} onChange={(e) => setDistance(parseFloat(e.target.value))} 
          />
        </div>

        <div className="control-group">
          <label>Elevation: {elevation}&deg;</label>
          <input 
            type="range" min="-90" max="90" step="1" 
            value={elevation} onChange={(e) => setElevation(parseInt(e.target.value))} 
          />
        </div>

        <div className="control-group">
          <label>Padding: {padding}px</label>
          <input 
            type="range" min="0" max="64" step="1" 
            value={padding} onChange={(e) => setPadding(parseInt(e.target.value))} 
          />
        </div>

        <div className="control-group">
          <label>Resolution: {resolution}px</label>
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
