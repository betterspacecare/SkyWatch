/**
 * Deep_Sky_Catalog - Messier Object Catalog and Position Calculator
 *
 * Provides access to the Messier catalog of 110 deep sky objects including
 * galaxies, nebulae, and star clusters. Calculates horizontal coordinates
 * for visibility determination.
 *
 * @module deep-sky-catalog
 */

import { celestialToHorizontal } from './coordinate-converter';
import type { GeographicCoordinates } from './index';
import messierData from '../data/messier.json';

/**
 * Classification types for deep sky objects
 */
export type DeepSkyObjectType =
  | 'Galaxy'
  | 'Nebula'
  | 'Open Cluster'
  | 'Globular Cluster'
  | 'Planetary Nebula';

/**
 * Represents a deep sky object from the Messier catalog
 */
export interface DeepSkyObject {
  /** Messier number (e.g., 'M31') */
  id: string;
  /** Common name (e.g., 'Andromeda Galaxy') or null if unnamed */
  name: string | null;
  /** Right Ascension in decimal hours (0-24) */
  ra: number;
  /** Declination in degrees (-90 to +90) */
  dec: number;
  /** Apparent magnitude (lower = brighter) */
  magnitude: number;
  /** Object classification */
  type: DeepSkyObjectType;
}

/**
 * Deep sky object with calculated horizontal position
 */
export interface DeepSkyPosition {
  /** The deep sky object */
  object: DeepSkyObject;
  /** Azimuth in degrees (0-360) */
  azimuth: number;
  /** Altitude in degrees (-90 to +90) */
  altitude: number;
  /** True if above horizon and within magnitude limit */
  isVisible: boolean;
}

/**
 * Configuration for the deep sky catalog
 */
export interface DeepSkyCatalogConfig {
  /** Maximum magnitude for visibility (default: 10.0) */
  maxMagnitude: number;
}


/**
 * Interface for the Deep Sky Catalog
 */
export interface DeepSkyCatalog {
  /**
   * Gets all 110 Messier objects
   * @returns Array of all deep sky objects
   */
  getAllObjects(): DeepSkyObject[];

  /**
   * Gets objects filtered by type
   * @param type - The object type to filter by
   * @returns Array of objects matching the specified type
   */
  getObjectsByType(type: DeepSkyObjectType): DeepSkyObject[];

  /**
   * Gets a single object by its ID
   * @param id - The Messier number (e.g., 'M31')
   * @returns The object if found, null otherwise
   */
  getObject(id: string): DeepSkyObject | null;

  /**
   * Calculates positions for visible objects
   * @param observer - Geographic position of the observer
   * @param lst - Local Sidereal Time in decimal hours
   * @param maxMagnitude - Optional magnitude limit (overrides config)
   * @returns Array of objects with calculated positions
   */
  getVisibleObjects(
    observer: GeographicCoordinates,
    lst: number,
    maxMagnitude?: number
  ): DeepSkyPosition[];

  /**
   * Gets the current configuration
   * @returns Current catalog configuration
   */
  getConfig(): DeepSkyCatalogConfig;

  /**
   * Updates the configuration
   * @param config - Partial configuration to merge
   */
  setConfig(config: Partial<DeepSkyCatalogConfig>): void;
}

/**
 * Valid deep sky object types for validation
 */
const VALID_TYPES: DeepSkyObjectType[] = [
  'Galaxy',
  'Nebula',
  'Open Cluster',
  'Globular Cluster',
  'Planetary Nebula',
];

/**
 * Validates that a type string is a valid DeepSkyObjectType
 */
function isValidDeepSkyType(type: string): type is DeepSkyObjectType {
  return VALID_TYPES.includes(type as DeepSkyObjectType);
}

/**
 * Loads and validates Messier objects from the JSON data
 */
function loadMessierObjects(): DeepSkyObject[] {
  const objects: DeepSkyObject[] = [];

  for (const obj of messierData.objects) {
    // Validate type
    if (!isValidDeepSkyType(obj.type)) {
      console.warn(`Invalid type for ${obj.id}: ${obj.type}`);
      continue;
    }

    objects.push({
      id: obj.id,
      name: obj.name,
      ra: obj.ra,
      dec: obj.dec,
      magnitude: obj.magnitude,
      type: obj.type,
    });
  }

  return objects;
}

/**
 * Creates a new Deep Sky Catalog instance
 * @param initialConfig - Optional initial configuration
 * @returns DeepSkyCatalog instance
 */
export function createDeepSkyCatalog(
  initialConfig?: Partial<DeepSkyCatalogConfig>
): DeepSkyCatalog {
  // Load objects from JSON
  const objects = loadMessierObjects();

  // Create object lookup map for efficient single object retrieval
  const objectMap = new Map<string, DeepSkyObject>();
  for (const obj of objects) {
    objectMap.set(obj.id.toUpperCase(), obj);
  }

  // Initialize configuration with defaults
  let config: DeepSkyCatalogConfig = {
    maxMagnitude: 10.0,
    ...initialConfig,
  };

  return {
    getAllObjects(): DeepSkyObject[] {
      return [...objects];
    },

    getObjectsByType(type: DeepSkyObjectType): DeepSkyObject[] {
      return objects.filter((obj) => obj.type === type);
    },

    getObject(id: string): DeepSkyObject | null {
      return objectMap.get(id.toUpperCase()) ?? null;
    },

    getVisibleObjects(
      observer: GeographicCoordinates,
      lst: number,
      maxMagnitude?: number
    ): DeepSkyPosition[] {
      const magnitudeLimit = maxMagnitude ?? config.maxMagnitude;
      const positions: DeepSkyPosition[] = [];

      for (const obj of objects) {
        // Convert RA/Dec to Az/Alt
        const horizontal = celestialToHorizontal(
          { ra: obj.ra, dec: obj.dec },
          observer,
          lst
        );

        // Determine visibility: above horizon AND within magnitude limit
        const isAboveHorizon = horizontal.altitude >= 0;
        const isWithinMagnitude = obj.magnitude <= magnitudeLimit;
        const isVisible = isAboveHorizon && isWithinMagnitude;

        positions.push({
          object: obj,
          azimuth: horizontal.azimuth,
          altitude: horizontal.altitude,
          isVisible,
        });
      }

      return positions;
    },

    getConfig(): DeepSkyCatalogConfig {
      return { ...config };
    },

    setConfig(newConfig: Partial<DeepSkyCatalogConfig>): void {
      config = { ...config, ...newConfig };
    },
  };
}

/**
 * Default deep sky catalog instance
 */
export const deepSkyCatalog = createDeepSkyCatalog();

export default deepSkyCatalog;
