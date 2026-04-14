# SuperBillboardBacker

A sophisticated TypeScript library and interactive tool designed for game artists to "bake" 3D objects into high-quality 2D sprite frames. It features a configurable orbital camera system that captures models from multiple angles, perfect for creating assets for 2D isometric, top-down, or side-scrolling games.

## Features
- **Orbital Capture**: Define distance, elevation, and number of frames.
- **Three.js Integration**: Seamlessly loads GLTF, GLB, and OBJ formats.
- **High-Resolution Baking**: Captures frames to a stitched sprite sheet.
- **Interactive Preview**: Real-time visualization of capture orbits and camera positions.
- **Developer Friendly**: Written in modern TypeScript with full ESM support.

## Demo
Check out the interactive tool: [Coming Soon](https://gnuton.github.io/SuperBillboardBacker/)

## Quick Start
```bash
npm install super-billboard-backer
```

```typescript
import { SpriteBaker } from 'super-billboard-backer';

const baker = new SpriteBaker();
const result = await baker.bake({
  modelUrl: 'path/to/model.glb',
  frames: 16,
  distance: 5,
  elevation: 30, // Degrees
});

// Download or use the generated sprite sheet
```

## Development & Demo Setup

To test the library and the demo application locally:

1. **Clone and Install**:
   ```bash
   npm install
   ```

2. **Build the Library**:
   The demo relies on the core library logic.
   ```bash
   npm run build
   ```

3. **Run the Demo**:
   Navigate to the demo directory and start the dev server.
   ```bash
   cd demo
   npm install
   npm run dev
   ```

4. **Testing the Tool**:
   - Once the server is running (usually at `http://localhost:3000`), open your browser.
   - Upload a `.glb` or `.gltf` file.
   - Adjust the **Frames**, **Distance**, and **Elevation** sliders.
   - Observe the blue "Orbit Preview" ring in the 3D viewport.
   - Click **BAKE SPRITES** and verify the generated sprite sheet on the right panel.

## Documentation
Detailed specifications can be found in the [docs](./docs) directory.

## License
[GPL-3.0](./LICENSE)
