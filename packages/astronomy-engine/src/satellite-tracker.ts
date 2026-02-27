/**
 * Satellite_Tracker - Satellite Position Calculation from TLE Data
 *
 * Calculates satellite positions using Two-Line Element (TLE) data.
 * Implements simplified SGP4-like propagation for satellite tracking.
 *
 * @module satellite-tracker
 * @see Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import type { GeographicCoordinates } from './index';
import type { SunPosition } from './sun-calculator';

/**
 * Two-Line Element data for a satellite
 */
export interface TLEData {
  /** Satellite name */
  name: string;
  /** TLE line 1 */
  line1: string;
  /** TLE line 2 */
  line2: string;
  /** When the TLE data was fetched */
  fetchedAt: Date;
}

/**
 * Calculated satellite position
 */
export interface SatellitePosition {
  /** Satellite identifier */
  id: string;
  /** Satellite name */
  name: string;
  /** Horizontal azimuth (0-360) */
  azimuth: number;
  /** Horizontal altitude (-90 to +90) */
  altitude: number;
  /** Distance from observer in km */
  range: number;
  /** True if satellite is illuminated and observer is in darkness */
  isVisible: boolean;
  /** True if TLE data is older than staleDays */
  isStale: boolean;
}

/**
 * Configuration for the satellite tracker
 */
export interface SatelliteTrackerConfig {
  /** Days before TLE is considered stale (default: 14) */
  staleDays: number;
}

/**
 * Error types for satellite tracking
 */
export type SatelliteTrackerError =
  | { type: 'TLE_UNAVAILABLE'; satelliteId: string }
  | { type: 'TLE_INVALID'; satelliteId: string; reason: string }
  | { type: 'TLE_STALE'; satelliteId: string; age: number };

/**
 * Interface for the Satellite Tracker
 */
export interface SatelliteTracker {
  /**
   * Adds or updates TLE data for a satellite
   * @param id - Satellite identifier
   * @param tle - TLE data
   */
  setTLE(id: string, tle: TLEData): void;

  /**
   * Gets TLE data for a satellite
   * @param id - Satellite identifier
   * @returns TLE data or null if not found
   */
  getTLE(id: string): TLEData | null;

  /**
   * Checks if TLE data is stale (older than staleDays)
   * @param id - Satellite identifier
   * @returns true if TLE is stale or not found
   */
  isTLEStale(id: string): boolean;

  /**
   * Calculates satellite position
   * @param id - Satellite identifier
   * @param timestamp - Time for calculation
   * @param observer - Observer's geographic coordinates
   * @returns SatellitePosition or error
   */
  calculate(
    id: string,
    timestamp: Date,
    observer: GeographicCoordinates
  ): SatellitePosition | SatelliteTrackerError;

  /**
   * Calculates positions for all tracked satellites
   * @param timestamp - Time for calculation
   * @param observer - Observer's geographic coordinates
   * @param sunPosition - Sun position for visibility calculation
   * @returns Map of satellite positions or errors
   */
  calculateAll(
    timestamp: Date,
    observer: GeographicCoordinates,
    sunPosition: SunPosition
  ): Map<string, SatellitePosition | SatelliteTrackerError>;

  /**
   * Predicts visibility based on satellite illumination and observer darkness
   * @param satelliteAltitude - Satellite's altitude above horizon in degrees
   * @param sunPosition - Sun position for darkness check
   * @returns true if satellite should be visible
   */
  predictVisibility(satelliteAltitude: number, sunPosition: SunPosition): boolean;

  /**
   * Gets list of tracked satellite IDs
   * @returns Array of satellite IDs
   */
  getTrackedSatellites(): string[];

  /**
   * Loads default ISS TLE data
   * @returns Promise that resolves when ISS TLE is loaded
   */
  loadDefaultISS(): Promise<void>;
}

/**
 * Parsed TLE orbital elements
 */
interface OrbitalElements {
  /** Satellite catalog number */
  catalogNumber: string;
  /** Epoch year (2-digit) */
  epochYear: number;
  /** Epoch day of year (fractional) */
  epochDay: number;
  /** Inclination in degrees */
  inclination: number;
  /** Right Ascension of Ascending Node in degrees */
  raan: number;
  /** Eccentricity (decimal) */
  eccentricity: number;
  /** Argument of Perigee in degrees */
  argPerigee: number;
  /** Mean Anomaly in degrees */
  meanAnomaly: number;
  /** Mean Motion in revolutions per day */
  meanMotion: number;
  /** Revolution number at epoch */
  revNumber: number;
}

