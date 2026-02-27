/**
 * Basic tests to verify testing infrastructure is working
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PROPERTY_TEST_CONFIG, validLatitude, validLongitude } from './test-generators';
import type { GeographicCoordinates, CelestialCoordinates, HorizontalCoordinates } from './index';

describe('Testing Infrastructure', () => {
  it('should run basic unit tests', () => {
    expect(true).toBe(true);
  });

  it('should have fast-check available', () => {
    expect(fc).toBeDefined();
    expect(fc.assert).toBeDefined();
  });

  it('should run property tests with minimum 100 iterations', () => {
    let runCount = 0;
    
    fc.assert(
      fc.property(validLatitude, (lat) => {
        runCount++;
        return lat >= -90 && lat <= 90;
      }),
      PROPERTY_TEST_CONFIG
    );

    expect(runCount).toBeGreaterThanOrEqual(100);
  });

  it('should generate valid geographic coordinates', () => {
    fc.assert(
      fc.property(validLatitude, validLongitude, (lat, lon) => {
        return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
      }),
      PROPERTY_TEST_CONFIG
    );
  });
});

describe('Type Exports', () => {
  it('should export GeographicCoordinates type', () => {
    const coords: GeographicCoordinates = { latitude: 40.7128, longitude: -74.006 };
    expect(coords.latitude).toBe(40.7128);
    expect(coords.longitude).toBe(-74.006);
  });

  it('should export CelestialCoordinates type', () => {
    const coords: CelestialCoordinates = { ra: 12.5, dec: 45.0 };
    expect(coords.ra).toBe(12.5);
    expect(coords.dec).toBe(45.0);
  });

  it('should export HorizontalCoordinates type', () => {
    const coords: HorizontalCoordinates = { azimuth: 180, altitude: 45 };
    expect(coords.azimuth).toBe(180);
    expect(coords.altitude).toBe(45);
  });
});
