/**
 * Astronomy API Service
 * Fetches celestial data from Astronomy API with fallback to local catalog
 */

import type { Star, Constellation, SpectralType } from '@virtual-window/astronomy-engine';
import { createDefaultStarCatalog } from '@virtual-window/astronomy-engine';

/**
 * Astronomy API configuration
 * Get your free API key from https://astronomyapi.com
 */
const ASTRONOMY_API_CONFIG = {
  applicationId: process.env.NEXT_PUBLIC_ASTRONOMY_API_ID || '',
  applicationSecret: process.env.NEXT_PUBLIC_ASTRONOMY_API_SECRET || '',
  baseUrl: 'https://api.astronomyapi.com/api/v2',
};

/**
 * Check if Astronomy API is configured
 */
function isAstronomyAPIConfigured(): boolean {
  return !!(ASTRONOMY_API_CONFIG.applicationId && ASTRONOMY_API_CONFIG.applicationSecret);
}

/**
 * Creates Basic Auth header for Astronomy API
 * Returns null if credentials are not configured
 */
function getAstronomyAPIAuthHeader(): string | null {
  const { applicationId, applicationSecret } = ASTRONOMY_API_CONFIG;
  if (!applicationId || !applicationSecret) {
    return null;
  }
  const credentials = `${applicationId}:${applicationSecret}`;
  const encoded = typeof window !== 'undefined' 
    ? btoa(credentials) 
    : Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Fetches star data from Astronomy API by HIP ID
 * Exported for potential future use
 */
export async function fetchStarFromAstronomyAPI(hipId: number): Promise<{ ra: number; dec: number; name?: string } | null> {
  try {
    const authHeader = getAstronomyAPIAuthHeader();
    if (!authHeader) return null;
    
    const searchTerm = `HIP ${hipId}`;
    
    const url = `${ASTRONOMY_API_CONFIG.baseUrl}/search?term=${encodeURIComponent(searchTerm)}&match=exact&limit=1`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const star = data.data[0];
      if (star.position?.equatorial) {
        // Astronomy API returns RA in hours (as string)
        const ra = parseFloat(star.position.equatorial.rightAscension.hours);
        const dec = parseFloat(star.position.equatorial.declination.degrees);
        const name = star.name || undefined;
        return { ra, dec, name };
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`⚠️  Error fetching HIP ${hipId} from Astronomy API:`, error);
    return null;
  }
}

/**
 * Fetches constellation data and star coordinates from static database
 * Returns both constellations and the stars needed to render them
 * 
 * This uses a pre-built static database from the HYG catalog (v4.2)
 * which eliminates API calls and provides instant loading.
 */
export async function fetchConstellationsWithStars(): Promise<{
  constellations: Constellation[];
  stars: Star[];
}> {
  try {
    // Load constellation structure
    const constellationsResponse = await fetch('/data/constellations.json');
    if (!constellationsResponse.ok) {
      throw new Error(`Failed to fetch constellations: ${constellationsResponse.status}`);
    }
    const rawConstellations = await constellationsResponse.json();
    
    // Load constellation star database
    const constellationStarsResponse = await fetch('/data/constellation-stars.json');
    if (!constellationStarsResponse.ok) {
      throw new Error(`Failed to fetch constellation star database: ${constellationStarsResponse.status}`);
    }
    const constellationStarDatabase = await constellationStarsResponse.json();
    
    // Load bright stars database
    const brightStarsResponse = await fetch('/data/bright-stars.json');
    if (!brightStarsResponse.ok) {
      console.warn('⚠️  Failed to fetch bright stars database, using constellation stars only');
    }
    const brightStarsDatabase = brightStarsResponse.ok ? await brightStarsResponse.json() : null;
    
    // Build star map from constellation stars
    const starCoords = new Map<number, { ra: number; dec: number; mag: number; name: string }>();
    const stars: Star[] = [];
    
    // Add constellation stars first
    for (const [hipIdStr, starData] of Object.entries(constellationStarDatabase.stars)) {
      const hipId = parseInt(hipIdStr);
      const data = starData as { ra: number; dec: number; mag: number; name: string };
      
      starCoords.set(hipId, data);
      stars.push({
        id: `HIP${hipId}`,
        name: data.name || null,
        ra: data.ra,
        dec: data.dec,
        magnitude: data.mag,
        spectralType: 'G' as SpectralType
      });
    }
    
    // Add bright stars (avoiding duplicates)
    if (brightStarsDatabase) {
      let addedCount = 0;
      for (const starData of brightStarsDatabase.stars) {
        // Skip if already in constellation stars
        if (starData.hipId && starCoords.has(starData.hipId)) continue;
        
        stars.push({
          id: starData.id,
          name: starData.name || null,
          ra: starData.ra,
          dec: starData.dec,
          magnitude: starData.mag,
          spectralType: starData.spectralType as SpectralType
        });
        addedCount++;
      }
    }
    
    // Build constellations using star coordinates
    const constellations: Constellation[] = rawConstellations.map((c: any) => ({
      id: c.id,
      name: c.name,
      lines: c.lines.map((line: any) => {
        const star1Coords = starCoords.get(line.star1.hipId);
        const star2Coords = starCoords.get(line.star2.hipId);
        
        return {
          star1: {
            hipId: line.star1.hipId,
            ra: star1Coords ? star1Coords.ra : 0,
            dec: star1Coords ? star1Coords.dec : 0
          },
          star2: {
            hipId: line.star2.hipId,
            ra: star2Coords ? star2Coords.ra : 0,
            dec: star2Coords ? star2Coords.dec : 0
          }
        };
      }),
      centerRA: c.centerRA / 15,
      centerDec: c.centerDec
    }));
    
    return { constellations, stars };
    
  } catch (error) {
    return { constellations: [], stars: [] };
  }
}

/**
 * Fetches a single constellation by ID
 */
export async function fetchConstellation(id: string): Promise<Constellation | null> {
  try {
    const { constellations } = await fetchConstellationsWithStars();
    return constellations.find((c: Constellation) => c.id === id.toLowerCase()) || null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetches stars using Astronomy API with fallback to local catalog
 */
export async function fetchStars(options?: {
  limit?: number;
  maxMagnitude?: number;
  hipIds?: number[];
}): Promise<Star[]> {
  const useAstronomyAPI = isAstronomyAPIConfigured();
  
  // Try Astronomy API first for general star queries
  if (useAstronomyAPI && !options?.hipIds) {
    try {
      const authHeader = getAstronomyAPIAuthHeader();
      if (!authHeader) return [];
      
      const stars: Star[] = [];
      
      // Search for bright stars using the search endpoint
      // We'll search for common bright star names and constellations
      const brightStarNames = [
        'Sirius', 'Canopus', 'Arcturus', 'Vega', 'Capella', 'Rigel', 'Procyon', 'Achernar',
        'Betelgeuse', 'Hadar', 'Altair', 'Aldebaran', 'Antares', 'Spica', 'Pollux', 'Fomalhaut',
        'Deneb', 'Regulus', 'Adhara', 'Castor', 'Shaula', 'Bellatrix', 'Elnath', 'Miaplacidus',
        'Alnilam', 'Alnitak', 'Alnair', 'Alioth', 'Mirfak', 'Dubhe', 'Wezen', 'Alkaid',
        'Sargas', 'Avior', 'Menkalinan', 'Atria', 'Alhena', 'Peacock', 'Mirzam', 'Alphard',
        'Polaris', 'Hamal', 'Algieba', 'Diphda', 'Mizar', 'Nunki', 'Kaus Australis', 'Alpheratz',
        'Mirach', 'Ankaa', 'Scheat', 'Alderamin', 'Enif', 'Saiph', 'Kochab', 'Rasalhague',
        'Algol', 'Almach', 'Denebola', 'Gacrux', 'Gienah', 'Acrux', 'Mimosa', 'Shaula'
      ];
      
      // Fetch in batches
      const batchSize = 10;
      const limit = options?.limit || 100;
      
      for (let i = 0; i < Math.min(brightStarNames.length, limit) && stars.length < limit; i += batchSize) {
        const batch = brightStarNames.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (starName) => {
          try {
            const url = `${ASTRONOMY_API_CONFIG.baseUrl}/search?term=${encodeURIComponent(starName)}&match=fuzzy&limit=1`;
            
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              
              if (data.data && data.data.length > 0) {
                const starData = data.data[0];
                if (starData.position?.equatorial) {
                  const ra = parseFloat(starData.position.equatorial.rightAscension.hours);
                  const dec = parseFloat(starData.position.equatorial.declination.degrees);
                  
                  // Extract HIP ID if available
                  const hipMatch = starData.id?.match(/HIP\s*(\d+)/i);
                  const id = hipMatch ? `HIP${hipMatch[1]}` : `STAR${stars.length}`;
                  
                  return {
                    id,
                    name: starData.name || starName,
                    ra,
                    dec,
                    magnitude: 5.0, // Default - API doesn't always provide magnitude
                    spectralType: 'G' as SpectralType
                  };
                }
              }
            }
          } catch (error) {
            // Continue silently
          }
          return null;
        });
        
        const batchResults = await Promise.all(batchPromises);
        const validStars = batchResults.filter((s): s is Star => s !== null);
        stars.push(...validStars);
        
        // Rate limiting between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return stars;
      
    } catch (error) {
      // Fall through to next option
    }
  }
  
  if (useAstronomyAPI && options?.hipIds && options.hipIds.length > 0) {
    // Use Astronomy API for specific HIP IDs
    try {
      const authHeader = getAstronomyAPIAuthHeader();
      if (!authHeader) return [];
      
      const stars: Star[] = [];
      
      // Fetch in batches to respect rate limits
      const batchSize = 10;
      for (let i = 0; i < options.hipIds.length; i += batchSize) {
        const batch = options.hipIds.slice(i, i + batchSize);
        
        for (const hipId of batch) {
          const searchTerm = `HIP ${hipId}`;
          const url = `${ASTRONOMY_API_CONFIG.baseUrl}/search?term=${encodeURIComponent(searchTerm)}&match=exact&limit=1`;
          
          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              
              if (data.data && data.data.length > 0) {
                const starData = data.data[0];
                if (starData.position?.equatorial) {
                  const ra = parseFloat(starData.position.equatorial.rightAscension.hours);
                  const dec = parseFloat(starData.position.equatorial.declination.degrees);
                  
                  stars.push({
                    id: `HIP${hipId}`,
                    name: starData.name || null,
                    ra,
                    dec,
                    magnitude: 5.0, // Default
                    spectralType: 'G' as SpectralType
                  });
                }
              }
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            // Continue silently
          }
        }
      }
      
      return stars;
      
    } catch (error) {
      // Fall through to fallback
    }
  }
  
  // Use local catalog as fallback - but it's currently not available
  // Return empty array instead of failing
  return [];
}
/**
 * Fetches celestial bodies (sun, moon, planets) from Astronomy API
 * Returns positions for all bodies at the current time
 */
export async function fetchBodiesFromAstronomyAPI(
  observer: { latitude: number; longitude: number; elevation?: number },
  date: Date
): Promise<{
  sun: { ra: number; dec: number; magnitude: number; distance: number } | null;
  moon: { ra: number; dec: number; magnitude: number; phase: number; distance: number } | null;
  planets: Array<{ name: string; ra: number; dec: number; magnitude: number; distance: number }>;
}> {
  const authHeader = getAstronomyAPIAuthHeader();
  if (!authHeader) {
    // Return empty result when API is not configured - caller will use fallback
    throw new Error('Astronomy API not configured');
  }
  
  try {
    // Format date and time separately as the API requires
    // from_date/to_date: YYYY-MM-DD format
    // time: HH:MM:SS format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours}:${minutes}:${seconds}`;
    
    // Build query parameters - API expects specific format
    const params = new URLSearchParams({
      latitude: observer.latitude.toString(),
      longitude: observer.longitude.toString(),
      elevation: (observer.elevation || 0).toString(),
      from_date: dateStr,
      to_date: dateStr,
      time: timeStr,
    });
    
    const url = `${ASTRONOMY_API_CONFIG.baseUrl}/bodies/positions?${params}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse response - API returns table format with rows
    const rows = data.data?.table?.rows || [];
    
    let sun = null;
    let moon = null;
    const planets: Array<{ name: string; ra: number; dec: number; magnitude: number; distance: number }> = [];
    
    for (const row of rows) {
      const bodyId = row.entry?.id;
      const bodyName = row.entry?.name;
      const cells = row.cells || [];
      
      // Get first cell (current time)
      if (cells.length === 0) continue;
      const cell = cells[0];
      
      const ra = parseFloat(cell.position?.equatorial?.rightAscension?.hours || '0');
      const dec = parseFloat(cell.position?.equatorial?.declination?.degrees || '0');
      const magnitude = parseFloat(cell.extraInfo?.magnitude || '0');
      const distanceAU = parseFloat(cell.distance?.fromEarth?.au || '0');
      
      if (bodyId === 'sun') {
        sun = { ra, dec, magnitude, distance: distanceAU };
      } else if (bodyId === 'moon') {
        const phase = parseFloat(cell.extraInfo?.phase?.fraction || '0');
        moon = { ra, dec, magnitude, phase, distance: distanceAU };
      } else if (['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(bodyId)) {
        planets.push({
          name: bodyName,
          ra,
          dec,
          magnitude,
          distance: distanceAU,
        });
      }
    }
    
    return { sun, moon, planets };
    
  } catch (error) {
    throw error;
  }
}

/**
 * Preload the star catalog for offline use
 */
export async function preloadStarCatalog(): Promise<void> {
  try {
    const catalog = createDefaultStarCatalog();
    await catalog.initialize();
  } catch (error) {
    // Silently fail - catalog preload is optional
  }
}
