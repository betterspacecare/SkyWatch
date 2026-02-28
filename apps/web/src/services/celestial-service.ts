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
    // Try Where The ISS At API (free, no key required) with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
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
    // Silently fail - ISS tracking is optional
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
 * Fetch visible satellites - uses ISS API only (CelesTrak has CORS/timeout issues)
 */
export async function getVisibleSatellites(latitude: number, longitude: number): Promise<SatelliteData[]> {
  const satellites: SatelliteData[] = [];
  
  // Get ISS from the reliable Where The ISS At API
  const iss = await getISSPosition(latitude, longitude);
  if (iss) {
    satellites.push(iss);
  }
  
  // Note: CelesTrak API has persistent CORS/timeout issues from browsers
  // For more satellites, would need a backend proxy or N2YO API (requires key)
  
  return satellites;
}


/**
 * Meteor Shower Data
 */
export interface MeteorShowerData {
  id: string;
  name: string;
  peakDate: string;
  startDate: string;
  endDate: string;
  zhr: number; // Zenithal Hourly Rate
  radiantRa: number;
  radiantDec: number;
  radiantAlt?: number;
  radiantAz?: number;
  velocity: number; // km/s
  parentBody: string;
  isActive: boolean;
  description: string;
}

// Major meteor showers data (static - these are predictable annual events)
const METEOR_SHOWERS: Omit<MeteorShowerData, 'isActive' | 'radiantAlt' | 'radiantAz'>[] = [
  {
    id: 'quadrantids',
    name: 'Quadrantids',
    peakDate: '01-03',
    startDate: '12-28',
    endDate: '01-12',
    zhr: 120,
    radiantRa: 15.33, // hours
    radiantDec: 49.5,
    velocity: 41,
    parentBody: 'Asteroid 2003 EH1',
    description: 'One of the best annual showers with bright meteors'
  },
  {
    id: 'lyrids',
    name: 'Lyrids',
    peakDate: '04-22',
    startDate: '04-16',
    endDate: '04-25',
    zhr: 18,
    radiantRa: 18.07,
    radiantDec: 34,
    velocity: 49,
    parentBody: 'Comet C/1861 G1 Thatcher',
    description: 'Ancient shower observed for 2700 years'
  },
  {
    id: 'eta-aquariids',
    name: 'Eta Aquariids',
    peakDate: '05-06',
    startDate: '04-19',
    endDate: '05-28',
    zhr: 50,
    radiantRa: 22.33,
    radiantDec: -1,
    velocity: 66,
    parentBody: 'Comet 1P/Halley',
    description: 'Best viewed from Southern Hemisphere'
  },
  {
    id: 'delta-aquariids',
    name: 'Delta Aquariids',
    peakDate: '07-30',
    startDate: '07-12',
    endDate: '08-23',
    zhr: 20,
    radiantRa: 22.67,
    radiantDec: -16,
    velocity: 41,
    parentBody: 'Comet 96P/Machholz',
    description: 'Steady shower best seen from southern latitudes'
  },
  {
    id: 'perseids',
    name: 'Perseids',
    peakDate: '08-12',
    startDate: '07-17',
    endDate: '08-24',
    zhr: 100,
    radiantRa: 3.07,
    radiantDec: 58,
    velocity: 59,
    parentBody: 'Comet 109P/Swift-Tuttle',
    description: 'Most popular shower with bright, fast meteors'
  },
  {
    id: 'orionids',
    name: 'Orionids',
    peakDate: '10-21',
    startDate: '10-02',
    endDate: '11-07',
    zhr: 20,
    radiantRa: 6.33,
    radiantDec: 16,
    velocity: 66,
    parentBody: 'Comet 1P/Halley',
    description: 'Fast meteors from Halley\'s Comet debris'
  },
  {
    id: 'leonids',
    name: 'Leonids',
    peakDate: '11-17',
    startDate: '11-06',
    endDate: '11-30',
    zhr: 15,
    radiantRa: 10.13,
    radiantDec: 22,
    velocity: 71,
    parentBody: 'Comet 55P/Tempel-Tuttle',
    description: 'Can produce meteor storms every 33 years'
  },
  {
    id: 'geminids',
    name: 'Geminids',
    peakDate: '12-14',
    startDate: '12-04',
    endDate: '12-17',
    zhr: 150,
    radiantRa: 7.47,
    radiantDec: 33,
    velocity: 35,
    parentBody: 'Asteroid 3200 Phaethon',
    description: 'Best annual shower with slow, bright meteors'
  },
  {
    id: 'ursids',
    name: 'Ursids',
    peakDate: '12-22',
    startDate: '12-17',
    endDate: '12-26',
    zhr: 10,
    radiantRa: 14.47,
    radiantDec: 76,
    velocity: 33,
    parentBody: 'Comet 8P/Tuttle',
    description: 'Modest shower near winter solstice'
  }
];