// Constants for orbital calculations
const EARTH_RADIUS_KM = 6371;
const MINUTES_PER_DAY = 1440;
const TWO_PI = 2 * Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// Default ISS TLE (updated periodically - this is a sample)
const DEFAULT_ISS_TLE: TLEData = {
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025',
  line2: '2 25544  51.6400 208.9163 0006703 358.0000   2.1000 15.49815200  0000',
  fetchedAt: new Date(),
};

/**
 * Parses TLE line 1 and line 2 into orbital elements
 * @param line1 - TLE line 1
 * @param line2 - TLE line 2
 * @returns Parsed orbital elements or null if invalid
 */
function parseTLE(line1: string, line2: string): OrbitalElements | null {
  try {
    // Validate line lengths
    if (line1.length < 69 || line2.length < 69) {
      return null;
    }

    // Validate line numbers
    if (line1[0] !== '1' || line2[0] !== '2') {
      return null;
    }

    // Parse line 1
    const catalogNumber = line1.substring(2, 7).trim();
    const epochYearStr = line1.substring(18, 20);
    const epochDayStr = line1.substring(20, 32);

    // Parse line 2
    const inclination = parseFloat(line2.substring(8, 16).trim());
    const raan = parseFloat(line2.substring(17, 25).trim());
    const eccentricityStr = '0.' + line2.substring(26, 33).trim();
    const eccentricity = parseFloat(eccentricityStr);
    const argPerigee = parseFloat(line2.substring(34, 42).trim());
    const meanAnomaly = parseFloat(line2.substring(43, 51).trim());
    const meanMotion = parseFloat(line2.substring(52, 63).trim());
    const revNumber = parseInt(line2.substring(63, 68).trim(), 10);

    // Validate parsed values
    if (
      isNaN(inclination) ||
      isNaN(raan) ||
      isNaN(eccentricity) ||
      isNaN(argPerigee) ||
      isNaN(meanAnomaly) ||
      isNaN(meanMotion)
    ) {
      return null;
    }

    // Validate ranges
    if (
      inclination < 0 || inclination > 180 ||
      raan < 0 || raan > 360 ||
      eccentricity < 0 || eccentricity >= 1 ||
      argPerigee < 0 || argPerigee > 360 ||
      meanAnomaly < 0 || meanAnomaly > 360 ||
      meanMotion <= 0
    ) {
      return null;
    }

    return {
      catalogNumber,
      epochYear: parseInt(epochYearStr, 10),
      epochDay: parseFloat(epochDayStr),
      inclination,
      raan,
      eccentricity,
      argPerigee,
      meanAnomaly,
      meanMotion,
      revNumber: isNaN(revNumber) ? 0 : revNumber,
    };
  } catch {
    return null;
  }
}

/**
 * Converts TLE epoch to JavaScript Date
 * @param epochYear - 2-digit year
 * @param epochDay - Fractional day of year
 * @returns Date object
 */
function tleEpochToDate(epochYear: number, epochDay: number): Date {
  // Convert 2-digit year to 4-digit (assumes 2000s for years < 57, 1900s otherwise)
  const fullYear = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
  
  // Create date at start of year
  const date = new Date(Date.UTC(fullYear, 0, 1));
  
  // Add fractional days (epochDay is 1-based)
  const milliseconds = (epochDay - 1) * 24 * 60 * 60 * 1000;
  date.setTime(date.getTime() + milliseconds);
  
  return date;
}

/**
 * Calculates the age of TLE data in days
 * @param fetchedAt - When TLE was fetched
 * @param currentTime - Current time
 * @returns Age in days
 */
