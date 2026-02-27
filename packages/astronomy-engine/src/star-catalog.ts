/**
 * Star_Catalog - Star and Planet Data Management
 *
 * Provides access to star and planet data with API fetch capability
 * and local JSON fallback for offline use.
 *
 * @module star-catalog
 */

import type { Star, Planet, HorizontalCoordinates, GeographicCoordinates, SpectralType } from './index';

// Type for localStorage interface
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Declare localStorage for environments where it may not be globally available
declare const localStorage: StorageLike | undefined;

/**
 * Configuration for the Star Catalog
 */
export interface StarCatalogConfig {
  /** Optional API endpoint for fetching star data */
  apiEndpoint?: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Path to local catalog JSON file */
  localCatalogPath: string;
  /** Maximum magnitude of stars to include (default: 5.0) */
  maxMagnitude: number;
}

/**
 * Raw star data from JSON catalog
 */
interface RawStarData {
  id: string;
  name: string | null;
  ra: number;
  dec: number;
  magnitude: number;
  spectralType: string;
}

/**
 * Raw planet data from JSON catalog
 */
interface RawPlanetData {
  id: string;
  name: string;
  symbol: string;
}

/**
 * Cached catalog data structure
 */
interface CachedCatalog {
  version: string;
  fetchedAt: string;
  stars: Star[];
  expiresAt: string;
}

/**
 * Interface for the Star Catalog
 */
export interface StarCatalog {
  /**
   * Initializes the catalog, attempting API fetch with local fallback
   */
  initialize(): Promise<void>;

  /**
   * Returns all stars up to specified magnitude
   * @param maxMagnitude - Maximum magnitude to include (default: config maxMagnitude)
   */
  getStars(maxMagnitude?: number): Star[];

  /**
   * Returns all planets with current positions
   */
  getPlanets(): Planet[];

  /**
   * Returns stars within the specified field of view
   * @param center - Center of the field of view in horizontal coordinates
   * @param fov - Field of view in degrees
   * @param maxMagnitude - Maximum magnitude to include
   */
  getVisibleStars(
    center: HorizontalCoordinates,
    fov: number,
    maxMagnitude?: number
  ): Star[];

  /**
   * Updates planet positions for given timestamp and observer location
   * @param timestamp - Date for position calculation
   * @param observer - Observer's geographic coordinates
   */
  updatePlanetPositions(timestamp: Date, observer: GeographicCoordinates): void;

  /**
   * Returns true if using cached/local data (offline mode)
   */
  isOfflineMode(): boolean;
}

// Cache key for localStorage
const CACHE_KEY = 'star_catalog_cache';
const CACHE_VERSION = '1.0.0';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Validates that a spectral type string is a valid SpectralType
 */
function isValidSpectralType(type: string): type is SpectralType {
  return ['O', 'B', 'A', 'F', 'G', 'K', 'M'].includes(type);
}

/**
 * Converts raw star data to Star interface
 */
function parseRawStar(raw: RawStarData): Star {
  const spectralType: SpectralType = isValidSpectralType(raw.spectralType)
    ? raw.spectralType
    : 'G'; // Default to G if invalid

  return {
    id: raw.id,
    name: raw.name,
    ra: raw.ra,
    dec: raw.dec,
    magnitude: raw.magnitude,
    spectralType,
  };
}

/**
 * Calculates angular distance between two points in horizontal coordinates
 * Uses the spherical law of cosines
 * @internal Used for FOV filtering when observer context is available
 */
export function angularDistance(
  point1: HorizontalCoordinates,
  point2: { azimuth: number; altitude: number }
): number {
  const az1 = (point1.azimuth * Math.PI) / 180;
  const alt1 = (point1.altitude * Math.PI) / 180;
  const az2 = (point2.azimuth * Math.PI) / 180;
  const alt2 = (point2.altitude * Math.PI) / 180;

  const cosDistance =
    Math.sin(alt1) * Math.sin(alt2) +
    Math.cos(alt1) * Math.cos(alt2) * Math.cos(az1 - az2);

  // Clamp to [-1, 1] to handle floating point errors
  const clampedCos = Math.max(-1, Math.min(1, cosDistance));
  return (Math.acos(clampedCos) * 180) / Math.PI;
}

/**
 * Creates a new Star Catalog instance
 */
