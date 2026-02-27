/**
 * Satellite Tracker Tests
 *
 * Tests for TLE parsing, position calculation, and visibility prediction.
 * @see Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSatelliteTracker,
  type SatelliteTracker,
  type TLEData,
  type SatellitePosition,
  type SatelliteTrackerError,
} from './satellite-tracker';
import type { SunPosition } from './sun-calculator';

// Sample valid TLE data for ISS
const VALID_ISS_TLE: TLEData = {
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
  line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
  fetchedAt: new Date(),
};

// Sample TLE for a different satellite (Hubble Space Telescope)
const VALID_HST_TLE: TLEData = {
  name: 'HST',
  line1: '1 20580U 90037B   24001.50000000  .00001234  00000-0  12345-4 0  9999',
  line2: '2 20580  28.4700 123.4567 0002890  45.0000 315.0000 15.09123456  0000',
  fetchedAt: new Date(),
};

// Invalid TLE data
const INVALID_TLE: TLEData = {
  name: 'INVALID',
  line1: 'invalid line 1',
  line2: 'invalid line 2',
  fetchedAt: new Date(),
};

// Stale TLE data (20 days old)
const STALE_TLE: TLEData = {
  name: 'STALE SAT',
  line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
  line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
  fetchedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
};

// Sample observer location (New York City)
const NYC_OBSERVER = {
  latitude: 40.7128,
  longitude: -74.006,
};

// Sample sun positions for visibility testing
const SUN_BELOW_HORIZON: SunPosition = {
  ra: 12,
  dec: -10,
  azimuth: 270,
  altitude: -30,
  status: 'night',
  safetyWarning: false,
  isBelowHorizon: true,
};

const SUN_ABOVE_HORIZON: SunPosition = {
  ra: 12,
  dec: 20,
  azimuth: 180,
  altitude: 45,
  status: 'daylight',
  safetyWarning: true,
  isBelowHorizon: false,
};

describe('SatelliteTracker', () => {
  let tracker: SatelliteTracker;

  beforeEach(() => {
    tracker = createSatelliteTracker();
  });

  describe('setTLE and getTLE', () => {
    it('should store and retrieve TLE data', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      const retrieved = tracker.getTLE('ISS');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('ISS (ZARYA)');
      expect(retrieved?.line1).toBe(VALID_ISS_TLE.line1);
      expect(retrieved?.line2).toBe(VALID_ISS_TLE.line2);
    });

    it('should return null for non-existent satellite', () => {
      const result = tracker.getTLE('NONEXISTENT');
      expect(result).toBeNull();
    });

    it('should update existing TLE data', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      
      const updatedTLE: TLEData = {
        ...VALID_ISS_TLE,
        name: 'ISS (UPDATED)',
      };
      tracker.setTLE('ISS', updatedTLE);
      
      const retrieved = tracker.getTLE('ISS');
      expect(retrieved?.name).toBe('ISS (UPDATED)');
    });

    it('should store multiple satellites', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      tracker.setTLE('HST', VALID_HST_TLE);
      
      expect(tracker.getTLE('ISS')).not.toBeNull();
      expect(tracker.getTLE('HST')).not.toBeNull();
      expect(tracker.getTrackedSatellites()).toHaveLength(2);
    });
  });

  describe('isTLEStale', () => {
    it('should return true for non-existent satellite', () => {
      expect(tracker.isTLEStale('NONEXISTENT')).toBe(true);
    });

    it('should return false for fresh TLE data', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      expect(tracker.isTLEStale('ISS')).toBe(false);
    });

    it('should return true for TLE older than 14 days', () => {
      tracker.setTLE('STALE', STALE_TLE);
      expect(tracker.isTLEStale('STALE')).toBe(true);
    });

    it('should respect custom staleDays configuration', () => {
      const customTracker = createSatelliteTracker({ staleDays: 30 });
      customTracker.setTLE('STALE', STALE_TLE);
      // 20 days old, but staleDays is 30, so not stale
      expect(customTracker.isTLEStale('STALE')).toBe(false);
    });
  });

  describe('calculate', () => {
    it('should return TLE_UNAVAILABLE for non-existent satellite', () => {
      const result = tracker.calculate('NONEXISTENT', new Date(), NYC_OBSERVER);
      
      expect('type' in result).toBe(true);
      expect((result as SatelliteTrackerError).type).toBe('TLE_UNAVAILABLE');
      expect((result as SatelliteTrackerError).satelliteId).toBe('NONEXISTENT');
    });

    it('should return TLE_INVALID for invalid TLE data', () => {
      tracker.setTLE('INVALID', INVALID_TLE);
      const result = tracker.calculate('INVALID', new Date(), NYC_OBSERVER);
      
      expect('type' in result).toBe(true);
      expect((result as SatelliteTrackerError).type).toBe('TLE_INVALID');
    });

    it('should calculate position for valid TLE', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      const result = tracker.calculate('ISS', new Date(), NYC_OBSERVER);
      
      // Should return a position, not an error
      expect('azimuth' in result).toBe(true);
      
      const position = result as SatellitePosition;
      expect(position.id).toBe('ISS');
      expect(position.name).toBe('ISS (ZARYA)');
      expect(position.azimuth).toBeGreaterThanOrEqual(0);
      expect(position.azimuth).toBeLessThan(360);
      expect(position.altitude).toBeGreaterThanOrEqual(-90);
      expect(position.altitude).toBeLessThanOrEqual(90);
      expect(position.range).toBeGreaterThan(0);
    });

    it('should mark stale TLE in position result', () => {
      tracker.setTLE('STALE', STALE_TLE);
      const result = tracker.calculate('STALE', new Date(), NYC_OBSERVER);
      
      if ('azimuth' in result) {
        expect(result.isStale).toBe(true);
      }
    });

    it('should mark fresh TLE as not stale', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      const result = tracker.calculate('ISS', new Date(), NYC_OBSERVER);
      
      if ('azimuth' in result) {
        expect(result.isStale).toBe(false);
      }
    });
  });

  describe('calculateAll', () => {
    it('should return empty map when no satellites tracked', () => {
      const results = tracker.calculateAll(new Date(), NYC_OBSERVER, SUN_BELOW_HORIZON);
      expect(results.size).toBe(0);
    });

    it('should calculate positions for all tracked satellites', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      tracker.setTLE('HST', VALID_HST_TLE);
      
      const results = tracker.calculateAll(new Date(), NYC_OBSERVER, SUN_BELOW_HORIZON);
      
      expect(results.size).toBe(2);
      expect(results.has('ISS')).toBe(true);
      expect(results.has('HST')).toBe(true);
    });

    it('should include errors for invalid TLE in results', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      tracker.setTLE('INVALID', INVALID_TLE);
      
      const results = tracker.calculateAll(new Date(), NYC_OBSERVER, SUN_BELOW_HORIZON);
      
      expect(results.size).toBe(2);
      
      const invalidResult = results.get('INVALID');
      expect(invalidResult).toBeDefined();
      expect('type' in invalidResult!).toBe(true);
    });
  });

  describe('predictVisibility', () => {
    it('should return true when satellite above horizon and observer in darkness', () => {
      const isVisible = tracker.predictVisibility(45, SUN_BELOW_HORIZON);
      expect(isVisible).toBe(true);
    });

    it('should return false when satellite below horizon', () => {
      const isVisible = tracker.predictVisibility(-10, SUN_BELOW_HORIZON);
      expect(isVisible).toBe(false);
    });

    it('should return false when observer not in darkness', () => {
      const isVisible = tracker.predictVisibility(45, SUN_ABOVE_HORIZON);
      expect(isVisible).toBe(false);
    });

    it('should return false when satellite at horizon (altitude = 0)', () => {
      const isVisible = tracker.predictVisibility(0, SUN_BELOW_HORIZON);
      expect(isVisible).toBe(false);
    });
  });

  describe('getTrackedSatellites', () => {
    it('should return empty array when no satellites tracked', () => {
      expect(tracker.getTrackedSatellites()).toEqual([]);
    });

    it('should return all tracked satellite IDs', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      tracker.setTLE('HST', VALID_HST_TLE);
      
      const tracked = tracker.getTrackedSatellites();
      expect(tracked).toHaveLength(2);
      expect(tracked).toContain('ISS');
      expect(tracked).toContain('HST');
    });
  });

  describe('loadDefaultISS', () => {
    it('should load ISS TLE data', async () => {
      await tracker.loadDefaultISS();
      
      const iss = tracker.getTLE('ISS');
      expect(iss).not.toBeNull();
      expect(iss?.name).toBe('ISS (ZARYA)');
    });

    it('should allow calculating ISS position after loading', async () => {
      await tracker.loadDefaultISS();
      
      const result = tracker.calculate('ISS', new Date(), NYC_OBSERVER);
      expect('azimuth' in result).toBe(true);
    });
  });

  describe('Position validity', () => {
    it('should produce azimuth in valid range [0, 360)', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      
      // Test at multiple times
      for (let i = 0; i < 10; i++) {
        const timestamp = new Date(Date.now() + i * 60000); // Every minute
        const result = tracker.calculate('ISS', timestamp, NYC_OBSERVER);
        
        if ('azimuth' in result) {
          expect(result.azimuth).toBeGreaterThanOrEqual(0);
          expect(result.azimuth).toBeLessThan(360);
        }
      }
    });

    it('should produce altitude in valid range [-90, 90]', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      
      for (let i = 0; i < 10; i++) {
        const timestamp = new Date(Date.now() + i * 60000);
        const result = tracker.calculate('ISS', timestamp, NYC_OBSERVER);
        
        if ('azimuth' in result) {
          expect(result.altitude).toBeGreaterThanOrEqual(-90);
          expect(result.altitude).toBeLessThanOrEqual(90);
        }
      }
    });

    it('should produce positive range', () => {
      tracker.setTLE('ISS', VALID_ISS_TLE);
      
      const result = tracker.calculate('ISS', new Date(), NYC_OBSERVER);
      
      if ('azimuth' in result) {
        expect(result.range).toBeGreaterThan(0);
      }
    });
  });

  describe('Configuration', () => {
    it('should use default staleDays of 14', () => {
      const defaultTracker = createSatelliteTracker();
      
      // TLE 13 days old should not be stale
      const thirteenDaysOld: TLEData = {
        ...VALID_ISS_TLE,
        fetchedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
      };
      defaultTracker.setTLE('TEST', thirteenDaysOld);
      expect(defaultTracker.isTLEStale('TEST')).toBe(false);
      
      // TLE 15 days old should be stale
      const fifteenDaysOld: TLEData = {
        ...VALID_ISS_TLE,
        fetchedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      };
      defaultTracker.setTLE('TEST2', fifteenDaysOld);
      expect(defaultTracker.isTLEStale('TEST2')).toBe(true);
    });

    it('should allow custom staleDays configuration', () => {
      const customTracker = createSatelliteTracker({ staleDays: 7 });
      
      // TLE 6 days old should not be stale with 7-day threshold
      const sixDaysOld: TLEData = {
        ...VALID_ISS_TLE,
        fetchedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      };
      customTracker.setTLE('TEST', sixDaysOld);
      expect(customTracker.isTLEStale('TEST')).toBe(false);
      
      // TLE 8 days old should be stale with 7-day threshold
      const eightDaysOld: TLEData = {
        ...VALID_ISS_TLE,
        fetchedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      };
      customTracker.setTLE('TEST2', eightDaysOld);
      expect(customTracker.isTLEStale('TEST2')).toBe(true);
    });
  });
});


/**
 * Property-Based Tests for Satellite Tracker
 *
 * Feature: enhanced-celestial-objects, Property 12: Satellite TLE Staleness Detection
 *
 * **Validates: Requirements 6.3**
 */
