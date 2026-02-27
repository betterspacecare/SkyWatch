/**
 * Moon Calculator Unit Tests
 *
 * Tests for the Moon_Calculator module that computes lunar position,
 * phase, illumination, and magnitude.
 *
 * @module moon-calculator.test
 */

import { describe, it, expect } from 'vitest';
import { createMoonCalculator, type LunarPhaseName } from './moon-calculator';
import type { GeographicCoordinates } from './index';

describe('Moon Calculator', () => {
  const calculator = createMoonCalculator();

  // Test observer location (New York City)
  const observer: GeographicCoordinates = {
    latitude: 40.7128,
    longitude: -74.006,
  };

  describe('calculate()', () => {
    it('should return valid RA in range [0, 24) hours', () => {
      const timestamp = new Date('2024-01-15T00:00:00Z');
      const lst = 12.0;
      const result = calculator.calculate(timestamp, observer, lst);

      expect(result.ra).toBeGreaterThanOrEqual(0);
      expect(result.ra).toBeLessThan(24);
    });

    it('should return valid Dec in range [-90, +90] degrees', () => {
      const timestamp = new Date('2024-01-15T00:00:00Z');
      const lst = 12.0;
      const result = calculator.calculate(timestamp, observer, lst);

      expect(result.dec).toBeGreaterThanOrEqual(-90);
      expect(result.dec).toBeLessThanOrEqual(90);
    });

    it('should return valid azimuth in range [0, 360) degrees', () => {
      const timestamp = new Date('2024-01-15T00:00:00Z');
      const lst = 12.0;
      const result = calculator.calculate(timestamp, observer, lst);

      expect(result.azimuth).toBeGreaterThanOrEqual(0);
      expect(result.azimuth).toBeLessThan(360);
    });

    it('should return valid altitude in range [-90, +90] degrees', () => {
      const timestamp = new Date('2024-01-15T00:00:00Z');
      const lst = 12.0;
      const result = calculator.calculate(timestamp, observer, lst);

      expect(result.altitude).toBeGreaterThanOrEqual(-90);
      expect(result.altitude).toBeLessThanOrEqual(90);
    });

    it('should return valid illumination in range [0, 100]', () => {
      const timestamp = new Date('2024-01-15T00:00:00Z');
      const lst = 12.0;
      const result = calculator.calculate(timestamp, observer, lst);

      expect(result.illumination).toBeGreaterThanOrEqual(0);
      expect(result.illumination).toBeLessThanOrEqual(100);
    });

    it('should return a valid lunar phase name', () => {
      const validPhases: LunarPhaseName[] = [
        'New Moon',
        'Waxing Crescent',
        'First Quarter',
        'Waxing Gibbous',
        'Full Moon',
        'Waning Gibbous',
        'Last Quarter',
        'Waning Crescent',
      ];

      const timestamp = new Date('2024-01-15T00:00:00Z');
      const lst = 12.0;
      const result = calculator.calculate(timestamp, observer, lst);

      expect(validPhases).toContain(result.phaseName);
    });

    it('should return a finite magnitude value', () => {
      const timestamp = new Date('2024-01-15T00:00:00Z');
      const lst = 12.0;
      const result = calculator.calculate(timestamp, observer, lst);

      expect(Number.isFinite(result.magnitude)).toBe(true);
    });

    it('should correctly set isBelowHorizon flag based on altitude', () => {
      const timestamp = new Date('2024-01-15T00:00:00Z');
      const lst = 12.0;
      const result = calculator.calculate(timestamp, observer, lst);

      expect(result.isBelowHorizon).toBe(result.altitude < 0);
    });
  });

  describe('phase calculations', () => {
    it('should return New Moon phase near known new moon date', () => {
      // January 11, 2024 was a New Moon
      const newMoonDate = new Date('2024-01-11T11:57:00Z');
      const lst = 12.0;
      const result = calculator.calculate(newMoonDate, observer, lst);

      expect(result.phaseName).toBe('New Moon');
      expect(result.illumination).toBeLessThan(10); // Should be very low
    });

    it('should return Full Moon phase near known full moon date', () => {
      // January 25, 2024 was a Full Moon
      const fullMoonDate = new Date('2024-01-25T17:54:00Z');
      const lst = 12.0;
      const result = calculator.calculate(fullMoonDate, observer, lst);

      expect(result.phaseName).toBe('Full Moon');
      expect(result.illumination).toBeGreaterThan(90); // Should be very high
    });

    it('should return First Quarter phase near known first quarter date', () => {
      // January 18, 2024 was First Quarter
      const firstQuarterDate = new Date('2024-01-18T03:52:00Z');
      const lst = 12.0;
      const result = calculator.calculate(firstQuarterDate, observer, lst);

      expect(result.phaseName).toBe('First Quarter');
      expect(result.illumination).toBeGreaterThan(40);
      expect(result.illumination).toBeLessThan(60);
    });
  });

  describe('magnitude calculations', () => {
    it('should return brighter (lower) magnitude for full moon', () => {
      const fullMoonDate = new Date('2024-01-25T17:54:00Z');
      const newMoonDate = new Date('2024-01-11T11:57:00Z');
      const lst = 12.0;

      const fullMoonResult = calculator.calculate(fullMoonDate, observer, lst);
      const newMoonResult = calculator.calculate(newMoonDate, observer, lst);

      // Full moon should be brighter (lower magnitude)
      expect(fullMoonResult.magnitude).toBeLessThan(newMoonResult.magnitude);
    });

    it('should return magnitude around -12.7 for full moon', () => {
      const fullMoonDate = new Date('2024-01-25T17:54:00Z');
      const lst = 12.0;
      const result = calculator.calculate(fullMoonDate, observer, lst);

      // Full moon magnitude should be close to -12.7
      expect(result.magnitude).toBeLessThan(-10);
      expect(result.magnitude).toBeGreaterThan(-15);
    });
  });

  describe('position changes over time', () => {
    it('should return different positions for different timestamps', () => {
      const timestamp1 = new Date('2024-01-15T00:00:00Z');
      const timestamp2 = new Date('2024-01-15T12:00:00Z');
      const lst = 12.0;

      const result1 = calculator.calculate(timestamp1, observer, lst);
      const result2 = calculator.calculate(timestamp2, observer, lst);

      // Moon moves significantly in 12 hours
      expect(result1.ra).not.toBe(result2.ra);
    });
  });
});


