/**
 * Geographic Coordinate Validation Module
 *
 * Provides validation functions for geographic coordinates (latitude/longitude)
 * and ensures precision preservation to 4 decimal places.
 *
 * Requirements:
 * - 2.2: Accept latitude values between -90 and +90 degrees
 * - 2.3: Accept longitude values between -180 and +180 degrees
 * - 2.5: Store coordinates with at least 4 decimal places of precision
 */

import type { GeographicCoordinates } from './index';

/**
 * Rounds a number to the specified number of decimal places.
 * @param value - The number to round
 * @param places - Number of decimal places (default: 4)
 * @returns The rounded number
 */
export function roundToDecimalPlaces(value: number, places: number = 4): number {
  const multiplier = Math.pow(10, places);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Validates if a latitude value is within the valid range [-90, +90].
 * @param lat - Latitude value in degrees
 * @returns true if latitude is valid, false otherwise
 */
export function isValidLatitude(lat: number): boolean {
  if (typeof lat !== 'number' || !Number.isFinite(lat)) {
    return false;
  }
  return lat >= -90 && lat <= 90;
}

/**
 * Validates if a longitude value is within the valid range [-180, +180].
 * @param lon - Longitude value in degrees
 * @returns true if longitude is valid, false otherwise
 */
export function isValidLongitude(lon: number): boolean {
  if (typeof lon !== 'number' || !Number.isFinite(lon)) {
    return false;
  }
  return lon >= -180 && lon <= 180;
}

/**
 * Validates if geographic coordinates are within valid ranges.
 * @param coords - Geographic coordinates to validate
 * @returns true if both latitude and longitude are valid, false otherwise
 */
export function isValidGeographicCoordinates(coords: GeographicCoordinates): boolean {
  if (!coords || typeof coords !== 'object') {
    return false;
  }
  return isValidLatitude(coords.latitude) && isValidLongitude(coords.longitude);
}

/**
 * Validates and normalizes geographic coordinates with 4 decimal places precision.
 * @param coords - Geographic coordinates to validate and normalize
 * @returns Normalized coordinates with 4 decimal precision, or null if invalid
 */
export function validateAndNormalizeCoordinates(
  coords: GeographicCoordinates
): GeographicCoordinates | null {
  if (!isValidGeographicCoordinates(coords)) {
    return null;
  }

  return {
    latitude: roundToDecimalPlaces(coords.latitude, 4),
    longitude: roundToDecimalPlaces(coords.longitude, 4),
  };
}

/**
 * Geographic validation interface for dependency injection
 */
export interface GeoValidator {
  isValidLatitude(lat: number): boolean;
  isValidLongitude(lon: number): boolean;
  isValidGeographicCoordinates(coords: GeographicCoordinates): boolean;
  validateAndNormalizeCoordinates(coords: GeographicCoordinates): GeographicCoordinates | null;
  roundToDecimalPlaces(value: number, places?: number): number;
}

/**
 * Default geo validator instance
 */
export const geoValidator: GeoValidator = {
  isValidLatitude,
  isValidLongitude,
  isValidGeographicCoordinates,
  validateAndNormalizeCoordinates,
  roundToDecimalPlaces,
};
