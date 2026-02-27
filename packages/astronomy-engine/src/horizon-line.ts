/**
 * Horizon Line Module
 *
 * Generates horizon line points at altitude 0° for rendering and provides
 * utilities for determining if celestial objects are below the horizon.
 */

/**
 * Represents a point on the horizon line.
 */
export interface HorizonPoint {
  /** Azimuth in degrees (0-360) */
  azimuth: number;
  /** Altitude in degrees (always 0 for horizon points) */
  altitude: number;
  /** Screen X coordinate (populated by renderer) */
  screenX?: number;
  /** Screen Y coordinate (populated by renderer) */
  screenY?: number;
}

/**
 * Configuration options for the horizon line.
 */
export interface HorizonLineConfig {
  /** Number of points to generate (default: 360) */
  pointCount: number;
  /** Line color (default: '#4a5568') */
  color: string;
  /** Line opacity (default: 0.6) */
  opacity: number;
}

/**
 * Interface for horizon line operations.
 */
export interface HorizonLine {
  /**
   * Generates horizon points at altitude 0° across all azimuths.
   * Points are evenly distributed from 0° to 360° azimuth.
   */
  getHorizonPoints(): HorizonPoint[];

  /**
   * Checks if an object is below the horizon.
   * @param altitude - The altitude in degrees
   * @returns true if altitude < 0
   */
  isBelowHorizon(altitude: number): boolean;

  /**
   * Gets the current configuration.
   */
  getConfig(): HorizonLineConfig;

  /**
   * Updates the configuration with partial values.
   * @param config - Partial configuration to merge
   */
  setConfig(config: Partial<HorizonLineConfig>): void;
}

/**
 * Default configuration values for the horizon line.
 */
const DEFAULT_CONFIG: HorizonLineConfig = {
  pointCount: 360,
  color: '#4a5568',
  opacity: 0.6,
};

/**
 * Creates a HorizonLine instance with the specified configuration.
 * @param config - Optional partial configuration to override defaults
 * @returns A HorizonLine instance
 */
export function createHorizonLine(config?: Partial<HorizonLineConfig>): HorizonLine {
  // Merge provided config with defaults
  let currentConfig: HorizonLineConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return {
    getHorizonPoints(): HorizonPoint[] {
      const points: HorizonPoint[] = [];
      const { pointCount } = currentConfig;

      // Ensure we have at least 1 point
      const count = Math.max(1, Math.floor(pointCount));

      for (let i = 0; i < count; i++) {
        // Distribute points evenly from 0 to 360 degrees
        // For pointCount points, we want azimuths at 0, 360/n, 2*360/n, ..., (n-1)*360/n
        const azimuth = (i * 360) / count;

        points.push({
          azimuth,
          altitude: 0, // Horizon is always at altitude 0°
        });
      }

      return points;
    },

    isBelowHorizon(altitude: number): boolean {
      return altitude < 0;
    },

    getConfig(): HorizonLineConfig {
      // Return a copy to prevent external mutation
      return { ...currentConfig };
    },

    setConfig(config: Partial<HorizonLineConfig>): void {
      currentConfig = {
        ...currentConfig,
        ...config,
      };
    },
  };
}
