# SuperBillboardBacker Technical Specification

## Overview
SuperBillboardBacker is a TypeScript library designed to bridge the gap between 3D modeling and 2D game rendering. It allows creators to automate the generation of sprite sheets from 3D models using a configurable orbital camera system.

## Core Components

### 1. SpriteBaker
The main class responsible for the rendering pipeline.
- **Offscreen Rendering**: Uses `THREE.WebGLRenderer` to capture frames without requiring a visible canvas in the DOM.
- **Stitching Engine**: Utilizes a 2D Canvas context to pack individual frames into a single, optimized sprite sheet.

### 2. Orbital Math
The mathematical foundation for camera placement:
- **Spherical Coordinates**: Converts distance, azimuth, and elevation into 3D Cartesian points.
- **Bounding Box Centering**: Automatically calculates the center of the target model to ensure the orbit remains focused regardless of the model's pivot point.

### 3. Grid Packing
- **Algorithm**: Calculates the squarest possible grid for a given number of frames to minimize unused texture space.

## API Reference

### `BakeOptions`
| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `THREE.Object3D` \| `string` | **Required** | The model instance or URL to a GLTF/OBJ. |
| `frameCount` | `number` | **Required** | Total images to capture. |
| `distance` | `number` | `5` | Camera distance from center. |
| `elevation` | `number` | `30` | Vertical angle in degrees. |
| `resolution` | `number` | `256` | Squared size (px) of each frame. |
| `transparent` | `boolean` | `true` | Whether to omit the background. |

## Demo Architecture
The demo application (Vite + React) serves as a visual playground. It utilizes:
- **OrbitControls**: For manual viewport inspection.
- **Real-time Ring Gizmo**: Visualizes the calculated path of the orbital "bake" camera.
- **Glassmorphism UI**: High-fidelity dark mode interface for professional feedback.

## Deployment & CI/CD
- **NPM**: Automated publishing on release tags.
- **GitHub Pages**: Automated deployment of the demo on pushes to `main`.
