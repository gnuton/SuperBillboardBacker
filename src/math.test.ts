import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateOrbitalPosition, calculateGrid, calculateAutoDistance } from './math';

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
      
      // radius = 5
      // fov = 45 deg
      // dist = radius / sin(fov/2)
      const expectedDist = 5 / Math.sin((45 / 2) * Math.PI / 180);
      expect(distance).toBeCloseTo(expectedDist);
    });
  });
});
