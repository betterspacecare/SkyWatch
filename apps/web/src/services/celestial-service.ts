/**
 * Celestial Service
 * Provides sun, moon, and satellite position calculations using suncalc and external APIs
 */

import SunCalc from 'suncalc';

export interface SunData {
  altitude: number; // degrees above horizon
  azimuth: number; // degrees from north
  ra: number;
  dec: number;
  status: 'daylight' | 'twilight' | 'night';
  safetyWarning: boolean;
  isBelowHorizon: boolean;
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date | null;
}

export interface MoonData {
  altitude: number;
  azimuth: number;
  ra: number;
  dec: number;
  phase: number; // 0-1
  phaseName: string;
  illumination: number; // percentage
  isBelowHorizon: boolean;
  moonrise: Date | null;
  moonset: Date | null;
  distance: number; // km
}

export interface SatelliteData {
  id: number;
  name: string;
  altitude: number;
  azimuth: number;
  ra: number;
  dec: number;
  height: number; // km above Earth
  velocity: number; // km/s
  isVisible: boolean;
  latitude: number;
  longitude: number;
}

// Moon phase names based on illumination fraction
function getMoonPhaseName(phase: number): string {
  if (phase < 0.03) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  if (phase < 0.97) return 'Waning Crescent';
  return 'New Moon';
}

// Convert azimuth from suncalc (radians from south) to degrees from north
function convertAzimuth(azimuthRad: number): number {
  // suncalc returns azimuth in radians, measured from south, clockwise
  // We need degrees from north
  let azDeg = (azimuthRad * 180 / Math.PI) + 180;
  return ((azDeg % 360) + 360) % 360;
}

// Convert altitude from radians to degrees
function convertAltitude(altitudeRad: number): number {
  return altitudeRad * 180 / Math.PI;
}

/**
 * Get sun position and data using suncalc
 */
export function getSunPosition(date: Date, latitude: number, longitude: number): SunData {
  const sunPos = SunCalc.getPosition(date, latitude, longitude);
  const sunTimes = SunCalc.getTimes(date, latitude, longitude);
  
  const altitude = convertAltitude(sunPos.altitude);
  const azimuth = convertAzimuth(sunPos.azimuth);
  
  // Determine sun status
  let status: 'daylight' | 'twilight' | 'night' = 'night';
  if (altitude > 0) {
    status = 'daylight';
  } else if (altitude > -18) {
    status = 'twilight';
  }
  
  // Calculate approximate RA/Dec (simplified)
  // For more accurate values, would need proper astronomical calculations
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const ra = ((dayOfYear / 365.25) * 24 + 12) % 24; // Rough approximation
  const dec = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
  
  return {
    altitude,
    azimuth,
    ra,
    dec,
    status,
    safetyWarning: altitude > -6, // Warning when sun is near or above horizon
    isBelowHorizon: altitude < 0,
    sunrise: sunTimes.sunrise || null,
    sunset: sunTimes.sunset || null,
    solarNoon: sunTimes.solarNoon || null,
  };
}

/**
 * Get moon position and data using suncalc
 */
export function getMoonPosition(date: Date, latitude: number, longitude: number): MoonData {
  const moonPos = SunCalc.getMoonPosition(date, latitude, longitude);
  const moonIllum = SunCalc.getMoonIllumination(date);
  const moonTimes = SunCalc.getMoonTimes(date, latitude, longitude);
  
  const altitude = convertAltitude(moonPos.altitude);
  const azimuth = convertAzimuth(moonPos.azimuth);
  
  // Calculate approximate RA/Dec from altitude/azimuth (reverse transformation)
  // This is a simplified approximation
  const latRad = latitude * Math.PI / 180;
  const altRad = altitude * Math.PI / 180;
  const azRad = azimuth * Math.PI / 180;
  
  const dec = Math.asin(
    Math.sin(altRad) * Math.sin(latRad) + 
    Math.cos(altRad) * Math.cos(latRad) * Math.cos(azRad)
  ) * 180 / Math.PI;
  
  // Simplified RA calculation
  const lst = getLocalSiderealTime(date, longitude);
  const ha = Math.atan2(
    Math.sin(azRad),
    Math.cos(azRad) * Math.sin(latRad) - Math.tan(altRad) * Math.cos(latRad)
  ) * 180 / Math.PI / 15;
  const ra = ((lst - ha) % 24 + 24) % 24;
  
  return {
    altitude,
    azimuth,
    ra,
    dec,
    phase: moonIllum.phase,
    phaseName: getMoonPhaseName(moonIllum.phase),
    illumination: moonIllum.fraction * 100,
    isBelowHorizon: altitude < 0,
    moonrise: moonTimes.rise || null,
    moonset: moonTimes.set || null,
    distance: moonPos.distance,
  };
}

