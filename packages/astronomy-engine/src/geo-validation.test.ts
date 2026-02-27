/**
 * Unit Tests for Geographic Coordinate Validation Module
 *
 * Tests validation functions for latitude, longitude, and coordinate precision.
 * Validates: Requirements 2.2, 2.3, 2.5
 */

import { describe, it, expect } from 'vitest';
import {
  isValidLatitude,
  isValidLongitude,
  isValidGeographicCoordinates,
  validateAndNormalizeCoordinates,
  roundToDecimalPlaces,
} from './geo-validation';

describe('roundToDecimalPlaces', () => {
  it('should round to 4 decimal places by default', () => {
    expect(roundToDecimalPlaces(12.345678)).toBe(12.3457);
    expect(roundToDecimalPlaces(12.34561)).toBe(12.3456);
    // Note: 12.34565 rounds to 12.3456 due to floating-point representation
    // (12.34565 is actually stored as slightly less than 12.34565)
    expect(roundToDecimalPlaces(12.345651)).toBe(12.3457);
  });

  it('should round to specified decimal places', () => {
    expect(roundToDecimalPlaces(12.345678, 2)).toBe(12.35);
    expect(roundToDecimalPlaces(12.345678, 3)).toBe(12.346);
    expect(roundToDecimalPlaces(12.345678, 6)).toBe(12.345678);
  });

  it('should handle zero decimal places', () => {
    expect(roundToDecimalPlaces(12.5, 0)).toBe(13);
    expect(roundToDecimalPlaces(12.4, 0)).toBe(12);
  });

  it('should handle negative numbers', () => {
    expect(roundToDecimalPlaces(-12.345678, 4)).toBe(-12.3457);
    expect(roundToDecimalPlaces(-12.34561, 4)).toBe(-12.3456);
  });

  it('should handle whole numbers', () => {
    expect(roundToDecimalPlaces(12, 4)).toBe(12);
    expect(roundToDecimalPlaces(0, 4)).toBe(0);
  });
});

describe('isValidLatitude', () => {
  it('should accept valid latitude values within range [-90, +90]', () => {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(45)).toBe(true);
    expect(isValidLatitude(-45)).toBe(true);
    expect(isValidLatitude(89.9999)).toBe(true);
    expect(isValidLatitude(-89.9999)).toBe(true);
  });

  it('should accept boundary values', () => {
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
  });

  it('should reject values outside range', () => {
    expect(isValidLatitude(90.0001)).toBe(false);
    expect(isValidLatitude(-90.0001)).toBe(false);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(-91)).toBe(false);
    expect(isValidLatitude(180)).toBe(false);
    expect(isValidLatitude(-180)).toBe(false);
  });

  it('should reject non-finite values', () => {
    expect(isValidLatitude(NaN)).toBe(false);
    expect(isValidLatitude(Infinity)).toBe(false);
    expect(isValidLatitude(-Infinity)).toBe(false);
  });

  it('should reject non-number values', () => {
    expect(isValidLatitude('45' as unknown as number)).toBe(false);
    expect(isValidLatitude(null as unknown as number)).toBe(false);
    expect(isValidLatitude(undefined as unknown as number)).toBe(false);
  });
});

describe('isValidLongitude', () => {
  it('should accept valid longitude values within range [-180, +180]', () => {
    expect(isValidLongitude(0)).toBe(true);
    expect(isValidLongitude(90)).toBe(true);
    expect(isValidLongitude(-90)).toBe(true);
    expect(isValidLongitude(179.9999)).toBe(true);
    expect(isValidLongitude(-179.9999)).toBe(true);
  });

  it('should accept boundary values', () => {
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
  });

  it('should reject values outside range', () => {
    expect(isValidLongitude(180.0001)).toBe(false);
    expect(isValidLongitude(-180.0001)).toBe(false);
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
    expect(isValidLongitude(360)).toBe(false);
  });

  it('should reject non-finite values', () => {
    expect(isValidLongitude(NaN)).toBe(false);
    expect(isValidLongitude(Infinity)).toBe(false);
    expect(isValidLongitude(-Infinity)).toBe(false);
  });

  it('should reject non-number values', () => {
    expect(isValidLongitude('90' as unknown as number)).toBe(false);
    expect(isValidLongitude(null as unknown as number)).toBe(false);
    expect(isValidLongitude(undefined as unknown as number)).toBe(false);
  });
});