export function createStarCatalog(config: StarCatalogConfig): StarCatalog {
  let stars: Star[] = [];
  let planets: Planet[] = [];
  let offlineMode = false;
  let initialized = false;

  /**
   * Attempts to load cached data from localStorage
   */
  function loadFromCache(): Star[] | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) {
        return null;
      }

      const data: CachedCatalog = JSON.parse(cached);

      // Check version compatibility
      if (data.version !== CACHE_VERSION) {
        return null;
      }

      // Check if cache has expired
      const expiresAt = new Date(data.expiresAt);
      if (new Date() > expiresAt) {
        return null;
      }

      return data.stars;
    } catch {
      return null;
    }
  }

  /**
   * Saves star data to localStorage cache
   */
  function saveToCache(starData: Star[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CACHE_DURATION_MS);

      const cacheData: CachedCatalog = {
        version: CACHE_VERSION,
        fetchedAt: now.toISOString(),
        stars: starData,
        expiresAt: expiresAt.toISOString(),
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch {
      // Silently fail if localStorage is full or unavailable
    }
  }

  /**
   * Fetches star data from API
   */
  async function fetchFromAPI(): Promise<Star[] | null> {
    if (!config.apiEndpoint) {
      return null;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(config.apiEndpoint, { headers });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { stars?: RawStarData[] };

      // Parse API response - adapt based on actual API format
      if (data.stars && Array.isArray(data.stars)) {
        return data.stars.map(parseRawStar);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Loads star data from local JSON file
   */
  async function loadFromLocalFile(): Promise<{ stars: Star[]; planets: Planet[] }> {
    try {
      // In a browser/bundler environment, we import the JSON directly
      // The localCatalogPath is used as a reference but actual loading
      // depends on the bundler configuration
      const catalogData = await import('../data/stars.json');

      const loadedStars: Star[] = (catalogData.stars || [])
        .map(parseRawStar)
        .filter((star: Star) => star.magnitude <= config.maxMagnitude);

      const loadedPlanets: Planet[] = (catalogData.planets || []).map(
        (p: RawPlanetData) => ({
          id: p.id,
          name: p.name,
          ra: 0, // Will be updated by updatePlanetPositions
          dec: 0,
          magnitude: 0,
        })
      );

      return { stars: loadedStars, planets: loadedPlanets };
    } catch {
      // Return empty arrays if local file fails to load
      return { stars: [], planets: [] };
    }
  }

  return {
    async initialize(): Promise<void> {
      if (initialized) {
        return;
      }

      // Try to load from cache first
      const cachedStars = loadFromCache();
      if (cachedStars && cachedStars.length > 0) {
        stars = cachedStars.filter((s) => s.magnitude <= config.maxMagnitude);
        offlineMode = false;

        // Load planets from local file (planets aren't cached as they need dynamic positions)
        const localData = await loadFromLocalFile();
        planets = localData.planets;

        initialized = true;
        return;
      }

      // Try to fetch from API
      const apiStars = await fetchFromAPI();
      if (apiStars && apiStars.length > 0) {
        stars = apiStars.filter((s) => s.magnitude <= config.maxMagnitude);
        offlineMode = false;

        // Cache the API results for offline use
        saveToCache(stars);

        // Load planets from local file
        const localData = await loadFromLocalFile();
        planets = localData.planets;

        initialized = true;
        return;
      }

      // Fall back to local JSON catalog
      const localData = await loadFromLocalFile();
      stars = localData.stars;
      planets = localData.planets;
      offlineMode = true;

      initialized = true;
    },

    getStars(maxMagnitude?: number): Star[] {
      const limit = maxMagnitude ?? config.maxMagnitude;
      return stars.filter((star) => star.magnitude <= limit);
    },

    getPlanets(): Planet[] {
      return [...planets];
    },

    getVisibleStars(
      _center: HorizontalCoordinates,
      _fov: number,
      maxMagnitude?: number
    ): Star[] {
      const limit = maxMagnitude ?? config.maxMagnitude;
      // Note: _center and _fov are intentionally unused in this simplified implementation
      // Full FOV filtering requires observer position and LST to convert celestial to horizontal coordinates

      // This is a simplified implementation that returns stars within magnitude limit
      // The actual FOV filtering would require the observer's position and LST
      // to convert celestial to horizontal coordinates
      return stars.filter((star) => {
        if (star.magnitude > limit) {
          return false;
        }

        // For proper FOV filtering, we'd need to:
        // 1. Convert star's RA/Dec to Az/Alt using observer position and LST
        // 2. Calculate angular distance from center using angularDistance()
        // 3. Check if distance < fov/2

        // Since we don't have observer context here, we return all stars
        // within magnitude limit. The caller should handle FOV filtering
        // with proper coordinate conversion.
        return true;
      });
    },

    updatePlanetPositions(_timestamp: Date, _observer: GeographicCoordinates): void {
      // This is a placeholder implementation
      // In a real implementation, this would use the astronomy-engine library
      // to calculate actual planet positions based on timestamp and observer location
      // Note: _timestamp and _observer are intentionally unused in this placeholder

      // The actual planet position calculation will be implemented in planet-calculator.ts
      // which uses the astronomy-engine npm package

      // Planets array is updated in place - positions would be calculated here
      // using ephemeris data or the astronomy-engine library
    },

    isOfflineMode(): boolean {
      return offlineMode;
    },
  };
}

/**
 * Default star catalog configuration
 */
export const defaultStarCatalogConfig: StarCatalogConfig = {
  localCatalogPath: '../data/stars.json',
  maxMagnitude: 5.0,
};

/**
 * Creates a star catalog with default configuration
 */
export function createDefaultStarCatalog(): StarCatalog {
  return createStarCatalog(defaultStarCatalogConfig);
}

export default createStarCatalog;