/**
 * Calculate Local Sidereal Time
 */
function getLocalSiderealTime(date: Date, longitude: number): number {
  const jd = getJulianDate(date);
  const t = (jd - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 
             0.000387933 * t * t - t * t * t / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  const lst = (gmst + longitude) / 15;
  return ((lst % 24) + 24) % 24;
}

/**
 * Calculate Julian Date
 */
function getJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

// Popular satellites that are often visible (for reference)
// NORAD IDs: ISS=25544, Hubble=20580, Tiangong=43013

/**
 * Fetch ISS position from Where The ISS At API
 */
export async function getISSPosition(latitude: number, longitude: number): Promise<SatelliteData | null> {
  try {
    // Try Where The ISS At API (free, no key required)
    const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    
    if (!response.ok) {
      throw new Error('ISS API failed');
    }
    
    const data = await response.json();
    
    // Calculate altitude and azimuth from observer's position
    const issLat = data.latitude;
    const issLon = data.longitude;
    const issAlt = data.altitude; // km
    
    // Calculate observer-relative position
    const { altitude, azimuth } = calculateSatellitePosition(
      latitude, longitude, 0,
      issLat, issLon, issAlt
    );
    
    return {
      id: 25544,
      name: 'ISS (ZARYA)',
      altitude,
      azimuth,
      ra: 0, // Would need more complex calculation
      dec: 0,
      height: issAlt,
      velocity: data.velocity,
      isVisible: altitude > 10, // Visible if more than 10° above horizon
      latitude: issLat,
      longitude: issLon,
    };
  } catch (error) {
    console.warn('Failed to fetch ISS position:', error);
    return null;
  }
}

/**
 * Fetch satellite position from Where The ISS At API (supports multiple satellites)
 */
async function fetchSatelliteFromAPI(
  noradId: number, 
  name: string, 
  latitude: number, 
  longitude: number
): Promise<SatelliteData | null> {
  try {
    const response = await fetch(`https://api.wheretheiss.at/v1/satellites/${noradId}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    const satLat = data.latitude;
    const satLon = data.longitude;
    const satAlt = data.altitude; // km
    
    const { altitude, azimuth } = calculateSatellitePosition(
      latitude, longitude, 0,
      satLat, satLon, satAlt
    );
    
    return {
      id: noradId,
      name,
      altitude,
      azimuth,
      ra: 0,
      dec: 0,
      height: satAlt,
      velocity: data.velocity || 0,
      isVisible: altitude > 10,
      latitude: satLat,
      longitude: satLon,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch multiple satellites using TLE data from CelesTrak
 * This provides more satellites than the Where The ISS At API
 */
async function fetchSatellitesFromCelesTrak(
  latitude: number, 
  longitude: number
): Promise<SatelliteData[]> {
  const satellites: SatelliteData[] = [];
  
  try {
    // Fetch visual satellites TLE data
    const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json');
    
    if (!response.ok) {
      throw new Error('CelesTrak API failed');
    }
    
    const tleData = await response.json();
    
    // Process up to 20 brightest/most visible satellites
    const processedCount = Math.min(tleData.length, 20);
    
    for (let i = 0; i < processedCount; i++) {
      const sat = tleData[i];
      if (!sat) continue;
      
      // Parse TLE and calculate position
      // This is a simplified calculation - real TLE propagation would use SGP4
      const satData = parseTLEAndCalculatePosition(sat, latitude, longitude);
      if (satData && satData.altitude > -10) { // Include satellites slightly below horizon
        satellites.push(satData);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch from CelesTrak:', error);
  }
  
  return satellites;
}

/**
 * Parse TLE JSON data and calculate approximate position
 * Note: This is a simplified calculation. For accurate positions, use SGP4 propagation.
 */
function parseTLEAndCalculatePosition(
  tleJson: any,
  obsLat: number,
  obsLon: number
): SatelliteData | null {
  try {
    const noradId = tleJson.NORAD_CAT_ID;
    const name = tleJson.OBJECT_NAME;
    const inclination = tleJson.INCLINATION; // degrees
    const meanMotion = tleJson.MEAN_MOTION; // revs per day
    const meanAnomaly = tleJson.MEAN_ANOMALY; // degrees
    const argOfPericenter = tleJson.ARG_OF_PERICENTER; // degrees
    const raan = tleJson.RA_OF_ASC_NODE; // degrees
    const epoch = new Date(tleJson.EPOCH);
    
    // Calculate orbital period in minutes
    const periodMinutes = 1440 / meanMotion;
    
    // Calculate semi-major axis using Kepler's third law
    // a^3 = (GM * T^2) / (4 * pi^2)
    // For Earth: GM = 398600.4418 km^3/s^2
    const GM = 398600.4418;
    const periodSeconds = periodMinutes * 60;
    const semiMajorAxis = Math.pow((GM * periodSeconds * periodSeconds) / (4 * Math.PI * Math.PI), 1/3);
    
    // Calculate altitude (approximate - assumes circular orbit)
    const earthRadius = 6371; // km
    const height = semiMajorAxis - earthRadius;
    
    // Calculate current position (simplified - assumes circular orbit)
    const now = new Date();
    const timeSinceEpoch = (now.getTime() - epoch.getTime()) / 1000; // seconds
    const orbitsCompleted = timeSinceEpoch / periodSeconds;
    const currentMeanAnomaly = (meanAnomaly + orbitsCompleted * 360) % 360;
    
    // Convert orbital elements to lat/lon (simplified)
    const incRad = inclination * Math.PI / 180;
    const argRad = argOfPericenter * Math.PI / 180;
    const maRad = currentMeanAnomaly * Math.PI / 180;
    
    // True anomaly (for circular orbit, true anomaly ≈ mean anomaly)
    const trueAnomaly = maRad;
    
    // Argument of latitude
    const u = argRad + trueAnomaly;
    
    // Calculate satellite latitude
    const satLat = Math.asin(Math.sin(incRad) * Math.sin(u)) * 180 / Math.PI;
    
    // Calculate satellite longitude (accounting for Earth's rotation)
    const earthRotationRate = 360.98564736629 / 86400; // degrees per second
    const gmst = (280.46061837 + earthRotationRate * timeSinceEpoch) % 360;
    const satLon = (Math.atan2(Math.cos(incRad) * Math.sin(u), Math.cos(u)) * 180 / Math.PI + raan - gmst + 360) % 360;
    const normalizedSatLon = satLon > 180 ? satLon - 360 : satLon;
    
    // Calculate observer-relative position
    const { altitude, azimuth } = calculateSatellitePosition(
      obsLat, obsLon, 0,
      satLat, normalizedSatLon, height
    );
    
    // Estimate visibility based on altitude and sun position
    // Satellites are typically visible when above horizon and in Earth's shadow
    const isVisible = altitude > 15 && height > 200 && height < 2000;
    
    return {
      id: noradId,
      name: name || `SAT-${noradId}`,
      altitude,
      azimuth,
      ra: 0,
      dec: 0,
      height,
      velocity: 2 * Math.PI * semiMajorAxis / periodSeconds, // km/s
      isVisible,
      latitude: satLat,
      longitude: normalizedSatLon,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Calculate satellite position relative to observer
 */
function calculateSatellitePosition(
  obsLat: number, obsLon: number, obsAlt: number,
  satLat: number, satLon: number, satAlt: number
): { altitude: number; azimuth: number } {
  const earthRadius = 6371; // km
  
  // Convert to radians
  const obsLatRad = obsLat * Math.PI / 180;
  const obsLonRad = obsLon * Math.PI / 180;
  const satLatRad = satLat * Math.PI / 180;
  const satLonRad = satLon * Math.PI / 180;
  
  // Observer position in ECEF
  const obsR = earthRadius + obsAlt;
  const obsX = obsR * Math.cos(obsLatRad) * Math.cos(obsLonRad);
  const obsY = obsR * Math.cos(obsLatRad) * Math.sin(obsLonRad);
  const obsZ = obsR * Math.sin(obsLatRad);
  
  // Satellite position in ECEF
  const satR = earthRadius + satAlt;
  const satX = satR * Math.cos(satLatRad) * Math.cos(satLonRad);
  const satY = satR * Math.cos(satLatRad) * Math.sin(satLonRad);
  const satZ = satR * Math.sin(satLatRad);
  
  // Vector from observer to satellite
  const dx = satX - obsX;
  const dy = satY - obsY;
  const dz = satZ - obsZ;
  
  // Convert to topocentric (ENU) coordinates
  const east = -Math.sin(obsLonRad) * dx + Math.cos(obsLonRad) * dy;
  const north = -Math.sin(obsLatRad) * Math.cos(obsLonRad) * dx 
              - Math.sin(obsLatRad) * Math.sin(obsLonRad) * dy 
              + Math.cos(obsLatRad) * dz;
  const up = Math.cos(obsLatRad) * Math.cos(obsLonRad) * dx 
           + Math.cos(obsLatRad) * Math.sin(obsLonRad) * dy 
           + Math.sin(obsLatRad) * dz;
  
  // Calculate altitude and azimuth
  const range = Math.sqrt(east * east + north * north + up * up);
  const altitude = Math.asin(up / range) * 180 / Math.PI;
  let azimuth = Math.atan2(east, north) * 180 / Math.PI;
  azimuth = ((azimuth % 360) + 360) % 360;
  
  return { altitude, azimuth };
}

/**
 * Fetch multiple satellites - combines ISS API with CelesTrak data
 */
export async function getVisibleSatellites(latitude: number, longitude: number): Promise<SatelliteData[]> {
  const satellites: SatelliteData[] = [];
  const seenIds = new Set<number>();
  
  // First, try to get ISS from the reliable Where The ISS At API
  const iss = await getISSPosition(latitude, longitude);
  if (iss) {
    satellites.push(iss);
    seenIds.add(iss.id);
  }
  
  // Try to fetch additional satellites from CelesTrak
  try {
    const celestrakSatellites = await fetchSatellitesFromCelesTrak(latitude, longitude);
    for (const sat of celestrakSatellites) {
      if (!seenIds.has(sat.id)) {
        satellites.push(sat);
        seenIds.add(sat.id);
      }
    }
  } catch (error) {
    console.warn('CelesTrak fetch failed:', error);
  }
  
  // If CelesTrak failed, try fetching known satellites from Where The ISS At API
  if (satellites.length < 3) {
    const additionalSatellites = [
      { id: 43013, name: 'Tiangong (CSS)' }, // Chinese Space Station
      { id: 20580, name: 'Hubble Space Telescope' },
    ];
    
    for (const sat of additionalSatellites) {
      if (!seenIds.has(sat.id)) {
        const satData = await fetchSatelliteFromAPI(sat.id, sat.name, latitude, longitude);
        if (satData) {
          satellites.push(satData);
          seenIds.add(sat.id);
        }
      }
    }
  }
  
  // Sort by altitude (highest first) and return top 15
  satellites.sort((a, b) => b.altitude - a.altitude);
  
  console.log(`🛰️ Fetched ${satellites.length} satellites`);
  satellites.slice(0, 5).forEach(sat => {
    console.log(`  - ${sat.name}: alt=${sat.altitude.toFixed(1)}°, az=${sat.azimuth.toFixed(1)}°, height=${sat.height.toFixed(0)}km, visible=${sat.isVisible}`);
  });
  
  return satellites.slice(0, 15);
}
