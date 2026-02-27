/**
 * Unit tests for Star_Catalog module
 *
 * Tests the star catalog initialization, data retrieval, and offline fallback behavior.
 * Validates: Requirements 5.2, 5.3, 5.5, 5.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  createStarCatalog,
  createDefaultStarCatalog,
  defaultStarCatalogConfig,
  type StarCatalogConfig,
} from './star-catalog';
import type { Star, SpectralType } from './index';
import { PROPERTY_TEST_CONFIG, validSpectralType } from './test-generators';

// Mock localStorage for caching tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock fetch for API tests
const mockFetch = vi.fn();

describe('Star_Catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Setup global mocks
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('createStarCatalog', () => {
    it('should create a star catalog with the provided config', () => {
      const config: StarCatalogConfig = {
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);

      expect(catalog).toBeDefined();
      expect(catalog.initialize).toBeDefined();
      expect(catalog.getStars).toBeDefined();
      expect(catalog.getPlanets).toBeDefined();
      expect(catalog.getVisibleStars).toBeDefined();
      expect(catalog.updatePlanetPositions).toBeDefined();
      expect(catalog.isOfflineMode).toBeDefined();
    });
  });

  describe('createDefaultStarCatalog', () => {
    it('should create a star catalog with default configuration', () => {
      const catalog = createDefaultStarCatalog();

      expect(catalog).toBeDefined();
      expect(catalog.initialize).toBeDefined();
    });
  });

  describe('defaultStarCatalogConfig', () => {
    it('should have correct default values', () => {
      expect(defaultStarCatalogConfig.maxMagnitude).toBe(5.0);
      expect(defaultStarCatalogConfig.localCatalogPath).toBe('../data/stars.json');
    });
  });

  describe('initialize', () => {
    it('should load stars from local JSON when API is not configured', async () => {
      const config: StarCatalogConfig = {
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      const stars = catalog.getStars();
      expect(stars.length).toBeGreaterThan(0);
      expect(catalog.isOfflineMode()).toBe(true);
    });

    it('should load planets from local JSON', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();

      const planets = catalog.getPlanets();
      expect(planets.length).toBe(8); // 8 major planets
      expect(planets.map((p) => p.name)).toContain('Mercury');
      expect(planets.map((p) => p.name)).toContain('Venus');
      expect(planets.map((p) => p.name)).toContain('Mars');
      expect(planets.map((p) => p.name)).toContain('Jupiter');
      expect(planets.map((p) => p.name)).toContain('Saturn');
      expect(planets.map((p) => p.name)).toContain('Uranus');
      expect(planets.map((p) => p.name)).toContain('Neptune');
    });

    it('should only initialize once', async () => {
      const catalog = createDefaultStarCatalog();

      await catalog.initialize();
      const starsFirstCall = catalog.getStars();

      await catalog.initialize();
      const starsSecondCall = catalog.getStars();

      expect(starsFirstCall).toEqual(starsSecondCall);
    });
  });

  describe('getStars', () => {
    it('should return stars filtered by default maxMagnitude', async () => {
      const config: StarCatalogConfig = {
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 2.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      const stars = catalog.getStars();
      expect(stars.every((star) => star.magnitude <= 2.0)).toBe(true);
    });

    it('should return stars filtered by provided maxMagnitude', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();

      const brightStars = catalog.getStars(1.0);
      expect(brightStars.every((star) => star.magnitude <= 1.0)).toBe(true);
      expect(brightStars.length).toBeGreaterThan(0);
    });

    it('should return empty array before initialization', () => {
      const catalog = createDefaultStarCatalog();
      const stars = catalog.getStars();
      expect(stars).toEqual([]);
    });
  });

  describe('getPlanets', () => {
    it('should return a copy of planets array', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();

      const planets1 = catalog.getPlanets();
      const planets2 = catalog.getPlanets();

      expect(planets1).not.toBe(planets2); // Different array instances
      expect(planets1).toEqual(planets2); // Same content
    });

    it('should return empty array before initialization', () => {
      const catalog = createDefaultStarCatalog();
      const planets = catalog.getPlanets();
      expect(planets).toEqual([]);
    });
  });

  describe('getVisibleStars', () => {
    it('should return stars within magnitude limit', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();

      const center = { azimuth: 180, altitude: 45 };
      const fov = 60;
      const maxMagnitude = 2.0;

      const visibleStars = catalog.getVisibleStars(center, fov, maxMagnitude);
      expect(visibleStars.every((star) => star.magnitude <= maxMagnitude)).toBe(true);
    });

    it('should use default maxMagnitude when not provided', async () => {
      const config: StarCatalogConfig = {
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 3.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      const center = { azimuth: 180, altitude: 45 };
      const fov = 60;

      const visibleStars = catalog.getVisibleStars(center, fov);
      expect(visibleStars.every((star) => star.magnitude <= 3.0)).toBe(true);
    });
  });

  describe('updatePlanetPositions', () => {
    it('should accept timestamp and observer parameters', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();

      const timestamp = new Date();
      const observer = { latitude: 40.7128, longitude: -74.006 };

      // Should not throw
      expect(() => {
        catalog.updatePlanetPositions(timestamp, observer);
      }).not.toThrow();
    });
  });

  describe('isOfflineMode', () => {
    it('should return true when using local catalog', async () => {
      const config: StarCatalogConfig = {
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      expect(catalog.isOfflineMode()).toBe(true);
    });

    it('should return false before initialization', () => {
      const catalog = createDefaultStarCatalog();
      expect(catalog.isOfflineMode()).toBe(false);
    });
  });

  describe('API fetch with fallback (Requirements 5.3, 5.5, 5.6)', () => {
    it('should fall back to local catalog when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const config: StarCatalogConfig = {
        apiEndpoint: 'https://api.example.com/stars',
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      const stars = catalog.getStars();
      expect(stars.length).toBeGreaterThan(0);
      expect(catalog.isOfflineMode()).toBe(true);
    });

    it('should fall back to local catalog when API returns non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const config: StarCatalogConfig = {
        apiEndpoint: 'https://api.example.com/stars',
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      const stars = catalog.getStars();
      expect(stars.length).toBeGreaterThan(0);
      expect(catalog.isOfflineMode()).toBe(true);
    });

    it('should use API data when fetch succeeds', async () => {
      const apiStars = [
        { id: 'API1', name: 'API Star 1', ra: 10, dec: 20, magnitude: 1.0, spectralType: 'A' },
        { id: 'API2', name: 'API Star 2', ra: 15, dec: 25, magnitude: 2.0, spectralType: 'G' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stars: apiStars }),
      });

      const config: StarCatalogConfig = {
        apiEndpoint: 'https://api.example.com/stars',
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      const stars = catalog.getStars();
      expect(stars.length).toBe(2);
      expect(stars[0]?.id).toBe('API1');
      expect(catalog.isOfflineMode()).toBe(false);
    });

    it('should include API key in request headers when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stars: [] }),
      });

      const config: StarCatalogConfig = {
        apiEndpoint: 'https://api.example.com/stars',
        apiKey: 'test-api-key',
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/stars',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });
  });

  describe('Caching logic (Requirement 5.5)', () => {
    it('should cache API results to localStorage', async () => {
      const apiStars = [
        { id: 'API1', name: 'Cached Star', ra: 10, dec: 20, magnitude: 1.0, spectralType: 'A' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stars: apiStars }),
      });

      const config: StarCatalogConfig = {
        apiEndpoint: 'https://api.example.com/stars',
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should use cached data when available and not expired', async () => {
      const cachedData = {
        version: '1.0.0',
        fetchedAt: new Date().toISOString(),
        stars: [
          { id: 'CACHED1', name: 'Cached Star', ra: 10, dec: 20, magnitude: 1.0, spectralType: 'A' },
        ],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      };

      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData));

      const config: StarCatalogConfig = {
        apiEndpoint: 'https://api.example.com/stars',
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      // Should not call fetch when cache is valid
      expect(mockFetch).not.toHaveBeenCalled();

      const stars = catalog.getStars();
      expect(stars[0]?.id).toBe('CACHED1');
    });

    it('should ignore expired cache and fetch from API', async () => {
      const expiredCache = {
        version: '1.0.0',
        fetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
        stars: [
          { id: 'EXPIRED1', name: 'Expired Star', ra: 10, dec: 20, magnitude: 1.0, spectralType: 'A' },
        ],
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Expired 24 hours ago
      };

      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(expiredCache));

      const apiStars = [
        { id: 'FRESH1', name: 'Fresh Star', ra: 10, dec: 20, magnitude: 1.0, spectralType: 'A' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stars: apiStars }),
      });

      const config: StarCatalogConfig = {
        apiEndpoint: 'https://api.example.com/stars',
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      // Should call fetch when cache is expired
      expect(mockFetch).toHaveBeenCalled();

      const stars = catalog.getStars();
      expect(stars[0]?.id).toBe('FRESH1');
    });

    it('should ignore cache with incompatible version', async () => {
      const oldVersionCache = {
        version: '0.9.0', // Old version
        fetchedAt: new Date().toISOString(),
        stars: [
          { id: 'OLD1', name: 'Old Version Star', ra: 10, dec: 20, magnitude: 1.0, spectralType: 'A' },
        ],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(oldVersionCache));

      const config: StarCatalogConfig = {
        localCatalogPath: '../data/stars.json',
        maxMagnitude: 5.0,
      };

      const catalog = createStarCatalog(config);
      await catalog.initialize();

      // Should fall back to local file when cache version is incompatible
      const stars = catalog.getStars();
      expect(stars.some((s) => s.id === 'OLD1')).toBe(false);
    });
  });

  describe('Property 10: Star Data Completeness', () => {
    it('should ensure all stars have required fields', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();

      const stars = catalog.getStars();

      for (const star of stars) {
        // Check id is present and non-empty
        expect(star.id).toBeDefined();
        expect(typeof star.id).toBe('string');
        expect(star.id.length).toBeGreaterThan(0);

        // Check name is present (can be null)
        expect('name' in star).toBe(true);
        expect(star.name === null || typeof star.name === 'string').toBe(true);

        // Check ra is a valid number
        expect(star.ra).toBeDefined();
        expect(typeof star.ra).toBe('number');
        expect(star.ra).toBeGreaterThanOrEqual(0);
        expect(star.ra).toBeLessThan(24);

        // Check dec is a valid number
        expect(star.dec).toBeDefined();
        expect(typeof star.dec).toBe('number');
        expect(star.dec).toBeGreaterThanOrEqual(-90);
        expect(star.dec).toBeLessThanOrEqual(90);

        // Check magnitude is a valid number
        expect(star.magnitude).toBeDefined();
        expect(typeof star.magnitude).toBe('number');

        // Check spectralType is valid
        expect(star.spectralType).toBeDefined();
        expect(['O', 'B', 'A', 'F', 'G', 'K', 'M']).toContain(star.spectralType);
      }
    });

    it('should include well-known stars with correct data', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();

      const stars = catalog.getStars();

      // Check for Sirius - brightest star
      const sirius = stars.find((s) => s.name === 'Sirius');
      expect(sirius).toBeDefined();
      expect(sirius!.magnitude).toBeLessThan(0); // Sirius is very bright

      // Check for Polaris - North Star
      const polaris = stars.find((s) => s.name === 'Polaris');
      expect(polaris).toBeDefined();
      expect(polaris!.dec).toBeGreaterThan(85); // Near celestial north pole

      // Check for Vega
      const vega = stars.find((s) => s.name === 'Vega');
      expect(vega).toBeDefined();
      expect(vega!.spectralType).toBe('A');
    });
  });
});

/**
 * Property-Based Tests for Star_Catalog
 *
 * Feature: stargazing-app, Property 10: Star Data Completeness
 * Validates: Requirements 5.2
 */
