/**
 * Planet_Calculator - Planetary Position Calculations
 *
 * Wraps the astronomy-engine npm package to calculate current RA/Dec
 * positions for all 8 planets based on timestamp and observer location.
 *
 * @module planet-calculator
 * @see Requirements 9.1, 9.2, 9.3
 */

import * as Astronomy from 'astronomy-engine';
import type { Planet, GeographicCoordinates } from './index';

/**
 * Planet names as used by the astronomy-engine library
 */
const PLANET_BODIES: Astronomy.Body[] = [
  Astronomy.Body.Mercury,
  Astronomy.Body.Venus,
  Astronomy.Body.Mars,
  Astronomy.Body.Jupiter,
  Astronomy.Body.Saturn,
  Astronomy.Body.Uranus,
  Astronomy.Body.Neptune,
  // Note: Earth is excluded as we're observing FROM Earth
];

/**
 * Planet metadata for display purposes
 */
const PLANET_INFO: Record<string, { id: string; name: string }> = {
  Mercury: { id: 'mercury', name: 'Mercury' },
  Venus: { id: 'venus', name: 'Venus' },
  Mars: { id: 'mars', name: 'Mars' },
  Jupiter: { id: 'jupiter', name: 'Jupiter' },
  Saturn: { id: 'saturn', name: 'Saturn' },
  Uranus: { id: 'uranus', name: 'Uranus' },
  Neptune: { id: 'neptune', name: 'Neptune' },
};

/**
 * Interface for the Planet Calculator
 */
export interface PlanetCalculator {
  /**
   * Calculates current RA/Dec positions for all 8 planets
   * @param timestamp - Date for position calculation
   * @param observer - Observer's geographic coordinates
   * @returns Array of Planet objects with calculated positions
   */
  calculatePlanetPositions(timestamp: Date, observer: GeographicCoordinates): Planet[];

  /**
   * Gets the position of a specific planet
   * @param planetName - Name of the planet (e.g., "Mars", "Jupiter")
   * @param timestamp - Date for position calculation
   * @param observer - Observer's geographic coordinates
   * @returns Planet object with calculated position, or null if not found
   */
  getPlanetPosition(
    planetName: string,
    timestamp: Date,
    observer: GeographicCoordinates
  ): Planet | null;
}

/**
 * Creates an observer object for the astronomy-engine library
 */
function createObserver(coords: GeographicCoordinates): Astronomy.Observer {
  return new Astronomy.Observer(coords.latitude, coords.longitude, 0);
}

/**
 * Calculates the apparent magnitude of a planet
 * Uses the astronomy-engine library's Illumination function
 */
function calculatePlanetMagnitude(body: Astronomy.Body, date: Date): number {
  try {
    const illum = Astronomy.Illumination(body, date);
    return illum.mag;
  } catch {
    // Return a default magnitude if calculation fails
    return 0;
  }
}

/**
 * Calculates the equatorial coordinates (RA/Dec) for a planet
 * @param body - The planet body from astronomy-engine
 * @param date - The date for calculation
 * @param observer - The observer's location
 * @returns Object with ra (in hours) and dec (in degrees)
 */
function calculateEquatorialCoordinates(
  body: Astronomy.Body,
  date: Date,
  observer: Astronomy.Observer
): { ra: number; dec: number } {
  // Get equatorial coordinates of the planet
  // Using true equator and equinox of date, with aberration correction
  const equator = Astronomy.Equator(body, date, observer, true, true);

  return {
    ra: equator.ra,   // Right Ascension in hours (0-24)
    dec: equator.dec, // Declination in degrees (-90 to +90)
  };
}

/**
 * Creates a Planet Calculator instance
 */
export function createPlanetCalculator(): PlanetCalculator {
  return {
    calculatePlanetPositions(
      timestamp: Date,
      observer: GeographicCoordinates
    ): Planet[] {
      const astroObserver = createObserver(observer);
      const planets: Planet[] = [];

      for (const body of PLANET_BODIES) {
        const planetName = body.toString();
        const info = PLANET_INFO[planetName];

        if (!info) {
          continue;
        }

        try {
          const coords = calculateEquatorialCoordinates(body, timestamp, astroObserver);
          const magnitude = calculatePlanetMagnitude(body, timestamp);

          planets.push({
            id: info.id,
            name: info.name,
            ra: coords.ra,
            dec: coords.dec,
            magnitude,
          });
        } catch {
          // Skip planet if calculation fails
          continue;
        }
      }

      return planets;
    },

    getPlanetPosition(
      planetName: string,
      timestamp: Date,
      observer: GeographicCoordinates
    ): Planet | null {
      // Normalize planet name for lookup
      const normalizedName =
        planetName.charAt(0).toUpperCase() + planetName.slice(1).toLowerCase();

      const info = PLANET_INFO[normalizedName];
      if (!info) {
        return null;
      }

      // Find the corresponding body
      const body = PLANET_BODIES.find((b) => b.toString() === normalizedName);
      if (!body) {
        return null;
      }

      try {
        const astroObserver = createObserver(observer);
        const coords = calculateEquatorialCoordinates(body, timestamp, astroObserver);
        const magnitude = calculatePlanetMagnitude(body, timestamp);

        return {
          id: info.id,
          name: info.name,
          ra: coords.ra,
          dec: coords.dec,
          magnitude,
        };
      } catch {
        return null;
      }
    },
  };
}

/**
 * Default planet calculator instance
 */
export const planetCalculator = createPlanetCalculator();

export default createPlanetCalculator;