/**
 * Property-Based Tests for Celestial Body RA/Dec Validity
 *
 * These tests verify that the Moon_Calculator returns valid RA/Dec values
 * across randomized timestamps and observer locations using fast-check.
 *
 * Feature: enhanced-celestial-objects, Property 3: Celestial Body RA/Dec Validity
 */
import fc from 'fast-check';
import { PROPERTY_TEST_CONFIG, validGeographicCoordinates, validLST, validTimestamp } from './test-generators';

describe('Moon Calculator Property-Based Tests', () => {
  /**
   * Property 3: Celestial Body RA/Dec Validity
   *
   * For any timestamp and observer location, the Moon_Calculator SHALL return
   * Right Ascension values in the range [0, 24) hours and Declination values
   * in the range [-90, +90] degrees.
   *
   * **Validates: Requirements 2.1, 3.1**
   */
  describe('Property 3: Celestial Body RA/Dec Validity', () => {
    const calculator = createMoonCalculator();

    it('should return RA in range [0, 24) hours for any timestamp and observer location', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // RA must be in range [0, 24)
            expect(result.ra).toBeGreaterThanOrEqual(0);
            expect(result.ra).toBeLessThan(24);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return Dec in range [-90, +90] degrees for any timestamp and observer location', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // Dec must be in range [-90, +90]
            expect(result.dec).toBeGreaterThanOrEqual(-90);
            expect(result.dec).toBeLessThanOrEqual(90);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return valid RA and Dec for any valid input combination', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // Both RA and Dec must be valid simultaneously
            expect(result.ra).toBeGreaterThanOrEqual(0);
            expect(result.ra).toBeLessThan(24);
            expect(result.dec).toBeGreaterThanOrEqual(-90);
            expect(result.dec).toBeLessThanOrEqual(90);

            // Values must be finite numbers (not NaN or Infinity)
            expect(Number.isFinite(result.ra)).toBe(true);
            expect(Number.isFinite(result.dec)).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return valid RA/Dec for extreme observer latitudes', () => {
      // Test with polar and equatorial observers
      const extremeLatitudes = fc.constantFrom(-90, -45, 0, 45, 90);
      const validLongitude = fc.double({ min: -180, max: 180, noNaN: true });

      fc.assert(
        fc.property(
          validTimestamp,
          extremeLatitudes,
          validLongitude,
          validLST,
          (timestamp, latitude, longitude, lst) => {
            const observer: GeographicCoordinates = { latitude, longitude };
            const result = calculator.calculate(timestamp, observer, lst);

            // RA and Dec must still be valid at extreme latitudes
            expect(result.ra).toBeGreaterThanOrEqual(0);
            expect(result.ra).toBeLessThan(24);
            expect(result.dec).toBeGreaterThanOrEqual(-90);
            expect(result.dec).toBeLessThanOrEqual(90);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return valid RA/Dec for timestamps across different years', () => {
      // Test with timestamps spanning multiple years
      const extendedTimestamp = fc.date({
        min: new Date('2000-01-01T00:00:00Z'),
        max: new Date('2050-12-31T23:59:59Z'),
      });

      fc.assert(
        fc.property(
          extendedTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // RA and Dec must be valid for any date in the range
            expect(result.ra).toBeGreaterThanOrEqual(0);
            expect(result.ra).toBeLessThan(24);
            expect(result.dec).toBeGreaterThanOrEqual(-90);
            expect(result.dec).toBeLessThanOrEqual(90);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return consistent RA/Dec for the same inputs', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            // Calculate twice with the same inputs
            const result1 = calculator.calculate(timestamp, observer, lst);
            const result2 = calculator.calculate(timestamp, observer, lst);

            // Results should be identical
            expect(result1.ra).toBe(result2.ra);
            expect(result1.dec).toBe(result2.dec);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});



/**
 * Property-Based Tests for Moon Phase Name Validity
 *
 * These tests verify that the Moon_Calculator returns a valid lunar phase name
 * across randomized timestamps using fast-check.
 *
 * Feature: enhanced-celestial-objects, Property 4: Moon Phase Name Validity
 */
describe('Moon Calculator Property-Based Tests - Phase Name Validity', () => {
  /**
   * Property 4: Moon Phase Name Validity
   *
   * For any timestamp, the Moon_Calculator SHALL return a phase name that is
   * exactly one of the eight valid lunar phases: New Moon, Waxing Crescent,
   * First Quarter, Waxing Gibbous, Full Moon, Waning Gibbous, Last Quarter,
   * or Waning Crescent.
   *
   * **Validates: Requirements 2.2**
   */
  describe('Property 4: Moon Phase Name Validity', () => {
    const calculator = createMoonCalculator();

    const VALID_LUNAR_PHASES: LunarPhaseName[] = [
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent',
    ];

    // Default observer for phase tests (phase is independent of observer location)
    const defaultObserver: GeographicCoordinates = {
      latitude: 0,
      longitude: 0,
    };
    const defaultLST = 12.0;

    it('should return a valid lunar phase name for any timestamp', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Phase name must be exactly one of the eight valid phases
            expect(VALID_LUNAR_PHASES).toContain(result.phaseName);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return a valid lunar phase name for timestamps across extended date range', () => {
      // Test with timestamps spanning multiple decades
      const extendedTimestamp = fc.date({
        min: new Date('1990-01-01T00:00:00Z'),
        max: new Date('2100-12-31T23:59:59Z'),
      });

      fc.assert(
        fc.property(
          extendedTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Phase name must be exactly one of the eight valid phases
            expect(VALID_LUNAR_PHASES).toContain(result.phaseName);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return a valid lunar phase name for any observer location', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // Phase name must be exactly one of the eight valid phases
            // (phase is determined by Sun-Earth-Moon geometry, not observer location)
            expect(VALID_LUNAR_PHASES).toContain(result.phaseName);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return the same phase name for the same timestamp regardless of observer', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validGeographicCoordinates,
          validLST,
          validLST,
          (timestamp, observer1, observer2, lst1, lst2) => {
            const result1 = calculator.calculate(timestamp, observer1, lst1);
            const result2 = calculator.calculate(timestamp, observer2, lst2);

            // Phase name should be the same for both observers at the same timestamp
            // because lunar phase depends on Sun-Earth-Moon geometry, not observer position
            expect(result1.phaseName).toBe(result2.phaseName);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return phase name as a string type', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Phase name must be a string
            expect(typeof result.phaseName).toBe('string');
            // Phase name must not be empty
            expect(result.phaseName.length).toBeGreaterThan(0);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return phase name that matches the LunarPhaseName type exactly', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Verify the phase name is exactly one of the valid phases (case-sensitive)
            const isValidPhase = VALID_LUNAR_PHASES.some(
              (phase) => phase === result.phaseName
            );
            expect(isValidPhase).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});



/**
 * Property-Based Tests for Moon Phase Name Validity
 *
 * These tests verify that the Moon_Calculator returns a valid lunar phase name
 * across randomized timestamps using fast-check.
 *
 * Feature: enhanced-celestial-objects, Property 4: Moon Phase Name Validity
 */
describe('Moon Calculator Property-Based Tests - Phase Name Validity', () => {
  /**
   * Property 4: Moon Phase Name Validity
   *
   * For any timestamp, the Moon_Calculator SHALL return a phase name that is
   * exactly one of the eight valid lunar phases: New Moon, Waxing Crescent,
   * First Quarter, Waxing Gibbous, Full Moon, Waning Gibbous, Last Quarter,
   * or Waning Crescent.
   *
   * **Validates: Requirements 2.2**
   */
  describe('Property 4: Moon Phase Name Validity', () => {
    const calculator = createMoonCalculator();

    const VALID_LUNAR_PHASES: LunarPhaseName[] = [
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent',
    ];

    // Default observer for phase tests (phase is independent of observer location)
    const defaultObserver: GeographicCoordinates = {
      latitude: 0,
      longitude: 0,
    };
    const defaultLST = 12.0;

    it('should return a valid lunar phase name for any timestamp', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Phase name must be exactly one of the eight valid phases
            expect(VALID_LUNAR_PHASES).toContain(result.phaseName);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return a valid lunar phase name for timestamps across extended date range', () => {
      // Test with timestamps spanning multiple decades
      const extendedTimestamp = fc.date({
        min: new Date('1990-01-01T00:00:00Z'),
        max: new Date('2100-12-31T23:59:59Z'),
      });

      fc.assert(
        fc.property(
          extendedTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Phase name must be exactly one of the eight valid phases
            expect(VALID_LUNAR_PHASES).toContain(result.phaseName);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return a valid lunar phase name for any observer location', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // Phase name must be exactly one of the eight valid phases
            // (phase is determined by Sun-Earth-Moon geometry, not observer location)
            expect(VALID_LUNAR_PHASES).toContain(result.phaseName);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return the same phase name for the same timestamp regardless of observer', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validGeographicCoordinates,
          validLST,
          validLST,
          (timestamp, observer1, observer2, lst1, lst2) => {
            const result1 = calculator.calculate(timestamp, observer1, lst1);
            const result2 = calculator.calculate(timestamp, observer2, lst2);

            // Phase name should be the same for both observers at the same timestamp
            // because lunar phase depends on Sun-Earth-Moon geometry, not observer position
            expect(result1.phaseName).toBe(result2.phaseName);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return phase name as a string type', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Phase name must be a string
            expect(typeof result.phaseName).toBe('string');
            // Phase name must not be empty
            expect(result.phaseName.length).toBeGreaterThan(0);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return phase name that matches the LunarPhaseName type exactly', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Verify the phase name is exactly one of the valid phases (case-sensitive)
            const isValidPhase = VALID_LUNAR_PHASES.some(
              (phase) => phase === result.phaseName
            );
            expect(isValidPhase).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});


/**
 * Property-Based Tests for Moon Illumination Bounds
 *
 * These tests verify that the Moon_Calculator returns illumination percentage
 * within the valid range [0, 100] across randomized timestamps using fast-check.
 *
 * Feature: enhanced-celestial-objects, Property 5: Moon Illumination Bounds
 */
describe('Moon Calculator Property-Based Tests - Illumination Bounds', () => {
  /**
   * Property 5: Moon Illumination Bounds
   *
   * For any timestamp, the Moon_Calculator SHALL return an illumination
   * percentage in the range [0, 100].
   *
   * **Validates: Requirements 2.3**
   */
  describe('Property 5: Moon Illumination Bounds', () => {
    const calculator = createMoonCalculator();

    // Default observer for illumination tests (illumination is independent of observer location)
    const defaultObserver: GeographicCoordinates = {
      latitude: 0,
      longitude: 0,
    };
    const defaultLST = 12.0;

    it('should return illumination in range [0, 100] for any timestamp', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Illumination must be in range [0, 100]
            expect(result.illumination).toBeGreaterThanOrEqual(0);
            expect(result.illumination).toBeLessThanOrEqual(100);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return illumination in range [0, 100] for timestamps across extended date range', () => {
      // Test with timestamps spanning multiple decades
      const extendedTimestamp = fc.date({
        min: new Date('1990-01-01T00:00:00Z'),
        max: new Date('2100-12-31T23:59:59Z'),
      });

      fc.assert(
        fc.property(
          extendedTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Illumination must be in range [0, 100]
            expect(result.illumination).toBeGreaterThanOrEqual(0);
            expect(result.illumination).toBeLessThanOrEqual(100);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return illumination as a finite number for any timestamp', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Illumination must be a finite number (not NaN or Infinity)
            expect(Number.isFinite(result.illumination)).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return the same illumination for the same timestamp regardless of observer', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validGeographicCoordinates,
          validLST,
          validLST,
          (timestamp, observer1, observer2, lst1, lst2) => {
            const result1 = calculator.calculate(timestamp, observer1, lst1);
            const result2 = calculator.calculate(timestamp, observer2, lst2);

            // Illumination should be the same for both observers at the same timestamp
            // because lunar illumination depends on Sun-Earth-Moon geometry, not observer position
            expect(result1.illumination).toBe(result2.illumination);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return illumination in range [0, 100] for any observer location', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // Illumination must be in range [0, 100] regardless of observer
            expect(result.illumination).toBeGreaterThanOrEqual(0);
            expect(result.illumination).toBeLessThanOrEqual(100);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return consistent illumination for the same inputs', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            // Calculate twice with the same inputs
            const result1 = calculator.calculate(timestamp, observer, lst);
            const result2 = calculator.calculate(timestamp, observer, lst);

            // Illumination should be identical
            expect(result1.illumination).toBe(result2.illumination);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});


/**
 * Property-Based Tests for Moon Magnitude Validity
 *
 * These tests verify that the Moon_Calculator returns a finite numeric magnitude
 * value that correlates with illumination (brighter/lower magnitude when more illuminated)
 * across randomized timestamps using fast-check.
 *
 * Feature: enhanced-celestial-objects, Property 6: Moon Magnitude Validity
 */
describe('Moon Calculator Property-Based Tests - Magnitude Validity', () => {
  /**
   * Property 6: Moon Magnitude Validity
   *
   * For any timestamp, the Moon_Calculator SHALL return a finite numeric magnitude
   * value that correlates with the illumination (brighter/lower magnitude when more illuminated).
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 6: Moon Magnitude Validity', () => {
    const calculator = createMoonCalculator();

    // Default observer for magnitude tests (magnitude is independent of observer location)
    const defaultObserver: GeographicCoordinates = {
      latitude: 0,
      longitude: 0,
    };
    const defaultLST = 12.0;

    it('should return a finite numeric magnitude for any timestamp', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Magnitude must be a finite number (not NaN or Infinity)
            expect(Number.isFinite(result.magnitude)).toBe(true);
            expect(typeof result.magnitude).toBe('number');
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return a finite numeric magnitude for timestamps across extended date range', () => {
      // Test with timestamps spanning multiple decades
      const extendedTimestamp = fc.date({
        min: new Date('1990-01-01T00:00:00Z'),
        max: new Date('2100-12-31T23:59:59Z'),
      });

      fc.assert(
        fc.property(
          extendedTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Magnitude must be a finite number
            expect(Number.isFinite(result.magnitude)).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return brighter (lower) magnitude when illumination is higher', () => {
      // Generate pairs of timestamps and compare magnitude vs illumination correlation
      fc.assert(
        fc.property(
          validTimestamp,
          validTimestamp,
          (timestamp1, timestamp2) => {
            const result1 = calculator.calculate(timestamp1, defaultObserver, defaultLST);
            const result2 = calculator.calculate(timestamp2, defaultObserver, defaultLST);

            // If illumination1 > illumination2, then magnitude1 should be <= magnitude2
            // (brighter = lower magnitude in astronomical convention)
            if (result1.illumination > result2.illumination) {
              expect(result1.magnitude).toBeLessThanOrEqual(result2.magnitude);
            } else if (result1.illumination < result2.illumination) {
              expect(result1.magnitude).toBeGreaterThanOrEqual(result2.magnitude);
            }
            // If illuminations are equal, magnitudes should be equal
            if (result1.illumination === result2.illumination) {
              expect(result1.magnitude).toBe(result2.magnitude);
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return the same magnitude for the same timestamp regardless of observer', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validGeographicCoordinates,
          validLST,
          validLST,
          (timestamp, observer1, observer2, lst1, lst2) => {
            const result1 = calculator.calculate(timestamp, observer1, lst1);
            const result2 = calculator.calculate(timestamp, observer2, lst2);

            // Magnitude should be the same for both observers at the same timestamp
            // because lunar magnitude depends on Sun-Earth-Moon geometry, not observer position
            expect(result1.magnitude).toBe(result2.magnitude);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return a finite numeric magnitude for any observer location', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // Magnitude must be a finite number regardless of observer
            expect(Number.isFinite(result.magnitude)).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return consistent magnitude for the same inputs', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            // Calculate twice with the same inputs
            const result1 = calculator.calculate(timestamp, observer, lst);
            const result2 = calculator.calculate(timestamp, observer, lst);

            // Magnitude should be identical
            expect(result1.magnitude).toBe(result2.magnitude);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return magnitude in a reasonable astronomical range', () => {
      // Moon magnitude typically ranges from about -12.7 (full) to around 0 (new)
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Magnitude should be in a reasonable range for the Moon
            // Full moon: ~-12.7, New moon: ~0 or slightly positive
            expect(result.magnitude).toBeLessThanOrEqual(5); // Upper bound (very dim)
            expect(result.magnitude).toBeGreaterThanOrEqual(-15); // Lower bound (very bright)
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});



/**
 * Property-Based Tests for Moon Magnitude Validity
 *
 * These tests verify that the Moon_Calculator returns a finite numeric magnitude
 * value that correlates with illumination (brighter/lower magnitude when more illuminated)
 * across randomized timestamps using fast-check.
 *
 * Feature: enhanced-celestial-objects, Property 6: Moon Magnitude Validity
 */
describe('Moon Calculator Property-Based Tests - Magnitude Validity', () => {
  /**
   * Property 6: Moon Magnitude Validity
   *
   * For any timestamp, the Moon_Calculator SHALL return a finite numeric magnitude
   * value that correlates with the illumination (brighter/lower magnitude when more illuminated).
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 6: Moon Magnitude Validity', () => {
    const calculator = createMoonCalculator();

    // Default observer for magnitude tests (magnitude is independent of observer location)
    const defaultObserver: GeographicCoordinates = {
      latitude: 0,
      longitude: 0,
    };
    const defaultLST = 12.0;

    it('should return a finite numeric magnitude for any timestamp', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Magnitude must be a finite number (not NaN or Infinity)
            expect(Number.isFinite(result.magnitude)).toBe(true);
            expect(typeof result.magnitude).toBe('number');
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return a finite numeric magnitude for timestamps across extended date range', () => {
      // Test with timestamps spanning multiple decades
      const extendedTimestamp = fc.date({
        min: new Date('1990-01-01T00:00:00Z'),
        max: new Date('2100-12-31T23:59:59Z'),
      });

      fc.assert(
        fc.property(
          extendedTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Magnitude must be a finite number
            expect(Number.isFinite(result.magnitude)).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return brighter (lower) magnitude when illumination is higher', () => {
      // Generate pairs of timestamps and compare magnitude vs illumination correlation
      fc.assert(
        fc.property(
          validTimestamp,
          validTimestamp,
          (timestamp1, timestamp2) => {
            const result1 = calculator.calculate(timestamp1, defaultObserver, defaultLST);
            const result2 = calculator.calculate(timestamp2, defaultObserver, defaultLST);

            // If illumination1 > illumination2, then magnitude1 should be <= magnitude2
            // (brighter = lower magnitude in astronomical convention)
            if (result1.illumination > result2.illumination) {
              expect(result1.magnitude).toBeLessThanOrEqual(result2.magnitude);
            } else if (result1.illumination < result2.illumination) {
              expect(result1.magnitude).toBeGreaterThanOrEqual(result2.magnitude);
            }
            // If illuminations are equal, magnitudes should be equal
            if (result1.illumination === result2.illumination) {
              expect(result1.magnitude).toBe(result2.magnitude);
            }
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return the same magnitude for the same timestamp regardless of observer', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validGeographicCoordinates,
          validLST,
          validLST,
          (timestamp, observer1, observer2, lst1, lst2) => {
            const result1 = calculator.calculate(timestamp, observer1, lst1);
            const result2 = calculator.calculate(timestamp, observer2, lst2);

            // Magnitude should be the same for both observers at the same timestamp
            // because lunar magnitude depends on Sun-Earth-Moon geometry, not observer position
            expect(result1.magnitude).toBe(result2.magnitude);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return a finite numeric magnitude for any observer location', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            const result = calculator.calculate(timestamp, observer, lst);

            // Magnitude must be a finite number regardless of observer
            expect(Number.isFinite(result.magnitude)).toBe(true);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return consistent magnitude for the same inputs', () => {
      fc.assert(
        fc.property(
          validTimestamp,
          validGeographicCoordinates,
          validLST,
          (timestamp, observer, lst) => {
            // Calculate twice with the same inputs
            const result1 = calculator.calculate(timestamp, observer, lst);
            const result2 = calculator.calculate(timestamp, observer, lst);

            // Magnitude should be identical
            expect(result1.magnitude).toBe(result2.magnitude);
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return magnitude in a reasonable astronomical range', () => {
      // Moon magnitude typically ranges from about -12.7 (full) to around 0 (new)
      fc.assert(
        fc.property(
          validTimestamp,
          (timestamp) => {
            const result = calculator.calculate(timestamp, defaultObserver, defaultLST);

            // Magnitude should be in a reasonable range for the Moon
            // Full moon: ~-12.7, New moon: ~0 or slightly positive
            expect(result.magnitude).toBeLessThanOrEqual(5); // Upper bound (very dim)
            expect(result.magnitude).toBeGreaterThanOrEqual(-15); // Lower bound (very bright)
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});
