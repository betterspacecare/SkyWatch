/**
 * Sun Calculator Tests
 *
 * Tests for the Sun_Calculator module that computes Sun position,
 * sky status, and safety warnings.
 *
 * @see Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createSunCalculator } from './sun-calculator';
import type { GeographicCoordinates } from './index';

describe('Sun Calculator', () => {
  const sunCalculator = createSunCalculator();

  // Test observer location (New York City)
  const testObserver: GeographicCoordinates = {
    latitude: 40.7128,
    longitude: -74.006,
  };

  describe('calculate()', () => {
    it('should return valid RA in range [0, 24) hours', () => {
      const timestamp = new Date('2024-06-21T12:00:00Z'); // Summer solstice
      const lst = 12.0;

      const result = sunCalculator.calculate(timestamp, testObserver, lst);

      expect(result.ra).toBeGreaterThanOrEqual(0);
      expect(result.ra).toBeLessThan(24);
    });

    it('should return valid Dec in range [-90, +90] degrees', () => {
      const timestamp = new Date('2024-06-21T12:00:00Z');
      const lst = 12.0;

      const result = sunCalculator.calculate(timestamp, testObserver, lst);

      expect(result.dec).toBeGreaterThanOrEqual(-90);
      expect(result.dec).toBeLessThanOrEqual(90);
    });

    it('should return valid azimuth in range [0, 360) degrees', () => {
      const timestamp = new Date('2024-06-21T12:00:00Z');
      const lst = 12.0;

      const result = sunCalculator.calculate(timestamp, testObserver, lst);

      expect(result.azimuth).toBeGreaterThanOrEqual(0);
      expect(result.azimuth).toBeLessThan(360);
    });

    it('should return valid altitude in range [-90, +90] degrees', () => {
      const timestamp = new Date('2024-06-21T12:00:00Z');
      const lst = 12.0;

      const result = sunCalculator.calculate(timestamp, testObserver, lst);

      expect(result.altitude).toBeGreaterThanOrEqual(-90);
      expect(result.altitude).toBeLessThanOrEqual(90);
    });

    it('should set isBelowHorizon correctly when altitude < 0', () => {
      // Test at midnight when Sun should be below horizon
      const timestamp = new Date('2024-06-21T04:00:00Z'); // ~midnight in NYC
      const lst = 0.0;

      const result = sunCalculator.calculate(timestamp, testObserver, lst);

      expect(result.isBelowHorizon).toBe(result.altitude < 0);
    });

    it('should return daylight status when Sun is above horizon', () => {
      // Test at noon when Sun should be above horizon
      const timestamp = new Date('2024-06-21T17:00:00Z'); // ~noon in NYC
      const lst = 12.0;

      const result = sunCalculator.calculate(timestamp, testObserver, lst);

      // During summer solstice at noon, Sun should be high
      if (result.altitude > 0) {
        expect(result.status).toBe('daylight');
      }
    });

    it('should set safetyWarning when altitude > -18 degrees', () => {
      const timestamp = new Date('2024-06-21T17:00:00Z');
      const lst = 12.0;

      const result = sunCalculator.calculate(timestamp, testObserver, lst);

      expect(result.safetyWarning).toBe(result.altitude > -18);
    });
  });

  describe('getSkyStatus()', () => {
    it('should return "daylight" when altitude > 0', () => {
      expect(sunCalculator.getSkyStatus(10)).toBe('daylight');
      expect(sunCalculator.getSkyStatus(45)).toBe('daylight');
      expect(sunCalculator.getSkyStatus(0.1)).toBe('daylight');
    });

    it('should return "twilight" when altitude is between -18 and 0', () => {
      expect(sunCalculator.getSkyStatus(-1)).toBe('twilight');
      expect(sunCalculator.getSkyStatus(-10)).toBe('twilight');
      expect(sunCalculator.getSkyStatus(-17.9)).toBe('twilight');
    });

    it('should return "night" when altitude <= -18', () => {
      expect(sunCalculator.getSkyStatus(-18)).toBe('night');
      expect(sunCalculator.getSkyStatus(-30)).toBe('night');
      expect(sunCalculator.getSkyStatus(-90)).toBe('night');
    });

    it('should return "twilight" at exactly 0 degrees', () => {
      // At exactly 0, the Sun is on the horizon, not above it
      expect(sunCalculator.getSkyStatus(0)).toBe('twilight');
    });
  });

  describe('Sun position at known dates', () => {
    it('should have positive declination during summer solstice (Northern Hemisphere)', () => {
      const summerSolstice = new Date('2024-06-21T12:00:00Z');
      const lst = 12.0;

      const result = sunCalculator.calculate(summerSolstice, testObserver, lst);

      // Sun should be at maximum northern declination (~23.5°)
      expect(result.dec).toBeGreaterThan(20);
      expect(result.dec).toBeLessThan(25);
    });

    it('should have negative declination during winter solstice (Northern Hemisphere)', () => {
      const winterSolstice = new Date('2024-12-21T12:00:00Z');
      const lst = 12.0;

      const result = sunCalculator.calculate(winterSolstice, testObserver, lst);

      // Sun should be at maximum southern declination (~-23.5°)
      expect(result.dec).toBeLessThan(-20);
      expect(result.dec).toBeGreaterThan(-25);
    });

    it('should have near-zero declination during equinoxes', () => {
      const springEquinox = new Date('2024-03-20T12:00:00Z');
      const lst = 12.0;

      const result = sunCalculator.calculate(springEquinox, testObserver, lst);

      // Sun should be near celestial equator
      expect(Math.abs(result.dec)).toBeLessThan(2);
    });
  });
});

/**
 * Property-Based Tests for Sun Calculator
 *
 * Feature: enhanced-celestial-objects, Property 7: Sun Status and Safety Flag Correctness
 *
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
 */