function calculateTLEAge(fetchedAt: Date, currentTime: Date): number {
  const diffMs = currentTime.getTime() - fetchedAt.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Simplified SGP4-like propagation to calculate satellite position
 * This is a simplified model for demonstration purposes
 * @param elements - Orbital elements
 * @param timestamp - Time for calculation
 * @returns Position in ECI coordinates (km) and velocity
 */
function propagate(
  elements: OrbitalElements,
  timestamp: Date
): { x: number; y: number; z: number } | null {
  try {
    // Calculate time since epoch in minutes
    const epochDate = tleEpochToDate(elements.epochYear, elements.epochDay);
    const timeSinceEpochMs = timestamp.getTime() - epochDate.getTime();
    const timeSinceEpochMin = timeSinceEpochMs / (1000 * 60);

    // Calculate mean motion in radians per minute
    const n = elements.meanMotion * TWO_PI / MINUTES_PER_DAY;

    // Calculate semi-major axis from mean motion (Kepler's third law)
    // n = sqrt(GM/a^3), so a = (GM/n^2)^(1/3)
    // Using GM = 398600.4418 km^3/s^2
    const GM = 398600.4418;
    const nRadPerSec = n / 60;
    const a = Math.pow(GM / (nRadPerSec * nRadPerSec), 1 / 3);

    // Calculate mean anomaly at current time
    const M = (elements.meanAnomaly * DEG_TO_RAD + n * timeSinceEpochMin) % TWO_PI;

    // Solve Kepler's equation for eccentric anomaly (Newton-Raphson)
    let E = M;
    const e = elements.eccentricity;
    for (let i = 0; i < 10; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }

    // Calculate true anomaly
    const sinV = Math.sqrt(1 - e * e) * Math.sin(E) / (1 - e * Math.cos(E));
    const cosV = (Math.cos(E) - e) / (1 - e * Math.cos(E));
    const v = Math.atan2(sinV, cosV);

    // Calculate distance from Earth center
    const r = a * (1 - e * Math.cos(E));

    // Calculate position in orbital plane
    const xOrbit = r * Math.cos(v);
    const yOrbit = r * Math.sin(v);

    // Convert orbital elements to radians
    const i = elements.inclination * DEG_TO_RAD;
    const omega = elements.argPerigee * DEG_TO_RAD;
    
    // Calculate RAAN precession (simplified)
    const raanRate = -1.5 * n * (EARTH_RADIUS_KM / a) ** 2 * Math.cos(i) / (1 - e * e) ** 2;
    const raan = (elements.raan * DEG_TO_RAD + raanRate * timeSinceEpochMin) % TWO_PI;

    // Rotation matrices to convert from orbital plane to ECI
    const cosRaan = Math.cos(raan);
    const sinRaan = Math.sin(raan);
    const cosI = Math.cos(i);
    const sinI = Math.sin(i);
    const cosOmega = Math.cos(omega);
    const sinOmega = Math.sin(omega);

    // Position in orbital plane rotated by argument of perigee
    const xPeri = xOrbit * cosOmega - yOrbit * sinOmega;
    const yPeri = xOrbit * sinOmega + yOrbit * cosOmega;

    // Transform to ECI coordinates
    const x = xPeri * cosRaan - yPeri * cosI * sinRaan;
    const y = xPeri * sinRaan + yPeri * cosI * cosRaan;
    const z = yPeri * sinI;

    return { x, y, z };
  } catch {
    return null;
  }
}

/**
 * Converts ECI coordinates to geodetic (lat/lon/alt)
 * @param eci - ECI position in km
 * @param timestamp - Time for GMST calculation
 * @returns Geodetic coordinates
 */
function eciToGeodetic(
  eci: { x: number; y: number; z: number },
  timestamp: Date
): { latitude: number; longitude: number; altitude: number } {
  // Calculate GMST (Greenwich Mean Sidereal Time)
  const jd = timestamp.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
             0.000387933 * T * T - T * T * T / 38710000;
  gmst = ((gmst % 360) + 360) % 360;

  // Calculate longitude
  let longitude = Math.atan2(eci.y, eci.x) * RAD_TO_DEG - gmst;
  longitude = ((longitude + 180) % 360) - 180;

  // Calculate latitude (simplified, assumes spherical Earth)
  const r = Math.sqrt(eci.x * eci.x + eci.y * eci.y + eci.z * eci.z);
  const latitude = Math.asin(eci.z / r) * RAD_TO_DEG;

  // Calculate altitude
  const altitude = r - EARTH_RADIUS_KM;

  return { latitude, longitude, altitude };
}

/**
 * Calculates topocentric position (azimuth, altitude, range) from observer
 * @param satGeodetic - Satellite geodetic position
 * @param observer - Observer's geographic coordinates
 * @returns Topocentric coordinates
 */
function calculateTopocentric(
  satGeodetic: { latitude: number; longitude: number; altitude: number },
  observer: GeographicCoordinates
): { azimuth: number; altitude: number; range: number } {
  // Calculate differences
  const dLat = (satGeodetic.latitude - observer.latitude) * DEG_TO_RAD;
  const dLon = (satGeodetic.longitude - observer.longitude) * DEG_TO_RAD;
  const obsLatRad = observer.latitude * DEG_TO_RAD;
  const satLatRad = satGeodetic.latitude * DEG_TO_RAD;

  // Calculate range using spherical approximation
  const satAlt = satGeodetic.altitude;
  const satR = EARTH_RADIUS_KM + satAlt;
  const obsR = EARTH_RADIUS_KM;

  // Angular distance
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(obsLatRad) * Math.cos(satLatRad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Range calculation using law of cosines
  const range = Math.sqrt(obsR * obsR + satR * satR - 2 * obsR * satR * Math.cos(c));

  // Calculate elevation angle
  const sinEl = (satR * Math.cos(c) - obsR) / range;
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl))) * RAD_TO_DEG;

  // Calculate azimuth
  const y = Math.sin(dLon) * Math.cos(satLatRad);
  const x = Math.cos(obsLatRad) * Math.sin(satLatRad) -
            Math.sin(obsLatRad) * Math.cos(satLatRad) * Math.cos(dLon);
  let azimuth = Math.atan2(y, x) * RAD_TO_DEG;
  azimuth = ((azimuth % 360) + 360) % 360;

  return { azimuth, altitude: elevation, range };
}

