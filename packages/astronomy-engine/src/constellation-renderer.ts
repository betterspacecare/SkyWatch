/**
 * Constellation_Renderer - Constellation Line Pattern Visualization
 *
 * Manages constellation line data and visibility calculations for rendering
 * constellation patterns connecting stars in the night sky.
 *
 * @module constellation-renderer
 */

import type { GeographicCoordinates, HorizontalCoordinates } from './index';
import { celestialToHorizontal } from './coordinate-converter';
import constellationData from '../data/constellations.json';

/**
 * Represents a star in a constellation with its position
 */
export interface ConstellationStar {
  /** Hipparcos catalog ID */
  hipId: string;
  /** Right Ascension in hours */
  ra: number;
  /** Declination in degrees */
  dec: number;
}

/**
 * Represents a line segment connecting two stars in a constellation
 */
export interface ConstellationLine {
  star1: ConstellationStar;
  star2: ConstellationStar;
}

/**
 * Represents a complete constellation with its line pattern
 */
export interface Constellation {
  /** IAU abbreviation (e.g., 'ORI') */
  id: string;
  /** Full name (e.g., 'Orion') */
  name: string;
  /** Line segments connecting stars */
  lines: ConstellationLine[];
  /** Center RA for label placement */
  centerRA: number;
  /** Center Dec for label placement */
  centerDec: number;
}

/**
 * Represents a constellation line segment in horizontal coordinates
 */
export interface ConstellationLineSegment {
  constellationId: string;
  constellationName: string;
  start: HorizontalCoordinates;
  end: HorizontalCoordinates;
  /** True if one end is below horizon */
  isPartiallyVisible: boolean;
}

/**
 * Configuration options for the constellation renderer
 */
export interface ConstellationRendererConfig {
  enabled: boolean;
  lineColor: string;
  lineThickness: number;
  showNames: boolean;
}

/**
 * Interface for the Constellation Renderer
 */
export interface ConstellationRenderer {
  /**
   * Gets all 88 IAU constellations
   */
  getConstellations(): Constellation[];

  /**
   * Calculates visible constellation line segments
   */
  getVisibleLines(
    observer: GeographicCoordinates,
    lst: number
  ): ConstellationLineSegment[];

  /**
   * Gets constellation center positions for labels
   */
  getConstellationCenters(
    observer: GeographicCoordinates,
    lst: number
  ): Map<string, HorizontalCoordinates>;

  /**
   * Gets current configuration
   */
  getConfig(): ConstellationRendererConfig;

  /**
   * Updates configuration
   */
  setConfig(config: Partial<ConstellationRendererConfig>): void;
}


/**
 * Raw constellation data structure from JSON
 */
interface RawConstellationData {
  constellations?: Array<{
    id: string;
    name: string;
    lines: Array<{ star1: string; star2: string }>;
    stars: Record<string, { ra: number; dec: number }>;
  }>;
}

/**
 * New constellation data format (from generate-constellations script)
 */
interface NewConstellationData {
  id: string;
  name: string;
  lines: Array<{
    star1: { hipId: number; ra: number; dec: number };
    star2: { hipId: number; ra: number; dec: number };
  }>;
  centerRA: number;
  centerDec: number;
}

/**
 * Default configuration for the constellation renderer
 */
const DEFAULT_CONFIG: ConstellationRendererConfig = {
  enabled: true,
  lineColor: '#6366f1',
  lineThickness: 1,
  showNames: true,
};

/**
 * Parses raw constellation data into Constellation objects
 */