describe('Property 7: Sun Status and Safety Flag Correctness', () => {
  const sunCalculator = createSunCalculator();

  /**
   * Property 7: Sun Status and Safety Flag Correctness
   *
   * *For any* calculated Sun altitude:
   * - If altitude > 0°, status SHALL be 'daylight'
   * - If -18° < altitude ≤ 0°, status SHALL be 'twilight'
   * - If altitude ≤ -18°, status SHALL be 'night'
   * - safetyWarning SHALL be `true` if and only if altitude > -18°
   *
   * Feature: enhanced-celestial-objects, Property 7: Sun Status and Safety Flag Correctness
   */
  it('should return correct sky status based on altitude thresholds', () => {
    // Generator for valid sun altitudes (-90 to +90 degrees)
    const validSunAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(validSunAltitude, (altitude) => {
        const status = sunCalculator.getSkyStatus(altitude);

        // Verify status based on altitude thresholds
        if (altitude > 0) {
          // Requirement 3.3: altitude > 0° → 'daylight'
          expect(status).toBe('daylight');
        } else if (altitude > -18) {
          // Requirement 3.4: -18° < altitude ≤ 0° → 'twilight'
          expect(status).toBe('twilight');
        } else {
          // Requirement 3.5: altitude ≤ -18° → 'night'
          expect(status).toBe('night');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should set safetyWarning true if and only if altitude > -18°', () => {
    // Generator for valid geographic coordinates
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for valid timestamps (reasonable date range)
    const validTimestamp = fc.date({
      min: new Date('2020-01-01T00:00:00Z'),
      max: new Date('2030-12-31T23:59:59Z'),
    });

    // Generator for valid LST (0-24 hours)
    const validLst = fc.double({ min: 0, max: 24, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(
        validTimestamp,
        validObserver,
        validLst,
        (timestamp, observer, lst) => {
          const result = sunCalculator.calculate(timestamp, observer, lst);

          // Requirement 3.2: safetyWarning SHALL be true if and only if altitude > -18°
          const expectedSafetyWarning = result.altitude > -18;
          expect(result.safetyWarning).toBe(expectedSafetyWarning);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have consistent status and safetyWarning relationship', () => {
    // Generator for valid geographic coordinates
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for valid timestamps
    const validTimestamp = fc.date({
      min: new Date('2020-01-01T00:00:00Z'),
      max: new Date('2030-12-31T23:59:59Z'),
    });

    // Generator for valid LST (0-24 hours)
    const validLst = fc.double({ min: 0, max: 24, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(
        validTimestamp,
        validObserver,
        validLst,
        (timestamp, observer, lst) => {
          const result = sunCalculator.calculate(timestamp, observer, lst);

          // Verify status matches altitude thresholds
          if (result.altitude > 0) {
            expect(result.status).toBe('daylight');
          } else if (result.altitude > -18) {
            expect(result.status).toBe('twilight');
          } else {
            expect(result.status).toBe('night');
          }

          // Verify safetyWarning is true for daylight and twilight, false for night
          if (result.status === 'night') {
            expect(result.safetyWarning).toBe(false);
          } else {
            expect(result.safetyWarning).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
