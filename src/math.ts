import * as THREE from 'three';

/**
 * Orbital camera point calculation.
 * Generates a point on a sphere/orbit around a center.
 */
export interface CameraPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculates a point on an orbit around the Y-axis.
 *
 * @param distance - Distance from the center
 * @param azimuthalAngle - Angle in radians around the Y-axis (0 to 2PI)
 * @param elevationAngle - Elevation angle in radians from the XZ plane (-PI/2 to PI/2)
 * @param center - The target center point
 */
export function calculateOrbitalPosition(
  distance: number,
  azimuthalAngle: number,
  elevationAngle: number,
  center: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
): CameraPoint {
  // Spherical to Cartesian coordinates
  // x = r * cos(phi) * cos(theta)
  // y = r * sin(phi)
  // z = r * cos(phi) * sin(theta)
  // where phi is elevation and theta is azimuth

  const x = center.x + distance * Math.cos(elevationAngle) * Math.cos(azimuthalAngle);
  const y = center.y + distance * Math.sin(elevationAngle);
  const z = center.z + distance * Math.cos(elevationAngle) * Math.sin(azimuthalAngle);

  return { x, y, z };
}

/**
 * Calculates the number of rows and columns for a sprite sheet.
 * Aims for a square-ish grid.
 */
export function calculateGrid(frameCount: number) {
  const cols = Math.ceil(Math.sqrt(frameCount));
  const rows = Math.ceil(frameCount / cols);
  return { rows, cols };
}

/**
 * Calculates the optimal distance to fit an object in the camera's view.
 *
 * @param object - The 3D object to measure
 * @param cameraFov - Vertical field of view in degrees (default 45)
 * @param margin - Safety margin multiplier (default 1.1 for 10%)
 */
export function calculateAutoDistance(object: THREE.Object3D, cameraFov: number = 45, margin: number = 1.02): number {
  const box = new THREE.Box3().setFromObject(object);
  const sphere = box.getBoundingSphere(new THREE.Sphere());

  // distance = radius / sin(fov / 2)
  const fovRad = (cameraFov * Math.PI) / 180;
  const distance = (sphere.radius * margin) / Math.sin(fovRad / 2);

  return distance;
}

/**
 * Analyzes pixel alpha data to find the tightest bounding box of non-transparent pixels.
 * Uses a threshold to skip semi-transparent artifacts if necessary.
 *
 * @returns [minX, maxX, minY, maxY] in 0-1 range
 */
export function getAlphaBoundingBox(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): [number, number, number, number] {
  let minX = width,
    maxX = 0,
    minY = height,
    maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha > 5) {
        // Threshold to ignore near-transparent noise
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return [0, 1, 0, 1]; // Fallback to full view

  return [minX / width, maxX / width, minY / height, maxY / height];
}

/**
 * Calculates a relative scale factor to fit the given bounds into a square viewport.
 */
export function getFittingScale(bounds: [number, number, number, number], margin: number = 0.05): number {
  const [minX, maxX, minY, maxY] = bounds;
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  if (contentWidth <= 0 || contentHeight <= 0) return 1.0;

  // We want the larger dimension to fill (1.0 - margin * 2)
  const targetSize = Math.max(0.01, 1.0 - margin * 2);
  const currentSize = Math.max(contentWidth, contentHeight);

  return targetSize / currentSize;
}

/**
 * Merges two bounding boxes.
 */
export function mergeBounds(
  a: [number, number, number, number],
  b: [number, number, number, number]
): [number, number, number, number] {
  return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3])];
}

/**
 * Calculates the vertical world-space offset needed to "ground" an object.
 *
 * @param bounds - [minX, maxX, minY, maxY] in 0-1 range
 * @param distance - Current camera distance
 * @param fov - Vertical FOV in degrees (default 45)
 * @param margin - Lower margin (default 0.05)
 */
export function calculateGroundingOffset(
  bounds: [number, number, number, number],
  distance: number,
  fov: number = 45,
  margin: number = 0.05
): number {
  const [,, , maxY] = bounds;
  // Current bottom is maxY. Target bottom is 1.0 - margin.
  const diffNormalized = 1.0 - margin - maxY;

  // Viewport height in world units at distance D
  const fovRad = (fov * Math.PI) / 180;
  const viewportHeight = 2 * distance * Math.tan(fovRad / 2);

  // Offset in world units
  return diffNormalized * viewportHeight;
}
