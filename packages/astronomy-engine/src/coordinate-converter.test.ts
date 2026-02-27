/**
 * Unit tests and Property-Based tests for Coordinate_Converter module
 *
 * Tests the celestial to horizontal coordinate conversion functions
 * with known values and verifies the round-trip property.
 *
 * @module coordinate-converter.test
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  celestialToHorizontal,
  horizontalToCelestial,
  raHoursToDegrees,
  raDegreesToHours,
} from './coordinate-converter';
import type { CelestialCoordinates, GeographicCoordinates, HorizontalCoordinates } from './index';
import {
  validCelestialCoordinates,
  validGeographicCoordinates,
  validLST,
  validRAHours,
  validRADegrees,
  validDeclination,
  PROPERTY_TEST_CONFIG,
} from './test-generators';

describe('Coordinate_Converter', () => {
  describe('raHoursToDegrees', () => {
    it('should convert 0 hours to 0 degrees', () => {
      expect(raHoursToDegrees(0)).toBe(0);
    });

    it('should convert 6 hours to 90 degrees', () => {
      expect(raHoursToDegrees(6)).toBe(90);
    });

    it('should convert 12 hours to 180 degrees', () => {
      expect(raHoursToDegrees(12)).toBe(180);
    });

    it('should convert 24 hours to 360 degrees', () => {
      expect(raHoursToDegrees(24)).toBe(360);
    });

    it('should handle fractional hours', () => {
      expect(raHoursToDegrees(1.5)).toBeCloseTo(22.5, 10);
    });
  });

  describe('raDegreesToHours', () => {
    it('should convert 0 degrees to 0 hours', () => {
      expect(raDegreesToHours(0)).toBe(0);
    });

    it('should convert 90 degrees to 6 hours', () => {
      expect(raDegreesToHours(90)).toBe(6);
    });

    it('should convert 180 degrees to 12 hours', () => {
      expect(raDegreesToHours(180)).toBe(12);
    });

    it('should convert 360 degrees to 24 hours', () => {
      expect(raDegreesToHours(360)).toBe(24);
    });

    it('should be inverse of raHoursToDegrees', () => {
      const hours = 7.5;
      expect(raDegreesToHours(raHoursToDegrees(hours))).toBeCloseTo(hours, 10);
    });
  });


  describe('celestialToHorizontal', () => {
    it('should return azimuth in range [0, 360)', () => {
      const celestial: CelestialCoordinates = { ra: 12, dec: 45 };
      const observer: GeographicCoordinates = { latitude: 40, longitude: -74 };
      const lst = 12;

      const result = celestialToHorizontal(celestial, observer, lst);
      expect(result.azimuth).toBeGreaterThanOrEqual(0);
      expect(result.azimuth).toBeLessThan(360);
    });

    it('should return altitude in range [-90, +90]', () => {
      const celestial: CelestialCoordinates = { ra: 12, dec: 45 };
      const observer: GeographicCoordinates = { latitude: 40, longitude: -74 };
      const lst = 12;

      const result = celestialToHorizontal(celestial, observer, lst);
      expect(result.altitude).toBeGreaterThanOrEqual(-90);
      expect(result.altitude).toBeLessThanOrEqual(90);
    });

    it('should place object at zenith when Dec equals latitude and HA is 0', () => {
      // When declination equals observer latitude and hour angle is 0,
      // the object should be at the zenith (altitude = 90)
      const observer: GeographicCoordinates = { latitude: 45, longitude: 0 };
      const lst = 6; // LST in hours
      const celestial: CelestialCoordinates = { ra: 6, dec: 45 }; // HA = LST - RA = 0

      const result = celestialToHorizontal(celestial, observer, lst);
      expect(result.altitude).toBeCloseTo(90, 1);
    });

    it('should place object on horizon when appropriate', () => {
      // Test a case where the object should be near the horizon
      const observer: GeographicCoordinates = { latitude: 0, longitude: 0 };
      const lst = 6;
      const celestial: CelestialCoordinates = { ra: 0, dec: 0 }; // HA = 6 hours = 90 degrees

      const result = celestialToHorizontal(celestial, observer, lst);
      // At equator, with Dec=0 and HA=90°, altitude should be 0
      expect(result.altitude).toBeCloseTo(0, 1);
    });

    it('should handle Polaris from mid-northern latitudes', () => {
      // Polaris: RA ~2.5h, Dec ~89.3°
      // From latitude 45°N, Polaris should be at altitude close to observer's latitude
      // The altitude of a circumpolar star near the pole is approximately equal to
      // the observer's latitude, but varies slightly with hour angle
      const celestial: CelestialCoordinates = { ra: 2.5, dec: 89.3 };
      const observer: GeographicCoordinates = { latitude: 45, longitude: 0 };
      const lst = 12;

      const result = celestialToHorizontal(celestial, observer, lst);
      // Polaris altitude should be approximately equal to observer's latitude (within 1 degree)
      // The actual altitude varies slightly due to Polaris not being exactly at the pole
      expect(result.altitude).toBeGreaterThan(44);
      expect(result.altitude).toBeLessThan(46);
    });

    it('should handle objects below the horizon', () => {
      // An object with Dec = -60 viewed from latitude 45°N should be below horizon
      const celestial: CelestialCoordinates = { ra: 12, dec: -60 };
      const observer: GeographicCoordinates = { latitude: 45, longitude: 0 };
      const lst = 12; // Object on meridian

      const result = celestialToHorizontal(celestial, observer, lst);
      expect(result.altitude).toBeLessThan(0);
    });
  });


  describe('horizontalToCelestial', () => {
    it('should return RA in range [0, 24)', () => {
      const horizontal: HorizontalCoordinates = { azimuth: 180, altitude: 45 };
      const observer: GeographicCoordinates = { latitude: 40, longitude: -74 };
      const lst = 12;

      const result = horizontalToCelestial(horizontal, observer, lst);
      expect(result.ra).toBeGreaterThanOrEqual(0);
      expect(result.ra).toBeLessThan(24);
    });

    it('should return Dec in range [-90, +90]', () => {
      const horizontal: HorizontalCoordinates = { azimuth: 180, altitude: 45 };
      const observer: GeographicCoordinates = { latitude: 40, longitude: -74 };
      const lst = 12;

      const result = horizontalToCelestial(horizontal, observer, lst);
      expect(result.dec).toBeGreaterThanOrEqual(-90);
      expect(result.dec).toBeLessThanOrEqual(90);
    });

    it('should recover zenith as Dec = latitude', () => {
      // Zenith (altitude = 90) should correspond to Dec = observer latitude
      const horizontal: HorizontalCoordinates = { azimuth: 0, altitude: 90 };
      const observer: GeographicCoordinates = { latitude: 45, longitude: 0 };
      const lst = 12;

      const result = horizontalToCelestial(horizontal, observer, lst);
      expect(result.dec).toBeCloseTo(45, 1);
    });
  });

  describe('Round-trip conversion (Property 2)', () => {
    it('should produce round-trip within 0.01 degrees for typical coordinates', () => {
      const testCases = [
        { celestial: { ra: 6, dec: 30 }, observer: { latitude: 40, longitude: -74 }, lst: 12 },
        { celestial: { ra: 18, dec: -20 }, observer: { latitude: -33, longitude: 151 }, lst: 6 },
        { celestial: { ra: 0, dec: 0 }, observer: { latitude: 0, longitude: 0 }, lst: 0 },
        { celestial: { ra: 12, dec: 60 }, observer: { latitude: 60, longitude: 10 }, lst: 18 },
        { celestial: { ra: 3, dec: -45 }, observer: { latitude: -45, longitude: -70 }, lst: 3 },
      ];

      for (const { celestial, observer, lst } of testCases) {
        // Convert celestial to horizontal
        const horizontal = celestialToHorizontal(celestial, observer, lst);

        // Convert back to celestial
        const recovered = horizontalToCelestial(horizontal, observer, lst);

        // Check RA within 0.01 degrees (converted to hours: 0.01/15 ≈ 0.00067 hours)
        let raDiff = Math.abs(recovered.ra - celestial.ra);
        if (raDiff > 12) raDiff = 24 - raDiff; // Handle wrap-around
        const raDiffDegrees = raDiff * 15;
        expect(raDiffDegrees).toBeLessThanOrEqual(0.01);

        // Check Dec within 0.01 degrees
        expect(Math.abs(recovered.dec - celestial.dec)).toBeLessThanOrEqual(0.01);
      }
    });

    it('should handle edge case at celestial pole', () => {
      // Near celestial pole, RA becomes less meaningful but Dec should be preserved
      const celestial: CelestialCoordinates = { ra: 12, dec: 89 };
      const observer: GeographicCoordinates = { latitude: 45, longitude: 0 };
      const lst = 12;

      const horizontal = celestialToHorizontal(celestial, observer, lst);
      const recovered = horizontalToCelestial(horizontal, observer, lst);

      // Dec should be preserved within tolerance
      expect(Math.abs(recovered.dec - celestial.dec)).toBeLessThanOrEqual(0.1);
    });

    it('should handle edge case at observer pole', () => {
      // At observer pole, azimuth becomes less meaningful
      const celestial: CelestialCoordinates = { ra: 6, dec: 45 };
      const observer: GeographicCoordinates = { latitude: 89, longitude: 0 };
      const lst = 12;

      const horizontal = celestialToHorizontal(celestial, observer, lst);
      const recovered = horizontalToCelestial(horizontal, observer, lst);

      // Dec should be preserved within tolerance
      expect(Math.abs(recovered.dec - celestial.dec)).toBeLessThanOrEqual(0.1);
    });
  });

  describe('Horizontal Coordinate Output Ranges (Property 7)', () => {
    it('should always return azimuth in [0, 360) and altitude in [-90, +90]', () => {
      const testCases = [
        { celestial: { ra: 0, dec: 0 }, observer: { latitude: 0, longitude: 0 }, lst: 0 },
        { celestial: { ra: 23.9, dec: 89 }, observer: { latitude: 89, longitude: 179 }, lst: 23.9 },
        { celestial: { ra: 12, dec: -89 }, observer: { latitude: -89, longitude: -179 }, lst: 12 },
        { celestial: { ra: 6, dec: 45 }, observer: { latitude: -45, longitude: 90 }, lst: 18 },
      ];

      for (const { celestial, observer, lst } of testCases) {
        const result = celestialToHorizontal(celestial, observer, lst);

        expect(result.azimuth).toBeGreaterThanOrEqual(0);
        expect(result.azimuth).toBeLessThan(360);
        expect(result.altitude).toBeGreaterThanOrEqual(-90);
        expect(result.altitude).toBeLessThanOrEqual(90);
      }
    });
  });

  describe('RA Format Equivalence (Property 8)', () => {
    it('should produce identical results for RA in hours vs degrees', () => {
      // This test verifies that the conversion utilities work correctly
      // The celestialToHorizontal function expects RA in hours
      const raHours = 6;
      const raDegrees = 90;

      // Verify the conversion is correct
      expect(raHoursToDegrees(raHours)).toBe(raDegrees);
      expect(raDegreesToHours(raDegrees)).toBe(raHours);

      // Both should give the same result when properly converted
      const observer: GeographicCoordinates = { latitude: 40, longitude: 0 };
      const lst = 12;

      const resultFromHours = celestialToHorizontal({ ra: raHours, dec: 30 }, observer, lst);
      const resultFromDegrees = celestialToHorizontal(
        { ra: raDegreesToHours(raDegrees), dec: 30 },
        observer,
        lst
      );

      expect(resultFromHours.azimuth).toBeCloseTo(resultFromDegrees.azimuth, 10);
      expect(resultFromHours.altitude).toBeCloseTo(resultFromDegrees.altitude, 10);
    });
  });
});


/**
 * Property-Based Tests for Coordinate_Converter
 *
 * These tests verify universal properties across randomized inputs
 * using fast-check with minimum 100 iterations per property.
 */
