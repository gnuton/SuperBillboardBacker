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
export function calculateAutoDistance(
  object: { boundingBox?: any, getBoundingSphere?: any } | any,
  cameraFov: number = 45,
  margin: number = 1.1
): number {
  const box = new THREE.Box3().setFromObject(object);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  
  // distance = radius / sin(fov / 2)
  const fovRad = (cameraFov * Math.PI) / 180;
  const distance = (sphere.radius * margin) / Math.sin(fovRad / 2);
  
  return distance;
}