describe('Star_Catalog Property-Based Tests', () => {
  /**
   * Generator for valid star data with all required fields
   */
  const validStarGenerator: fc.Arbitrary<Star> = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    ra: fc.double({ min: 0, max: 24, noNaN: true }).filter(ra => ra < 24),
    dec: fc.double({ min: -90, max: 90, noNaN: true }),
    magnitude: fc.double({ min: -2, max: 6, noNaN: true }),
    spectralType: validSpectralType as fc.Arbitrary<SpectralType>,
  });

  /**
   * Helper function to validate star data completeness
   */
  function isValidStar(star: Star): boolean {
    // Check id is present and non-empty string
    if (typeof star.id !== 'string' || star.id.length === 0) {
      return false;
    }

    // Check name is null or non-empty string
    if (star.name !== null && (typeof star.name !== 'string')) {
      return false;
    }

    // Check ra is a valid number in range [0, 24)
    if (typeof star.ra !== 'number' || isNaN(star.ra) || star.ra < 0 || star.ra >= 24) {
      return false;
    }

    // Check dec is a valid number in range [-90, 90]
    if (typeof star.dec !== 'number' || isNaN(star.dec) || star.dec < -90 || star.dec > 90) {
      return false;
    }

    // Check magnitude is a valid number
    if (typeof star.magnitude !== 'number' || isNaN(star.magnitude)) {
      return false;
    }

    // Check spectralType is one of the valid types
    const validTypes: SpectralType[] = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
    if (!validTypes.includes(star.spectralType)) {
      return false;
    }

    return true;
  }

  describe('Property 10: Star Data Completeness', () => {
    /**
     * Property 10: Star Data Completeness
     * For any star in the Star_Catalog, it shall contain all required fields:
     * id, name (or null), RA, Dec, apparent magnitude, and spectral type.
     *
     * **Validates: Requirements 5.2**
     */
    it('should validate that all generated stars have complete required fields', () => {
      fc.assert(
        fc.property(validStarGenerator, (star) => {
          // Every generated star should pass the completeness validation
          return isValidStar(star);
        }),
        { ...PROPERTY_TEST_CONFIG, numRuns: 100 }
      );
    });

    it('should verify star data completeness validation function correctly identifies valid stars', () => {
      fc.assert(
        fc.property(validStarGenerator, (star) => {
          // The validation function should return true for all valid stars
          const result = isValidStar(star);
          
          // Additional assertions to ensure the star has all required fields
          expect(star.id).toBeDefined();
          expect('name' in star).toBe(true);
          expect(star.ra).toBeDefined();
          expect(star.dec).toBeDefined();
          expect(star.magnitude).toBeDefined();
          expect(star.spectralType).toBeDefined();
          
          return result === true;
        }),
        { ...PROPERTY_TEST_CONFIG, numRuns: 100 }
      );
    });

    it('should verify star data completeness validation function correctly rejects invalid stars', () => {
      // Generator for invalid stars (missing or invalid fields)
      const invalidStarGenerator = fc.oneof(
        // Missing id (empty string)
        fc.record({
          id: fc.constant(''),
          name: fc.option(fc.string({ minLength: 1 }), { nil: null }),
          ra: fc.double({ min: 0, max: 24, noNaN: true }),
          dec: fc.double({ min: -90, max: 90, noNaN: true }),
          magnitude: fc.double({ min: -2, max: 6, noNaN: true }),
          spectralType: validSpectralType as fc.Arbitrary<SpectralType>,
        }),
        // Invalid RA (out of range)
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.option(fc.string({ minLength: 1 }), { nil: null }),
          ra: fc.oneof(
            fc.double({ min: -100, max: -0.01, noNaN: true }),
            fc.double({ min: 24, max: 100, noNaN: true })
          ),
          dec: fc.double({ min: -90, max: 90, noNaN: true }),
          magnitude: fc.double({ min: -2, max: 6, noNaN: true }),
          spectralType: validSpectralType as fc.Arbitrary<SpectralType>,
        }),
        // Invalid Dec (out of range)
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.option(fc.string({ minLength: 1 }), { nil: null }),
          ra: fc.double({ min: 0, max: 24, noNaN: true }),
          dec: fc.oneof(
            fc.double({ min: -180, max: -90.01, noNaN: true }),
            fc.double({ min: 90.01, max: 180, noNaN: true })
          ),
          magnitude: fc.double({ min: -2, max: 6, noNaN: true }),
          spectralType: validSpectralType as fc.Arbitrary<SpectralType>,
        }),
        // Invalid spectral type
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.option(fc.string({ minLength: 1 }), { nil: null }),
          ra: fc.double({ min: 0, max: 24, noNaN: true }),
          dec: fc.double({ min: -90, max: 90, noNaN: true }),
          magnitude: fc.double({ min: -2, max: 6, noNaN: true }),
          spectralType: fc.constantFrom('X', 'Y', 'Z') as unknown as fc.Arbitrary<SpectralType>,
        })
      );

      fc.assert(
        fc.property(invalidStarGenerator, (star) => {
          // The validation function should return false for all invalid stars
          return isValidStar(star) === false;
        }),
        { ...PROPERTY_TEST_CONFIG, numRuns: 100 }
      );
    });

    it('should verify all stars from local catalog have complete data', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();
      const stars = catalog.getStars();

      // Use property-based testing to verify each star from the catalog
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, stars.length - 1) }),
          (index) => {
            if (stars.length === 0) return true;
            const star = stars[index];
            if (!star) return true; // Handle undefined case
            return isValidStar(star);
          }
        ),
        { ...PROPERTY_TEST_CONFIG, numRuns: Math.min(100, stars.length) }
      );
    });

    it('should verify RA values are always in valid range [0, 24) for all catalog stars', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();
      const stars = catalog.getStars();

      // Property: For all stars, RA must be in [0, 24)
      for (const star of stars) {
        expect(star.ra).toBeGreaterThanOrEqual(0);
        expect(star.ra).toBeLessThan(24);
      }
    });

    it('should verify Dec values are always in valid range [-90, 90] for all catalog stars', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();
      const stars = catalog.getStars();

      // Property: For all stars, Dec must be in [-90, 90]
      for (const star of stars) {
        expect(star.dec).toBeGreaterThanOrEqual(-90);
        expect(star.dec).toBeLessThanOrEqual(90);
      }
    });

    it('should verify spectral types are always valid for all catalog stars', async () => {
      const catalog = createDefaultStarCatalog();
      await catalog.initialize();
      const stars = catalog.getStars();

      const validTypes: SpectralType[] = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

      // Property: For all stars, spectral type must be one of the valid types
      for (const star of stars) {
        expect(validTypes).toContain(star.spectralType);
      }
    });
  });
});