function parseConstellations(data: RawConstellationData | NewConstellationData[]): Constellation[] {
  // Check if it's the new format (array)
  if (Array.isArray(data)) {
    return data.map(con => ({
      id: con.id,
      name: con.name,
      lines: con.lines.map(line => ({
        star1: {
          hipId: String(line.star1.hipId),
          ra: line.star1.ra,
          dec: line.star1.dec
        },
        star2: {
          hipId: String(line.star2.hipId),
          ra: line.star2.ra,
          dec: line.star2.dec
        }
      })),
      centerRA: con.centerRA,
      centerDec: con.centerDec
    }));
  }
  
  // Old format (object with constellations array)
  if (!data.constellations) {
    return [];
  }

  return data.constellations.map((raw) => {
    const lines: ConstellationLine[] = raw.lines
      .filter((line) => {
        // Filter out lines where star data is missing
        return raw.stars[line.star1] !== undefined && raw.stars[line.star2] !== undefined;
      })
      .map((line) => {
        // We've already filtered to ensure these exist
        const star1Data = raw.stars[line.star1]!;
        const star2Data = raw.stars[line.star2]!;

        return {
          star1: {
            hipId: line.star1,
            ra: star1Data.ra,
            dec: star1Data.dec,
          },
          star2: {
            hipId: line.star2,
            ra: star2Data.ra,
            dec: star2Data.dec,
          },
        };
      });

    // Calculate center position as average of all star positions
    const starIds = Object.keys(raw.stars);
    const totalRA = starIds.reduce((sum, id) => {
      const star = raw.stars[id];
      return sum + (star ? star.ra : 0);
    }, 0);
    const totalDec = starIds.reduce((sum, id) => {
      const star = raw.stars[id];
      return sum + (star ? star.dec : 0);
    }, 0);
    const centerRA = starIds.length > 0 ? totalRA / starIds.length : 0;
    const centerDec = starIds.length > 0 ? totalDec / starIds.length : 0;

    return {
      id: raw.id,
      name: raw.name,
      lines,
      centerRA,
      centerDec,
    };
  });
}

/**
 * Creates a ConstellationRenderer instance
 */
export function createConstellationRenderer(): ConstellationRenderer {
  // Parse constellation data on initialization
  const constellations = parseConstellations(constellationData as (RawConstellationData | NewConstellationData[]));

  // Configuration state
  let config: ConstellationRendererConfig = { ...DEFAULT_CONFIG };

  return {
    getConstellations(): Constellation[] {
      return constellations;
    },

    getVisibleLines(
      observer: GeographicCoordinates,
      lst: number
    ): ConstellationLineSegment[] {
      if (!config.enabled) {
        return [];
      }

      const segments: ConstellationLineSegment[] = [];

      for (const constellation of constellations) {
        for (const line of constellation.lines) {
          // Convert both star positions to horizontal coordinates
          const start = celestialToHorizontal(
            { ra: line.star1.ra, dec: line.star1.dec },
            observer,
            lst
          );
          const end = celestialToHorizontal(
            { ra: line.star2.ra, dec: line.star2.dec },
            observer,
            lst
          );

          // Determine if the line is partially visible
          // (one star above horizon, one below)
          const star1BelowHorizon = start.altitude < 0;
          const star2BelowHorizon = end.altitude < 0;
          const isPartiallyVisible = star1BelowHorizon !== star2BelowHorizon;

          segments.push({
            constellationId: constellation.id,
            constellationName: constellation.name,
            start,
            end,
            isPartiallyVisible,
          });
        }
      }

      return segments;
    },

    getConstellationCenters(
      observer: GeographicCoordinates,
      lst: number
    ): Map<string, HorizontalCoordinates> {
      const centers = new Map<string, HorizontalCoordinates>();

      for (const constellation of constellations) {
        const center = celestialToHorizontal(
          { ra: constellation.centerRA, dec: constellation.centerDec },
          observer,
          lst
        );
        centers.set(constellation.id, center);
      }

      return centers;
    },

    getConfig(): ConstellationRendererConfig {
      return { ...config };
    },

    setConfig(newConfig: Partial<ConstellationRendererConfig>): void {
      config = { ...config, ...newConfig };
    },
  };
}

/**
 * Default constellation renderer instance
 */
export const constellationRenderer = createConstellationRenderer();

export default constellationRenderer;
