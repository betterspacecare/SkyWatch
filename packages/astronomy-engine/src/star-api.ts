/**
 * Star Catalog API Service
 * Fetches star data from various astronomical databases
 */

export interface StarData {
  hipId: number;
  name?: string;
  ra: number;  // Right Ascension in degrees
  dec: number; // Declination in degrees
  magnitude: number;
  spectralType?: string;
  distance?: number | undefined; // in parsecs
  properMotionRA?: number;
  properMotionDec?: number;
}

export interface StarQueryOptions {
  hipIds?: number[];
  maxMagnitude?: number;
  minMagnitude?: number;
  raMin?: number;
  raMax?: number;
  decMin?: number;
  decMax?: number;
  limit?: number;
}

/**
 * SIMBAD TAP (Table Access Protocol) Service
 * Free astronomical database with comprehensive star data
 */
export class SimbadStarService {
  private baseUrl = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';

  async queryByHipIds(hipIds: number[]): Promise<StarData[]> {
    if (hipIds.length === 0) return [];

    // Build ADQL query for Hipparcos IDs
    const hipList = hipIds.map(id => `'HIP ${id}'`).join(',');
    const query = `
      SELECT 
        main_id,
        ra, dec,
        flux_v as magnitude,
        sp_type,
        pmra, pmdec,
        plx_value
      FROM basic
      WHERE main_id IN (${hipList})
    `;

    return this.executeQuery(query);
  }

  async queryByRegion(options: StarQueryOptions): Promise<StarData[]> {
    const {
      maxMagnitude = 6.5,
      raMin = 0,
      raMax = 360,
      decMin = -90,
      decMax = 90,
      limit = 1000
    } = options;

    const query = `
      SELECT TOP ${limit}
        main_id,
        ra, dec,
        flux_v as magnitude,
        sp_type,
        pmra, pmdec,
        plx_value
      FROM basic
      WHERE 
        otype = 'Star'
        AND flux_v <= ${maxMagnitude}
        AND ra BETWEEN ${raMin} AND ${raMax}
        AND dec BETWEEN ${decMin} AND ${decMax}
      ORDER BY flux_v ASC
    `;

    return this.executeQuery(query);
  }

  private async executeQuery(adqlQuery: string): Promise<StarData[]> {
    const params = new URLSearchParams({
      REQUEST: 'doQuery',
      LANG: 'ADQL',
      FORMAT: 'json',
      QUERY: adqlQuery
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`SIMBAD query failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('SIMBAD query error:', error);
      return [];
    }
  }

  private parseResponse(data: any): StarData[] {
    if (!data.data || data.data.length === 0) {
      return [];
    }

    const stars: StarData[] = [];
    
    for (const row of data.data) {
      const [mainId, ra, dec, magnitude, spType, pmra, pmdec, parallax] = row;
      
      // Extract HIP ID if present
      const hipMatch = mainId?.match(/HIP\s*(\d+)/i);
      if (!hipMatch) continue; // Skip stars without HIP ID
      
      const hipId = parseInt(hipMatch[1]);

      // Calculate distance from parallax (distance in parsecs = 1000 / parallax in mas)
      const distance = parallax && parallax > 0 ? 1000 / parallax : undefined;

      stars.push({
        hipId,
        name: mainId,
        ra: ra || 0,
        dec: dec || 0,
        magnitude: magnitude || 99,
        spectralType: spType,
        distance,
        properMotionRA: pmra,
        properMotionDec: pmdec
      });
    }

    return stars;
  }
}

/**
 * Fallback: Use gmiller123456/hip2000 data
 * This is a static dataset but comprehensive
 */
export class HipparcosStaticService {
  private dataUrl = 'https://raw.githubusercontent.com/gmiller123456/hip2000/master/hip_main.json';
  private cache: Map<number, StarData> = new Map();
  private loaded = false;

  async loadCatalog(): Promise<void> {
    if (this.loaded) return;

    try {
      const response = await fetch(this.dataUrl);
      const data = await response.json() as any[];

      for (const star of data) {
        const hipId = star[0];
        const raHours = star[1];
        const decDegrees = star[2];
        const magnitude = star[3];

        this.cache.set(hipId, {
          hipId,
          ra: raHours * 15, // Convert hours to degrees
          dec: decDegrees,
          magnitude
        });
      }

      this.loaded = true;
      console.log(`Loaded ${this.cache.size} stars from Hipparcos catalog`);
    } catch (error) {
      console.error('Failed to load Hipparcos catalog:', error);
    }
  }

  async queryByHipIds(hipIds: number[]): Promise<StarData[]> {
    await this.loadCatalog();
    
    const stars: StarData[] = [];
    for (const hipId of hipIds) {
      const star = this.cache.get(hipId);
      if (star) {
        stars.push(star);
      }
    }
    return stars;
  }

  async queryByMagnitude(maxMagnitude: number, limit: number = 1000): Promise<StarData[]> {
    await this.loadCatalog();
    
    const stars = Array.from(this.cache.values())
      .filter(star => star.magnitude <= maxMagnitude)
      .sort((a, b) => a.magnitude - b.magnitude)
      .slice(0, limit);
    
    return stars;
  }
}

/**
 * Main Star Catalog API
 * Tries multiple sources with fallback
 */
export class StarCatalogAPI {
  private simbad = new SimbadStarService();
  private hipparcos = new HipparcosStaticService();
  private useStaticFallback = false;

  /**
   * Query stars by Hipparcos IDs
   */
  async getStarsByHipIds(hipIds: number[]): Promise<StarData[]> {
    // Try SIMBAD first
    if (!this.useStaticFallback) {
      try {
        const stars = await this.simbad.queryByHipIds(hipIds);
        if (stars.length > 0) {
          return stars;
        }
      } catch (error) {
        console.warn('SIMBAD query failed, falling back to static catalog');
        this.useStaticFallback = true;
      }
    }

    // Fallback to static Hipparcos data
    return this.hipparcos.queryByHipIds(hipIds);
  }

  /**
   * Query stars by sky region and magnitude
   */
  async getStarsByRegion(options: StarQueryOptions): Promise<StarData[]> {
    if (!this.useStaticFallback) {
      try {
        return await this.simbad.queryByRegion(options);
      } catch (error) {
        console.warn('SIMBAD query failed, falling back to static catalog');
        this.useStaticFallback = true;
      }
    }

    // Fallback to static data
    const maxMag = options.maxMagnitude || 6.5;
    const limit = options.limit || 1000;
    return this.hipparcos.queryByMagnitude(maxMag, limit);
  }

  /**
   * Get bright stars for constellation rendering
   */
  async getBrightStars(maxMagnitude: number = 6.5): Promise<StarData[]> {
    return this.getStarsByRegion({ maxMagnitude, limit: 5000 });
  }

  /**
   * Preload the static catalog for offline use
   */
  async preloadStaticCatalog(): Promise<void> {
    await this.hipparcos.loadCatalog();
  }
}

// Export singleton instance
export const starCatalogAPI = new StarCatalogAPI();
