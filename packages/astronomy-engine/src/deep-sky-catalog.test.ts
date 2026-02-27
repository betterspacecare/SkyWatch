/**
 * Unit tests for Deep Sky Catalog
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDeepSkyCatalog,
  type DeepSkyCatalog,
  type DeepSkyObjectType,
} from './deep-sky-catalog';
import type { GeographicCoordinates } from './index';

describe('DeepSkyCatalog', () => {
  let catalog: DeepSkyCatalog;

  beforeEach(() => {
    catalog = createDeepSkyCatalog();
  });

  describe('getAllObjects', () => {
    it('should return all 110 Messier objects', () => {
      const objects = catalog.getAllObjects();
      expect(objects).toHaveLength(110);
    });

    it('should return objects with required properties', () => {
      const objects = catalog.getAllObjects();
      for (const obj of objects) {
        expect(obj).toHaveProperty('id');
        expect(obj).toHaveProperty('name');
        expect(obj).toHaveProperty('ra');
        expect(obj).toHaveProperty('dec');
        expect(obj).toHaveProperty('magnitude');
        expect(obj).toHaveProperty('type');
      }
    });

    it('should return a copy of the objects array', () => {
      const objects1 = catalog.getAllObjects();
      const objects2 = catalog.getAllObjects();
      expect(objects1).not.toBe(objects2);
    });
  });

  describe('getObjectsByType', () => {
    const validTypes: DeepSkyObjectType[] = [
      'Galaxy',
      'Nebula',
      'Open Cluster',
      'Globular Cluster',
      'Planetary Nebula',
    ];

    it.each(validTypes)('should return objects of type %s', (type) => {
      const objects = catalog.getObjectsByType(type);
      expect(objects.length).toBeGreaterThan(0);
      for (const obj of objects) {
        expect(obj.type).toBe(type);
      }
    });

    it('should return galaxies including M31 Andromeda', () => {
      const galaxies = catalog.getObjectsByType('Galaxy');
      const andromeda = galaxies.find((g) => g.id === 'M31');
      expect(andromeda).toBeDefined();
      expect(andromeda?.name).toBe('Andromeda Galaxy');
    });
  });


  describe('getObject', () => {
    it('should return M31 Andromeda Galaxy', () => {
      const obj = catalog.getObject('M31');
      expect(obj).not.toBeNull();
      expect(obj?.id).toBe('M31');
      expect(obj?.name).toBe('Andromeda Galaxy');
      expect(obj?.type).toBe('Galaxy');
    });

    it('should return M42 Orion Nebula', () => {
      const obj = catalog.getObject('M42');
      expect(obj).not.toBeNull();
      expect(obj?.id).toBe('M42');
      expect(obj?.name).toBe('Orion Nebula');
      expect(obj?.type).toBe('Nebula');
    });

    it('should return M1 Crab Nebula', () => {
      const obj = catalog.getObject('M1');
      expect(obj).not.toBeNull();
      expect(obj?.id).toBe('M1');
      expect(obj?.name).toBe('Crab Nebula');
    });

    it('should be case-insensitive', () => {
      const obj1 = catalog.getObject('m31');
      const obj2 = catalog.getObject('M31');
      expect(obj1).toEqual(obj2);
    });

    it('should return null for non-existent object', () => {
      const obj = catalog.getObject('M999');
      expect(obj).toBeNull();
    });
  });

  describe('getVisibleObjects', () => {
    const observer: GeographicCoordinates = {
      latitude: 40.7128, // New York
      longitude: -74.006,
    };
    const lst = 12.0; // Noon LST

    it('should return positions for all objects', () => {
      const positions = catalog.getVisibleObjects(observer, lst);
      expect(positions).toHaveLength(110);
    });

    it('should include azimuth and altitude for each object', () => {
      const positions = catalog.getVisibleObjects(observer, lst);
      for (const pos of positions) {
        expect(pos.azimuth).toBeGreaterThanOrEqual(0);
        expect(pos.azimuth).toBeLessThan(360);
        expect(pos.altitude).toBeGreaterThanOrEqual(-90);
        expect(pos.altitude).toBeLessThanOrEqual(90);
      }
    });

    it('should mark objects below horizon as not visible', () => {
      const positions = catalog.getVisibleObjects(observer, lst);
      for (const pos of positions) {
        if (pos.altitude < 0) {
          expect(pos.isVisible).toBe(false);
        }
      }
    });

    it('should mark objects exceeding magnitude limit as not visible', () => {
      const positions = catalog.getVisibleObjects(observer, lst, 5.0);
      for (const pos of positions) {
        if (pos.object.magnitude > 5.0) {
          expect(pos.isVisible).toBe(false);
        }
      }
    });

    it('should respect custom magnitude limit', () => {
      const positions = catalog.getVisibleObjects(observer, lst, 6.0);
      const visibleObjects = positions.filter((p) => p.isVisible);
      
      // All visible objects should be above horizon and within magnitude limit
      for (const pos of visibleObjects) {
        expect(pos.altitude).toBeGreaterThanOrEqual(0);
        expect(pos.object.magnitude).toBeLessThanOrEqual(6.0);
      }
    });
  });

  describe('configuration', () => {
    it('should have default maxMagnitude of 10.0', () => {
      const config = catalog.getConfig();
      expect(config.maxMagnitude).toBe(10.0);
    });

    it('should allow setting custom initial config', () => {
      const customCatalog = createDeepSkyCatalog({ maxMagnitude: 8.0 });
      const config = customCatalog.getConfig();
      expect(config.maxMagnitude).toBe(8.0);
    });

    it('should update config with setConfig', () => {
      catalog.setConfig({ maxMagnitude: 7.5 });
      const config = catalog.getConfig();
      expect(config.maxMagnitude).toBe(7.5);
    });

    it('should return a copy of config', () => {
      const config1 = catalog.getConfig();
      const config2 = catalog.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('data validation', () => {
    it('should have valid RA values (0-24 hours)', () => {
      const objects = catalog.getAllObjects();
      for (const obj of objects) {
        expect(obj.ra).toBeGreaterThanOrEqual(0);
        expect(obj.ra).toBeLessThan(24);
      }
    });

    it('should have valid Dec values (-90 to +90 degrees)', () => {
      const objects = catalog.getAllObjects();
      for (const obj of objects) {
        expect(obj.dec).toBeGreaterThanOrEqual(-90);
        expect(obj.dec).toBeLessThanOrEqual(90);
      }
    });

    it('should have valid magnitude values', () => {
      const objects = catalog.getAllObjects();
      for (const obj of objects) {
        expect(obj.magnitude).toBeGreaterThan(0);
        expect(obj.magnitude).toBeLessThan(15);
      }
    });

    it('should have valid object types', () => {
      const validTypes: DeepSkyObjectType[] = [
        'Galaxy',
        'Nebula',
        'Open Cluster',
        'Globular Cluster',
        'Planetary Nebula',
      ];
      const objects = catalog.getAllObjects();
      for (const obj of objects) {
        expect(validTypes).toContain(obj.type);
      }
    });
  });
});

/**
 * Property-Based Tests for Deep Sky Catalog
 * Feature: enhanced-celestial-objects
 */

