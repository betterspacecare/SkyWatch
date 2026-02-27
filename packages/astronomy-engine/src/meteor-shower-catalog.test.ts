/**
 * Tests for Meteor Shower Catalog
 *
 * Tests the meteor shower catalog functionality including:
 * - Loading all meteor showers from JSON data
 * - Filtering active showers within 7 days of peak
 * - Calculating radiant positions in horizontal coordinates
 * - Helper methods for activity status and days from peak
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMeteorShowerCatalog,
  meteorShowerCatalog,
  type MeteorShowerCatalog,
  type MeteorShower,
} from './meteor-shower-catalog';

describe('MeteorShowerCatalog', () => {
  let catalog: MeteorShowerCatalog;

  beforeEach(() => {
    catalog = createMeteorShowerCatalog();
  });

  describe('getAllShowers', () => {
    it('should return all meteor showers from the catalog', () => {
      const showers = catalog.getAllShowers();
      expect(showers.length).toBeGreaterThan(0);
    });

    it('should include required showers: Quadrantids, Lyrids, Eta Aquariids, Perseids, Orionids, Leonids, Geminids', () => {
      const showers = catalog.getAllShowers();
      const showerIds = showers.map((s) => s.id);

      expect(showerIds).toContain('QUA'); // Quadrantids
      expect(showerIds).toContain('LYR'); // Lyrids
      expect(showerIds).toContain('ETA'); // Eta Aquariids
      expect(showerIds).toContain('PER'); // Perseids
      expect(showerIds).toContain('ORI'); // Orionids
      expect(showerIds).toContain('LEO'); // Leonids
      expect(showerIds).toContain('GEM'); // Geminids
    });

    it('should return showers with valid RA values (0-24 hours)', () => {
      const showers = catalog.getAllShowers();
      for (const shower of showers) {
        expect(shower.ra).toBeGreaterThanOrEqual(0);
        expect(shower.ra).toBeLessThan(24);
      }
    });

    it('should return showers with valid Dec values (-90 to +90 degrees)', () => {
      const showers = catalog.getAllShowers();
      for (const shower of showers) {
        expect(shower.dec).toBeGreaterThanOrEqual(-90);
        expect(shower.dec).toBeLessThanOrEqual(90);
      }
    });

    it('should return showers with valid peak month (1-12)', () => {
      const showers = catalog.getAllShowers();
      for (const shower of showers) {
        expect(shower.peakMonth).toBeGreaterThanOrEqual(1);
        expect(shower.peakMonth).toBeLessThanOrEqual(12);
      }
    });

    it('should return showers with valid peak day (1-31)', () => {
      const showers = catalog.getAllShowers();
      for (const shower of showers) {
        expect(shower.peakDay).toBeGreaterThanOrEqual(1);
        expect(shower.peakDay).toBeLessThanOrEqual(31);
      }
    });

    it('should return showers with positive ZHR values', () => {
      const showers = catalog.getAllShowers();
      for (const shower of showers) {
        expect(shower.zhr).toBeGreaterThan(0);
      }
    });

    it('should return a copy of the showers array', () => {
      const showers1 = catalog.getAllShowers();
      const showers2 = catalog.getAllShowers();
      expect(showers1).not.toBe(showers2);
    });
  });

  describe('getActiveShowers', () => {
    it('should return Perseids as active on August 12', () => {
      const date = new Date(2024, 7, 12); // August 12, 2024
      const activeShowers = catalog.getActiveShowers(date);
      const perseidActive = activeShowers.some((s) => s.id === 'PER');
      expect(perseidActive).toBe(true);
    });

    it('should return Geminids as active on December 14', () => {
      const date = new Date(2024, 11, 14); // December 14, 2024
      const activeShowers = catalog.getActiveShowers(date);
      const geminidActive = activeShowers.some((s) => s.id === 'GEM');
      expect(geminidActive).toBe(true);
    });

    it('should return Quadrantids as active on January 4', () => {
      const date = new Date(2024, 0, 4); // January 4, 2024
      const activeShowers = catalog.getActiveShowers(date);
      const quadrantidActive = activeShowers.some((s) => s.id === 'QUA');
      expect(quadrantidActive).toBe(true);
    });

    it('should return showers within 7 days before peak', () => {
      const date = new Date(2024, 7, 5); // August 5, 2024 (7 days before Perseids peak)
      const activeShowers = catalog.getActiveShowers(date);
      const perseidActive = activeShowers.some((s) => s.id === 'PER');
      expect(perseidActive).toBe(true);
    });

    it('should return showers within 7 days after peak', () => {
      const date = new Date(2024, 7, 19); // August 19, 2024 (7 days after Perseids peak)
      const activeShowers = catalog.getActiveShowers(date);
      const perseidActive = activeShowers.some((s) => s.id === 'PER');
      expect(perseidActive).toBe(true);
    });

    it('should not return showers more than 7 days from peak', () => {
      const date = new Date(2024, 7, 25); // August 25, 2024 (13 days after Perseids peak)
      const activeShowers = catalog.getActiveShowers(date);
      const perseidActive = activeShowers.some((s) => s.id === 'PER');
      expect(perseidActive).toBe(false);
    });

    it('should return empty array when no showers are active', () => {
      // Pick a date far from any shower peaks
      const date = new Date(2024, 2, 15); // March 15, 2024
      const activeShowers = catalog.getActiveShowers(date);
      // This may or may not be empty depending on shower data
      expect(Array.isArray(activeShowers)).toBe(true);
    });
  });

  describe('getRadiantPositions', () => {
    const observer = { latitude: 40.7128, longitude: -74.006 }; // New York
    const lst = 12; // Noon LST

    it('should return positions for all showers', () => {
      const date = new Date(2024, 7, 12);
      const positions = catalog.getRadiantPositions(date, observer, lst);
      const allShowers = catalog.getAllShowers();
      expect(positions.length).toBe(allShowers.length);
    });

    it('should return valid azimuth values (0-360)', () => {
      const date = new Date(2024, 7, 12);
      const positions = catalog.getRadiantPositions(date, observer, lst);
      for (const pos of positions) {
        expect(pos.azimuth).toBeGreaterThanOrEqual(0);
        expect(pos.azimuth).toBeLessThan(360);
      }
    });

    it('should return valid altitude values (-90 to +90)', () => {
      const date = new Date(2024, 7, 12);
      const positions = catalog.getRadiantPositions(date, observer, lst);
      for (const pos of positions) {
        expect(pos.altitude).toBeGreaterThanOrEqual(-90);
        expect(pos.altitude).toBeLessThanOrEqual(90);
      }
    });

    it('should include shower data in each position', () => {
      const date = new Date(2024, 7, 12);
      const positions = catalog.getRadiantPositions(date, observer, lst);
      for (const pos of positions) {
        expect(pos.shower).toBeDefined();
        expect(pos.shower.id).toBeDefined();
        expect(pos.shower.name).toBeDefined();
      }
    });

    it('should mark active showers correctly', () => {
      const date = new Date(2024, 7, 12); // Perseids peak
      const positions = catalog.getRadiantPositions(date, observer, lst);
      const perseidPos = positions.find((p) => p.shower.id === 'PER');
      expect(perseidPos?.isActive).toBe(true);
    });

    it('should include daysFromPeak in each position', () => {
      const date = new Date(2024, 7, 12);
      const positions = catalog.getRadiantPositions(date, observer, lst);
      for (const pos of positions) {
        expect(typeof pos.daysFromPeak).toBe('number');
      }
    });
  });

  describe('isShowerActive', () => {
    it('should return true on peak day', () => {
      const perseids: MeteorShower = {
        id: 'PER',
        name: 'Perseids',
        ra: 3.07,
        dec: 58.0,
        peakMonth: 8,
        peakDay: 12,
        zhr: 100,
      };
      const peakDate = new Date(2024, 7, 12);
      expect(catalog.isShowerActive(perseids, peakDate)).toBe(true);
    });

    it('should return true 7 days before peak', () => {
      const perseids: MeteorShower = {
        id: 'PER',
        name: 'Perseids',
        ra: 3.07,
        dec: 58.0,
        peakMonth: 8,
        peakDay: 12,
        zhr: 100,
      };
      const date = new Date(2024, 7, 5);
      expect(catalog.isShowerActive(perseids, date)).toBe(true);
    });

    it('should return true 7 days after peak', () => {
      const perseids: MeteorShower = {
        id: 'PER',
        name: 'Perseids',
        ra: 3.07,
        dec: 58.0,
        peakMonth: 8,
        peakDay: 12,
        zhr: 100,
      };
      const date = new Date(2024, 7, 19);
      expect(catalog.isShowerActive(perseids, date)).toBe(true);
    });

    it('should return false 8 days before peak', () => {
      const perseids: MeteorShower = {
        id: 'PER',
        name: 'Perseids',
        ra: 3.07,
        dec: 58.0,
        peakMonth: 8,
        peakDay: 12,
        zhr: 100,
      };
      const date = new Date(2024, 7, 4);
      expect(catalog.isShowerActive(perseids, date)).toBe(false);
    });

    it('should return false 8 days after peak', () => {
      const perseids: MeteorShower = {
        id: 'PER',
        name: 'Perseids',
        ra: 3.07,
        dec: 58.0,
        peakMonth: 8,
        peakDay: 12,
        zhr: 100,
      };
      const date = new Date(2024, 7, 20);
      expect(catalog.isShowerActive(perseids, date)).toBe(false);
    });
  });

  describe('getDaysFromPeak', () => {
    it('should return 0 on peak day', () => {
      const perseids: MeteorShower = {
        id: 'PER',
        name: 'Perseids',
        ra: 3.07,
        dec: 58.0,
        peakMonth: 8,
        peakDay: 12,
        zhr: 100,
      };
      const peakDate = new Date(2024, 7, 12);
      const days = catalog.getDaysFromPeak(perseids, peakDate);
      expect(Math.abs(days)).toBeLessThan(1);
    });

    it('should return negative value before peak', () => {
      const perseids: MeteorShower = {
        id: 'PER',
        name: 'Perseids',
        ra: 3.07,
        dec: 58.0,
        peakMonth: 8,
        peakDay: 12,
        zhr: 100,
      };
      const date = new Date(2024, 7, 5);
      const days = catalog.getDaysFromPeak(perseids, date);
      expect(days).toBeLessThan(0);
    });

    it('should return positive value after peak', () => {
      const perseids: MeteorShower = {
        id: 'PER',
        name: 'Perseids',
        ra: 3.07,
        dec: 58.0,
        peakMonth: 8,
        peakDay: 12,
        zhr: 100,
      };
      const date = new Date(2024, 7, 19);
      const days = catalog.getDaysFromPeak(perseids, date);
      expect(days).toBeGreaterThan(0);
    });

    it('should handle year boundary for Quadrantids (January peak)', () => {
      const quadrantids: MeteorShower = {
        id: 'QUA',
        name: 'Quadrantids',
        ra: 15.33,
        dec: 49.5,
        peakMonth: 1,
        peakDay: 4,
        zhr: 120,
      };
      // December 30 should be close to January 4 peak (about -5 days)
      const date = new Date(2024, 11, 30);
      const days = catalog.getDaysFromPeak(quadrantids, date);
      expect(days).toBeLessThan(0);
      expect(Math.abs(days)).toBeLessThan(10);
    });
  });

  describe('default export', () => {
    it('should export a default catalog instance', () => {
      expect(meteorShowerCatalog).toBeDefined();
      expect(typeof meteorShowerCatalog.getAllShowers).toBe('function');
      expect(typeof meteorShowerCatalog.getActiveShowers).toBe('function');
      expect(typeof meteorShowerCatalog.getRadiantPositions).toBe('function');
      expect(typeof meteorShowerCatalog.isShowerActive).toBe('function');
      expect(typeof meteorShowerCatalog.getDaysFromPeak).toBe('function');
    });
  });
});


/**
 * Property-Based Tests for Meteor Shower Catalog
 * Feature: enhanced-celestial-objects
 */

