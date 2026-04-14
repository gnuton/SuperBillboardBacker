import { useEffect, useRef } from 'react';
import { BillboardBackerUI } from '../../src/index';
import '../../src/ui/BillboardBackerUI.css';

const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<BillboardBackerUI | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize the embeddable UI
    uiRef.current = new BillboardBackerUI({
      container: containerRef.current,
      theme: 'dark',
      onBakeComplete: (dataUrl) => {
        console.log('Bake finished!', dataUrl.length);
      }
    });

    // Example: Programmatically load a default model if needed
    // uiRef.current.loadModel('path/to/model.glb');

    return () => {
      uiRef.current?.dispose();
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default App;
