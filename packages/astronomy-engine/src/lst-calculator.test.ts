/**
 * Unit tests and Property-Based tests for LST_Calculator module
 *
 * Tests the Local Sidereal Time calculation functions with known values
 * and verifies the round-trip property using fast-check.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateLST, lstToUTC } from './lst-calculator';

/**
 * Custom generators for property-based testing
 */

// Valid longitude: -180 to +180 degrees
const validLongitude = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

// Valid timestamp: within ±1 year from a reference date
const validTimestamp = fc.date({
  min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
});

/**
 * Property-Based Tests Configuration
 */
const propertyTestConfig = {
  numRuns: 100, // Minimum iterations per property
  verbose: true, // Show counterexamples on failure
};

describe('LST_Calculator', () => {
  describe('calculateLST', () => {
    it('should return LST as decimal hours in range [0, 24)', () => {
      const testCases = [
        { longitude: 0, timestamp: new Date('2024-01-01T00:00:00Z') },
        { longitude: 180, timestamp: new Date('2024-06-15T12:00:00Z') },
        { longitude: -180, timestamp: new Date('2024-03-20T06:00:00Z') },
        { longitude: 90, timestamp: new Date('2024-09-22T18:00:00Z') },
        { longitude: -90, timestamp: new Date('2024-12-21T23:59:59Z') },
      ];

      for (const { longitude, timestamp } of testCases) {
        const lst = calculateLST(longitude, timestamp);
        expect(lst).toBeGreaterThanOrEqual(0);
        expect(lst).toBeLessThan(24);
      }
    });

    it('should accept ISO string timestamps', () => {
      const lst = calculateLST(0, '2024-01-01T12:00:00Z');
      expect(lst).toBeGreaterThanOrEqual(0);
      expect(lst).toBeLessThan(24);
    });

    it('should accept Date objects', () => {
      const lst = calculateLST(0, new Date('2024-01-01T12:00:00Z'));
      expect(lst).toBeGreaterThanOrEqual(0);
      expect(lst).toBeLessThan(24);
    });

    it('should increase LST with increasing longitude (east)', () => {
      const timestamp = new Date('2024-06-15T12:00:00Z');
      const lstAtZero = calculateLST(0, timestamp);
      const lstAtEast = calculateLST(15, timestamp); // 15 degrees = 1 hour

      // LST at 15° E should be ~1 hour ahead of LST at 0°
      let diff = lstAtEast - lstAtZero;
      if (diff < 0) diff += 24; // Handle wrap-around
      expect(diff).toBeCloseTo(1, 1);
    });

    it('should decrease LST with decreasing longitude (west)', () => {
      const timestamp = new Date('2024-06-15T12:00:00Z');
      const lstAtZero = calculateLST(0, timestamp);
      const lstAtWest = calculateLST(-15, timestamp); // -15 degrees = -1 hour

      // LST at 15° W should be ~1 hour behind LST at 0°
      let diff = lstAtZero - lstAtWest;
      if (diff < 0) diff += 24; // Handle wrap-around
      expect(diff).toBeCloseTo(1, 1);
    });

    it('should handle J2000.0 epoch correctly', () => {
      // At J2000.0 (Jan 1, 2000, 12:00 TT), GMST should be approximately 18.697374558 hours
      // Note: TT is ~64 seconds ahead of UTC at J2000
      const j2000UTC = new Date('2000-01-01T11:58:55.816Z'); // Approximate UTC for J2000.0 TT
      const gmst = calculateLST(0, j2000UTC);
      // GMST at J2000.0 is approximately 18.697 hours
      expect(gmst).toBeCloseTo(18.697, 0);
    });
  });

  describe('lstToUTC', () => {
    it('should return a valid Date object', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      const result = lstToUTC(12, 0, referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).not.toBeNaN();
    });

    it('should produce round-trip within 1 second tolerance', () => {
      const testCases = [
        { longitude: 0, timestamp: new Date('2024-01-15T08:30:00Z') },
        { longitude: 45, timestamp: new Date('2024-06-21T14:00:00Z') },
        { longitude: -120, timestamp: new Date('2024-03-20T22:15:00Z') },
        { longitude: 90, timestamp: new Date('2024-09-22T03:45:00Z') },
        { longitude: -75, timestamp: new Date('2024-12-25T18:00:00Z') },
      ];

      for (const { longitude, timestamp } of testCases) {
        // Calculate LST from the original timestamp
        const lst = calculateLST(longitude, timestamp);

        // Convert back to UTC
        const recoveredUTC = lstToUTC(lst, longitude, timestamp);

        // Check that the difference is within 1 second
        const diffMs = Math.abs(recoveredUTC.getTime() - timestamp.getTime());
        expect(diffMs).toBeLessThanOrEqual(1000);
      }
    });

    it('should handle edge case at midnight', () => {
      const timestamp = new Date('2024-06-15T00:00:00Z');
      const lst = calculateLST(0, timestamp);
      const recovered = lstToUTC(lst, 0, timestamp);
      const diffMs = Math.abs(recovered.getTime() - timestamp.getTime());
      expect(diffMs).toBeLessThanOrEqual(1000);
    });

    it('should handle edge case at noon', () => {
      const timestamp = new Date('2024-06-15T12:00:00Z');
      const lst = calculateLST(0, timestamp);
      const recovered = lstToUTC(lst, 0, timestamp);
      const diffMs = Math.abs(recovered.getTime() - timestamp.getTime());
      expect(diffMs).toBeLessThanOrEqual(1000);
    });

    it('should handle extreme longitudes', () => {
      const timestamp = new Date('2024-06-15T12:00:00Z');

      // Test at +180 longitude
      const lstEast = calculateLST(180, timestamp);
      const recoveredEast = lstToUTC(lstEast, 180, timestamp);
      expect(Math.abs(recoveredEast.getTime() - timestamp.getTime())).toBeLessThanOrEqual(1000);

      // Test at -180 longitude
      const lstWest = calculateLST(-180, timestamp);
      const recoveredWest = lstToUTC(lstWest, -180, timestamp);
      expect(Math.abs(recoveredWest.getTime() - timestamp.getTime())).toBeLessThanOrEqual(1000);
    });
  });

  describe('LST Output Range (Property 6)', () => {
    it('should always return LST in range [0, 24) for various inputs', () => {
      const longitudes = [-180, -90, -45, 0, 45, 90, 180];
      const timestamps = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-03-20T06:00:00Z'),
        new Date('2024-06-21T12:00:00Z'),
        new Date('2024-09-22T18:00:00Z'),
        new Date('2024-12-21T23:59:59Z'),
      ];

      for (const longitude of longitudes) {
        for (const timestamp of timestamps) {
          const lst = calculateLST(longitude, timestamp);
          expect(lst).toBeGreaterThanOrEqual(0);
          expect(lst).toBeLessThan(24);
        }
      }
    });
  });
});


