# Updated to Use `observations` Table

## Changes Made

The integration has been updated to use your existing `observations` table instead of `user_observations`.

## Schema Mapping

### From SkyWatch → To observations table

| SkyWatch Field | observations Column | Mapping |
|----------------|---------------------|---------|
| `object_type` | `category` | Mapped: 'star' → 'Star', 'planet' → 'Planet', 'messier' → 'Deep Sky Object', 'constellation' → 'Constellation' |
| `object_name` | `object_name` | Direct mapping |
| `notes` | `notes` | Direct mapping |
| `location_lat, location_lon` | `location` | Combined as string: "lat, lon" |
| `observed_at` | `observation_date` | Direct mapping |
| - | `points_awarded` | Default: 10 points |
| - | `is_seasonal_rare` | Default: false |
| - | `photo_url` | Default: null |
| - | `comments_count` | Auto-managed by database |
| - | `likes_count` | Auto-managed by database |

## Updated Files

### 1. `src/lib/supabase.ts`
- Updated `observations` table type definition
- Removed duplicate table definition
- Matches your existing schema

### 2. `src/services/supabase-service.ts`
- Updated `UserObservation` interface to match `observations` table
- Modified `saveObservation()` to map fields correctly
- Updated `getUserObservations()` to use `observations` table
- Changed sort field from `observed_at` to `observation_date`

### 3. `src/components/UserDataPanel.tsx`
- Updated to display `category` instead of `object_type`
- Changed date field from `observed_at` to `observation_date`
- Updated location display to show string format
- Added points display

### 4. `supabase/schema.sql`
- Updated index names to match `observations` table
- Changed from `user_observations` to `observations`

### 5. Documentation Files
- Updated all references from `user_observations` to `observations`
- Updated schema documentation
- Updated examples

## Database Schema

### observations Table