/**
 * Creates a Satellite Tracker instance
 * @param config - Optional configuration
 * @returns SatelliteTracker instance
 */
export function createSatelliteTracker(
  config?: Partial<SatelliteTrackerConfig>
): SatelliteTracker {
  const fullConfig: SatelliteTrackerConfig = {
    staleDays: config?.staleDays ?? 14,
  };

  // Storage for TLE data
  const tleStore = new Map<string, TLEData>();

  return {
    setTLE(id: string, tle: TLEData): void {
      tleStore.set(id, tle);
    },

    getTLE(id: string): TLEData | null {
      return tleStore.get(id) ?? null;
    },

    isTLEStale(id: string): boolean {
      const tle = tleStore.get(id);
      if (!tle) {
        return true;
      }
      const age = calculateTLEAge(tle.fetchedAt, new Date());
      return age > fullConfig.staleDays;
    },

    calculate(
      id: string,
      timestamp: Date,
      observer: GeographicCoordinates
    ): SatellitePosition | SatelliteTrackerError {
      // Check if TLE exists
      const tle = tleStore.get(id);
      if (!tle) {
        return { type: 'TLE_UNAVAILABLE', satelliteId: id };
      }

      // Parse TLE
      const elements = parseTLE(tle.line1, tle.line2);
      if (!elements) {
        return { type: 'TLE_INVALID', satelliteId: id, reason: 'Failed to parse TLE data' };
      }

      // Check staleness
      const age = calculateTLEAge(tle.fetchedAt, timestamp);
      const isStale = age > fullConfig.staleDays;

      // Propagate satellite position
      const eciPosition = propagate(elements, timestamp);
      if (!eciPosition) {
        return { type: 'TLE_INVALID', satelliteId: id, reason: 'Propagation failed' };
      }

      // Convert to geodetic
      const geodetic = eciToGeodetic(eciPosition, timestamp);

      // Calculate topocentric position
      const topocentric = calculateTopocentric(geodetic, observer);

      // Determine visibility (simplified: satellite above horizon and in Earth's shadow)
      // For proper visibility, we'd need to check if satellite is illuminated by Sun
      const isVisible = topocentric.altitude > 0;

      return {
        id,
        name: tle.name,
        azimuth: topocentric.azimuth,
        altitude: topocentric.altitude,
        range: topocentric.range,
        isVisible,
        isStale,
      };
    },

    calculateAll(
      timestamp: Date,
      observer: GeographicCoordinates,
      sunPosition: SunPosition
    ): Map<string, SatellitePosition | SatelliteTrackerError> {
      const results = new Map<string, SatellitePosition | SatelliteTrackerError>();

      const trackedIds = Array.from(tleStore.keys());
      for (const id of trackedIds) {
        const result = this.calculate(id, timestamp, observer);
        
        // Update visibility based on sun position if we got a valid position
        if ('azimuth' in result) {
          const isVisible = this.predictVisibility(result.altitude, sunPosition);
          results.set(id, { ...result, isVisible });
        } else {
          results.set(id, result);
        }
      }

      return results;
    },

    predictVisibility(satelliteAltitude: number, sunPosition: SunPosition): boolean {
      // Satellite is visible when:
      // 1. Satellite is above the observer's horizon (altitude > 0)
      // 2. Observer is in darkness (Sun below horizon, altitude < 0)
      // 3. Satellite is illuminated by the Sun (simplified: assume illuminated when above horizon)
      
      // For a more accurate model, we'd calculate if the satellite is in Earth's shadow
      // but for simplicity, we assume satellites above horizon during darkness are visible
      
      const observerInDarkness = sunPosition.altitude < 0;
      const satelliteAboveHorizon = satelliteAltitude > 0;
      
      return observerInDarkness && satelliteAboveHorizon;
    },

    getTrackedSatellites(): string[] {
      return Array.from(tleStore.keys());
    },

    async loadDefaultISS(): Promise<void> {
      // In a real implementation, this would fetch fresh TLE data from an API
      // For now, we use a default TLE with current timestamp
      const issTLE: TLEData = {
        ...DEFAULT_ISS_TLE,
        fetchedAt: new Date(),
      };
      tleStore.set('ISS', issTLE);
    },
  };
}

/**
 * Default satellite tracker instance
 */
export const satelliteTracker = createSatelliteTracker();

export default createSatelliteTracker;
