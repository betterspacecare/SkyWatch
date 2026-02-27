/**
 * Coordinate_Converter - Celestial to Horizontal Coordinate Transformation
 *
 * Converts between celestial coordinates (Right Ascension/Declination) and
 * horizontal coordinates (Azimuth/Altitude) using spherical trigonometry.
 *
 * @module coordinate-converter
 */

import type { CelestialCoordinates, GeographicCoordinates, HorizontalCoordinates } from './index';

/**
 * Degrees per hour of Right Ascension
 */
const DEGREES_PER_HOUR = 15;

/**
 * Interface for the Coordinate Converter
 */
export interface CoordinateConverter {
  /**
   * Converts celestial coordinates to horizontal coordinates
   * @param celestial - RA/Dec coordinates
   * @param observer - Geographic position
   * @param lst - Local Sidereal Time in decimal hours
   * @returns Azimuth/Altitude coordinates
   */
  celestialToHorizontal(
    celestial: CelestialCoordinates,
    observer: GeographicCoordinates,
    lst: number
  ): HorizontalCoordinates;

  /**
   * Converts horizontal coordinates back to celestial (for validation)
   * @param horizontal - Az/Alt coordinates
   * @param observer - Geographic position
   * @param lst - Local Sidereal Time in decimal hours
   * @returns RA/Dec coordinates
   */
  horizontalToCelestial(
    horizontal: HorizontalCoordinates,
    observer: GeographicCoordinates,
    lst: number
  ): CelestialCoordinates;

  /**
   * Converts RA from hours to degrees
   */
  raHoursToDegrees(raHours: number): number;

  /**
   * Converts RA from degrees to hours
   */
  raDegreesToHours(raDegrees: number): number;
}


/**
 * Converts degrees to radians
 */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees
 */
function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Normalizes an angle in degrees to the range [0, 360)
 */
function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Normalizes an angle in hours to the range [0, 24)
 */
function normalizeHours(hours: number): number {
  return ((hours % 24) + 24) % 24;
}

/**
 * Converts Right Ascension from decimal hours to degrees
 * @param raHours - RA in decimal hours (0 to 24)
 * @returns RA in degrees (0 to 360)
 */
export function raHoursToDegrees(raHours: number): number {
  return raHours * DEGREES_PER_HOUR;
}

/**
 * Converts Right Ascension from degrees to decimal hours
 * @param raDegrees - RA in degrees (0 to 360)
 * @returns RA in decimal hours (0 to 24)
 */
export function raDegreesToHours(raDegrees: number): number {
  return raDegrees / DEGREES_PER_HOUR;
}

/**
 * Converts celestial coordinates (RA/Dec) to horizontal coordinates (Az/Alt)
 *
 * Uses spherical trigonometry formulas:
 * - Hour Angle (HA) = LST - RA (in hours, then convert to degrees)
 * - sin(Alt) = sin(Dec) * sin(Lat) + cos(Dec) * cos(Lat) * cos(HA)
 * - cos(Az) = (sin(Dec) - sin(Alt) * sin(Lat)) / (cos(Alt) * cos(Lat))
 * - Az adjustment: if sin(HA) > 0, Az = 360 - Az
 *
 * @param celestial - RA/Dec coordinates (RA in decimal hours)
 * @param observer - Geographic position (latitude/longitude in degrees)
 * @param lst - Local Sidereal Time in decimal hours
 * @returns Azimuth/Altitude coordinates
 */
export function celestialToHorizontal(
  celestial: CelestialCoordinates,
  observer: GeographicCoordinates,
  lst: number
): HorizontalCoordinates {
  // Calculate Hour Angle in hours, then convert to degrees
  const haHours = lst - celestial.ra;
  const haDegrees = raHoursToDegrees(haHours);

  // Convert all angles to radians for trigonometric calculations
  const haRad = degreesToRadians(haDegrees);
  const decRad = degreesToRadians(celestial.dec);
  const latRad = degreesToRadians(observer.latitude);

  // Calculate altitude using spherical trigonometry
  // sin(Alt) = sin(Dec) * sin(Lat) + cos(Dec) * cos(Lat) * cos(HA)
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);

  // Clamp sinAlt to [-1, 1] to handle floating point errors
  const clampedSinAlt = Math.max(-1, Math.min(1, sinAlt));
  const altRad = Math.asin(clampedSinAlt);
  const altitude = radiansToDegrees(altRad);

  // Calculate azimuth
  // cos(Az) = (sin(Dec) - sin(Alt) * sin(Lat)) / (cos(Alt) * cos(Lat))
  const cosAlt = Math.cos(altRad);
  const cosLat = Math.cos(latRad);

  let azimuth: number;

  // Handle special case when observer is at pole or object is at zenith
  if (Math.abs(cosAlt) < 1e-10 || Math.abs(cosLat) < 1e-10) {
    // At zenith or pole, azimuth is undefined; default to 0
    azimuth = 0;
  } else {
    const cosAz = (Math.sin(decRad) - sinAlt * Math.sin(latRad)) / (cosAlt * cosLat);

    // Clamp cosAz to [-1, 1] to handle floating point errors
    const clampedCosAz = Math.max(-1, Math.min(1, cosAz));
    let azRad = Math.acos(clampedCosAz);

    // Adjust azimuth based on hour angle
    // If sin(HA) > 0, the object is west of meridian, so Az = 360 - Az
    if (Math.sin(haRad) > 0) {
      azRad = 2 * Math.PI - azRad;
    }

    azimuth = radiansToDegrees(azRad);
  }

  // Normalize azimuth to [0, 360)
  azimuth = normalizeDegrees(azimuth);

  return {
    azimuth,
    altitude,
  };
}


