# SIMBAD API Integration

This document explains how the Virtual Window app integrates with the SIMBAD Astronomical Database to fetch real-time star data.

## Overview

The app uses the [SIMBAD TAP (Table Access Protocol)](https://simbad.cds.unistra.fr/simbad/sim-tap) service to query astronomical data. SIMBAD is maintained by the Centre de Données astronomiques de Strasbourg (CDS) and provides comprehensive data on celestial objects.

## How It Works

### 1. Query Construction

The app constructs ADQL (Astronomical Data Query Language) queries to fetch stars:

```sql
SELECT TOP 5000
  main_id,
  ra, dec,
  flux_v as magnitude,
  sp_type
FROM basic
WHERE 
  otype = 'Star'
  AND flux_v IS NOT NULL
  AND flux_v <= 6.5
  AND main_id LIKE 'HIP %'
ORDER BY flux_v ASC
```

This query:
- Fetches up to 5000 stars
- Filters by magnitude (brightness) ≤ 6.5 (visible to naked eye)
- Only includes stars with Hipparcos catalog IDs
- Orders by brightness (lower magnitude = brighter)

### 2. API Endpoint

**URL**: `https://simbad.cds.unistra.fr/simbad/sim-tap/sync`

**Method**: GET

**Parameters**:
- `REQUEST=doQuery` - Execute a query
- `LANG=ADQL` - Query language
- `FORMAT=json` - Response format
- `QUERY=<adql_query>` - The ADQL query

### 3. Response Format

SIMBAD returns data in JSON format:

```json
{
  "metadata": [...],
  "data": [
    ["HIP 11767", 37.95456, 89.26411, 1.97, "F7Ib-IIv"],
    ["HIP 27989", 88.79293, 7.40703, 0.45, "M1-M2Ia-Iab"],
    ...
  ]
}
```

Each row contains:
1. Star identifier (e.g., "HIP 11767")
2. Right Ascension (degrees)
3. Declination (degrees)
4. Visual magnitude
5. Spectral type

### 4. Data Processing

The app processes SIMBAD data:

```typescript
// Extract HIP ID from identifier
const hipMatch = mainId?.match(/HIP\s*(\d+)/i);
const hipId = parseInt(hipMatch[1]);

// Convert RA from degrees to hours (for internal use)
const raHours = raDegrees / 15;

// Parse spectral type (O, B, A, F, G, K, M)
const spectralType = parseSpectralType(spType);
```

### 5. Fallback Strategy

If SIMBAD is unavailable (network issues, CORS, rate limiting), the app automatically falls back to a local star catalog:

```typescript
try {
  // Try SIMBAD first
  const stars = await fetchStarsFromSimbad(options);
  return stars;
} catch (error) {
  // Fallback to local catalog
  console.warn('SIMBAD failed, using local catalog');
  const catalog = createDefaultStarCatalog();
  return catalog.getStars();
}
```

## CORS Considerations

SIMBAD's TAP service supports CORS (Cross-Origin Resource Sharing), allowing direct browser requests. However, if CORS issues occur:

1. The app will automatically fall back to the local catalog
2. For production, consider proxying requests through your backend
3. Alternative: Use a CORS proxy service (not recommended for production)

## Rate Limiting

SIMBAD has rate limits to prevent abuse:
- **Recommended**: Cache results and avoid excessive queries
- **Best Practice**: Fetch data once on app load, not on every render
- **Fallback**: Local catalog ensures app works even if rate limited

## Query Optimization

### Current Implementation
- Fetches bright stars (magnitude ≤ 6.5)
- Limits to 5000 stars maximum
- Only queries Hipparcos catalog stars

### Potential Optimizations
1. **Sky Region Filtering**: Query only visible stars based on user location
2. **Caching**: Store results in localStorage/IndexedDB
3. **Incremental Loading**: Fetch stars in batches as needed
4. **Proper Motion**: Calculate current positions using proper motion data

## Example Usage

```typescript
import { fetchStars } from './services/astronomy-api';

// Fetch bright stars (default: magnitude ≤ 6.5)
const stars = await fetchStars({ maxMagnitude: 6.5, limit: 5000 });

// Fetch specific stars by HIP IDs
const specificStars = await fetchStars({ 
  hipIds: [11767, 27989, 30438] 
});

// Fetch very bright stars only
const brightStars = await fetchStars({ maxMagnitude: 3.0 });
```

## Debugging

Enable console logging to see SIMBAD queries:

```javascript
// In browser console
localStorage.setItem('debug', 'astronomy:*');
```

You'll see:
- `Fetching stars from SIMBAD...`
- `SIMBAD returned X stars`
- `Successfully loaded X stars from SIMBAD`

Or if fallback occurs:
- `SIMBAD fetch failed, falling back to local catalog`
- `Loaded X stars from local catalog`

## Alternative Data Sources

If SIMBAD doesn't meet your needs, consider:

1. **VizieR**: CDS's catalog access service
2. **Gaia Archive**: ESA's Gaia mission data
3. **NASA Exoplanet Archive**: For exoplanet data
4. **Minor Planet Center**: For asteroids and comets

## References

- [SIMBAD TAP Documentation](https://simbad.cds.unistra.fr/simbad/tap)
- [ADQL Language Specification](https://www.ivoa.net/documents/ADQL/)
- [Hipparcos Catalog](https://www.cosmos.esa.int/web/hipparcos)
- [CDS Portal](https://cds.unistra.fr/)

## Troubleshooting

### No stars appearing
1. Check browser console for errors
2. Verify SIMBAD service is online: https://simbad.cds.unistra.fr/
3. Check if fallback to local catalog is working
4. Ensure magnitude filter isn't too restrictive

### CORS errors
1. SIMBAD should support CORS, but check browser console
2. Try accessing SIMBAD directly in browser
3. Consider backend proxy for production

### Slow loading
1. Reduce `limit` parameter (default: 5000)
2. Increase `maxMagnitude` filter (fewer stars)
3. Implement caching strategy
4. Use local catalog for faster initial load