/**
 * Property-Based Tests for LST_Calculator
 *
 * These tests verify universal properties that should hold across all valid inputs.
 */
describe('LST_Calculator Property-Based Tests', () => {
  /**
   * Property 1: LST Round-Trip
   *
   * For any valid geographic longitude and UTC timestamp, computing Local Sidereal Time
   * and then converting back to UTC shall produce a timestamp within 1 second of the original.
   *
   * **Validates: Requirements 3.5**
   */
  describe('Property 1: LST Round-Trip', () => {
    it('should produce original timestamp within 1 second when LST→UTC→LST', () => {
      fc.assert(
        fc.property(validLongitude, validTimestamp, (longitude, timestamp) => {
          // Calculate LST from the original timestamp
          const lst = calculateLST(longitude, timestamp);

          // Convert back to UTC using the original timestamp as reference
          const recoveredUTC = lstToUTC(lst, longitude, timestamp);

          // Calculate the difference in milliseconds
          const diffMs = Math.abs(recoveredUTC.getTime() - timestamp.getTime());

          // The round-trip should produce a timestamp within 1 second (1000ms)
          return diffMs <= 1000;
        }),
        propertyTestConfig
      );
    });

    it('should maintain round-trip accuracy across different times of day', () => {
      // Generate timestamps at specific hours to test edge cases
      const hourOfDay = fc.integer({ min: 0, max: 23 });
      const minuteOfHour = fc.integer({ min: 0, max: 59 });
      const dayOffset = fc.integer({ min: -180, max: 180 }); // Days from now

      fc.assert(
        fc.property(
          validLongitude,
          hourOfDay,
          minuteOfHour,
          dayOffset,
          (longitude, hour, minute, days) => {
            const timestamp = new Date();
            timestamp.setUTCDate(timestamp.getUTCDate() + days);
            timestamp.setUTCHours(hour, minute, 0, 0);

            const lst = calculateLST(longitude, timestamp);
            const recoveredUTC = lstToUTC(lst, longitude, timestamp);
            const diffMs = Math.abs(recoveredUTC.getTime() - timestamp.getTime());

            return diffMs <= 1000;
          }
        ),
        propertyTestConfig
      );
    });
  });

  /**
   * Property 6: LST Output Range
   *
   * For any valid longitude and timestamp input, the computed Local Sidereal Time
   * shall be a decimal hour value in the range [0, 24).
   *
   * **Validates: Requirements 3.3**
   */
  describe('Property 6: LST Output Range', () => {
    it('should always return LST in range [0, 24) for any valid inputs', () => {
      fc.assert(
        fc.property(validLongitude, validTimestamp, (longitude, timestamp) => {
          const lst = calculateLST(longitude, timestamp);

          // LST must be >= 0 and < 24
          return lst >= 0 && lst < 24;
        }),
        propertyTestConfig
      );
    });

    it('should return LST in range [0, 24) for extreme longitude values', () => {
      // Test specifically at boundary longitudes
      const boundaryLongitude = fc.oneof(
        fc.constant(-180),
        fc.constant(-179.9999),
        fc.constant(0),
        fc.constant(179.9999),
        fc.constant(180)
      );

      fc.assert(
        fc.property(boundaryLongitude, validTimestamp, (longitude, timestamp) => {
          const lst = calculateLST(longitude, timestamp);
          return lst >= 0 && lst < 24;
        }),
        propertyTestConfig
      );
    });

    it('should return LST in range [0, 24) for ISO string timestamps', () => {
      // Generate ISO string timestamps
      const isoTimestamp = validTimestamp.map((date) => date.toISOString());

      fc.assert(
        fc.property(validLongitude, isoTimestamp, (longitude, timestamp) => {
          const lst = calculateLST(longitude, timestamp);
          return lst >= 0 && lst < 24;
        }),
        propertyTestConfig
      );
    });

    it('should maintain output range across year boundaries', () => {
      // Test timestamps around year boundaries
      const yearBoundaryTimestamp = fc.oneof(
        fc.constant(new Date('2024-01-01T00:00:00Z')),
        fc.constant(new Date('2024-12-31T23:59:59Z')),
        fc.constant(new Date('2023-12-31T23:59:59Z')),
        fc.constant(new Date('2025-01-01T00:00:00Z'))
      );

      fc.assert(
        fc.property(validLongitude, yearBoundaryTimestamp, (longitude, timestamp) => {
          const lst = calculateLST(longitude, timestamp);
          return lst >= 0 && lst < 24;
        }),
        propertyTestConfig
      );
    });
  });

  /**
   * Additional property: LST increases with longitude
   *
   * For any fixed timestamp, LST should increase by approximately 1 hour
   * for every 15 degrees of eastward longitude.
   */
  describe('LST Longitude Relationship', () => {
    it('should increase LST by ~1 hour per 15 degrees east', () => {
      const baseLongitude = fc.double({ min: -165, max: 165, noNaN: true, noDefaultInfinity: true });

      fc.assert(
        fc.property(baseLongitude, validTimestamp, (longitude, timestamp) => {
          const lstBase = calculateLST(longitude, timestamp);
          const lstEast = calculateLST(longitude + 15, timestamp);

          // Calculate the difference, handling wrap-around
          let diff = lstEast - lstBase;
          if (diff < 0) diff += 24;
          if (diff > 12) diff -= 24;

          // The difference should be approximately 1 hour (within 0.1 hour tolerance)
          return Math.abs(diff - 1) < 0.1;
        }),
        propertyTestConfig
      );
    });
  });
});
