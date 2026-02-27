# Supabase Integration - Complete Setup

Your SkyWatch app is now fully integrated with your existing Supabase platform! 🎉

## What's Been Integrated

### 1. Authentication System
- **Sign In/Sign Up UI** - Users can create accounts or log in
- **Session Management** - Automatic session persistence and refresh
- **User Status Display** - Shows logged-in user in top bar

### 2. Object Interaction
- **Click to View Details** - Click any star or planet to see detailed information
- **Save Observations** - Log observations with notes, location, and timestamp
- **Add to Favorites** - Mark celestial objects as favorites

### 3. Database Connection
- **Existing Schema Compatible** - Works with your current database tables:
  - `users` - User accounts and profiles
  - `stars` - Star catalog (optional, currently using local JSON)
  - `observations` - User observation logs
  - `user_favorites` - User favorite objects

## How to Use

### For Users

1. **Sign In**
   - Click the 🔓 icon in the top-right corner
   - Enter your email and password
   - Or create a new account

2. **Explore the Sky**
   - Click on any star or planet to see details
   - View magnitude, coordinates, and spectral type

3. **Log Observations**
   - Click an object to open the detail panel
   - Add notes about what you observed
   - Click "Save Observation" to log it

4. **Add Favorites**
   - Click "Add to Favorites" in the object detail panel
   - Access your favorites later from your profile

### For Developers

#### Environment Setup
Your `.env.local` is already configured with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://gmsylfwpftqdlzoboqqr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Database Schema
Run this SQL in your Supabase SQL Editor to add helper functions:

```sql
-- Copy from apps/web/supabase/schema.sql
-- This adds indexes and helper functions without duplicating tables
```

The schema is designed to work with your existing tables, only adding:
- Performance indexes
- Helper functions for spatial queries
- No table modifications needed

#### Architecture

**Hybrid Approach (Recommended)**
- ✅ **Local JSON** - 50,000 stars for fast rendering
- ✅ **Supabase** - User data, observations, favorites

This gives you:
- Fast, offline-capable star rendering
- Rich user features and data persistence
- No database query costs for star positions
- Scalable user data management

## New Components

### 1. AuthPanel (`src/components/AuthPanel.tsx`)
- Handles user authentication
- Sign in/sign up forms
- Session management
- User profile display

### 2. ObjectDetailPanel (`src/components/ObjectDetailPanel.tsx`)
- Shows celestial object details
- Observation logging interface
- Favorites management
- Requires authentication for user features

### 3. Supabase Service (`src/services/supabase-service.ts`)
- `saveObservation()` - Save user observations
- `getUserObservations()` - Fetch user's observations
- `addToFavorites()` - Add objects to favorites
- `removeFromFavorites()` - Remove from favorites
- `getUserFavorites()` - Get user's favorites
- `isFavorited()` - Check if object is favorited
- `fetchStarsFromSupabase()` - Query stars by region (optional)
- `fetchBrightestStars()` - Get brightest stars (optional)

## Features Enabled

### Current Features ✅
- User authentication (email/password)
- Click objects to view details
- Save observations with notes
- Add objects to favorites
- Real-time session management
- Automatic auth state updates

### Ready to Add 🚀
- User profile page
- Observation history view
- Favorites list view
- Social features (share observations)
- Community feed
- Achievement system
- Telescope equipment tracking
- Location-based features

## API Reference

### Save an Observation
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

### Get User Data
```typescript
import { getUserObservations, getUserFavorites } from '../src/services/supabase-service';

const observations = await getUserObservations();
const favorites = await getUserFavorites();
```

### Check Auth Status
```typescript
import { supabase } from '../src/lib/supabase';

const { data: { user } } = await supabase.auth.getUser();
if (user) {
  console.log('User is logged in:', user.email);
}
```

## Next Steps

### 1. Enable Authentication Providers (Optional)
In your Supabase dashboard:
- Go to Authentication → Providers
- Enable Google, GitHub, or other OAuth providers
- Configure redirect URLs

### 2. Add User Profile Page
Create a profile page to show:
- User information
- Observation history
- Favorites list
- Statistics and achievements

### 3. Build Social Features
- Share observations with community
- Comment on observations
- Like/react to observations
- Follow other users

### 4. Add Advanced Features
- Export observations to CSV
- Import observations from other apps
- Telescope equipment management
- Weather integration
- Notification system

## Database Schema Reference

### observations
```typescript
{
  id: string;
  user_id: string;
  object_name: string;
  category: string; // 'Star', 'Planet', 'Deep Sky Object', 'Constellation'
  observation_date: string;
  location: string | null; // "lat, lon" format
  notes: string | null;
  photo_url: string | null;
  points_awarded: number;
  is_seasonal_rare: boolean;
  created_at: string;
  comments_count: number;
  likes_count: number;
}
```

### user_favorites
```typescript
{
  id: string;
  user_id: string;
  object_type: 'star' | 'planet' | 'messier' | 'constellation';
  object_id: string;
  object_name: string;
  created_at: string;
}
```

### users (existing)
```typescript
{
  id: string;
  email: string;
  display_name?: string;
  bio?: string;
  profile_photo_url?: string;
  telescope_type?: string;
  experience_level?: string;
  level: number;
  total_points: number;
  // ... other fields from your existing schema
}
```

## Troubleshooting

### "Supabase credentials not configured"
- Check `.env.local` has correct values
- Restart dev server: `npm run dev`

### "User not authenticated" errors
- User must be signed in for observations/favorites
- Check auth status with `supabase.auth.getUser()`

### Database errors
- Verify schema is created in Supabase
- Check RLS policies are configured
- Ensure user has proper permissions

## Performance Considerations

### Why Keep Stars in JSON?
1. **Speed** - All 50,000 stars loaded instantly
2. **Offline** - Works without internet
3. **Cost** - No database query costs
4. **Three.js** - Needs all stars in memory for rendering

### When to Use Supabase?
1. **User Data** - Observations, favorites, profiles
2. **Social Features** - Comments, likes, follows
3. **Dynamic Content** - News, events, updates
4. **Analytics** - Usage tracking, popular objects

## Support

For more information:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## Summary

Your SkyWatch app now has:
- ✅ Full authentication system
- ✅ User observation logging
- ✅ Favorites management
- ✅ Integration with existing Supabase platform
- ✅ Hybrid architecture (local stars + cloud user data)
- ✅ Ready for social features

The integration is complete and ready to use! Users can now sign in, explore the sky, and save their observations and favorites to your existing Supabase database.