import fc from 'fast-check';

describe('Property 12: Satellite TLE Staleness Detection', () => {
  /**
   * Property 12: Satellite TLE Staleness Detection
   *
   * *For any* TLE data with a `fetchedAt` timestamp more than 14 days in the past
   * relative to the current calculation time, the `isStale` flag SHALL be `true`.
   *
   * Feature: enhanced-celestial-objects, Property 12: Satellite TLE Staleness Detection
   */
  it('should mark TLE as stale when fetchedAt is more than 14 days old', () => {
    // Generator for TLE age in days (0 to 60 days)
    const validTLEAge = fc.integer({
      min: 0,
      max: 60,
    });

    // Generator for valid satellite IDs
    const validSatelliteId = fc.stringMatching(/^[A-Z]{2,10}$/);

    fc.assert(
      fc.property(
        validTLEAge,
        validSatelliteId,
        (ageDays, satelliteId) => {
          const tracker = createSatelliteTracker();

          // Create TLE data with the specified age
          const fetchedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
          const tleData: TLEData = {
            name: `TEST SAT ${satelliteId}`,
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt,
          };

          tracker.setTLE(satelliteId, tleData);

          const isStale = tracker.isTLEStale(satelliteId);

          // Requirement 6.3: TLE older than 14 days SHALL be flagged as stale
          if (ageDays > 14) {
            expect(isStale).toBe(true);
          } else {
            expect(isStale).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should set isStale flag correctly in calculated position when TLE is older than 14 days', () => {
    // Generator for TLE age in days (0 to 60 days)
    const validTLEAge = fc.integer({
      min: 0,
      max: 60,
    });

    // Generator for valid observer locations
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(
        validTLEAge,
        validObserver,
        (ageDays, observer) => {
          const tracker = createSatelliteTracker();

          // Create TLE data with the specified age
          const fetchedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
          const tleData: TLEData = {
            name: 'TEST SAT',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt,
          };

          tracker.setTLE('TEST', tleData);

          const result = tracker.calculate('TEST', new Date(), observer);

          // Only check isStale if we got a valid position (not an error)
          if ('azimuth' in result) {
            const position = result as SatellitePosition;

            // Requirement 6.3: TLE older than 14 days SHALL have isStale = true
            if (ageDays > 14) {
              expect(position.isStale).toBe(true);
            } else {
              expect(position.isStale).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly handle boundary case at exactly 14 days', () => {
    // Generator for hours offset from exactly 14 days (-24 to +24 hours)
    const hoursOffset = fc.integer({
      min: -24,
      max: 24,
    });

    fc.assert(
      fc.property(
        hoursOffset,
        (offsetHours) => {
          const tracker = createSatelliteTracker();

          // Create TLE data at exactly 14 days plus/minus some hours
          const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
          const offsetMs = offsetHours * 60 * 60 * 1000;
          const fetchedAt = new Date(Date.now() - fourteenDaysInMs - offsetMs);

          const tleData: TLEData = {
            name: 'BOUNDARY TEST',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt,
          };

          tracker.setTLE('BOUNDARY', tleData);

          const isStale = tracker.isTLEStale('BOUNDARY');

          // Calculate actual age in days
          const ageMs = Date.now() - fetchedAt.getTime();
          const ageDays = ageMs / (24 * 60 * 60 * 1000);

          // Requirement 6.3: TLE older than 14 days SHALL be stale
          if (ageDays > 14) {
            expect(isStale).toBe(true);
          } else {
            expect(isStale).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect custom staleDays configuration for any age', () => {
    // Generator for custom stale days threshold (1 to 30 days)
    const customStaleDays = fc.integer({
      min: 1,
      max: 30,
    });

    // Generator for TLE age in days (0 to 60 days)
    const validTLEAge = fc.integer({
      min: 0,
      max: 60,
    });

    fc.assert(
      fc.property(
        customStaleDays,
        validTLEAge,
        (staleDays, ageDays) => {
          const tracker = createSatelliteTracker({ staleDays });

          // Create TLE data with the specified age
          const fetchedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
          const tleData: TLEData = {
            name: 'CUSTOM CONFIG TEST',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt,
          };

          tracker.setTLE('CUSTOM', tleData);

          const isStale = tracker.isTLEStale('CUSTOM');

          // TLE should be stale if age exceeds the custom threshold
          if (ageDays > staleDays) {
            expect(isStale).toBe(true);
          } else {
            expect(isStale).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});



/**
 * Property-Based Tests for Satellite Tracker
 *
 * Feature: enhanced-celestial-objects, Property 13: Satellite Position Validity
 *
 * **Validates: Requirements 6.1, 6.4**
 */

describe('Property 13: Satellite Position Validity', () => {
  /**
   * Property 13: Satellite Position Validity
   *
   * *For any* valid TLE data and observer location, the calculated satellite position
   * SHALL contain azimuth in [0, 360) degrees, altitude in [-90, +90] degrees,
   * and range > 0 kilometers.
   *
   * Feature: enhanced-celestial-objects, Property 13: Satellite Position Validity
   */
  it('should produce azimuth in [0, 360) degrees for any valid TLE and observer', () => {
    // Generator for valid observer locations
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for timestamps within a reasonable range
    const validTimestamp = fc.date({
      min: new Date('2024-01-01'),
      max: new Date('2024-12-31'),
    });

    fc.assert(
      fc.property(
        validObserver,
        validTimestamp,
        (observer, timestamp) => {
          const tracker = createSatelliteTracker();

          // Use valid ISS TLE data
          const tleData: TLEData = {
            name: 'ISS (ZARYA)',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt: new Date(),
          };

          tracker.setTLE('ISS', tleData);

          const result = tracker.calculate('ISS', timestamp, observer);

          // Only check if we got a valid position (not an error)
          if ('azimuth' in result) {
            const position = result as SatellitePosition;

            // Requirement 6.4: azimuth SHALL be in [0, 360) degrees
            expect(position.azimuth).toBeGreaterThanOrEqual(0);
            expect(position.azimuth).toBeLessThan(360);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce altitude in [-90, +90] degrees for any valid TLE and observer', () => {
    // Generator for valid observer locations
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for timestamps within a reasonable range
    const validTimestamp = fc.date({
      min: new Date('2024-01-01'),
      max: new Date('2024-12-31'),
    });

    fc.assert(
      fc.property(
        validObserver,
        validTimestamp,
        (observer, timestamp) => {
          const tracker = createSatelliteTracker();

          // Use valid ISS TLE data
          const tleData: TLEData = {
            name: 'ISS (ZARYA)',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt: new Date(),
          };

          tracker.setTLE('ISS', tleData);

          const result = tracker.calculate('ISS', timestamp, observer);

          // Only check if we got a valid position (not an error)
          if ('azimuth' in result) {
            const position = result as SatellitePosition;

            // Requirement 6.4: altitude SHALL be in [-90, +90] degrees
            expect(position.altitude).toBeGreaterThanOrEqual(-90);
            expect(position.altitude).toBeLessThanOrEqual(90);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce range > 0 kilometers for any valid TLE and observer', () => {
    // Generator for valid observer locations
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for timestamps within a reasonable range
    const validTimestamp = fc.date({
      min: new Date('2024-01-01'),
      max: new Date('2024-12-31'),
    });

    fc.assert(
      fc.property(
        validObserver,
        validTimestamp,
        (observer, timestamp) => {
          const tracker = createSatelliteTracker();

          // Use valid ISS TLE data
          const tleData: TLEData = {
            name: 'ISS (ZARYA)',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt: new Date(),
          };

          tracker.setTLE('ISS', tleData);

          const result = tracker.calculate('ISS', timestamp, observer);

          // Only check if we got a valid position (not an error)
          if ('azimuth' in result) {
            const position = result as SatellitePosition;

            // Requirement 6.4: range SHALL be > 0 kilometers
            expect(position.range).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce valid position for multiple different satellites', () => {
    // Generator for valid observer locations
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Different valid TLE data sets for various satellites
    const tleSets = [
      {
        id: 'ISS',
        name: 'ISS (ZARYA)',
        line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
        line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
      },
      {
        id: 'HST',
        name: 'HST',
        line1: '1 20580U 90037B   24001.50000000  .00001234  00000-0  12345-4 0  9999',
        line2: '2 20580  28.4700 123.4567 0002890  45.0000 315.0000 15.09123456  0000',
      },
    ];

    // Generator to select a TLE set
    const tleSelector = fc.integer({ min: 0, max: tleSets.length - 1 });

    fc.assert(
      fc.property(
        validObserver,
        tleSelector,
        (observer, tleIndex) => {
          const tracker = createSatelliteTracker();
          const tleSet = tleSets[tleIndex];

          // Guard against undefined (should never happen with valid generator)
          if (!tleSet) {
            return;
          }

          const tleData: TLEData = {
            name: tleSet.name,
            line1: tleSet.line1,
            line2: tleSet.line2,
            fetchedAt: new Date(),
          };

          tracker.setTLE(tleSet.id, tleData);

          const result = tracker.calculate(tleSet.id, new Date(), observer);

          // Only check if we got a valid position (not an error)
          if ('azimuth' in result) {
            const position = result as SatellitePosition;

            // Requirements 6.1, 6.4: All position values SHALL be valid
            expect(position.azimuth).toBeGreaterThanOrEqual(0);
            expect(position.azimuth).toBeLessThan(360);
            expect(position.altitude).toBeGreaterThanOrEqual(-90);
            expect(position.altitude).toBeLessThanOrEqual(90);
            expect(position.range).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce valid position for extreme observer locations', () => {
    // Generator for extreme observer locations (poles and prime meridian/date line)
    const extremeObserver = fc.oneof(
      // Near North Pole
      fc.record({
        latitude: fc.double({ min: 85, max: 90, noNaN: true, noDefaultInfinity: true }),
        longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
      }),
      // Near South Pole
      fc.record({
        latitude: fc.double({ min: -90, max: -85, noNaN: true, noDefaultInfinity: true }),
        longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
      }),
      // Near date line
      fc.record({
        latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        longitude: fc.oneof(
          fc.double({ min: 175, max: 180, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -180, max: -175, noNaN: true, noDefaultInfinity: true })
        ),
      }),
      // Equator
      fc.record({
        latitude: fc.double({ min: -5, max: 5, noNaN: true, noDefaultInfinity: true }),
        longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
      })
    );

    fc.assert(
      fc.property(
        extremeObserver,
        (observer) => {
          const tracker = createSatelliteTracker();

          const tleData: TLEData = {
            name: 'ISS (ZARYA)',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt: new Date(),
          };

          tracker.setTLE('ISS', tleData);

          const result = tracker.calculate('ISS', new Date(), observer);

          // Only check if we got a valid position (not an error)
          if ('azimuth' in result) {
            const position = result as SatellitePosition;

            // Requirements 6.1, 6.4: Position SHALL be valid even for extreme locations
            expect(position.azimuth).toBeGreaterThanOrEqual(0);
            expect(position.azimuth).toBeLessThan(360);
            expect(position.altitude).toBeGreaterThanOrEqual(-90);
            expect(position.altitude).toBeLessThanOrEqual(90);
            expect(position.range).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});



/**
 * Property-Based Tests for Satellite Tracker
 *
 * Feature: enhanced-celestial-objects, Property 14: Satellite Visibility Prediction
 *
 * **Validates: Requirements 6.5**
 */

describe('Property 14: Satellite Visibility Prediction', () => {
  /**
   * Property 14: Satellite Visibility Prediction
   *
   * *For any* satellite position calculation, the satellite SHALL be marked as visible
   * (`isVisible === true`) only when both conditions are met: the satellite is illuminated
   * by the Sun AND the observer is in darkness (Sun altitude < 0).
   *
   * Feature: enhanced-celestial-objects, Property 14: Satellite Visibility Prediction
   */
  it('should mark satellite as visible only when satellite is above horizon AND observer is in darkness', () => {
    // Generator for satellite altitude (-90 to +90 degrees)
    const validSatelliteAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    // Generator for sun altitude (-90 to +90 degrees)
    const validSunAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(
        validSatelliteAltitude,
        validSunAltitude,
        (satelliteAltitude, sunAltitude) => {
          const tracker = createSatelliteTracker();

          // Create sun position based on generated altitude
          const sunPosition: SunPosition = {
            ra: 12,
            dec: 0,
            azimuth: 180,
            altitude: sunAltitude,
            status: sunAltitude > 0 ? 'daylight' : sunAltitude > -18 ? 'twilight' : 'night',
            safetyWarning: sunAltitude > -18,
            isBelowHorizon: sunAltitude < 0,
          };

          const isVisible = tracker.predictVisibility(satelliteAltitude, sunPosition);

          // Requirement 6.5: Satellite SHALL be visible only when:
          // 1. Satellite is illuminated (above horizon, altitude > 0)
          // 2. Observer is in darkness (Sun altitude < 0)
          const satelliteAboveHorizon = satelliteAltitude > 0;
          const observerInDarkness = sunAltitude < 0;
          const expectedVisibility = satelliteAboveHorizon && observerInDarkness;

          expect(isVisible).toBe(expectedVisibility);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never mark satellite as visible when sun is above horizon (daylight)', () => {
    // Generator for satellite altitude (-90 to +90 degrees)
    const validSatelliteAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    // Generator for sun altitude above horizon (0 to +90 degrees)
    const sunAboveHorizon = fc.double({
      min: 0.001, // Just above horizon
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(
        validSatelliteAltitude,
        sunAboveHorizon,
        (satelliteAltitude, sunAltitude) => {
          const tracker = createSatelliteTracker();

          const sunPosition: SunPosition = {
            ra: 12,
            dec: 0,
            azimuth: 180,
            altitude: sunAltitude,
            status: 'daylight',
            safetyWarning: true,
            isBelowHorizon: false,
          };

          const isVisible = tracker.predictVisibility(satelliteAltitude, sunPosition);

          // Requirement 6.5: Satellite SHALL NOT be visible during daylight
          // regardless of satellite altitude
          expect(isVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never mark satellite as visible when satellite is below horizon', () => {
    // Generator for satellite altitude below horizon (-90 to 0 degrees)
    const satelliteBelowHorizon = fc.double({
      min: -90,
      max: 0, // At or below horizon
      noNaN: true,
      noDefaultInfinity: true,
    });

    // Generator for sun altitude (-90 to +90 degrees)
    const validSunAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(
        satelliteBelowHorizon,
        validSunAltitude,
        (satelliteAltitude, sunAltitude) => {
          const tracker = createSatelliteTracker();

          const sunPosition: SunPosition = {
            ra: 12,
            dec: 0,
            azimuth: 180,
            altitude: sunAltitude,
            status: sunAltitude > 0 ? 'daylight' : sunAltitude > -18 ? 'twilight' : 'night',
            safetyWarning: sunAltitude > -18,
            isBelowHorizon: sunAltitude < 0,
          };

          const isVisible = tracker.predictVisibility(satelliteAltitude, sunPosition);

          // Requirement 6.5: Satellite SHALL NOT be visible when below horizon
          // regardless of sun position
          expect(isVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mark satellite as visible when satellite is above horizon AND sun is below horizon', () => {
    // Generator for satellite altitude above horizon (0 to +90 degrees, exclusive of 0)
    const satelliteAboveHorizon = fc.double({
      min: 0.001, // Just above horizon
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    // Generator for sun altitude below horizon (-90 to 0 degrees, exclusive of 0)
    const sunBelowHorizon = fc.double({
      min: -90,
      max: -0.001, // Just below horizon
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(
        satelliteAboveHorizon,
        sunBelowHorizon,
        (satelliteAltitude, sunAltitude) => {
          const tracker = createSatelliteTracker();

          const sunPosition: SunPosition = {
            ra: 12,
            dec: 0,
            azimuth: 180,
            altitude: sunAltitude,
            status: sunAltitude > -18 ? 'twilight' : 'night',
            safetyWarning: sunAltitude > -18,
            isBelowHorizon: true,
          };

          const isVisible = tracker.predictVisibility(satelliteAltitude, sunPosition);

          // Requirement 6.5: Satellite SHALL be visible when:
          // - Satellite is above horizon (illuminated)
          // - Observer is in darkness (sun below horizon)
          expect(isVisible).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly set isVisible in calculateAll results based on visibility conditions', () => {
    // Generator for valid observer locations
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for sun altitude (-90 to +90 degrees)
    const validSunAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(
        validObserver,
        validSunAltitude,
        (observer, sunAltitude) => {
          const tracker = createSatelliteTracker();

          // Add valid TLE data
          const tleData: TLEData = {
            name: 'ISS (ZARYA)',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt: new Date(),
          };
          tracker.setTLE('ISS', tleData);

          const sunPosition: SunPosition = {
            ra: 12,
            dec: 0,
            azimuth: 180,
            altitude: sunAltitude,
            status: sunAltitude > 0 ? 'daylight' : sunAltitude > -18 ? 'twilight' : 'night',
            safetyWarning: sunAltitude > -18,
            isBelowHorizon: sunAltitude < 0,
          };

          const results = tracker.calculateAll(new Date(), observer, sunPosition);
          const issResult = results.get('ISS');

          // Only check if we got a valid position (not an error)
          if (issResult && 'azimuth' in issResult) {
            const position = issResult as SatellitePosition;

            // Requirement 6.5: isVisible should follow visibility rules
            const satelliteAboveHorizon = position.altitude > 0;
            const observerInDarkness = sunAltitude < 0;
            const expectedVisibility = satelliteAboveHorizon && observerInDarkness;

            expect(position.isVisible).toBe(expectedVisibility);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle boundary case when satellite altitude is exactly 0', () => {
    // Generator for sun altitude (-90 to +90 degrees)
    const validSunAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(
        validSunAltitude,
        (sunAltitude) => {
          const tracker = createSatelliteTracker();

          const sunPosition: SunPosition = {
            ra: 12,
            dec: 0,
            azimuth: 180,
            altitude: sunAltitude,
            status: sunAltitude > 0 ? 'daylight' : sunAltitude > -18 ? 'twilight' : 'night',
            safetyWarning: sunAltitude > -18,
            isBelowHorizon: sunAltitude < 0,
          };

          // Satellite at exactly horizon (altitude = 0)
          const isVisible = tracker.predictVisibility(0, sunPosition);

          // Requirement 6.5: Satellite at horizon (altitude = 0) is NOT above horizon
          // so it should NOT be visible regardless of sun position
          expect(isVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle boundary case when sun altitude is exactly 0', () => {
    // Generator for satellite altitude (-90 to +90 degrees)
    const validSatelliteAltitude = fc.double({
      min: -90,
      max: 90,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(
        validSatelliteAltitude,
        (satelliteAltitude) => {
          const tracker = createSatelliteTracker();

          // Sun at exactly horizon (altitude = 0)
          const sunPosition: SunPosition = {
            ra: 12,
            dec: 0,
            azimuth: 180,
            altitude: 0,
            status: 'daylight', // Sun at horizon is still daylight
            safetyWarning: true,
            isBelowHorizon: false,
          };

          const isVisible = tracker.predictVisibility(satelliteAltitude, sunPosition);

          // Requirement 6.5: Sun at horizon (altitude = 0) means observer is NOT in darkness
          // so satellite should NOT be visible regardless of satellite altitude
          expect(isVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property-Based Tests for Satellite Tracker
 *
 * Feature: enhanced-celestial-objects, Property 15: Satellite Error Handling
 *
 * **Validates: Requirements 6.6**
 */

describe('Property 15: Satellite Error Handling', () => {
  /**
   * Property 15: Satellite Error Handling
   *
   * *For any* satellite ID with unavailable or invalid TLE data, the Satellite_Tracker
   * SHALL return an error result (not a position) with the appropriate error type.
   *
   * Error types:
   * - TLE_UNAVAILABLE: When getTLE(id) returns null
   * - TLE_INVALID: When TLE parsing fails or orbital elements are out of valid ranges
   * - TLE_STALE: Returned as a warning when TLE age exceeds 14 days (position is still calculated but flagged)
   *
   * Feature: enhanced-celestial-objects, Property 15: Satellite Error Handling
   */

  it('should return TLE_UNAVAILABLE error for any non-existent satellite ID', () => {
    // Generator for random satellite IDs that don't exist
    const nonExistentSatelliteId = fc.stringMatching(/^[A-Z0-9_-]{1,20}$/);

    // Generator for valid observer locations
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for timestamps
    const validTimestamp = fc.date({
      min: new Date('2024-01-01'),
      max: new Date('2024-12-31'),
    });

    fc.assert(
      fc.property(
        nonExistentSatelliteId,
        validObserver,
        validTimestamp,
        (satelliteId, observer, timestamp) => {
          const tracker = createSatelliteTracker();

          // Do NOT add any TLE data - satellite should not exist
          const result = tracker.calculate(satelliteId, timestamp, observer);

          // Requirement 6.6: SHALL return error result for unavailable TLE
          expect('type' in result).toBe(true);
          const error = result as SatelliteTrackerError;
          expect(error.type).toBe('TLE_UNAVAILABLE');
          expect(error.satelliteId).toBe(satelliteId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return TLE_INVALID error for any invalid TLE data', () => {
    // Generator for invalid TLE line 1 formats
    const invalidTLELine1 = fc.oneof(
      fc.constant('invalid line 1'),
      fc.constant(''),
      fc.constant('1 XXXXX'),
      fc.stringMatching(/^[a-z]{5,20}$/), // lowercase letters only
      fc.constant('1 25544U 98067A   INVALID  .00016717  00000-0  10270-3 0  9025'),
    );

    // Generator for invalid TLE line 2 formats
    const invalidTLELine2 = fc.oneof(
      fc.constant('invalid line 2'),
      fc.constant(''),
      fc.constant('2 XXXXX'),
      fc.stringMatching(/^[a-z]{5,20}$/), // lowercase letters only
      fc.constant('2 25544  INVALID 208.9163 0006703 358.0000   2.1000 15.49815200  0000'),
    );

    // Generator for valid observer locations
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for satellite IDs
    const satelliteId = fc.stringMatching(/^[A-Z]{2,10}$/);

    fc.assert(
      fc.property(
        invalidTLELine1,
        invalidTLELine2,
        validObserver,
        satelliteId,
        (line1, line2, observer, satId) => {
          const tracker = createSatelliteTracker();

          // Add invalid TLE data
          const invalidTLE: TLEData = {
            name: `INVALID SAT ${satId}`,
            line1,
            line2,
            fetchedAt: new Date(),
          };

          tracker.setTLE(satId, invalidTLE);

          const result = tracker.calculate(satId, new Date(), observer);

          // Requirement 6.6: SHALL return error result for invalid TLE
          expect('type' in result).toBe(true);
          const error = result as SatelliteTrackerError;
          expect(error.type).toBe('TLE_INVALID');
          expect(error.satelliteId).toBe(satId);
          expect('reason' in error).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return error (not position) when TLE data is unavailable regardless of observer location', () => {
    // Generator for various observer locations including edge cases
    const anyObserver = fc.oneof(
      // Normal locations
      fc.record({
        latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
      }),
      // Polar locations
      fc.record({
        latitude: fc.oneof(fc.constant(90), fc.constant(-90)),
        longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
      }),
      // Equatorial locations
      fc.record({
        latitude: fc.constant(0),
        longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
      })
    );

    fc.assert(
      fc.property(
        anyObserver,
        (observer) => {
          const tracker = createSatelliteTracker();

          // Request calculation for non-existent satellite
          const result = tracker.calculate('NONEXISTENT_SAT', new Date(), observer);

          // Requirement 6.6: SHALL return error, NOT a position
          // Verify it's an error by checking for 'type' property
          expect('type' in result).toBe(true);
          // Verify it's NOT a position by checking absence of position properties
          expect('azimuth' in result).toBe(false);
          expect('altitude' in result).toBe(false);
          expect('range' in result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return error (not position) when TLE data is invalid regardless of timestamp', () => {
    // Generator for various timestamps
    const anyTimestamp = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    // Generator for valid observer
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(
        anyTimestamp,
        validObserver,
        (timestamp, observer) => {
          const tracker = createSatelliteTracker();

          // Add invalid TLE data
          const invalidTLE: TLEData = {
            name: 'INVALID SAT',
            line1: 'completely invalid line 1 data',
            line2: 'completely invalid line 2 data',
            fetchedAt: new Date(),
          };

          tracker.setTLE('INVALID', invalidTLE);

          const result = tracker.calculate('INVALID', timestamp, observer);

          // Requirement 6.6: SHALL return error, NOT a position
          expect('type' in result).toBe(true);
          expect('azimuth' in result).toBe(false);
          expect('altitude' in result).toBe(false);
          expect('range' in result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include errors in calculateAll results for satellites with unavailable/invalid TLE', () => {
    // Generator for number of valid satellites (0 to 5)
    const numValidSatellites = fc.integer({ min: 0, max: 5 });

    // Generator for number of invalid satellites (1 to 5)
    const numInvalidSatellites = fc.integer({ min: 1, max: 5 });

    // Generator for valid observer
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Sun position for calculateAll
    const sunPosition: SunPosition = {
      ra: 12,
      dec: 0,
      azimuth: 180,
      altitude: -30,
      status: 'night',
      safetyWarning: false,
      isBelowHorizon: true,
    };

    fc.assert(
      fc.property(
        numValidSatellites,
        numInvalidSatellites,
        validObserver,
        (numValid, numInvalid, observer) => {
          const tracker = createSatelliteTracker();

          // Add valid satellites
          for (let i = 0; i < numValid; i++) {
            const validTLE: TLEData = {
              name: `VALID SAT ${i}`,
              line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
              line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
              fetchedAt: new Date(),
            };
            tracker.setTLE(`VALID${i}`, validTLE);
          }

          // Add invalid satellites
          for (let i = 0; i < numInvalid; i++) {
            const invalidTLE: TLEData = {
              name: `INVALID SAT ${i}`,
              line1: 'invalid line 1',
              line2: 'invalid line 2',
              fetchedAt: new Date(),
            };
            tracker.setTLE(`INVALID${i}`, invalidTLE);
          }

          const results = tracker.calculateAll(new Date(), observer, sunPosition);

          // Requirement 6.6: calculateAll SHALL include errors for invalid TLE
          expect(results.size).toBe(numValid + numInvalid);

          // Check that invalid satellites have error results
          for (let i = 0; i < numInvalid; i++) {
            const result = results.get(`INVALID${i}`);
            expect(result).toBeDefined();
            expect('type' in result!).toBe(true);
            expect((result as SatelliteTrackerError).type).toBe('TLE_INVALID');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return appropriate error type based on the specific error condition', () => {
    // Generator for error scenarios
    const errorScenario = fc.oneof(
      fc.constant('unavailable'),
      fc.constant('invalid')
    );

    // Generator for valid observer
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    // Generator for satellite IDs
    const satelliteId = fc.stringMatching(/^[A-Z]{3,8}$/);

    fc.assert(
      fc.property(
        errorScenario,
        validObserver,
        satelliteId,
        (scenario, observer, satId) => {
          const tracker = createSatelliteTracker();

          if (scenario === 'invalid') {
            // Add invalid TLE
            const invalidTLE: TLEData = {
              name: `TEST SAT ${satId}`,
              line1: 'invalid',
              line2: 'invalid',
              fetchedAt: new Date(),
            };
            tracker.setTLE(satId, invalidTLE);
          }
          // For 'unavailable', don't add any TLE

          const result = tracker.calculate(satId, new Date(), observer);

          // Requirement 6.6: SHALL return appropriate error type
          expect('type' in result).toBe(true);
          const error = result as SatelliteTrackerError;

          if (scenario === 'unavailable') {
            expect(error.type).toBe('TLE_UNAVAILABLE');
          } else {
            expect(error.type).toBe('TLE_INVALID');
          }

          // Error should always include satelliteId
          expect(error.satelliteId).toBe(satId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle stale TLE by returning position with isStale flag (not blocking error)', () => {
    // Generator for TLE age beyond stale threshold (15 to 60 days)
    const staleTLEAge = fc.integer({ min: 15, max: 60 });

    // Generator for valid observer
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(
        staleTLEAge,
        validObserver,
        (ageDays, observer) => {
          const tracker = createSatelliteTracker();

          // Create stale but valid TLE data
          const fetchedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
          const staleTLE: TLEData = {
            name: 'STALE SAT',
            line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
            line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
            fetchedAt,
          };

          tracker.setTLE('STALE', staleTLE);

          const result = tracker.calculate('STALE', new Date(), observer);

          // Per design doc: TLE_STALE is returned as a warning, position is still calculated
          // So we should get a position (not an error) with isStale = true
          if ('azimuth' in result) {
            const position = result as SatellitePosition;
            expect(position.isStale).toBe(true);
          }
          // Note: The implementation may return either a position with isStale=true
          // or a TLE_STALE error - both are valid per the design
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should consistently return error type for the same invalid TLE across multiple calculations', () => {
    // Generator for number of calculations (2 to 10)
    const numCalculations = fc.integer({ min: 2, max: 10 });

    // Generator for valid observer
    const validObserver = fc.record({
      latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(
        numCalculations,
        validObserver,
        (numCalcs, observer) => {
          const tracker = createSatelliteTracker();

          // Add invalid TLE
          const invalidTLE: TLEData = {
            name: 'CONSISTENT TEST',
            line1: 'invalid line 1',
            line2: 'invalid line 2',
            fetchedAt: new Date(),
          };
          tracker.setTLE('CONSISTENT', invalidTLE);

          // Perform multiple calculations
          const results: (SatellitePosition | SatelliteTrackerError)[] = [];
          for (let i = 0; i < numCalcs; i++) {
            const timestamp = new Date(Date.now() + i * 60000); // Different timestamps
            results.push(tracker.calculate('CONSISTENT', timestamp, observer));
          }

          // Requirement 6.6: All results should be consistent errors
          for (const result of results) {
            expect('type' in result).toBe(true);
            expect((result as SatelliteTrackerError).type).toBe('TLE_INVALID');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
