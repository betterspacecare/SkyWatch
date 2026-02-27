/**
 * Sun_Calculator - Solar Position and Safety Calculations
 *
 * Computes the Sun's position (RA/Dec), horizontal coordinates (Az/Alt),
 * sky status (daylight/twilight/night), and safety warnings using
 * the astronomy-engine npm package.
 *
 * @module sun-calculator
 * @see Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as Astronomy from 'astronomy-engine';
import { celestialToHorizontal } from './coordinate-converter';
import type { GeographicCoordinates } from './index';

/**
 * Sky status based on Sun altitude
 * - 'daylight': Sun altitude > 0°
 * - 'twilight': Sun altitude between -18° and 0°
 * - 'night': Sun altitude ≤ -18°
 */
export type SkyStatus = 'daylight' | 'twilight' | 'night';

/**
 * Sun position and safety information
 */
export interface SunPosition {
  /** Right Ascension in hours (0-24) */
  ra: number;
  /** Declination in degrees (-90 to +90) */
  dec: number;
  /** Horizontal azimuth (0-360) */
  azimuth: number;
  /** Horizontal altitude (-90 to +90) */
  altitude: number;
  /** Current sky status */
  status: SkyStatus;
  /** True if altitude > -18° (safety warning for potential eye damage) */
  safetyWarning: boolean;
  /** True if altitude < 0 */
  isBelowHorizon: boolean;
}

/**
 * Interface for the Sun Calculator
 */
export interface SunCalculator {
  /**
   * Calculates Sun position and safety status for given time and location
   * @param timestamp - Date for position calculation
   * @param observer - Observer's geographic coordinates
   * @param lst - Local Sidereal Time in decimal hours
   * @returns SunPosition with all calculated values
   */
  calculate(
    timestamp: Date,
    observer: GeographicCoordinates,
    lst: number
  ): SunPosition;

  /**
   * Gets sky status based on Sun altitude
   * @param sunAltitude - Sun's altitude in degrees
   * @returns SkyStatus ('daylight', 'twilight', or 'night')
   */
  getSkyStatus(sunAltitude: number): SkyStatus;
}


/** Astronomical twilight threshold in degrees */
const ASTRONOMICAL_TWILIGHT_THRESHOLD = -18;

/**
 * Creates an observer object for the astronomy-engine library
 */
function createObserver(coords: GeographicCoordinates): Astronomy.Observer {
  return new Astronomy.Observer(coords.latitude, coords.longitude, 0);
}

/**
 * Calculates the equatorial coordinates (RA/Dec) for the Sun
 * @param date - The date for calculation
 * @param observer - The observer's location
 * @returns Object with ra (in hours) and dec (in degrees)
 */
function calculateSunEquatorialCoordinates(
  date: Date,
  observer: Astronomy.Observer
): { ra: number; dec: number } {
  // Get equatorial coordinates of the Sun
  // Using true equator and equinox of date, with aberration correction
  const equator = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);

  return {
    ra: equator.ra,   // Right Ascension in hours (0-24)
    dec: equator.dec, // Declination in degrees (-90 to +90)
  };
}

/**
 * Determines the sky status based on Sun altitude
 * @param sunAltitude - Sun's altitude in degrees
 * @returns SkyStatus
 */
function determineSkyStatus(sunAltitude: number): SkyStatus {
  if (sunAltitude > 0) {
    return 'daylight';
  } else if (sunAltitude > ASTRONOMICAL_TWILIGHT_THRESHOLD) {
    return 'twilight';
  } else {
    return 'night';
  }
}

/**
 * Determines if a safety warning should be shown
 * Safety warning is active when Sun altitude > -18° (astronomical twilight threshold)
 * @param sunAltitude - Sun's altitude in degrees
 * @returns true if safety warning should be displayed
 */
function shouldShowSafetyWarning(sunAltitude: number): boolean {
  return sunAltitude > ASTRONOMICAL_TWILIGHT_THRESHOLD;
}

/**
 * Creates a Sun Calculator instance
 */
export function createSunCalculator(): SunCalculator {
  return {
    calculate(
      timestamp: Date,
      observer: GeographicCoordinates,
      lst: number
    ): SunPosition {
      const astroObserver = createObserver(observer);

      // Calculate equatorial coordinates (RA/Dec)
      const { ra, dec } = calculateSunEquatorialCoordinates(timestamp, astroObserver);

      // Convert to horizontal coordinates (Az/Alt) using existing converter
      const horizontal = celestialToHorizontal(
        { ra, dec },
        observer,
        lst
      );

      // Determine sky status and safety warning
      const status = determineSkyStatus(horizontal.altitude);
      const safetyWarning = shouldShowSafetyWarning(horizontal.altitude);

      return {
        ra,
        dec,
        azimuth: horizontal.azimuth,
        altitude: horizontal.altitude,
        status,
        safetyWarning,
        isBelowHorizon: horizontal.altitude < 0,
      };
    },

    getSkyStatus(sunAltitude: number): SkyStatus {
      return determineSkyStatus(sunAltitude);
    },
  };
}

/**
 * Default sun calculator instance
 */
export const sunCalculator = createSunCalculator();

export default createSunCalculator;
