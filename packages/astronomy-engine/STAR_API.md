# Star Catalog API

The Star Catalog API provides dynamic access to astronomical star data from multiple sources, replacing hardcoded JSON files with live data fetching.

## Features

- **Multiple Data Sources**: Fetches from SIMBAD astronomical database with fallback to static Hipparcos catalog
- **Flexible Queries**: Query by HIP IDs, magnitude, sky region, or get all bright stars
- **Automatic Fallback**: Seamlessly falls back to static data if API is unavailable
- **TypeScript Support**: Fully typed interfaces for all star data

## Usage

### Basic Example

```typescript
import { starCatalogAPI } from '@virtual-window/astronomy-engine';

// Get bright stars (magnitude <= 6.5)
const brightStars = await starCatalogAPI.getBrightStars(6.5);

// Get specific stars by Hipparcos IDs
const stars = await starCatalogAPI.getStarsByHipIds([11767, 27989, 30438]);

// Query stars by region and magnitude
const regionStars = await starCatalogAPI.getStarsByRegion({
  maxMagnitude: 5.0,
  raMin: 0,
  raMax: 90,
  decMin: -30,
  decMax: 30,
  limit: 500
});

// Preload static catalog for offline use
await starCatalogAPI.preloadStaticCatalog();
```

### Star Data Interface

```typescript
interface StarData {
  hipId: number;              // Hipparcos catalog ID
  name?: string;              // Common name (e.g., "Sirius")
  ra: number;                 // Right Ascension in degrees
  dec: number;                // Declination in degrees
  magnitude: number;          // Apparent magnitude
  spectralType?: string;      // Spectral classification
  distance?: number;          // Distance in parsecs
  properMotionRA?: number;    // Proper motion in RA
  properMotionDec?: number;   // Proper motion in Dec
}
```

## Data Sources

### 1. SIMBAD (Primary)

The [SIMBAD Astronomical Database](https://simbad.cds.unistra.fr/) is a comprehensive reference database for astronomical objects. It provides:

- High-quality curated data
- Proper motions and parallax
- Spectral types
- Cross-references to other catalogs

**Endpoint**: `https://simbad.cds.unistra.fr/simbad/sim-tap/sync`

**Query Language**: ADQL (Astronomical Data Query Language)

### 2. Hipparcos Static Catalog (Fallback)

When SIMBAD is unavailable, the API falls back to the static Hipparcos catalog from [gmiller123456/hip2000](https://github.com/gmiller123456/hip2000):

- ~118,000 stars
- Magnitudes up to ~12
- Basic positional data (RA, Dec, magnitude)

## Advanced Usage

### Using Individual Services

```typescript
import { SimbadStarService, HipparcosStaticService } from '@virtual-window/astronomy-engine';

// Use SIMBAD directly
const simbad = new SimbadStarService();
const stars = await simbad.queryByHipIds([11767, 27989]);

// Use static Hipparcos catalog
const hipparcos = new HipparcosStaticService();
await hipparcos.loadCatalog();
const brightStars = await hipparcos.queryByMagnitude(6.5, 1000);
```

### Query Options

```typescript
interface StarQueryOptions {
  hipIds?: number[];        // Specific HIP IDs to fetch
  maxMagnitude?: number;    // Maximum magnitude (lower = brighter)
  minMagnitude?: number;    // Minimum magnitude
  raMin?: number;           // Minimum RA in degrees (0-360)
  raMax?: number;           // Maximum RA in degrees (0-360)
  decMin?: number;          // Minimum Dec in degrees (-90 to 90)
  decMax?: number;          // Maximum Dec in degrees (-90 to 90)
  limit?: number;           // Maximum number of results
}
```

## Integration with Web App

The web app's astronomy API service has been updated to use the Star Catalog API:

```typescript
// apps/web/src/services/astronomy-api.ts
import { starCatalogAPI } from '@virtual-window/astronomy-engine';

export async function fetchStars(options?: {
  limit?: number;
  maxMagnitude?: number;
  hipIds?: number[];
}): Promise<Star[]> {
  // Fetches from SIMBAD or Hipparcos catalog
  const stars = await starCatalogAPI.getBrightStars(options?.maxMagnitude || 6.5);
  return stars.map(convertToAppFormat);
}

// Preload for offline use
export async function preloadStarCatalog(): Promise<void> {
  await starCatalogAPI.preloadStaticCatalog();
}
```

## Constellation Generation

The constellation generation script now uses the Star Catalog API to fetch accurate star coordinates:

```bash
# Generate constellation data with live star coordinates
cd packages/astronomy-engine
npx tsx scripts/generate-constellations.ts
```

This script:
1. Collects all HIP IDs needed for constellation lines
2. Fetches star data from the API
3. Generates `data/constellations.json` with accurate coordinates

## Performance Considerations

- **Caching**: The static Hipparcos catalog is cached in memory after first load
- **Batch Queries**: The API batches HIP ID queries to avoid overwhelming the server
- **Fallback Strategy**: Automatically switches to static data if API fails
- **Preloading**: Call `preloadStaticCatalog()` during app initialization for offline support

## Error Handling

The API handles errors gracefully:

```typescript
try {
  const stars = await starCatalogAPI.getStarsByHipIds([1, 2, 3]);
} catch (error) {
  console.error('Failed to fetch stars:', error);
  // API automatically falls back to static catalog
}
```

## Future Enhancements

Potential improvements:

- Add Gaia DR3 catalog support for even more stars
- Implement client-side caching with IndexedDB
- Add proper motion calculations for accurate positions at any date
- Support for variable stars and binary systems
- Integration with other catalogs (Tycho-2, UCAC4, etc.)

## References

- [SIMBAD Astronomical Database](https://simbad.cds.unistra.fr/)
- [Hipparcos Catalog](https://www.cosmos.esa.int/web/hipparcos)
- [ADQL Documentation](https://www.ivoa.net/documents/ADQL/)
- [Stellarium Constellation Data](https://github.com/Stellarium/stellarium)