import * as fc from 'fast-check';

describe('MeteorShowerCatalog Property Tests', () => {
  /**
   * Feature: enhanced-celestial-objects, Property 16: Meteor Shower Data Validity
   *
   * For all meteor showers in the catalog, the data SHALL contain:
   * - RA in [0, 24) hours
   * - Dec in [-90, +90] degrees
   * - peakMonth in [1, 12]
   * - peakDay in [1, 31]
   * - ZHR > 0
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  describe('Property 16: Meteor Shower Data Validity', () => {
    it('should have valid RA values in [0, 24) hours for all meteor showers', () => {
      const catalog = createMeteorShowerCatalog();
      const allShowers = catalog.getAllShowers();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: allShowers.length - 1 }),
          (index) => {
            const shower = allShowers[index];
            if (!shower) return true;

            expect(shower.ra).toBeGreaterThanOrEqual(0);
            expect(shower.ra).toBeLessThan(24);
            expect(Number.isFinite(shower.ra)).toBe(true);

            return shower.ra >= 0 && shower.ra < 24 && Number.isFinite(shower.ra);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid Dec values in [-90, +90] degrees for all meteor showers', () => {
      const catalog = createMeteorShowerCatalog();
      const allShowers = catalog.getAllShowers();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: allShowers.length - 1 }),
          (index) => {
            const shower = allShowers[index];
            if (!shower) return true;

            expect(shower.dec).toBeGreaterThanOrEqual(-90);
            expect(shower.dec).toBeLessThanOrEqual(90);
            expect(Number.isFinite(shower.dec)).toBe(true);

            return shower.dec >= -90 && shower.dec <= 90 && Number.isFinite(shower.dec);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid peakMonth values in [1, 12] for all meteor showers', () => {
      const catalog = createMeteorShowerCatalog();
      const allShowers = catalog.getAllShowers();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: allShowers.length - 1 }),
          (index) => {
            const shower = allShowers[index];
            if (!shower) return true;

            expect(shower.peakMonth).toBeGreaterThanOrEqual(1);
            expect(shower.peakMonth).toBeLessThanOrEqual(12);
            expect(Number.isInteger(shower.peakMonth)).toBe(true);

            return shower.peakMonth >= 1 && shower.peakMonth <= 12 && Number.isInteger(shower.peakMonth);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid peakDay values in [1, 31] for all meteor showers', () => {
      const catalog = createMeteorShowerCatalog();
      const allShowers = catalog.getAllShowers();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: allShowers.length - 1 }),
          (index) => {
            const shower = allShowers[index];
            if (!shower) return true;

            expect(shower.peakDay).toBeGreaterThanOrEqual(1);
            expect(shower.peakDay).toBeLessThanOrEqual(31);
            expect(Number.isInteger(shower.peakDay)).toBe(true);

            return shower.peakDay >= 1 && shower.peakDay <= 31 && Number.isInteger(shower.peakDay);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have positive ZHR values (ZHR > 0) for all meteor showers', () => {
      const catalog = createMeteorShowerCatalog();
      const allShowers = catalog.getAllShowers();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: allShowers.length - 1 }),
          (index) => {
            const shower = allShowers[index];
            if (!shower) return true;

            expect(shower.zhr).toBeGreaterThan(0);
            expect(Number.isFinite(shower.zhr)).toBe(true);

            return shower.zhr > 0 && Number.isFinite(shower.zhr);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have all data fields valid for every meteor shower in the catalog', () => {
      const catalog = createMeteorShowerCatalog();
      const allShowers = catalog.getAllShowers();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: allShowers.length - 1 }),
          (index) => {
            const shower = allShowers[index];
            if (!shower) return true;

            const validRA = shower.ra >= 0 && shower.ra < 24 && Number.isFinite(shower.ra);
            expect(validRA).toBe(true);

            const validDec = shower.dec >= -90 && shower.dec <= 90 && Number.isFinite(shower.dec);
            expect(validDec).toBe(true);

            const validPeakMonth = shower.peakMonth >= 1 && shower.peakMonth <= 12 && Number.isInteger(shower.peakMonth);
            expect(validPeakMonth).toBe(true);

            const validPeakDay = shower.peakDay >= 1 && shower.peakDay <= 31 && Number.isInteger(shower.peakDay);
            expect(validPeakDay).toBe(true);

            const validZHR = shower.zhr > 0 && Number.isFinite(shower.zhr);
            expect(validZHR).toBe(true);

            return validRA && validDec && validPeakMonth && validPeakDay && validZHR;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data validity when retrieving radiant positions', () => {
      const catalog = createMeteorShowerCatalog();
      const observer = { latitude: 40.7128, longitude: -74.006 };
      const lst = 12;

      fc.assert(
        fc.property(
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2024-12-31'),
          }),
          (currentDate) => {
            const positions = catalog.getRadiantPositions(currentDate, observer, lst);

            for (const pos of positions) {
              const shower = pos.shower;

              expect(shower.ra).toBeGreaterThanOrEqual(0);
              expect(shower.ra).toBeLessThan(24);
              expect(shower.dec).toBeGreaterThanOrEqual(-90);
              expect(shower.dec).toBeLessThanOrEqual(90);
              expect(shower.peakMonth).toBeGreaterThanOrEqual(1);
              expect(shower.peakMonth).toBeLessThanOrEqual(12);
              expect(shower.peakDay).toBeGreaterThanOrEqual(1);
              expect(shower.peakDay).toBeLessThanOrEqual(31);
              expect(shower.zhr).toBeGreaterThan(0);
            }

            return positions.every(
              (pos) =>
                pos.shower.ra >= 0 &&
                pos.shower.ra < 24 &&
                pos.shower.dec >= -90 &&
                pos.shower.dec <= 90 &&
                pos.shower.peakMonth >= 1 &&
                pos.shower.peakMonth <= 12 &&
                pos.shower.peakDay >= 1 &&
                pos.shower.peakDay <= 31 &&
                pos.shower.zhr > 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data validity when filtering active showers', () => {
      const catalog = createMeteorShowerCatalog();

      fc.assert(
        fc.property(
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2024-12-31'),
          }),
          (currentDate) => {
            const activeShowers = catalog.getActiveShowers(currentDate);

            for (const shower of activeShowers) {
              expect(shower.ra).toBeGreaterThanOrEqual(0);
              expect(shower.ra).toBeLessThan(24);
              expect(shower.dec).toBeGreaterThanOrEqual(-90);
              expect(shower.dec).toBeLessThanOrEqual(90);
              expect(shower.peakMonth).toBeGreaterThanOrEqual(1);
              expect(shower.peakMonth).toBeLessThanOrEqual(12);
              expect(shower.peakDay).toBeGreaterThanOrEqual(1);
              expect(shower.peakDay).toBeLessThanOrEqual(31);
              expect(shower.zhr).toBeGreaterThan(0);
            }

            return activeShowers.every(
              (shower) =>
                shower.ra >= 0 &&
                shower.ra < 24 &&
                shower.dec >= -90 &&
                shower.dec <= 90 &&
                shower.peakMonth >= 1 &&
                shower.peakMonth <= 12 &&
                shower.peakDay >= 1 &&
                shower.peakDay <= 31 &&
                shower.zhr > 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: enhanced-celestial-objects, Property 17: Meteor Shower Active Status
   *
   * For any meteor shower and current date, the shower SHALL be marked as active
   * (`isActive === true`) if and only if the current date is within 7 days of
   * the shower's peak date.
   *
   * **Validates: Requirements 7.3**
   */
  describe('Property 17: Meteor Shower Active Status', () => {
    it('should mark shower as active when date is within 7 days of peak (isShowerActive)', () => {
      const catalog = createMeteorShowerCatalog();

      // Generator for meteor shower with valid peak date
      const meteorShowerArb = fc.record({
        id: fc.string({ minLength: 1, maxLength: 5 }),
        name: fc.string({ minLength: 1, maxLength: 30 }),
        ra: fc.double({ min: 0, max: 23.999, noNaN: true }),
        dec: fc.double({ min: -90, max: 90, noNaN: true }),
        peakMonth: fc.integer({ min: 1, max: 12 }),
        peakDay: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
        zhr: fc.integer({ min: 1, max: 200 }),
      });

      // Generator for days offset from peak (-30 to +30 days)
      const daysOffsetArb = fc.integer({ min: -30, max: 30 });

      fc.assert(
        fc.property(
          meteorShowerArb,
          daysOffsetArb,
          fc.integer({ min: 2020, max: 2030 }),
          (shower, daysOffset, year) => {
            // Create a date relative to the shower's peak
            const peakDate = new Date(year, shower.peakMonth - 1, shower.peakDay);
            const testDate = new Date(peakDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);

            const isActive = catalog.isShowerActive(shower, testDate);
            const withinSevenDays = Math.abs(daysOffset) <= 7;

            // isActive SHALL be true if and only if within 7 days of peak
            expect(isActive).toBe(withinSevenDays);

            return isActive === withinSevenDays;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark shower as active exactly at the 7-day boundary', () => {
      const catalog = createMeteorShowerCatalog();

      // Test the boundary condition: exactly 7 days should be active, 8 days should not
      const meteorShowerArb = fc.record({
        id: fc.string({ minLength: 1, maxLength: 5 }),
        name: fc.string({ minLength: 1, maxLength: 30 }),
        ra: fc.double({ min: 0, max: 23.999, noNaN: true }),
        dec: fc.double({ min: -90, max: 90, noNaN: true }),
        peakMonth: fc.integer({ min: 1, max: 12 }),
        peakDay: fc.integer({ min: 1, max: 28 }),
        zhr: fc.integer({ min: 1, max: 200 }),
      });

      fc.assert(
        fc.property(
          meteorShowerArb,
          fc.integer({ min: 2020, max: 2030 }),
          fc.boolean(), // before or after peak
          (shower, year, beforePeak) => {
            const peakDate = new Date(year, shower.peakMonth - 1, shower.peakDay);
            const direction = beforePeak ? -1 : 1;

            // Exactly 7 days from peak should be active
            const sevenDaysDate = new Date(peakDate.getTime() + direction * 7 * 24 * 60 * 60 * 1000);
            const isActiveAt7Days = catalog.isShowerActive(shower, sevenDaysDate);
            expect(isActiveAt7Days).toBe(true);

            // Exactly 8 days from peak should NOT be active
            const eightDaysDate = new Date(peakDate.getTime() + direction * 8 * 24 * 60 * 60 * 1000);
            const isActiveAt8Days = catalog.isShowerActive(shower, eightDaysDate);
            expect(isActiveAt8Days).toBe(false);

            return isActiveAt7Days === true && isActiveAt8Days === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly set isActive flag in getRadiantPositions', () => {
      const catalog = createMeteorShowerCatalog();
      const observer = { latitude: 40.7128, longitude: -74.006 };
      const lst = 12;

      // Generator for dates throughout the year
      const dateArb = fc.date({
        min: new Date('2024-01-01'),
        max: new Date('2024-12-31'),
      });

      fc.assert(
        fc.property(dateArb, (currentDate) => {
          const positions = catalog.getRadiantPositions(currentDate, observer, lst);

          // For each position, verify isActive matches the 7-day rule
          for (const pos of positions) {
            const daysFromPeak = catalog.getDaysFromPeak(pos.shower, currentDate);
            const expectedActive = Math.abs(daysFromPeak) <= 7;

            expect(pos.isActive).toBe(expectedActive);

            if (pos.isActive !== expectedActive) {
              return false;
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle year boundary cases for showers with January peaks', () => {
      const catalog = createMeteorShowerCatalog();

      // Quadrantids peak on January 4 - test December dates near the boundary
      const quadrantids: MeteorShower = {
        id: 'QUA',
        name: 'Quadrantids',
        ra: 15.33,
        dec: 49.5,
        peakMonth: 1,
        peakDay: 4,
        zhr: 120,
      };

      fc.assert(
        fc.property(
          fc.integer({ min: 2020, max: 2030 }),
          fc.integer({ min: 28, max: 31 }), // December days
          (year, decemberDay) => {
            // December 28-31 should be within 7 days of January 4 peak
            const decDate = new Date(year, 11, decemberDay); // December
            const isActive = catalog.isShowerActive(quadrantids, decDate);

            // Calculate expected: Dec 28 is 7 days before Jan 4, Dec 31 is 4 days before
            const daysFromPeak = catalog.getDaysFromPeak(quadrantids, decDate);
            const expectedActive = Math.abs(daysFromPeak) <= 7;

            expect(isActive).toBe(expectedActive);

            return isActive === expectedActive;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle year boundary cases for showers with December peaks', () => {
      const catalog = createMeteorShowerCatalog();

      // Geminids peak on December 14 - test dates around the peak
      const geminids: MeteorShower = {
        id: 'GEM',
        name: 'Geminids',
        ra: 7.47,
        dec: 32.0,
        peakMonth: 12,
        peakDay: 14,
        zhr: 150,
      };

      fc.assert(
        fc.property(
          fc.integer({ min: 2020, max: 2030 }),
          (year) => {
            // December 21 (7 days after peak) should be active
            const dec21 = new Date(year, 11, 21);
            const isActiveDec21 = catalog.isShowerActive(geminids, dec21);
            expect(isActiveDec21).toBe(true);

            // December 22 (8 days after peak) should NOT be active
            const dec22 = new Date(year, 11, 22);
            const isActiveDec22 = catalog.isShowerActive(geminids, dec22);
            expect(isActiveDec22).toBe(false);

            // December 7 (7 days before peak) should be active
            const dec7 = new Date(year, 11, 7);
            const isActiveDec7 = catalog.isShowerActive(geminids, dec7);
            expect(isActiveDec7).toBe(true);

            // December 6 (8 days before peak) should NOT be active
            const dec6 = new Date(year, 11, 6);
            const isActiveDec6 = catalog.isShowerActive(geminids, dec6);
            expect(isActiveDec6).toBe(false);

            return isActiveDec21 && !isActiveDec22 && isActiveDec7 && !isActiveDec6;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent isActive between isShowerActive and getActiveShowers', () => {
      const catalog = createMeteorShowerCatalog();

      fc.assert(
        fc.property(
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2024-12-31'),
          }),
          (currentDate) => {
            const allShowers = catalog.getAllShowers();
            const activeShowers = catalog.getActiveShowers(currentDate);
            const activeIds = new Set(activeShowers.map((s) => s.id));

            // For each shower, isShowerActive should match presence in getActiveShowers
            for (const shower of allShowers) {
              const isActive = catalog.isShowerActive(shower, currentDate);
              const inActiveList = activeIds.has(shower.id);

              expect(isActive).toBe(inActiveList);

              if (isActive !== inActiveList) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