/**
 * Converts horizontal coordinates (Az/Alt) back to celestial coordinates (RA/Dec)
 *
 * This is the inverse operation of celestialToHorizontal, used for round-trip validation.
 *
 * Uses spherical trigonometry formulas:
 * - sin(Dec) = sin(Alt) * sin(Lat) + cos(Alt) * cos(Lat) * cos(Az)
 * - cos(HA) = (sin(Alt) - sin(Dec) * sin(Lat)) / (cos(Dec) * cos(Lat))
 * - HA adjustment: if sin(Az) > 0, HA = 360 - HA (object is west of meridian)
 * - RA = LST - HA
 *
 * @param horizontal - Az/Alt coordinates
 * @param observer - Geographic position (latitude/longitude in degrees)
 * @param lst - Local Sidereal Time in decimal hours
 * @returns RA/Dec coordinates (RA in decimal hours)
 */
export function horizontalToCelestial(
  horizontal: HorizontalCoordinates,
  observer: GeographicCoordinates,
  lst: number
): CelestialCoordinates {
  // Convert all angles to radians
  const azRad = degreesToRadians(horizontal.azimuth);
  const altRad = degreesToRadians(horizontal.altitude);
  const latRad = degreesToRadians(observer.latitude);

  // Calculate declination
  // sin(Dec) = sin(Alt) * sin(Lat) + cos(Alt) * cos(Lat) * cos(Az)
  const sinDec = Math.sin(altRad) * Math.sin(latRad) +
                 Math.cos(altRad) * Math.cos(latRad) * Math.cos(azRad);

  // Clamp sinDec to [-1, 1] to handle floating point errors
  const clampedSinDec = Math.max(-1, Math.min(1, sinDec));
  const decRad = Math.asin(clampedSinDec);
  const dec = radiansToDegrees(decRad);

  // Calculate hour angle
  // cos(HA) = (sin(Alt) - sin(Dec) * sin(Lat)) / (cos(Dec) * cos(Lat))
  const cosDec = Math.cos(decRad);
  const cosLat = Math.cos(latRad);

  let haHours: number;

  // Handle special case when observer is at pole or object is at celestial pole
  if (Math.abs(cosDec) < 1e-10 || Math.abs(cosLat) < 1e-10) {
    // At celestial pole or observer at pole, HA is undefined; default to 0
    haHours = 0;
  } else {
    const cosHA = (Math.sin(altRad) - sinDec * Math.sin(latRad)) / (cosDec * cosLat);

    // Clamp cosHA to [-1, 1] to handle floating point errors
    const clampedCosHA = Math.max(-1, Math.min(1, cosHA));
    let haRad = Math.acos(clampedCosHA);

    // Adjust hour angle based on azimuth
    // If sin(Az) > 0, the object is west of meridian, so HA should be positive
    // (HA increases westward from the meridian)
    if (Math.sin(azRad) > 0) {
      haRad = 2 * Math.PI - haRad;
    }

    const haDegrees = radiansToDegrees(haRad);
    haHours = raDegreesToHours(haDegrees);
  }

  // Calculate RA from LST and HA
  // RA = LST - HA
  const ra = normalizeHours(lst - haHours);

  return {
    ra,
    dec,
  };
}

/**
 * Coordinate Converter implementation object
 */
export const coordinateConverter: CoordinateConverter = {
  celestialToHorizontal,
  horizontalToCelestial,
  raHoursToDegrees,
  raDegreesToHours,
};

export default coordinateConverter;