describe('Coordinate_Converter Property-Based Tests', () => {
  /**
   * Property 2: Coordinate Conversion Round-Trip
   *
   * For any valid celestial coordinates (RA/Dec), observer position (latitude/longitude),
   * and Local Sidereal Time, converting to horizontal coordinates (Az/Alt) and then back
   * to celestial coordinates shall produce values within 0.01 degrees of the original.
   *
   * **Validates: Requirements 4.7**
   */
  describe('Property 2: Coordinate Conversion Round-Trip', () => {
    it('should produce round-trip RA/Dec→Az/Alt→RA/Dec within 0.01°', () => {
      fc.assert(
        fc.property(
          validCelestialCoordinates,
          validGeographicCoordinates,
          validLST,
          (celestial, observer, lst) => {
            // Skip edge cases where conversion is numerically unstable:
            // - Observer at exact poles (latitude ±90)
            // - Object at exact celestial poles (dec ±90)
            // - Object at exact zenith
            if (
              Math.abs(observer.latitude) > 89.9 ||
              Math.abs(celestial.dec) > 89.9
            ) {
              return true; // Skip these edge cases
            }

            // Convert celestial to horizontal
            const horizontal = celestialToHorizontal(celestial, observer, lst);

            // Skip if object is at zenith (altitude ~90) where azimuth is undefined
            if (horizontal.altitude > 89.9) {
              return true;
            }

            // Convert back to celestial
            const recovered = horizontalToCelestial(horizontal, observer, lst);

            // Check RA within 0.01 degrees
            // RA is in hours, so convert difference to degrees (1 hour = 15 degrees)
            let raDiff = Math.abs(recovered.ra - celestial.ra);
            // Handle wrap-around at 24 hours
            if (raDiff > 12) {
              raDiff = 24 - raDiff;
            }
            const raDiffDegrees = raDiff * 15;

            // Check Dec within 0.01 degrees
            const decDiff = Math.abs(recovered.dec - celestial.dec);

            return raDiffDegrees <= 0.01 && decDiff <= 0.01;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should preserve declination accurately in round-trip conversion', () => {
      fc.assert(
        fc.property(
          validCelestialCoordinates,
          validGeographicCoordinates,
          validLST,
          (celestial, observer, lst) => {
            // Skip extreme edge cases
            if (
              Math.abs(observer.latitude) > 89.9 ||
              Math.abs(celestial.dec) > 89.9
            ) {
              return true;
            }

            const horizontal = celestialToHorizontal(celestial, observer, lst);

            // Skip zenith case
            if (horizontal.altitude > 89.9) {
              return true;
            }

            const recovered = horizontalToCelestial(horizontal, observer, lst);

            // Declination should be preserved within 0.01 degrees
            return Math.abs(recovered.dec - celestial.dec) <= 0.01;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });

  /**
   * Property 7: Horizontal Coordinate Output Ranges
   *
   * For any valid celestial coordinate conversion, the output azimuth shall be
   * in the range [0, 360) degrees and the output altitude shall be in the range
   * [-90, +90] degrees.
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  describe('Property 7: Horizontal Coordinate Output Ranges', () => {
    it('should always return azimuth in [0, 360)', () => {
      fc.assert(
        fc.property(
          validCelestialCoordinates,
          validGeographicCoordinates,
          validLST,
          (celestial, observer, lst) => {
            const result = celestialToHorizontal(celestial, observer, lst);

            return result.azimuth >= 0 && result.azimuth < 360;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should always return altitude in [-90, +90]', () => {
      fc.assert(
        fc.property(
          validCelestialCoordinates,
          validGeographicCoordinates,
          validLST,
          (celestial, observer, lst) => {
            const result = celestialToHorizontal(celestial, observer, lst);

            return result.altitude >= -90 && result.altitude <= 90;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return both azimuth and altitude within valid ranges for all inputs', () => {
      fc.assert(
        fc.property(
          validCelestialCoordinates,
          validGeographicCoordinates,
          validLST,
          (celestial, observer, lst) => {
            const result = celestialToHorizontal(celestial, observer, lst);

            const azimuthValid = result.azimuth >= 0 && result.azimuth < 360;
            const altitudeValid = result.altitude >= -90 && result.altitude <= 90;

            return azimuthValid && altitudeValid;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });
  });

  /**
   * Property 8: RA Format Equivalence
   *
   * For any Right Ascension value, providing it in decimal hours (0-24) or in
   * degrees (0-360) shall produce identical horizontal coordinate results after
   * conversion.
   *
   * **Validates: Requirements 4.4**
   */
  describe('Property 8: RA Format Equivalence', () => {
    it('should produce identical results for RA in hours vs degrees', () => {
      fc.assert(
        fc.property(
          validRAHours,
          validDeclination,
          validGeographicCoordinates,
          validLST,
          (raHours, dec, observer, lst) => {
            // Convert RA from hours to degrees
            const raDegrees = raHoursToDegrees(raHours);

            // Create celestial coordinates using RA in hours (native format)
            const celestialFromHours: CelestialCoordinates = { ra: raHours, dec };

            // Create celestial coordinates using RA converted from degrees
            const celestialFromDegrees: CelestialCoordinates = {
              ra: raDegreesToHours(raDegrees),
              dec,
            };

            // Convert both to horizontal coordinates
            const resultFromHours = celestialToHorizontal(celestialFromHours, observer, lst);
            const resultFromDegrees = celestialToHorizontal(celestialFromDegrees, observer, lst);

            // Results should be identical (within floating point tolerance)
            const azimuthMatch = Math.abs(resultFromHours.azimuth - resultFromDegrees.azimuth) < 1e-10;
            const altitudeMatch = Math.abs(resultFromHours.altitude - resultFromDegrees.altitude) < 1e-10;

            return azimuthMatch && altitudeMatch;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should have raHoursToDegrees and raDegreesToHours as inverse functions', () => {
      fc.assert(
        fc.property(validRAHours, (raHours) => {
          // Convert hours → degrees → hours
          const degrees = raHoursToDegrees(raHours);
          const recoveredHours = raDegreesToHours(degrees);

          // Should recover original value within floating point tolerance
          return Math.abs(recoveredHours - raHours) < 1e-10;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should have raDegreesToHours and raHoursToDegrees as inverse functions', () => {
      fc.assert(
        fc.property(validRADegrees, (raDegrees) => {
          // Convert degrees → hours → degrees
          const hours = raDegreesToHours(raDegrees);
          const recoveredDegrees = raHoursToDegrees(hours);

          // Should recover original value within floating point tolerance
          return Math.abs(recoveredDegrees - raDegrees) < 1e-10;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should maintain 15 degrees per hour ratio', () => {
      fc.assert(
        fc.property(validRAHours, (raHours) => {
          const degrees = raHoursToDegrees(raHours);

          // 1 hour = 15 degrees, so degrees should be 15 * hours
          return Math.abs(degrees - raHours * 15) < 1e-10;
        }),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});