describe('isValidGeographicCoordinates', () => {
  it('should accept valid coordinates', () => {
    expect(isValidGeographicCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
    expect(isValidGeographicCoordinates({ latitude: 45.5, longitude: -122.5 })).toBe(true);
    expect(isValidGeographicCoordinates({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidGeographicCoordinates({ latitude: -90, longitude: -180 })).toBe(true);
  });

  it('should reject invalid latitude', () => {
    expect(isValidGeographicCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidGeographicCoordinates({ latitude: -91, longitude: 0 })).toBe(false);
  });

  it('should reject invalid longitude', () => {
    expect(isValidGeographicCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidGeographicCoordinates({ latitude: 0, longitude: -181 })).toBe(false);
  });

  it('should reject null or undefined', () => {
    expect(isValidGeographicCoordinates(null as any)).toBe(false);
    expect(isValidGeographicCoordinates(undefined as any)).toBe(false);
  });

  it('should reject non-object values', () => {
    expect(isValidGeographicCoordinates('coords' as any)).toBe(false);
    expect(isValidGeographicCoordinates(123 as any)).toBe(false);
  });
});

describe('validateAndNormalizeCoordinates', () => {
  it('should return normalized coordinates for valid input', () => {
    const result = validateAndNormalizeCoordinates({ latitude: 45.123456, longitude: -122.987654 });
    expect(result).toEqual({ latitude: 45.1235, longitude: -122.9877 });
  });

  it('should preserve 4 decimal places precision', () => {
    const result = validateAndNormalizeCoordinates({ latitude: 45.12345678, longitude: -122.98765432 });
    expect(result).not.toBeNull();
    expect(result!.latitude.toString().split('.')[1]?.length).toBeLessThanOrEqual(4);
    expect(result!.longitude.toString().split('.')[1]?.length).toBeLessThanOrEqual(4);
  });

  it('should return null for invalid latitude', () => {
    expect(validateAndNormalizeCoordinates({ latitude: 91, longitude: 0 })).toBeNull();
    expect(validateAndNormalizeCoordinates({ latitude: -91, longitude: 0 })).toBeNull();
  });

  it('should return null for invalid longitude', () => {
    expect(validateAndNormalizeCoordinates({ latitude: 0, longitude: 181 })).toBeNull();
    expect(validateAndNormalizeCoordinates({ latitude: 0, longitude: -181 })).toBeNull();
  });

  it('should return null for null/undefined input', () => {
    expect(validateAndNormalizeCoordinates(null as any)).toBeNull();
    expect(validateAndNormalizeCoordinates(undefined as any)).toBeNull();
  });

  it('should handle boundary values', () => {
    const result1 = validateAndNormalizeCoordinates({ latitude: 90, longitude: 180 });
    expect(result1).toEqual({ latitude: 90, longitude: 180 });

    const result2 = validateAndNormalizeCoordinates({ latitude: -90, longitude: -180 });
    expect(result2).toEqual({ latitude: -90, longitude: -180 });
  });

  it('should handle zero coordinates', () => {
    const result = validateAndNormalizeCoordinates({ latitude: 0, longitude: 0 });
    expect(result).toEqual({ latitude: 0, longitude: 0 });
  });
});


/**
 * Property-Based Tests for Geographic Coordinate Validation
 *
 * These tests verify universal properties across randomized inputs
 * using fast-check with minimum 100 iterations per property.
 */
import fc from 'fast-check';
import {
  validLatitude,
  validLongitude,
  extendedLatitude,
  extendedLongitude,
  validGeographicCoordinates,
  PROPERTY_TEST_CONFIG,
} from './test-generators';

describe('Geographic Validation Property-Based Tests', () => {
  /**
   * Property 4: Geographic Coordinate Validation
   *
   * For any latitude value, the system shall accept it if and only if it falls
   * within the range [-90, +90] degrees. For any longitude value, the system
   * shall accept it if and only if it falls within the range [-180, +180] degrees.
   *
   * **Validates: Requirements 2.2, 2.3**
   */
  describe('Property 4: Geographic Coordinate Validation', () => {
    it('should accept all latitude values within [-90, +90]', () => {
      fc.assert(
        fc.property(validLatitude, (lat) => {
          return isValidLatitude(lat) === true;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should accept all longitude values within [-180, +180]', () => {
      fc.assert(
        fc.property(validLongitude, (lon) => {
          return isValidLongitude(lon) === true;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should reject latitude values outside [-90, +90]', () => {
      // Generate values strictly outside the valid range
      const invalidLatitude = fc.double({
        min: 90.0001,
        max: 200,
        noNaN: true,
      });

      fc.assert(
        fc.property(invalidLatitude, (lat) => {
          return isValidLatitude(lat) === false && isValidLatitude(-lat) === false;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should reject longitude values outside [-180, +180]', () => {
      // Generate values strictly outside the valid range
      const invalidLongitude = fc.double({
        min: 180.0001,
        max: 400,
        noNaN: true,
      });

      fc.assert(
        fc.property(invalidLongitude, (lon) => {
          return isValidLongitude(lon) === false && isValidLongitude(-lon) === false;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should correctly classify any latitude value (extended range)', () => {
      fc.assert(
        fc.property(extendedLatitude, (lat) => {
          const isValid = isValidLatitude(lat);
          const shouldBeValid = lat >= -90 && lat <= 90;
          return isValid === shouldBeValid;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should correctly classify any longitude value (extended range)', () => {
      fc.assert(
        fc.property(extendedLongitude, (lon) => {
          const isValid = isValidLongitude(lon);
          const shouldBeValid = lon >= -180 && lon <= 180;
          return isValid === shouldBeValid;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should accept boundary values exactly at ±90 for latitude', () => {
      // Test exact boundary values
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);

      // Property: values very close to boundaries should be correctly classified
      fc.assert(
        fc.property(
          fc.double({ min: -0.0001, max: 0.0001, noNaN: true }),
          (epsilon) => {
            // Values at or just inside boundary should be valid
            const atUpperBound = isValidLatitude(90 + epsilon);
            const atLowerBound = isValidLatitude(-90 + epsilon);

            // If epsilon is negative, we're inside the range
            // If epsilon is positive, we're outside the range
            const upperShouldBeValid = 90 + epsilon <= 90;
            const lowerShouldBeValid = -90 + epsilon >= -90;

            return atUpperBound === upperShouldBeValid && atLowerBound === lowerShouldBeValid;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should accept boundary values exactly at ±180 for longitude', () => {
      // Test exact boundary values
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);

      // Property: values very close to boundaries should be correctly classified
      fc.assert(
        fc.property(
          fc.double({ min: -0.0001, max: 0.0001, noNaN: true }),
          (epsilon) => {
            // Values at or just inside boundary should be valid
            const atUpperBound = isValidLongitude(180 + epsilon);
            const atLowerBound = isValidLongitude(-180 + epsilon);

            // If epsilon is negative, we're inside the range
            // If epsilon is positive, we're outside the range
            const upperShouldBeValid = 180 + epsilon <= 180;
            const lowerShouldBeValid = -180 + epsilon >= -180;

            return atUpperBound === upperShouldBeValid && atLowerBound === lowerShouldBeValid;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should accept valid geographic coordinates and reject invalid ones', () => {
      fc.assert(
        fc.property(validGeographicCoordinates, (coords) => {
          return isValidGeographicCoordinates(coords) === true;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should reject coordinates with invalid latitude', () => {
      const invalidLatCoords = fc.record({
        latitude: fc.double({ min: 90.0001, max: 200, noNaN: true }),
        longitude: validLongitude,
      });

      fc.assert(
        fc.property(invalidLatCoords, (coords) => {
          return isValidGeographicCoordinates(coords) === false;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should reject coordinates with invalid longitude', () => {
      const invalidLonCoords = fc.record({
        latitude: validLatitude,
        longitude: fc.double({ min: 180.0001, max: 400, noNaN: true }),
      });

      fc.assert(
        fc.property(invalidLonCoords, (coords) => {
          return isValidGeographicCoordinates(coords) === false;
        }),
        PROPERTY_TEST_CONFIG
      );
    });
  });

  /**
   * Property 5: Coordinate Precision Preservation
   *
   * For any geographic coordinate input with decimal precision, the stored
   * coordinate shall maintain at least 4 decimal places of precision
   * (approximately 11 meters accuracy).
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 5: Coordinate Precision Preservation', () => {
    it('should preserve 4 decimal places for valid coordinates', () => {
      fc.assert(
        fc.property(validGeographicCoordinates, (coords) => {
          const normalized = validateAndNormalizeCoordinates(coords);

          if (normalized === null) {
            return false; // Should not happen with valid coordinates
          }

          // Verify that the normalized values are rounded to 4 decimal places
          const latRounded = roundToDecimalPlaces(coords.latitude, 4);
          const lonRounded = roundToDecimalPlaces(coords.longitude, 4);

          return normalized.latitude === latRounded && normalized.longitude === lonRounded;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should round values to exactly 4 decimal places', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: 90, noNaN: true }),
          (value) => {
            const rounded = roundToDecimalPlaces(value, 4);

            // The rounded value should have at most 4 decimal places
            // We check this by multiplying by 10000 and verifying it's an integer
            const multiplied = rounded * 10000;
            const isInteger = Math.abs(multiplied - Math.round(multiplied)) < 1e-9;

            return isInteger;
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should preserve precision within 0.00005 (half of last decimal place)', () => {
      fc.assert(
        fc.property(validGeographicCoordinates, (coords) => {
          const normalized = validateAndNormalizeCoordinates(coords);

          if (normalized === null) {
            return false;
          }

          // The difference between original and normalized should be at most 0.00005
          // (half of the last decimal place due to rounding)
          const latDiff = Math.abs(normalized.latitude - coords.latitude);
          const lonDiff = Math.abs(normalized.longitude - coords.longitude);

          return latDiff <= 0.00005 && lonDiff <= 0.00005;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should be idempotent - normalizing twice produces same result', () => {
      fc.assert(
        fc.property(validGeographicCoordinates, (coords) => {
          const normalized1 = validateAndNormalizeCoordinates(coords);

          if (normalized1 === null) {
            return false;
          }

          const normalized2 = validateAndNormalizeCoordinates(normalized1);

          if (normalized2 === null) {
            return false;
          }

          // Normalizing an already normalized value should produce the same result
          return (
            normalized1.latitude === normalized2.latitude &&
            normalized1.longitude === normalized2.longitude
          );
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should maintain precision for coordinates with many decimal places', () => {
      // Generate coordinates with high precision (many decimal places)
      const highPrecisionCoords = fc.record({
        latitude: fc.double({ min: -90, max: 90, noNaN: true }),
        longitude: fc.double({ min: -180, max: 180, noNaN: true }),
      });

      fc.assert(
        fc.property(highPrecisionCoords, (coords) => {
          const normalized = validateAndNormalizeCoordinates(coords);

          if (normalized === null) {
            return false;
          }

          // The normalized coordinates should be within 0.00005 of the original
          // This ensures we're preserving at least 4 decimal places of precision
          const latError = Math.abs(normalized.latitude - coords.latitude);
          const lonError = Math.abs(normalized.longitude - coords.longitude);

          // Maximum error from rounding to 4 decimal places is 0.00005
          return latError <= 0.00005 && lonError <= 0.00005;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should preserve sign of coordinates', () => {
      fc.assert(
        fc.property(validGeographicCoordinates, (coords) => {
          const normalized = validateAndNormalizeCoordinates(coords);

          if (normalized === null) {
            return false;
          }

          // Sign should be preserved (unless value rounds to 0)
          const latSignPreserved =
            coords.latitude === 0 ||
            normalized.latitude === 0 ||
            Math.sign(coords.latitude) === Math.sign(normalized.latitude);

          const lonSignPreserved =
            coords.longitude === 0 ||
            normalized.longitude === 0 ||
            Math.sign(coords.longitude) === Math.sign(normalized.longitude);

          return latSignPreserved && lonSignPreserved;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should return null for invalid coordinates (no precision preservation)', () => {
      const invalidCoords = fc.record({
        latitude: fc.double({ min: 91, max: 200, noNaN: true }),
        longitude: fc.double({ min: 181, max: 400, noNaN: true }),
      });

      fc.assert(
        fc.property(invalidCoords, (coords) => {
          const normalized = validateAndNormalizeCoordinates(coords);
          return normalized === null;
        }),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should handle zero coordinates correctly', () => {
      const result = validateAndNormalizeCoordinates({ latitude: 0, longitude: 0 });
      expect(result).toEqual({ latitude: 0, longitude: 0 });

      // Property: zero should always normalize to zero
      fc.assert(
        fc.property(
          fc.constant({ latitude: 0, longitude: 0 }),
          (coords) => {
            const normalized = validateAndNormalizeCoordinates(coords);
            return (
              normalized !== null &&
              normalized.latitude === 0 &&
              normalized.longitude === 0
            );
          }
        ),
        PROPERTY_TEST_CONFIG
      );
    });

    it('should handle boundary coordinates with precision', () => {
      // Test that boundary values are preserved correctly
      const boundaryCoords = fc.oneof(
        fc.constant({ latitude: 90, longitude: 180 }),
        fc.constant({ latitude: -90, longitude: -180 }),
        fc.constant({ latitude: 90, longitude: -180 }),
        fc.constant({ latitude: -90, longitude: 180 })
      );

      fc.assert(
        fc.property(boundaryCoords, (coords) => {
          const normalized = validateAndNormalizeCoordinates(coords);
          return (
            normalized !== null &&
            normalized.latitude === coords.latitude &&
            normalized.longitude === coords.longitude
          );
        }),
        PROPERTY_TEST_CONFIG
      );
    });
  });
});
