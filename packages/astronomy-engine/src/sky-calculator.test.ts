/**
 * Property-Based Tests for Sky Calculator
 * Feature: enhanced-celestial-objects
 *
 * Tests the SkyCalculator performance requirements to ensure
 * recalculation completes within the 100ms target.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createSkyCalculator } from './sky-calculator';
import type { Star, Planet, GeographicCoordinates, SpectralType } from './index';
import {
  validGeographicCoordinates,
  validTimestamp,
  PROPERTY_TEST_CONFIG,
} from './test-generators';

/**
 * Feature: enhanced-celestial-objects, Property 18: Recalculation Performance
 *
 * For any typical dataset (up to 10,000 stars, 110 deep sky objects, 88 constellations,
 * 10 satellites, 10 meteor showers), the `recalculate()` method SHALL complete
 * within 100 milliseconds.
 *
 * **Validates: Requirements 8.7**
 */
describe('SkyCalculator Property Tests', () => {
  describe('Property 18: Recalculation Performance', () => {
    it('should complete recalculation within 100ms for random observer locations and timestamps', () => {
      fc.assert(
        fc.property(
          validGeographicCoordinates,
          validTimestamp,
          (observer, timestamp) => {
            const calculator = createSkyCalculator({ observer });
            calculator.setTime(timestamp);

            // Measure recalculation time
            const startTime = performance.now();
            calculator.recalculate();
            const elapsed = performance.now() - startTime;

            // Assert performance requirement
            expect(elapsed).toBeLessThan(100);

            // Cleanup
            calculator.dispose();

            return elapsed < 100;
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });

    it('should complete recalculation within 100ms with varying star counts (up to 10,000)', () => {
      fc.assert(
        fc.property(
          validGeographicCoordinates,
          validTimestamp,
          fc.integer({ min: 0, max: 10000 }),
          (observer, timestamp, starCount) => {
            const calculator = createSkyCalculator({ observer });
            calculator.setTime(timestamp);

            // Generate stars with random positions
            const stars: Star[] = Array.from({ length: starCount }, (_, i) => ({
              id: `HIP${i}`,
              name: i < 100 ? `Star${i}` : null,
              ra: Math.random() * 24,
              dec: Math.random() * 180 - 90,
              magnitude: Math.random() * 8 - 2,
              spectralType: ['O', 'B', 'A', 'F', 'G', 'K', 'M'][Math.floor(Math.random() * 7)] as SpectralType,
            }));

            calculator.setStars(stars);

            // Measure recalculation time
            const startTime = performance.now();
            calculator.recalculate();
            const elapsed = performance.now() - startTime;

            // Assert performance requirement
            expect(elapsed).toBeLessThan(100);

            // Cleanup
            calculator.dispose();

            return elapsed < 100;
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });

    it('should complete recalculation within 100ms with full typical dataset', () => {
      // This test uses a realistic dataset size as specified in the requirement:
      // - Up to 10,000 stars
      // - 110 deep sky objects (Messier catalog - loaded by default)
      // - 88 constellations (loaded by default)
      // - 10 satellites (default ISS + potential others)
      // - 10 meteor showers (loaded by default)

      fc.assert(
        fc.property(
          validGeographicCoordinates,
          validTimestamp,
          fc.integer({ min: 5000, max: 10000 }), // Test with large star counts
          (observer, timestamp, starCount) => {
            const calculator = createSkyCalculator({ observer });
            calculator.setTime(timestamp);

            // Generate a large star catalog
            const stars: Star[] = Array.from({ length: starCount }, (_, i) => ({
              id: `HIP${i}`,
              name: i < 50 ? `Star${i}` : null,
              ra: (i * 0.0024) % 24, // Distribute across RA range
              dec: ((i * 0.018) % 180) - 90, // Distribute across Dec range
              magnitude: (i % 8) - 1,
              spectralType: ['O', 'B', 'A', 'F', 'G', 'K', 'M'][i % 7] as SpectralType,
            }));

            // Generate planets
            const planets: Planet[] = [
              { id: 'mercury', name: 'Mercury', ra: 2.5, dec: 15, magnitude: -0.5 },
              { id: 'venus', name: 'Venus', ra: 5.2, dec: 20, magnitude: -4.0 },
              { id: 'mars', name: 'Mars', ra: 8.1, dec: -5, magnitude: 1.2 },
              { id: 'jupiter', name: 'Jupiter', ra: 12.3, dec: -10, magnitude: -2.5 },
              { id: 'saturn', name: 'Saturn', ra: 18.7, dec: -22, magnitude: 0.5 },
            ];

            calculator.setStars(stars);
            calculator.setPlanets(planets);

            // Measure recalculation time
            const startTime = performance.now();
            const positions = calculator.recalculate();
            const elapsed = performance.now() - startTime;

            // Verify the result contains expected data
            expect(positions.starPositions.size).toBe(starCount);
            expect(positions.planetPositions.size).toBe(5);
            expect(positions.horizonPoints.length).toBeGreaterThan(0);
            expect(positions.moonPosition).not.toBeNull();
            expect(positions.sunPosition).not.toBeNull();
            expect(positions.constellationLines.length).toBeGreaterThanOrEqual(0);
            expect(positions.deepSkyPositions.size).toBeGreaterThanOrEqual(0);
            expect(positions.meteorShowerRadiants.size).toBeGreaterThan(0);

            // Assert performance requirement
            expect(elapsed).toBeLessThan(100);

            // Cleanup
            calculator.dispose();

            return elapsed < 100;
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });

    it('should maintain performance across extreme observer locations (poles and equator)', () => {
      // Test edge cases for observer locations that might affect calculation complexity
      const extremeLocations: fc.Arbitrary<GeographicCoordinates> = fc.oneof(
        // North Pole
        fc.record({
          latitude: fc.constant(90),
          longitude: fc.double({ min: -180, max: 180, noNaN: true }),
        }),
        // South Pole
        fc.record({
          latitude: fc.constant(-90),
          longitude: fc.double({ min: -180, max: 180, noNaN: true }),
        }),
        // Equator
        fc.record({
          latitude: fc.constant(0),
          longitude: fc.double({ min: -180, max: 180, noNaN: true }),
        }),
        // Random valid location
        validGeographicCoordinates
      );

      fc.assert(
        fc.property(
          extremeLocations,
          validTimestamp,
          (observer, timestamp) => {
            const calculator = createSkyCalculator({ observer });
            calculator.setTime(timestamp);

            // Add a moderate dataset
            const stars: Star[] = Array.from({ length: 5000 }, (_, i) => ({
              id: `HIP${i}`,
              name: null,
              ra: (i * 0.0048) % 24,
              dec: ((i * 0.036) % 180) - 90,
              magnitude: (i % 6) + 1,
              spectralType: 'G' as SpectralType,
            }));

            calculator.setStars(stars);

            // Measure recalculation time
            const startTime = performance.now();
            calculator.recalculate();
            const elapsed = performance.now() - startTime;

            // Assert performance requirement
            expect(elapsed).toBeLessThan(100);

            // Cleanup
            calculator.dispose();

            return elapsed < 100;
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });

    it('should maintain performance with repeated recalculations (simulating real-time updates)', () => {
      fc.assert(
        fc.property(
          validGeographicCoordinates,
          validTimestamp,
          fc.integer({ min: 3, max: 10 }), // Number of consecutive recalculations
          (observer, timestamp, recalcCount) => {
            const calculator = createSkyCalculator({ observer });
            calculator.setTime(timestamp);

            // Add a typical dataset
            const stars: Star[] = Array.from({ length: 3000 }, (_, i) => ({
              id: `HIP${i}`,
              name: null,
              ra: (i * 0.008) % 24,
              dec: ((i * 0.06) % 180) - 90,
              magnitude: (i % 6) + 1,
              spectralType: 'K' as SpectralType,
            }));

            calculator.setStars(stars);

            // Perform multiple recalculations and measure each
            let allWithinLimit = true;
            for (let i = 0; i < recalcCount; i++) {
              // Simulate time progression
              const newTime = new Date(timestamp.getTime() + i * 1000);
              calculator.setTime(newTime);

              const startTime = performance.now();
              calculator.recalculate();
              const elapsed = performance.now() - startTime;

              if (elapsed >= 100) {
                allWithinLimit = false;
              }
              expect(elapsed).toBeLessThan(100);
            }

            // Cleanup
            calculator.dispose();

            return allWithinLimit;
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });
});
