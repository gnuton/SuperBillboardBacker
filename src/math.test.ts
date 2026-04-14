import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateOrbitalPosition, calculateGrid, calculateAutoDistance, getAlphaBoundingBox, getFittingScale } from './math';

describe('Math Utilities', () => {
  describe('calculateGrid', () => {
    it('should calculate correct grid for 8 frames', () => {
      const { rows, cols } = calculateGrid(8);
      expect(cols).toBe(3);
      expect(rows).toBe(3);
    });

    it('should calculate correct grid for 16 frames', () => {
      const { rows, cols } = calculateGrid(16);
      expect(cols).toBe(4);
      expect(rows).toBe(4);
    });

    it('should calculate correct grid for 1 frame', () => {
      const { rows, cols } = calculateGrid(1);
      expect(cols).toBe(1);
      expect(rows).toBe(1);
    });
  });

  describe('calculateOrbitalPosition', () => {
    const center = { x: 0, y: 0, z: 0 };
    const distance = 10;

    it('should calculate position at 0 azimuth and 0 elevation', () => {
      const pos = calculateOrbitalPosition(distance, 0, 0, center);
      expect(pos.x).toBeCloseTo(10);
      expect(pos.y).toBeCloseTo(0);
      expect(pos.z).toBeCloseTo(0);
    });

    it('should calculate position at PI azimuthal angle', () => {
      const pos = calculateOrbitalPosition(distance, Math.PI, 0, center);
      expect(pos.x).toBeCloseTo(-10);
      expect(pos.y).toBeCloseTo(0);
      expect(pos.z).toBeCloseTo(0);
    });

    it('should calculate position at PI/2 elevation', () => {
      const pos = calculateOrbitalPosition(distance, 0, Math.PI / 2, center);
      expect(pos.x).toBeCloseTo(0);
      expect(pos.y).toBeCloseTo(10);
      expect(pos.z).toBeCloseTo(0);
    });
  });

  describe('calculateAutoDistance', () => {
    it('should calculate distance for a sphere', () => {
      const geometry = new THREE.SphereGeometry(5);
      const mesh = new THREE.Mesh(geometry);
      
      const distance = calculateAutoDistance(mesh, 45, 1.0);
      
      // For a sphere of radius 5, the bounding box is [-5, -5, -5] to [5, 5, 5]
      // The bounding sphere of THIS BOX has radius sqrt(5^2 + 5^2 + 5^2) = sqrt(75) approx 8.66
      const boxRadius = Math.sqrt(3 * (5 * 5));
      const fovRad = (45 * Math.PI) / 180;
      const expectedDist = boxRadius / Math.sin(fovRad / 2);
      
      expect(distance).toBeCloseTo(expectedDist);
    });
  });

  describe('Alpha Detection', () => {
    it('should find bounding box of a simple square', () => {
      const pixels = new Uint8Array(16 * 16 * 4);
      // Fill a 4x4 square in the middle (from 6,6 to 9,9)
      for (let y = 6; y <= 9; y++) {
        for (let x = 6; x <= 9; x++) {
          pixels[(y * 16 + x) * 4 + 3] = 255;
        }
      }

      const bounds = getAlphaBoundingBox(pixels, 16, 16);
      expect(bounds[0]).toBe(6 / 16);
      expect(bounds[1]).toBe(9 / 16);
      expect(bounds[2]).toBe(6 / 16);
      expect(bounds[3]).toBe(9 / 16);
    });

    it('should calculate correct fitting scale', () => {
      // Bounds cover 30% of the screen (0.6 - 0.3)
      const bounds: [number, number, number, number] = [0.3, 0.6, 0.3, 0.6];
      const margin = 0.1;
      const scale = getFittingScale(bounds, margin);
      
      // targetSize = 1.0 - 0.2 = 0.8
      // currentSize = 0.3
      // scale = 0.8 / 0.3 = 2.666...
      expect(scale).toBeCloseTo(8/3);
    });
  });
});
