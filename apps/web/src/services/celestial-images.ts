/**
 * Celestial Object Image Service
 * Provides actual astronomical images for celestial objects using multiple APIs
 */

export interface CelestialImage {
  url: string;
  credit: string;
  title: string;
  thumbnail?: string;
}

// NASA Image and Video Library API (no API key required)
const NASA_IMAGES_API = 'https://images-api.nasa.gov';

// Fallback high-quality images for popular Messier objects
const MESSIER_FALLBACK: Record<string, { url: string; credit: string }> = {
  'M31': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/1280px-Andromeda_Galaxy_%28with_h-alpha%29.jpg', credit: 'Adam Evans/Wikimedia' },
  'M42': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/1280px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg', credit: 'NASA/ESA/Hubble' },
  'M45': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Pleiades_large.jpg/1280px-Pleiades_large.jpg', credit: 'NASA/ESA/AURA/Caltech' },
  'M51': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Messier51_sRGB.jpg/1280px-Messier51_sRGB.jpg', credit: 'NASA/ESA/Hubble' },
  'M101': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/M101_hires_STScI-PRC2006-10a.jpg/1280px-M101_hires_STScI-PRC2006-10a.jpg', credit: 'NASA/ESA/Hubble' },
  'M104': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/M104_ngc4594_sombrero_galaxy_hi-res.jpg/1280px-M104_ngc4594_sombrero_galaxy_hi-res.jpg', credit: 'NASA/ESA/Hubble' },
  'M1': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Crab_Nebula.jpg/1024px-Crab_Nebula.jpg', credit: 'NASA/ESA/Hubble' },
  'M13': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Messier_13_Hubble_WikiSky.jpg/1024px-Messier_13_Hubble_WikiSky.jpg', credit: 'NASA/ESA/Hubble' },
  'M57': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/M57_The_Ring_Nebula.JPG/1024px-M57_The_Ring_Nebula.JPG', credit: 'NASA/ESA/Hubble' },
  'M16': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Eagle_nebula_pillars.jpg/800px-Eagle_nebula_pillars.jpg', credit: 'NASA/ESA/Hubble' },
  'M27': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Dumbbell_Nebula_from_the_Mount_Lemmon_SkyCenter.jpg/1024px-Dumbbell_Nebula_from_the_Mount_Lemmon_SkyCenter.jpg', credit: 'Mount Lemmon SkyCenter' },
};

// Planet search terms for NASA API
const PLANET_SEARCH_TERMS: Record<string, string> = {
  'mercury': 'mercury planet messenger',
  'venus': 'venus planet magellan',
  'mars': 'mars planet surface',
  'jupiter': 'jupiter planet juno',
  'saturn': 'saturn planet cassini rings',
  'uranus': 'uranus planet voyager',
  'neptune': 'neptune planet voyager',
};

// Constellation search terms
const CONSTELLATION_SEARCH_TERMS: Record<string, string> = {
  'orion': 'orion constellation nebula',
  'scorpius': 'scorpius constellation',
  'sagittarius': 'sagittarius milky way center',
  'cygnus': 'cygnus constellation',
  'cassiopeia': 'cassiopeia constellation',
  'ursa major': 'ursa major big dipper',
  'leo': 'leo constellation',
  'taurus': 'taurus constellation pleiades',
  'gemini': 'gemini constellation',
  'virgo': 'virgo cluster galaxies',
};

/**
 * Search NASA Image Library for celestial object images
 */
async function searchNASAImages(query: string): Promise<CelestialImage | null> {
  try {
    const searchUrl = `${NASA_IMAGES_API}/search?q=${encodeURIComponent(query)}&media_type=image`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const items = data?.collection?.items;
    
    if (!items || items.length === 0) return null;
    
    // Find the best image (prefer ones with 'hubble', 'telescope', or high-quality sources)
    let bestItem = items[0];
    for (const item of items.slice(0, 10)) {
      const desc = (item.data?.[0]?.description || '').toLowerCase();
      const title = (item.data?.[0]?.title || '').toLowerCase();
      if (desc.includes('hubble') || desc.includes('telescope') || title.includes('hubble')) {
        bestItem = item;
        break;
      }
    }
    
    const itemData = bestItem.data?.[0];
    const links = bestItem.links;
    
    if (!links || links.length === 0) return null;
    
    // Get the preview image URL
    const previewUrl = links.find((l: any) => l.rel === 'preview')?.href || links[0]?.href;
    
    if (!previewUrl) return null;
    
    // Try to get the full resolution image
    let fullUrl = previewUrl;
    try {
      const assetResponse = await fetch(`${NASA_IMAGES_API}/asset/${itemData.nasa_id}`);
      if (assetResponse.ok) {
        const assetData = await assetResponse.json();
        const assets = assetData?.collection?.items || [];
        // Find original or large image
        const origAsset = assets.find((a: any) => a.href?.includes('~orig') || a.href?.includes('~large'));
        if (origAsset) {
          fullUrl = origAsset.href;
        } else if (assets.length > 0) {
          // Get the largest available
          fullUrl = assets[assets.length - 1]?.href || previewUrl;
        }
      }
    } catch {
      // Use preview if asset fetch fails
    }
    
    return {
      url: fullUrl,
      thumbnail: previewUrl,
      credit: itemData.center ? `NASA/${itemData.center}` : 'NASA',
      title: itemData.title || query,
    };
  } catch (error) {
    console.error('NASA API search failed:', error);
    return null;
  }
}

