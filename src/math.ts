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
