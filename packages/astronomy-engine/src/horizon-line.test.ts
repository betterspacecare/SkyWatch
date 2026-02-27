import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createHorizonLine, type HorizonLineConfig } from './horizon-line';
import { PROPERTY_TEST_CONFIG } from './test-generators';

describe('HorizonLine', () => {
  describe('createHorizonLine', () => {
    it('should create a horizon line with default configuration', () => {
      const horizonLine = createHorizonLine();
      const config = horizonLine.getConfig();

      expect(config.pointCount).toBe(360);
      expect(config.color).toBe('#4a5568');
      expect(config.opacity).toBe(0.6);
    });

    it('should create a horizon line with custom configuration', () => {
      const customConfig: Partial<HorizonLineConfig> = {
        pointCount: 180,
        color: '#ff0000',
        opacity: 0.8,
      };
      const horizonLine = createHorizonLine(customConfig);
      const config = horizonLine.getConfig();

      expect(config.pointCount).toBe(180);
      expect(config.color).toBe('#ff0000');
      expect(config.opacity).toBe(0.8);
    });

    it('should merge partial configuration with defaults', () => {
      const horizonLine = createHorizonLine({ color: '#00ff00' });
      const config = horizonLine.getConfig();

      expect(config.pointCount).toBe(360);
      expect(config.color).toBe('#00ff00');
      expect(config.opacity).toBe(0.6);
    });
  });

  describe('getHorizonPoints', () => {
    it('should generate the correct number of points', () => {
      const horizonLine = createHorizonLine({ pointCount: 36 });
      const points = horizonLine.getHorizonPoints();

      expect(points).toHaveLength(36);
    });

    it('should generate points with altitude always 0', () => {
      const horizonLine = createHorizonLine({ pointCount: 100 });
      const points = horizonLine.getHorizonPoints();

      for (const point of points) {
        expect(point.altitude).toBe(0);
      }
    });

    it('should generate points with azimuths from 0 to 360 degrees', () => {
      const horizonLine = createHorizonLine({ pointCount: 360 });
      const points = horizonLine.getHorizonPoints();

      // First point should be at azimuth 0
      expect(points[0]!.azimuth).toBe(0);

      // All azimuths should be in range [0, 360)
      for (const point of points) {
        expect(point.azimuth).toBeGreaterThanOrEqual(0);
        expect(point.azimuth).toBeLessThan(360);
      }
    });

    it('should evenly distribute azimuth values', () => {
      const horizonLine = createHorizonLine({ pointCount: 4 });
      const points = horizonLine.getHorizonPoints();

      expect(points[0]!.azimuth).toBe(0);
      expect(points[1]!.azimuth).toBe(90);
      expect(points[2]!.azimuth).toBe(180);
      expect(points[3]!.azimuth).toBe(270);
    });

    it('should handle pointCount of 1', () => {
      const horizonLine = createHorizonLine({ pointCount: 1 });
      const points = horizonLine.getHorizonPoints();

      expect(points).toHaveLength(1);
      expect(points[0]!.azimuth).toBe(0);
      expect(points[0]!.altitude).toBe(0);
    });

    it('should handle fractional pointCount by flooring', () => {
      const horizonLine = createHorizonLine({ pointCount: 10.7 });
      const points = horizonLine.getHorizonPoints();

      expect(points).toHaveLength(10);
    });

    it('should handle zero or negative pointCount by using minimum of 1', () => {
      const horizonLine = createHorizonLine({ pointCount: 0 });
      const points = horizonLine.getHorizonPoints();

      expect(points).toHaveLength(1);
    });
  });

  describe('isBelowHorizon', () => {
    it('should return true for negative altitudes', () => {
      const horizonLine = createHorizonLine();

      expect(horizonLine.isBelowHorizon(-1)).toBe(true);
      expect(horizonLine.isBelowHorizon(-45)).toBe(true);
      expect(horizonLine.isBelowHorizon(-90)).toBe(true);
      expect(horizonLine.isBelowHorizon(-0.001)).toBe(true);
    });

    it('should return false for zero altitude', () => {
      const horizonLine = createHorizonLine();

      expect(horizonLine.isBelowHorizon(0)).toBe(false);
    });

    it('should return false for positive altitudes', () => {
      const horizonLine = createHorizonLine();

      expect(horizonLine.isBelowHorizon(1)).toBe(false);
      expect(horizonLine.isBelowHorizon(45)).toBe(false);
      expect(horizonLine.isBelowHorizon(90)).toBe(false);
      expect(horizonLine.isBelowHorizon(0.001)).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const horizonLine = createHorizonLine();
      const config1 = horizonLine.getConfig();
      const config2 = horizonLine.getConfig();

      // Should be equal but not the same object
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it('should not allow external mutation of config', () => {
      const horizonLine = createHorizonLine();
      const config = horizonLine.getConfig();
      config.pointCount = 999;

      // Internal config should be unchanged
      expect(horizonLine.getConfig().pointCount).toBe(360);
    });
  });

  describe('setConfig', () => {
    it('should update configuration with partial values', () => {
      const horizonLine = createHorizonLine();
      horizonLine.setConfig({ pointCount: 720 });

      const config = horizonLine.getConfig();
      expect(config.pointCount).toBe(720);
      expect(config.color).toBe('#4a5568'); // unchanged
      expect(config.opacity).toBe(0.6); // unchanged
    });

    it('should update multiple configuration values', () => {
      const horizonLine = createHorizonLine();
      horizonLine.setConfig({ color: '#ffffff', opacity: 1.0 });

      const config = horizonLine.getConfig();
      expect(config.color).toBe('#ffffff');
      expect(config.opacity).toBe(1.0);
    });

    it('should affect subsequent getHorizonPoints calls', () => {
      const horizonLine = createHorizonLine({ pointCount: 10 });
      expect(horizonLine.getHorizonPoints()).toHaveLength(10);

      horizonLine.setConfig({ pointCount: 20 });
      expect(horizonLine.getHorizonPoints()).toHaveLength(20);
    });
  });
});

/**
 * Property-Based Tests for Horizon Line
 *
 * These tests verify universal properties across randomized inputs
 * using fast-check with minimum 100 iterations per property.
 *
 * Feature: enhanced-celestial-objects, Property 1: Horizon Altitude Invariant
 */
describe('HorizonLine Property-Based Tests', () => {
  /**
   * Property 1: Horizon Altitude Invariant
   *
   * For any horizon line configuration and any generated horizon point,
   * the altitude value SHALL always equal exactly 0 degrees, and the
   * azimuth values SHALL cover the full range from 0 to 360 degrees.
   *
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Horizon Altitude Invariant', () => {
    // Generator for valid point counts (1 to 1000)
    const validPointCount = fc.integer({ min: 1, max: 1000 });

    // Generator for valid color strings
    const validColor = fc.hexaString({ minLength: 6, maxLength: 6 }).map((hex) => `#${hex}`);

    // Generator for valid opacity values [0, 1]
    const validOpacity = fc.double({ min: 0, max: 1, noNaN: true });

    // Generator for horizon line configuration
    const validHorizonConfig = fc.record({
      pointCount: validPointCount,
      color: validColor,
      opacity: validOpacity,
    });

    it('should always generate points with altitude exactly 0 degrees for any configuration', () => {
      fc.assert(
        fc.property(validHorizonConfig, (config) => {
          const horizonLine = createHorizonLine(config);
          const points = horizonLine.getHorizonPoints();

          // All points must have altitude exactly 0
          for (const point of points) {
            expect(point.altitude).toBe(0);
          }
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should generate the expected number of points for any valid pointCount', () => {
      fc.assert(
        fc.property(validPointCount, (pointCount) => {
          const horizonLine = createHorizonLine({ pointCount });
          const points = horizonLine.getHorizonPoints();

          // Number of points should match the floored pointCount (minimum 1)
          const expectedCount = Math.max(1, Math.floor(pointCount));
          expect(points).toHaveLength(expectedCount);
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should generate azimuth values covering range [0, 360) for any configuration', () => {
      fc.assert(
        fc.property(validHorizonConfig, (config) => {
          const horizonLine = createHorizonLine(config);
          const points = horizonLine.getHorizonPoints();

          // All azimuths must be in valid range [0, 360)
          for (const point of points) {
            expect(point.azimuth).toBeGreaterThanOrEqual(0);
            expect(point.azimuth).toBeLessThan(360);
          }

          // First point should always start at azimuth 0
          if (points.length > 0) {
            expect(points[0]!.azimuth).toBe(0);
          }
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should evenly distribute azimuth values across the full range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 360 }), // Need at least 2 points to check distribution
          (pointCount) => {
            const horizonLine = createHorizonLine({ pointCount });
            const points = horizonLine.getHorizonPoints();

            // Calculate expected step between consecutive azimuths
            const expectedStep = 360 / pointCount;

            // Verify even distribution
            for (let i = 0; i < points.length; i++) {
              const expectedAzimuth = i * expectedStep;
              expect(points[i]!.azimuth).toBeCloseTo(expectedAzimuth, 10);
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should cover the full azimuth range when pointCount is sufficient', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 360 }), // Need enough points to cover quadrants
          (pointCount) => {
            const horizonLine = createHorizonLine({ pointCount });
            const points = horizonLine.getHorizonPoints();
            const azimuths = points.map((p) => p.azimuth);

            // Should have points in all four quadrants (0-90, 90-180, 180-270, 270-360)
            const hasQ1 = azimuths.some((az) => az >= 0 && az < 90);
            const hasQ2 = azimuths.some((az) => az >= 90 && az < 180);
            const hasQ3 = azimuths.some((az) => az >= 180 && az < 270);
            const hasQ4 = azimuths.some((az) => az >= 270 && az < 360);

            expect(hasQ1).toBe(true);
            expect(hasQ2).toBe(true);
            expect(hasQ3).toBe(true);
            expect(hasQ4).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});


/**
 * Property-Based Tests for Below Horizon Flag
 *
 * These tests verify the correctness of the isBelowHorizon flag
 * across randomized altitude inputs using fast-check.
 *
 * Feature: enhanced-celestial-objects, Property 2: Below Horizon Flag Correctness
 */
describe('HorizonLine Property-Based Tests - Below Horizon Flag', () => {
  /**
   * Property 2: Below Horizon Flag Correctness
   *
   * For any celestial object with a calculated altitude, the `isBelowHorizon`
   * flag SHALL be `true` if and only if the altitude is less than 0 degrees.
   *
   * **Validates: Requirements 1.4**
   */
  describe('Property 2: Below Horizon Flag Correctness', () => {
    // Generator for valid altitude values [-90, +90]
    const validAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
    });

    // Generator for negative altitudes (below horizon)
    const negativeAltitude = fc.double({
      min: -90,
      max: -Number.MIN_VALUE,
      noNaN: true,
    });

    // Generator for non-negative altitudes (at or above horizon)
    const nonNegativeAltitude = fc.double({
      min: 0,
      max: 90,
      noNaN: true,
    });

    it('should return true if and only if altitude is less than 0 degrees', () => {
      fc.assert(
        fc.property(validAltitude, (altitude) => {
          const horizonLine = createHorizonLine();
          const result = horizonLine.isBelowHorizon(altitude);

          // The flag should be true if and only if altitude < 0
          if (altitude < 0) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should always return true for any negative altitude', () => {
      fc.assert(
        fc.property(negativeAltitude, (altitude) => {
          const horizonLine = createHorizonLine();
          const result = horizonLine.isBelowHorizon(altitude);

          expect(result).toBe(true);
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should always return false for any non-negative altitude', () => {
      fc.assert(
        fc.property(nonNegativeAltitude, (altitude) => {
          const horizonLine = createHorizonLine();
          const result = horizonLine.isBelowHorizon(altitude);

          expect(result).toBe(false);
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should be consistent across multiple calls with the same altitude', () => {
      fc.assert(
        fc.property(validAltitude, (altitude) => {
          const horizonLine = createHorizonLine();

          // Multiple calls should return the same result
          const result1 = horizonLine.isBelowHorizon(altitude);
          const result2 = horizonLine.isBelowHorizon(altitude);
          const result3 = horizonLine.isBelowHorizon(altitude);

          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should be independent of horizon line configuration', () => {
      fc.assert(
        fc.property(
          validAltitude,
          fc.integer({ min: 1, max: 1000 }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          (altitude, pointCount, opacity) => {
            // Create horizon lines with different configurations
            const horizonLine1 = createHorizonLine();
            const horizonLine2 = createHorizonLine({ pointCount, opacity });
            const horizonLine3 = createHorizonLine({ color: '#ff0000', pointCount: 720 });

            // isBelowHorizon should return the same result regardless of config
            const result1 = horizonLine1.isBelowHorizon(altitude);
            const result2 = horizonLine2.isBelowHorizon(altitude);
            const result3 = horizonLine3.isBelowHorizon(altitude);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should correctly handle boundary values near zero', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -0.001, max: 0.001, noNaN: true }),
          (altitude) => {
            const horizonLine = createHorizonLine();
            const result = horizonLine.isBelowHorizon(altitude);

            // Strict less than zero check
            expect(result).toBe(altitude < 0);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});