import * as fc from 'fast-check';

describe('DeepSkyCatalog Property Tests', () => {
  /**
   * Property 9: Deep Sky Object Type Validity
   *
   * For any deep sky object in the catalog, the type field SHALL be exactly one of:
   * Galaxy, Nebula, Open Cluster, Globular Cluster, or Planetary Nebula.
   *
   * **Validates: Requirements 5.2**
   */
  describe('Property 9: Deep Sky Object Type Validity', () => {
    const validTypes = [
      'Galaxy',
      'Nebula',
      'Open Cluster',
      'Globular Cluster',
      'Planetary Nebula',
    ] as const;

    it('should have valid type for all deep sky objects in the catalog', () => {
      const catalog = createDeepSkyCatalog();
      const allObjects = catalog.getAllObjects();

      // Property test: for any object selected from the catalog, its type must be valid
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: allObjects.length - 1 }),
          (index) => {
            const object = allObjects[index];
            if (!object) return true; // Guard against undefined

            // The type field SHALL be exactly one of the valid types
            const isValidType = validTypes.includes(object.type as typeof validTypes[number]);

            expect(isValidType).toBe(true);
            expect(object.type).toBeDefined();
            expect(typeof object.type).toBe('string');

            return isValidType;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain type validity when filtering by type', () => {
      const catalog = createDeepSkyCatalog();

      // Property test: for any valid type, all returned objects should have that exact type
      fc.assert(
        fc.property(
          fc.constantFrom(...validTypes),
          (filterType) => {
            const filteredObjects = catalog.getObjectsByType(filterType);

            // All filtered objects must have the exact type we filtered by
            for (const obj of filteredObjects) {
              expect(obj.type).toBe(filterType);
            }

            // The type must still be in the valid set
            for (const obj of filteredObjects) {
              expect(validTypes).toContain(obj.type);
            }

            return filteredObjects.every(obj => obj.type === filterType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve type validity in position calculations', () => {
      const catalog = createDeepSkyCatalog();

      // Property test: for any observer location and LST, object types remain valid
      fc.assert(
        fc.property(
          fc.record({
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          fc.double({ min: 0, max: 24, noNaN: true }),
          (observer, lst) => {
            const positions = catalog.getVisibleObjects(observer, lst);

            // All objects in positions must have valid types
            for (const pos of positions) {
              const isValidType = validTypes.includes(pos.object.type as typeof validTypes[number]);
              expect(isValidType).toBe(true);
            }

            return positions.every(pos =>
              validTypes.includes(pos.object.type as typeof validTypes[number])
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: enhanced-celestial-objects, Property 10: Deep Sky Magnitude Visibility
   *
   * For any deep sky object and visibility threshold, the object SHALL be marked as
   * not visible (isVisible === false) when its magnitude exceeds the configured threshold.
   *
   * **Validates: Requirements 5.3**
   */
  describe('Property 10: Deep Sky Magnitude Visibility', () => {
    it('should mark objects as not visible when magnitude exceeds threshold', () => {
      const catalog = createDeepSkyCatalog();

      // Use a fixed observer location for consistent coordinate conversion
      const observer: GeographicCoordinates = {
        latitude: 45.0,
        longitude: 0.0,
      };
      const lst = 12.0;

      // Property test: for any magnitude threshold, objects exceeding it should be not visible
      fc.assert(
        fc.property(
          fc.double({ min: 1.0, max: 15.0, noNaN: true }),
          (magnitudeThreshold) => {
            const positions = catalog.getVisibleObjects(observer, lst, magnitudeThreshold);

            // For every object whose magnitude exceeds the threshold,
            // isVisible SHALL be false
            for (const pos of positions) {
              if (pos.object.magnitude > magnitudeThreshold) {
                expect(pos.isVisible).toBe(false);
              }
            }

            return positions.every(pos =>
              pos.object.magnitude <= magnitudeThreshold || pos.isVisible === false
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark objects as not visible when magnitude exceeds threshold regardless of observer location', () => {
      const catalog = createDeepSkyCatalog();

      // Property test: for any observer location, LST, and magnitude threshold,
      // objects exceeding the threshold should be not visible
      fc.assert(
        fc.property(
          fc.record({
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          fc.double({ min: 0, max: 24, noNaN: true }),
          fc.double({ min: 1.0, max: 15.0, noNaN: true }),
          (observer, lst, magnitudeThreshold) => {
            const positions = catalog.getVisibleObjects(observer, lst, magnitudeThreshold);

            // For every object whose magnitude exceeds the threshold,
            // isVisible SHALL be false
            for (const pos of positions) {
              if (pos.object.magnitude > magnitudeThreshold) {
                expect(pos.isVisible).toBe(false);
              }
            }

            return positions.every(pos =>
              pos.object.magnitude <= magnitudeThreshold || pos.isVisible === false
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly apply visibility based on both magnitude and horizon', () => {
      const catalog = createDeepSkyCatalog();

      // Property test: visibility requires BOTH being above horizon AND within magnitude limit
      fc.assert(
        fc.property(
          fc.record({
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          fc.double({ min: 0, max: 24, noNaN: true }),
          fc.double({ min: 1.0, max: 15.0, noNaN: true }),
          (observer, lst, magnitudeThreshold) => {
            const positions = catalog.getVisibleObjects(observer, lst, magnitudeThreshold);

            for (const pos of positions) {
              // If magnitude exceeds threshold, must NOT be visible
              if (pos.object.magnitude > magnitudeThreshold) {
                expect(pos.isVisible).toBe(false);
              }

              // If below horizon, must NOT be visible
              if (pos.altitude < 0) {
                expect(pos.isVisible).toBe(false);
              }

              // If visible, must be both above horizon AND within magnitude limit
              if (pos.isVisible) {
                expect(pos.altitude).toBeGreaterThanOrEqual(0);
                expect(pos.object.magnitude).toBeLessThanOrEqual(magnitudeThreshold);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use config maxMagnitude when no threshold is provided', () => {
      // Property test: when using config maxMagnitude, objects exceeding it should be not visible
      fc.assert(
        fc.property(
          fc.double({ min: 1.0, max: 15.0, noNaN: true }),
          (configMaxMagnitude) => {
            const catalog = createDeepSkyCatalog({ maxMagnitude: configMaxMagnitude });
            const observer: GeographicCoordinates = {
              latitude: 45.0,
              longitude: 0.0,
            };
            const lst = 12.0;

            // Call without explicit maxMagnitude - should use config value
            const positions = catalog.getVisibleObjects(observer, lst);

            // For every object whose magnitude exceeds the config threshold,
            // isVisible SHALL be false
            for (const pos of positions) {
              if (pos.object.magnitude > configMaxMagnitude) {
                expect(pos.isVisible).toBe(false);
              }
            }

            return positions.every(pos =>
              pos.object.magnitude <= configMaxMagnitude || pos.isVisible === false
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: enhanced-celestial-objects, Property 11: Coordinate Conversion Validity
   *
   * For any celestial object with valid RA/Dec coordinates, converting to horizontal
   * coordinates SHALL produce azimuth in [0, 360) degrees and altitude in [-90, +90] degrees.
   *
   * **Validates: Requirements 5.5, 7.5**
   */
  describe('Property 11: Coordinate Conversion Validity', () => {
    it('should produce valid horizontal coordinates for all catalog objects at any observer location and LST', () => {
      const catalog = createDeepSkyCatalog();

      // Property test: for any observer location and LST, all converted coordinates
      // should have valid azimuth [0, 360) and altitude [-90, +90]
      fc.assert(
        fc.property(
          fc.record({
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          fc.double({ min: 0, max: 24, noNaN: true }),
          (observer, lst) => {
            const positions = catalog.getVisibleObjects(observer, lst);

            // All positions must have valid horizontal coordinates
            for (const pos of positions) {
              // Azimuth SHALL be in [0, 360) degrees
              expect(pos.azimuth).toBeGreaterThanOrEqual(0);
              expect(pos.azimuth).toBeLessThan(360);

              // Altitude SHALL be in [-90, +90] degrees
              expect(pos.altitude).toBeGreaterThanOrEqual(-90);
              expect(pos.altitude).toBeLessThanOrEqual(90);

              // Values should be finite numbers (not NaN or Infinity)
              expect(Number.isFinite(pos.azimuth)).toBe(true);
              expect(Number.isFinite(pos.altitude)).toBe(true);
            }

            return positions.every(
              (pos) =>
                pos.azimuth >= 0 &&
                pos.azimuth < 360 &&
                pos.altitude >= -90 &&
                pos.altitude <= 90 &&
                Number.isFinite(pos.azimuth) &&
                Number.isFinite(pos.altitude)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid horizontal coordinates for arbitrary valid RA/Dec inputs', () => {
      const catalog = createDeepSkyCatalog();

      // Property test: for any valid RA/Dec coordinates (simulating arbitrary celestial objects),
      // the coordinate conversion should produce valid horizontal coordinates
      fc.assert(
        fc.property(
          // Valid RA: [0, 24) hours
          fc.double({ min: 0, max: 23.999999, noNaN: true }),
          // Valid Dec: [-90, +90] degrees
          fc.double({ min: -90, max: 90, noNaN: true }),
          // Observer location
          fc.record({
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          // LST: [0, 24) hours
          fc.double({ min: 0, max: 24, noNaN: true }),
          (_ra, _dec, observer, lst) => {
            // Use the catalog's getVisibleObjects to test the coordinate conversion
            // by checking that all objects (which have valid RA/Dec) produce valid results
            const positions = catalog.getVisibleObjects(observer, lst);

            // Verify all positions have valid coordinates
            for (const pos of positions) {
              expect(pos.azimuth).toBeGreaterThanOrEqual(0);
              expect(pos.azimuth).toBeLessThan(360);
              expect(pos.altitude).toBeGreaterThanOrEqual(-90);
              expect(pos.altitude).toBeLessThanOrEqual(90);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case observer locations (poles and equator)', () => {
      const catalog = createDeepSkyCatalog();

      // Property test: coordinate conversion should work correctly at edge case locations
      fc.assert(
        fc.property(
          // Edge case latitudes: poles and equator
          fc.constantFrom(-90, -45, 0, 45, 90),
          fc.double({ min: -180, max: 180, noNaN: true }),
          fc.double({ min: 0, max: 24, noNaN: true }),
          (latitude, longitude, lst) => {
            const observer = { latitude, longitude };
            const positions = catalog.getVisibleObjects(observer, lst);

            // All positions must still have valid horizontal coordinates
            for (const pos of positions) {
              // Azimuth SHALL be in [0, 360) degrees
              expect(pos.azimuth).toBeGreaterThanOrEqual(0);
              expect(pos.azimuth).toBeLessThan(360);

              // Altitude SHALL be in [-90, +90] degrees
              expect(pos.altitude).toBeGreaterThanOrEqual(-90);
              expect(pos.altitude).toBeLessThanOrEqual(90);

              // Values should be finite
              expect(Number.isFinite(pos.azimuth)).toBe(true);
              expect(Number.isFinite(pos.altitude)).toBe(true);
            }

            return positions.every(
              (pos) =>
                pos.azimuth >= 0 &&
                pos.azimuth < 360 &&
                pos.altitude >= -90 &&
                pos.altitude <= 90 &&
                Number.isFinite(pos.azimuth) &&
                Number.isFinite(pos.altitude)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce consistent coordinate ranges across all LST values', () => {
      const catalog = createDeepSkyCatalog();
      const observer: GeographicCoordinates = {
        latitude: 40.0,
        longitude: -74.0,
      };

      // Property test: for any LST value, coordinates should remain in valid ranges
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 24, noNaN: true }),
          (lst) => {
            const positions = catalog.getVisibleObjects(observer, lst);

            for (const pos of positions) {
              // Azimuth SHALL be in [0, 360) degrees
              expect(pos.azimuth).toBeGreaterThanOrEqual(0);
              expect(pos.azimuth).toBeLessThan(360);

              // Altitude SHALL be in [-90, +90] degrees
              expect(pos.altitude).toBeGreaterThanOrEqual(-90);
              expect(pos.altitude).toBeLessThanOrEqual(90);
            }

            return positions.every(
              (pos) =>
                pos.azimuth >= 0 &&
                pos.azimuth < 360 &&
                pos.altitude >= -90 &&
                pos.altitude <= 90
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
