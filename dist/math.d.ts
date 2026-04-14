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
export declare function calculateOrbitalPosition(distance: number, azimuthalAngle: number, elevationAngle: number, center?: {
    x: number;
    y: number;
    z: number;
}): CameraPoint;
/**
 * Calculates the number of rows and columns for a sprite sheet.
 * Aims for a square-ish grid.
 */
export declare function calculateGrid(frameCount: number): {
    rows: number;
    cols: number;
};
//# sourceMappingURL=math.d.ts.map