/**
 * Get image for a Messier object
 */
export async function getMessierImage(messierNumber: string): Promise<CelestialImage | null> {
  // Normalize the ID (M1, M 1, m1 -> M1)
  const normalized = messierNumber.toUpperCase().replace(/\s+/g, '').replace('MESSIER', 'M');
  
  // Check fallback first for guaranteed high-quality images
  const fallback = MESSIER_FALLBACK[normalized];
  if (fallback) {
    return {
      url: fallback.url,
      credit: fallback.credit,
      title: normalized,
    };
  }
  
  // Search NASA for other Messier objects
  const searchTerms = [
    `${normalized} messier`,
    `messier ${normalized.replace('M', '')}`,
    normalized,
  ];
  
  for (const term of searchTerms) {
    const result = await searchNASAImages(term);
    if (result) return result;
  }
  
  return null;
}

/**
 * Get image for a planet
 */
export async function getPlanetImage(planetId: string): Promise<CelestialImage | null> {
  const planetLower = planetId.toLowerCase();
  const searchTerm = PLANET_SEARCH_TERMS[planetLower] || `${planetId} planet`;
  
  return searchNASAImages(searchTerm);
}

/**
 * Get Moon image
 */
export async function getMoonImage(): Promise<CelestialImage | null> {
  return searchNASAImages('moon lunar surface');
}

/**
 * Get Sun image
 */
export async function getSunImage(): Promise<CelestialImage | null> {
  return searchNASAImages('sun solar dynamics observatory');
}

/**
 * Get constellation image
 */
export async function getConstellationImage(constellationName: string): Promise<CelestialImage | null> {
  const nameLower = constellationName.toLowerCase();
  const searchTerm = CONSTELLATION_SEARCH_TERMS[nameLower] || `${constellationName} constellation stars`;
  
  return searchNASAImages(searchTerm);
}

/**
 * Get image for a star
 */
export async function getStarImage(starName: string): Promise<CelestialImage | null> {
  // Famous stars have better search results
  const famousStars: Record<string, string> = {
    'sirius': 'sirius star brightest',
    'betelgeuse': 'betelgeuse star red giant',
    'rigel': 'rigel star orion',
    'vega': 'vega star lyra',
    'arcturus': 'arcturus star',
    'capella': 'capella star',
    'polaris': 'polaris north star',
    'aldebaran': 'aldebaran star taurus',
    'antares': 'antares star scorpius',
    'spica': 'spica star virgo',
    'deneb': 'deneb star cygnus',
    'altair': 'altair star aquila',
    'fomalhaut': 'fomalhaut star',
    'canopus': 'canopus star',
    'procyon': 'procyon star',
  };
  
  const nameLower = starName.toLowerCase();
  const searchTerm = famousStars[nameLower] || `${starName} star`;
  
  return searchNASAImages(searchTerm);
}

/**
 * Get image for a deep sky object (NGC, IC, etc.)
 */
export async function getDeepSkyImage(objectId: string, objectName?: string): Promise<CelestialImage | null> {
  // Try object ID first
  let result = await searchNASAImages(objectId);
  if (result) return result;
  
  // Try with common name if available
  if (objectName && objectName !== objectId) {
    result = await searchNASAImages(objectName);
    if (result) return result;
  }
  
  // Try variations
  if (objectId.startsWith('NGC')) {
    result = await searchNASAImages(`NGC ${objectId.replace('NGC', '').trim()}`);
    if (result) return result;
  }
  
  return null;
}

/**
 * Get image for any celestial object - main entry point
 */
export async function getCelestialImage(
  objectType: 'star' | 'planet' | 'deepsky' | 'moon' | 'sun' | 'constellation' | 'messier',
  objectId: string,
  _ra?: number,
  _dec?: number
): Promise<CelestialImage | null> {
  try {
    switch (objectType) {
      case 'planet':
        return await getPlanetImage(objectId);
      
      case 'moon':
        return await getMoonImage();
      
      case 'sun':
        return await getSunImage();
      
      case 'messier':
      case 'deepsky':
        // Check if it's a Messier object
        const normalizedId = objectId.toUpperCase().replace(/\s+/g, '');
        if (normalizedId.startsWith('M') && /^M\d+$/.test(normalizedId)) {
          return await getMessierImage(objectId);
        }
        return await getDeepSkyImage(objectId);
      
      case 'constellation':
        return await getConstellationImage(objectId);
      
      case 'star':
        return await getStarImage(objectId);
      
      default:
        return null;
    }
  } catch (error) {
    console.error('Error fetching celestial image:', error);
    return null;
  }
}

/**
 * Check if we have a guaranteed high-quality image for an object
 */
export function hasHighQualityImage(objectType: string, objectId: string): boolean {
  if (objectType === 'deepsky' || objectType === 'messier') {
    const normalized = objectId.toUpperCase().replace(/\s+/g, '').replace('MESSIER', 'M');
    return normalized in MESSIER_FALLBACK;
  }
  // NASA API should have images for planets, moon, sun
  if (['planet', 'moon', 'sun'].includes(objectType)) {
    return true;
  }
  return false;
}