/**
 * Get active and upcoming meteor showers
 */
export function getMeteorShowers(latitude: number, longitude: number, date: Date = new Date()): MeteorShowerData[] {
  const currentMonth = date.getMonth() + 1;
  const currentDay = date.getDate();
  const currentMMDD = `${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
  
  // Calculate LST for radiant position
  const lst = getLocalSiderealTime(date, longitude);
  const latRad = (latitude * Math.PI) / 180;
  
  return METEOR_SHOWERS.map(shower => {
    // Parse dates (handle year wrap for showers spanning Dec-Jan)
    let startMMDD = shower.startDate;
    let endMMDD = shower.endDate;
    
    // Check if shower is active
    let isActive = false;
    if (startMMDD > endMMDD) {
      // Shower spans year boundary (e.g., Quadrantids: Dec 28 - Jan 12)
      isActive = currentMMDD >= startMMDD || currentMMDD <= endMMDD;
    } else {
      isActive = currentMMDD >= startMMDD && currentMMDD <= endMMDD;
    }
    
    // Calculate radiant altitude and azimuth
    const haHours = lst - shower.radiantRa;
    const haDegrees = haHours * 15;
    const haRadians = (haDegrees * Math.PI) / 180;
    const decRad = (shower.radiantDec * Math.PI) / 180;
    
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + 
                   Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRadians);
    const radiantAlt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    
    const cosAlt = Math.cos(radiantAlt * Math.PI / 180);
    let radiantAz = 0;
    if (Math.abs(cosAlt) > 1e-10) {
      const cosAz = (Math.sin(decRad) - sinAlt * Math.sin(latRad)) / (cosAlt * Math.cos(latRad));
      let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
      if (Math.sin(haRadians) > 0) azRad = 2 * Math.PI - azRad;
      radiantAz = azRad * 180 / Math.PI;
    }
    
    return {
      ...shower,
      isActive,
      radiantAlt,
      radiantAz,
    };
  }).sort((a, b) => {
    // Sort: active first, then by peak date
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return a.peakDate.localeCompare(b.peakDate);
  });
}

/**
 * Get currently active meteor showers only
 */
export function getActiveMeteorShowers(latitude: number, longitude: number, date: Date = new Date()): MeteorShowerData[] {
  return getMeteorShowers(latitude, longitude, date).filter(s => s.isActive);
}

/**
 * Satellite pass prediction data
 */
export interface SatellitePass {
  satellite: string;
  startTime: Date;
  startAz: number;
  startAlt: number;
  maxTime: Date;
  maxAz: number;
  maxAlt: number;
  endTime: Date;
  endAz: number;
  endAlt: number;
  magnitude: number;
  duration: number; // seconds
}

/**
 * Get upcoming ISS passes for a location
 * Uses Open Notify API (free, no key required)
 */
export async function getISSPasses(latitude: number, longitude: number, count: number = 5): Promise<SatellitePass[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `http://api.open-notify.org/iss-pass.json?lat=${latitude}&lon=${longitude}&n=${count}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    if (data.message !== 'success' || !data.response) return [];
    
    return data.response.map((pass: any) => ({
      satellite: 'ISS',
      startTime: new Date(pass.risetime * 1000),
      startAz: 0, // API doesn't provide detailed azimuth
      startAlt: 10,
      maxTime: new Date((pass.risetime + pass.duration / 2) * 1000),
      maxAz: 180,
      maxAlt: 45, // Approximate
      endTime: new Date((pass.risetime + pass.duration) * 1000),
      endAz: 360,
      endAlt: 10,
      magnitude: -3.5, // ISS typical magnitude
      duration: pass.duration,
    }));
  } catch {
    return [];
  }
}

/**
 * Get number of people currently in space
 */
export async function getPeopleInSpace(): Promise<{ number: number; people: { name: string; craft: string }[] } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('http://api.open-notify.org/astros.json', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.message !== 'success') return null;
    
    return {
      number: data.number,
      people: data.people,
    };
  } catch {
    return null;
  }
}
