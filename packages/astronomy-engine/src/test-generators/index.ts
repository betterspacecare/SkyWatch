/**
 * Test generators for property-based testing with fast-check
 * 
 * These generators create valid inputs for astronomy calculations,
 * ensuring property tests cover the full input space intelligently.
 */

import fc from 'fast-check';
import type { GeographicCoordinates, CelestialCoordinates, HorizontalCoordinates } from '../index';

/**
 * Property test configuration
 * Minimum 100 iterations per property as specified in design document
 */
export const PROPERTY_TEST_CONFIG = {
  numRuns: 100,
  verbose: true,
};

/**
 * Generator for valid latitude values [-90, +90]
 */
export const validLatitude = fc.double({
  min: -90,
  max: 90,
  noNaN: true,
});

/**
 * Generator for valid longitude values [-180, +180]
 */
export const validLongitude = fc.double({
  min: -180,
  max: 180,
  noNaN: true,
});

/**
 * Generator for valid geographic coordinates
 */
export const validGeographicCoordinates: fc.Arbitrary<GeographicCoordinates> = fc.record({
  latitude: validLatitude,
  longitude: validLongitude,
});

/**
 * Generator for valid Right Ascension in decimal hours [0, 24)
 */
export const validRAHours = fc.double({
  min: 0,
  max: 24,
  noNaN: true,
}).filter(ra => ra < 24); // Exclusive upper bound

/**
 * Generator for valid Right Ascension in degrees [0, 360)
 */
export const validRADegrees = fc.double({
  min: 0,
  max: 360,
  noNaN: true,
}).filter(ra => ra < 360); // Exclusive upper bound

/**
 * Generator for valid Declination [-90, +90]
 */
export const validDeclination = fc.double({
  min: -90,
  max: 90,
  noNaN: true,
});

/**
 * Generator for valid celestial coordinates
 */
export const validCelestialCoordinates: fc.Arbitrary<CelestialCoordinates> = fc.record({
  ra: validRAHours,
  dec: validDeclination,
});

/**
 * Generator for valid azimuth [0, 360)
 */
export const validAzimuth = fc.double({
  min: 0,
  max: 360,
  noNaN: true,
}).filter(az => az < 360); // Exclusive upper bound

/**
 * Generator for valid altitude [-90, +90]
 */
export const validAltitude = fc.double({
  min: -90,
  max: 90,
  noNaN: true,
});

/**
 * Generator for valid horizontal coordinates
 */
export const validHorizontalCoordinates: fc.Arbitrary<HorizontalCoordinates> = fc.record({
  azimuth: validAzimuth,
  altitude: validAltitude,
});

/**
 * Generator for valid Local Sidereal Time [0, 24)
 */
export const validLST = fc.double({
  min: 0,
  max: 24,
  noNaN: true,
}).filter(lst => lst < 24); // Exclusive upper bound

/**
 * Generator for timestamps within ±1 year from now
 */
export const validTimestamp = fc.date({
  min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
});

/**
 * Generator for extended latitude range (for boundary testing)
 */
export const extendedLatitude = fc.double({
  min: -200,
  max: 200,
  noNaN: true,
});

/**
 * Generator for extended longitude range (for boundary testing)
 */
export const extendedLongitude = fc.double({
  min: -400,
  max: 400,
  noNaN: true,
});

/**
 * Generator for valid filter alpha values [0, 1]
 */
export const validFilterAlpha = fc.double({
  min: 0,
  max: 1,
  noNaN: true,
});

/**
 * Generator for Sensor_Manager constrained alpha [0.1, 0.5]
 */
export const validSensorAlpha = fc.double({
  min: 0.1,
  max: 0.5,
  noNaN: true,
});

/**
 * Generator for 3D vector (sensor data)
 */
export const validVector3D = fc.record({
  x: fc.double({ noNaN: true, min: -1000, max: 1000 }),
  y: fc.double({ noNaN: true, min: -1000, max: 1000 }),
  z: fc.double({ noNaN: true, min: -1000, max: 1000 }),
});

/**
 * Generator for field of view [30, 120] degrees
 */
export const validFOV = fc.double({
  min: 30,
  max: 120,
  noNaN: true,
});

/**
 * Generator for star magnitude (naked eye visible ≤5.0, zoomed ≤6.0)
 */
export const validMagnitude = fc.double({
  min: -2,
  max: 6,
  noNaN: true,
});

/**
 * Generator for spectral types
 */
export const validSpectralType = fc.constantFrom('O', 'B', 'A', 'F', 'G', 'K', 'M');
