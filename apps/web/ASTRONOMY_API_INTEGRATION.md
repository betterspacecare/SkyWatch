# Astronomy API Integration

This document describes the integration with [Astronomy API](https://docs.astronomyapi.com/) for fetching celestial data.

## Overview

The Astronomy API provides:
- Star search by name or coordinates
- Deep sky object data (Messier, NGC, etc.)
- Constellation information
- Star chart generation (rendered images)

## Current Usage

Currently, the Astronomy API is configured as a **fallback option** for constellation data. The app primarily uses:
1. **SIMBAD API** - for bulk star data queries
2. **Local catalog** - for offline support and constellation line data
3. **Astronomy API** - (optional) for enhanced constellation information

## Configuration

### 1. Get API Credentials

1. Sign up at [astronomyapi.com](https://astronomyapi.com)
2. Create a new application from your dashboard
3. Save your Application ID and Application Secret

### 2. Set Environment Variables

Create a `.env.local` file in `apps/web/`:

```bash
NEXT_PUBLIC_ASTRONOMY_API_ID=your_application_id
NEXT_PUBLIC_ASTRONOMY_API_SECRET=your_application_secret
```

See `.env.local.example` for a template.

### 3. Enable in Code

The API is automatically used when credentials are configured. Check `apps/web/src/services/astronomy-api.ts`:

```typescript
const useAstronomyAPI = ASTRONOMY_API_CONFIG.applicationId && 
                        ASTRONOMY_API_CONFIG.applicationSecret;
```

## API Endpoints Used

### Search Endpoint
```
GET https://api.astronomyapi.com/api/v2/search
```

Parameters:
- `term` - Search term (star name, catalog ID)
- `match` - `fuzzy` or `exact`
- `ra` / `dec` - Area search by coordinates
- `limit` / `offset` - Pagination

Response includes:
- Object ID and name
- Type (star, galaxy, nebula, etc.)
- Position (RA/Dec in hours and degrees)
- Cross-identifications (M, NGC, HIP, etc.)

### Star Chart Endpoint (Image Generation)
```
POST https://api.astronomyapi.com/api/v2/studio/star-chart
```

Generates rendered images of:
- Constellations (by 3-letter ID)
- Sky areas (by RA/Dec coordinates)
- Custom views with zoom

**Note**: This endpoint returns images, not raw coordinate data, so it's not currently used for real-time rendering.

## Authentication

Uses HTTP Basic Authentication:

```typescript
const credentials = `${applicationId}:${applicationSecret}`;
const authHeader = `Basic ${btoa(credentials)}`;
```

## Limitations

1. **Rate Limiting** - Free tier has request limits
2. **Image-based charts** - Star chart endpoint generates images, not raw data
3. **Search-based** - No bulk queries like SIMBAD's TAP service
4. **Requires auth** - Unlike SIMBAD which is completely open

## Why Not Use Astronomy API for Everything?

| Feature | SIMBAD | Astronomy API | Local Catalog |
|---------|--------|---------------|---------------|
| Bulk star queries | ✅ Yes (TAP/ADQL) | ❌ No | ✅ Yes |
| Authentication | ❌ Not required | ✅ Required | ❌ Not required |
| Constellation lines | ❌ No | ❌ No (images only) | ✅ Yes |
| Deep sky objects | ✅ Yes | ✅ Yes | ✅ Limited |
| Offline support | ❌ No | ❌ No | ✅ Yes |
| Data format | Raw coordinates | JSON + Images | JSON |

## Future Enhancements

Potential uses for Astronomy API:
1. **Deep sky object search** - Find nebulae, galaxies by name
2. **Constellation metadata** - Get constellation boundaries, mythology
3. **Star identification** - Search stars by catalog ID (HIP, HD, etc.)
4. **Fallback data source** - When SIMBAD is unavailable

## Resources

- [Astronomy API Documentation](https://docs.astronomyapi.com/)
- [API Demo Site](https://demo.astronomyapi.com/)
- [GitHub Issues](https://github.com/AstronomyAPI/Documentation)

## Troubleshooting

### 403 Forbidden Error
- Check that credentials are correct
- Verify the auth string is properly base64 encoded
- Ensure the Origin header matches your application settings

### No Data Returned
- Check the search term format
- Verify RA/Dec coordinates are in correct format (decimal degrees)
- Check API rate limits on your dashboard

### CORS Issues
- Set the correct Origin domain in your application settings
- For local development, use `http://localhost:3000`
