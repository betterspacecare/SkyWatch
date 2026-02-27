/**
 * LST_Calculator - Local Sidereal Time Calculator
 *
 * Computes Local Sidereal Time from geographic position and UTC timestamp.
 * Uses Julian Date calculations for accurate sidereal time computation.
 *
 * @module lst-calculator
 */

/**
 * Astronomical constants for LST calculations
 */
const ASTRONOMY_CONSTANTS = {
  /** Julian date of J2000.0 epoch (January 1, 2000, 12:00 TT) */
  J2000: 2451545.0,

  /** Days per Julian century */
  DAYS_PER_CENTURY: 36525,

  /** Sidereal day in solar hours */
  SIDEREAL_DAY_HOURS: 23.9344696,

  /** Degrees per hour of RA */
  DEGREES_PER_HOUR: 15,
};

/**
 * Interface for the LST Calculator
 */
export interface LSTCalculator {
  /**
   * Computes Local Sidereal Time from geographic position and UTC timestamp
   * @param longitude - Observer longitude in degrees (-180 to +180)
   * @param timestamp - UTC timestamp (Date object or ISO string)
   * @returns LST as decimal hours [0, 24)
   */
  calculateLST(longitude: number, timestamp: Date | string): number;

  /**
   * Converts LST back to approximate UTC (for round-trip validation)
   * @param lst - Local Sidereal Time in decimal hours
   * @param longitude - Observer longitude in degrees
   * @param referenceDate - Reference date for calculation
   * @returns Approximate UTC timestamp
   */
  lstToUTC(lst: number, longitude: number, referenceDate: Date): Date;
}

/**
 * Converts a Date object to Julian Date
 * @param date - The date to convert
 * @returns Julian Date as a number
 */
function dateToJulianDate(date: Date): number {
  const time = date.getTime();
  // Julian Date at Unix epoch (January 1, 1970, 00:00:00 UTC)
  const JD_UNIX_EPOCH = 2440587.5;
  // Convert milliseconds to days and add to Unix epoch JD
  return JD_UNIX_EPOCH + time / (24 * 60 * 60 * 1000);
}

/**
 * Converts Julian Date back to a Date object
 * @param jd - Julian Date
 * @returns Date object
 */
function julianDateToDate(jd: number): Date {
  const JD_UNIX_EPOCH = 2440587.5;
  const milliseconds = (jd - JD_UNIX_EPOCH) * 24 * 60 * 60 * 1000;
  return new Date(milliseconds);
}

/**
 * Calculates Greenwich Mean Sidereal Time (GMST) from Julian Date
 * Uses the IAU formula for GMST
 * @param jd - Julian Date
 * @returns GMST in decimal hours [0, 24)
 */
function calculateGMST(jd: number): number {
  // Calculate Julian centuries since J2000.0
  const T = (jd - ASTRONOMY_CONSTANTS.J2000) / ASTRONOMY_CONSTANTS.DAYS_PER_CENTURY;

  // GMST at 0h UT in degrees (IAU 1982 formula)
  // GMST = 280.46061837 + 360.98564736629 * (JD - 2451545.0)
  //        + 0.000387933 * T^2 - T^3 / 38710000
  const D = jd - ASTRONOMY_CONSTANTS.J2000;
  let gmstDegrees =
    280.46061837 +
    360.98564736629 * D +
    0.000387933 * T * T -
    (T * T * T) / 38710000;

  // Normalize to [0, 360) degrees
  gmstDegrees = ((gmstDegrees % 360) + 360) % 360;

  // Convert to hours [0, 24)
  return gmstDegrees / ASTRONOMY_CONSTANTS.DEGREES_PER_HOUR;
}

/**
 * Normalizes an angle in hours to the range [0, 24)
 * @param hours - Angle in hours
 * @returns Normalized angle in hours [0, 24)
 */
function normalizeHours(hours: number): number {
  return ((hours % 24) + 24) % 24;
}

/**
 * Calculates Local Sidereal Time from longitude and UTC timestamp
 *
 * LST = GMST + longitude/15
 * where longitude is in degrees and the result is in hours
 *
 * @param longitude - Observer longitude in degrees (-180 to +180)
 * @param timestamp - UTC timestamp (Date object or ISO string)
 * @returns LST as decimal hours [0, 24)
 */
export function calculateLST(longitude: number, timestamp: Date | string): number {
  // Parse timestamp if it's a string
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  // Convert to Julian Date
  const jd = dateToJulianDate(date);

  // Calculate GMST
  const gmst = calculateGMST(jd);

  // Calculate LST by adding longitude offset
  // Longitude is in degrees, convert to hours (15 degrees = 1 hour)
  const longitudeHours = longitude / ASTRONOMY_CONSTANTS.DEGREES_PER_HOUR;
  const lst = gmst + longitudeHours;

  // Normalize to [0, 24)
  return normalizeHours(lst);
}

/**
 * Converts Local Sidereal Time back to approximate UTC
 *
 * This is the inverse operation of calculateLST, used for round-trip validation.
 * Note: Due to the nature of sidereal time, there can be multiple UTC times
 * that correspond to the same LST on different days. This function returns
 * the UTC time closest to the reference date.
 *
 * @param lst - Local Sidereal Time in decimal hours [0, 24)
 * @param longitude - Observer longitude in degrees (-180 to +180)
 * @param referenceDate - Reference date for calculation
 * @returns Approximate UTC timestamp
 */
export function lstToUTC(lst: number, longitude: number, referenceDate: Date): Date {
  // Calculate the GMST that corresponds to this LST
  const longitudeHours = longitude / ASTRONOMY_CONSTANTS.DEGREES_PER_HOUR;
  const targetGMST = normalizeHours(lst - longitudeHours);

  // Get the Julian Date for the reference date
  const refJD = dateToJulianDate(referenceDate);

  // Calculate GMST at the reference date
  const refGMST = calculateGMST(refJD);

  // Calculate the difference in sidereal hours
  let gmstDiff = targetGMST - refGMST;

  // Normalize the difference to [-12, 12) hours for finding closest time
  if (gmstDiff > 12) {
    gmstDiff -= 24;
  } else if (gmstDiff <= -12) {
    gmstDiff += 24;
  }

  // Convert sidereal hours difference to solar time
  // Sidereal day is ~23.9344696 solar hours
  // So 1 sidereal hour = 23.9344696/24 solar hours
  const solarHoursDiff = gmstDiff * (ASTRONOMY_CONSTANTS.SIDEREAL_DAY_HOURS / 24);

  // Calculate the target Julian Date
  const targetJD = refJD + solarHoursDiff / 24;

  // Convert back to Date
  return julianDateToDate(targetJD);
}

/**
 * LST Calculator implementation object
 */
export const lstCalculator: LSTCalculator = {
  calculateLST,
  lstToUTC,
};

export default lstCalculator;
