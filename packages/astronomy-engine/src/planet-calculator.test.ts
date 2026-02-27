/**
 * Planet Calculator Unit Tests
 *
 * Tests for the Planet_Calculator module that wraps the astronomy-engine
 * library for planetary position calculations.
 *
 * @see Requirements 9.1, 9.2, 9.3
 */

import { describe, it, expect } from 'vitest';
import { createPlanetCalculator, planetCalculator } from './planet-calculator';
import type { GeographicCoordinates } from './index';

describe('Planet Calculator', () => {
  // Test observer location (New York City)
  const testObserver: GeographicCoordinates = {
    latitude: 40.7128,
    longitude: -74.006,
  };

  // Test timestamp (fixed date for reproducible tests)
  const testTimestamp = new Date('2024-06-15T12:00:00Z');

  describe('createPlanetCalculator', () => {
    it('should create a planet calculator instance', () => {
      const calculator = createPlanetCalculator();
      expect(calculator).toBeDefined();
      expect(calculator.calculatePlanetPositions).toBeInstanceOf(Function);
      expect(calculator.getPlanetPosition).toBeInstanceOf(Function);
    });
  });

  describe('calculatePlanetPositions', () => {
    it('should return positions for all 7 visible planets (excluding Earth)', () => {
      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        testObserver
      );

      expect(planets).toHaveLength(7);
    });

    it('should include all expected planets', () => {
      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        testObserver
      );

      const planetNames = planets.map((p) => p.name);
      expect(planetNames).toContain('Mercury');
      expect(planetNames).toContain('Venus');
      expect(planetNames).toContain('Mars');
      expect(planetNames).toContain('Jupiter');
      expect(planetNames).toContain('Saturn');
      expect(planetNames).toContain('Uranus');
      expect(planetNames).toContain('Neptune');
    });

    it('should return valid RA values (0-24 hours)', () => {
      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        testObserver
      );

      for (const planet of planets) {
        expect(planet.ra).toBeGreaterThanOrEqual(0);
        expect(planet.ra).toBeLessThan(24);
      }
    });

    it('should return valid Dec values (-90 to +90 degrees)', () => {
      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        testObserver
      );

      for (const planet of planets) {
        expect(planet.dec).toBeGreaterThanOrEqual(-90);
        expect(planet.dec).toBeLessThanOrEqual(90);
      }
    });

    it('should return valid magnitude values', () => {
      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        testObserver
      );

      for (const planet of planets) {
        // Magnitudes for planets typically range from about -5 to +8
        expect(planet.magnitude).toBeGreaterThanOrEqual(-5);
        expect(planet.magnitude).toBeLessThanOrEqual(10);
      }
    });

    it('should have correct planet IDs', () => {
      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        testObserver
      );

      const expectedIds = [
        'mercury',
        'venus',
        'mars',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
      ];

      const actualIds = planets.map((p) => p.id);
      for (const id of expectedIds) {
        expect(actualIds).toContain(id);
      }
    });

    it('should calculate different positions for different timestamps', () => {
      const timestamp1 = new Date('2024-01-01T00:00:00Z');
      const timestamp2 = new Date('2024-07-01T00:00:00Z');

      const planets1 = planetCalculator.calculatePlanetPositions(
        timestamp1,
        testObserver
      );
      const planets2 = planetCalculator.calculatePlanetPositions(
        timestamp2,
        testObserver
      );

      // Mars should have noticeably different positions 6 months apart
      const mars1 = planets1.find((p) => p.name === 'Mars');
      const mars2 = planets2.find((p) => p.name === 'Mars');

      expect(mars1).toBeDefined();
      expect(mars2).toBeDefined();

      // Positions should be different (Mars moves significantly in 6 months)
      const raDiff = Math.abs(mars1!.ra - mars2!.ra);
      const decDiff = Math.abs(mars1!.dec - mars2!.dec);

      // At least one coordinate should differ significantly
      expect(raDiff > 0.1 || decDiff > 0.1).toBe(true);
    });

    it('should work with different observer locations', () => {
      const observer1: GeographicCoordinates = {
        latitude: 0,
        longitude: 0,
      };
      const observer2: GeographicCoordinates = {
        latitude: 45,
        longitude: 90,
      };

      const planets1 = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        observer1
      );
      const planets2 = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        observer2
      );

      // Both should return valid results
      expect(planets1).toHaveLength(7);
      expect(planets2).toHaveLength(7);

      // RA/Dec are geocentric, so they should be very similar
      // (observer location affects horizontal coords, not equatorial)
      const mars1 = planets1.find((p) => p.name === 'Mars');
      const mars2 = planets2.find((p) => p.name === 'Mars');

      expect(mars1).toBeDefined();
      expect(mars2).toBeDefined();

      // RA/Dec should be nearly identical (small parallax difference)
      expect(Math.abs(mars1!.ra - mars2!.ra)).toBeLessThan(0.1);
      expect(Math.abs(mars1!.dec - mars2!.dec)).toBeLessThan(0.1);
    });
  });

  describe('getPlanetPosition', () => {
    it('should return position for a valid planet name', () => {
      const mars = planetCalculator.getPlanetPosition(
        'Mars',
        testTimestamp,
        testObserver
      );

      expect(mars).not.toBeNull();
      expect(mars!.name).toBe('Mars');
      expect(mars!.id).toBe('mars');
    });

    it('should handle case-insensitive planet names', () => {
      const mars1 = planetCalculator.getPlanetPosition(
        'mars',
        testTimestamp,
        testObserver
      );
      const mars2 = planetCalculator.getPlanetPosition(
        'MARS',
        testTimestamp,
        testObserver
      );
      const mars3 = planetCalculator.getPlanetPosition(
        'Mars',
        testTimestamp,
        testObserver
      );

      expect(mars1).not.toBeNull();
      expect(mars2).not.toBeNull();
      expect(mars3).not.toBeNull();

      // All should return the same position
      expect(mars1!.ra).toBe(mars2!.ra);
      expect(mars1!.ra).toBe(mars3!.ra);
    });

    it('should return null for invalid planet name', () => {
      const result = planetCalculator.getPlanetPosition(
        'Pluto',
        testTimestamp,
        testObserver
      );

      expect(result).toBeNull();
    });

    it('should return null for Earth (we observe from Earth)', () => {
      const result = planetCalculator.getPlanetPosition(
        'Earth',
        testTimestamp,
        testObserver
      );

      expect(result).toBeNull();
    });

    it('should return valid coordinates for each planet', () => {
      const planetNames = [
        'Mercury',
        'Venus',
        'Mars',
        'Jupiter',
        'Saturn',
        'Uranus',
        'Neptune',
      ];

      for (const name of planetNames) {
        const planet = planetCalculator.getPlanetPosition(
          name,
          testTimestamp,
          testObserver
        );

        expect(planet).not.toBeNull();
        expect(planet!.ra).toBeGreaterThanOrEqual(0);
        expect(planet!.ra).toBeLessThan(24);
        expect(planet!.dec).toBeGreaterThanOrEqual(-90);
        expect(planet!.dec).toBeLessThanOrEqual(90);
      }
    });
  });

  describe('Position accuracy', () => {
    it('should calculate Venus position within expected range', () => {
      // Venus is always relatively close to the Sun in the sky
      // Its elongation from the Sun is at most ~47 degrees
      const venus = planetCalculator.getPlanetPosition(
        'Venus',
        testTimestamp,
        testObserver
      );

      expect(venus).not.toBeNull();
      // Venus should have a valid position
      expect(venus!.ra).toBeGreaterThanOrEqual(0);
      expect(venus!.ra).toBeLessThan(24);
    });

    it('should show outer planets with reasonable magnitudes', () => {
      const jupiter = planetCalculator.getPlanetPosition(
        'Jupiter',
        testTimestamp,
        testObserver
      );
      const saturn = planetCalculator.getPlanetPosition(
        'Saturn',
        testTimestamp,
        testObserver
      );

      expect(jupiter).not.toBeNull();
      expect(saturn).not.toBeNull();

      // Jupiter is typically between -3 and -1 magnitude
      expect(jupiter!.magnitude).toBeLessThan(0);
      expect(jupiter!.magnitude).toBeGreaterThan(-4);

      // Saturn is typically between -0.5 and +1.5 magnitude
      expect(saturn!.magnitude).toBeLessThan(2);
      expect(saturn!.magnitude).toBeGreaterThan(-1);
    });
  });

  describe('Edge cases', () => {
    it('should handle dates far in the past', () => {
      const pastDate = new Date('2000-01-01T00:00:00Z');
      const planets = planetCalculator.calculatePlanetPositions(
        pastDate,
        testObserver
      );

      expect(planets).toHaveLength(7);
      for (const planet of planets) {
        expect(planet.ra).toBeGreaterThanOrEqual(0);
        expect(planet.ra).toBeLessThan(24);
      }
    });

    it('should handle dates in the future', () => {
      const futureDate = new Date('2030-12-31T23:59:59Z');
      const planets = planetCalculator.calculatePlanetPositions(
        futureDate,
        testObserver
      );

      expect(planets).toHaveLength(7);
      for (const planet of planets) {
        expect(planet.ra).toBeGreaterThanOrEqual(0);
        expect(planet.ra).toBeLessThan(24);
      }
    });

    it('should handle observer at North Pole', () => {
      const northPole: GeographicCoordinates = {
        latitude: 90,
        longitude: 0,
      };

      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        northPole
      );

      expect(planets).toHaveLength(7);
    });

    it('should handle observer at South Pole', () => {
      const southPole: GeographicCoordinates = {
        latitude: -90,
        longitude: 0,
      };

      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        southPole
      );

      expect(planets).toHaveLength(7);
    });

    it('should handle observer at date line', () => {
      const dateLine: GeographicCoordinates = {
        latitude: 0,
        longitude: 180,
      };

      const planets = planetCalculator.calculatePlanetPositions(
        testTimestamp,
        dateLine
      );

      expect(planets).toHaveLength(7);
    });
  });
});
