# Supabase Integration Setup Guide

This guide will help you connect SkyWatch to your existing Supabase platform.

## Prerequisites

- Existing Supabase project
- Supabase project URL and anon key

## Step 1: Configure Environment Variables

1. Open `apps/web/.env.local`
2. Replace the placeholder values with your actual Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase dashboard:
- Go to Settings → API
- Copy the "Project URL" and "anon public" key

## Step 2: Create Database Schema

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy the contents of `apps/web/supabase/schema.sql`
4. Paste and run the SQL script

This will create:
- `stars` table - Stores the star catalog
- `observations` table - Stores user observations
- `user_favorites` table - Stores user favorites
- Indexes for efficient queries
- Row Level Security (RLS) policies
- Helper functions for spatial queries

## Step 3: Upload Stars Database (Optional)

If you want to store stars in Supabase instead of using local JSON:

```bash
# Install dependencies
npm install dotenv

# Run the upload script
node apps/web/scripts/upload-stars-to-supabase.js
```

This will upload all 50,000 stars to your Supabase database.

**Note:** This is optional. The app currently uses local JSON for better performance. Supabase is recommended for user features (observations, favorites) rather than star data.

## Step 4: Enable Authentication (Optional)

If you want user features:

1. Go to Authentication → Providers in Supabase dashboard
2. Enable your preferred auth providers (Email, Google, GitHub, etc.)
3. Configure the providers according to Supabase documentation

## Features Enabled

### Current Implementation

✅ **Supabase Client** - Configured and ready to use
✅ **Database Schema** - Tables for stars, observations, and favorites
✅ **Service Layer** - Functions to interact with Supabase
✅ **Row Level Security** - Users can only access their own data

### Available Functions

**Star Queries:**
- `fetchStarsFromSupabase()` - Get stars by region
- `fetchBrightestStars()` - Get brightest stars

**User Observations:**
- `saveObservation()` - Save an observation
- `getUserObservations()` - Get user's observations

**User Favorites:**
- `addToFavorites()` - Add object to favorites
- `removeFromFavorites()` - Remove from favorites
- `getUserFavorites()` - Get user's favorites
- `isFavorited()` - Check if object is favorited

## Usage Examples

### Fetch Stars from Supabase

```typescript
import { fetchBrightestStars } from '../src/services/supabase-service';

// Get 1000 brightest stars
const stars = await fetchBrightestStars(1000);
```

### Save User Observation

```typescript
import { saveObservation } from '../src/services/supabase-service';

await saveObservation({
  object_type: 'star',
  object_name: 'Sirius',
  notes: 'Very bright tonight!',
  location_lat: 40.7128,
  location_lon: -74.0060,
  observed_at: new Date(),
});
```

### Add to Favorites

```typescript
import { addToFavorites } from '../src/services/supabase-service';

await addToFavorites('messier', 'M42', 'Orion Nebula');
```

## Architecture Decisions

### Why Keep Stars in JSON?

1. **Performance** - All stars loaded once, no network latency
2. **Offline Support** - Works without internet after initial load
3. **Three.js Optimization** - Needs all stars in memory for rendering
4. **Cost** - No database query costs

### When to Use Supabase?

1. **User Data** - Observations, favorites, preferences
2. **Social Features** - Sharing, comments, community
3. **Dynamic Content** - News, events, updates
4. **Analytics** - Usage tracking, popular objects

## Hybrid Approach (Recommended)

- **Local JSON** - Star positions and constellation data (50,000 stars)
- **Supabase** - User accounts, observations, favorites, social features

This gives you the best of both worlds:
- Fast, offline-capable star rendering
- Rich user features and data persistence

## Next Steps

1. ✅ Configure environment variables
2. ✅ Run database schema
3. ⬜ Enable authentication (if needed)
4. ⬜ Implement UI for observations and favorites
5. ⬜ Add user profile page
6. ⬜ Build social features

## Troubleshooting

### "Supabase credentials not configured" warning

- Check that `.env.local` has the correct values
- Restart the development server after changing environment variables

### "Error fetching from Supabase"

- Verify your Supabase project is active
- Check that the database schema has been created
- Ensure RLS policies are correctly configured

### Upload script fails

- Make sure you have `dotenv` installed: `npm install dotenv`
- Verify your Supabase credentials are correct
- Check that the `stars` table exists in your database

## Support

For more information:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
