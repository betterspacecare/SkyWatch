# Upload Stars to Supabase Database

This guide will help you upload all 50,000 stars to your Supabase database and configure the app to use them.

## Step 1: Verify Database Schema

First, make sure your `stars` table exists in Supabase. Run this SQL in your Supabase SQL Editor:

```sql
-- Create stars table if it doesn't exist
CREATE TABLE IF NOT EXISTS stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hip_id INTEGER UNIQUE,
  ra DOUBLE PRECISION NOT NULL,
  dec DOUBLE PRECISION NOT NULL,
  magnitude DOUBLE PRECISION NOT NULL,
  name TEXT,
  spectral_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stars_magnitude ON stars(magnitude);
CREATE INDEX IF NOT EXISTS idx_stars_ra_dec ON stars(ra, dec);
CREATE INDEX IF NOT EXISTS idx_stars_hip_id ON stars(hip_id);

-- Enable Row Level Security (optional - for public read access)
ALTER TABLE stars ENABLE ROW LEVEL SECURITY;

-- Allow public read access to stars
CREATE POLICY IF NOT EXISTS "Stars are viewable by everyone"
  ON stars FOR SELECT
  USING (true);
```

## Step 2: Upload Stars to Supabase

Run the upload script:

```bash
cd apps/web
node scripts/upload-stars-to-supabase.js
```

This will:
- Load 50,000 stars from `public/data/bright-stars.json`
- Upload them in batches of 1,000 stars
- Show progress as it uploads
- Take approximately 2-3 minutes

Expected output:
```
🌟 Starting star database upload to Supabase...
📊 Loaded 50000 stars from local database
✅ Uploaded 1000/50000 stars (2.0%)
✅ Uploaded 2000/50000 stars (4.0%)
...
✅ Uploaded 50000/50000 stars (100.0%)
🎉 Successfully uploaded 50000 stars to Supabase!
```

## Step 3: Update App to Use Supabase Stars

Now you have two options:

### Option A: Use Supabase for All Stars (Recommended for Dynamic Data)

Update `apps/web/pages/index.tsx` to fetch stars from Supabase:

```typescript
// Replace the star loading section in the init() function
// Find this code:
try {
  console.log('🌌 Fetching constellations and stars from Astronomy API...');
  const result = await fetchConstellationsWithStars();
  // ... existing code
} catch (apiError) {
  // ... existing code
}

// Replace with:
try {
  console.log('🌌 Loading stars from Supabase...');
  const { fetchBrightestStars } = await import('../src/services/supabase-service');
  
  // Fetch constellation data from API
  const result = await fetchConstellationsWithStars();
  constellations = result.constellations;
  
  // Fetch stars from Supabase
  const supabaseStars = await fetchBrightestStars(50000);
  
  // Merge constellation stars with Supabase stars
  const starMap = new Map<string, Star>();
  result.stars.forEach(star => starMap.set(star.id, star));
  supabaseStars.forEach(star => starMap.set(star.id, star));
  
  stars = Array.from(starMap.values());
  
  console.log(`✅ Loaded ${constellations.length} constellations and ${stars.length} stars`);
} catch (error) {
  console.warn('⚠️  Failed to load from Supabase, using local data:', error);
  // Fallback to local JSON
  const response = await fetch('/data/bright-stars.json');
  const data = await response.json();
  stars = data.stars.map((s: any) => ({
    id: s.id,
    name: s.name,
    ra: s.ra,
    dec: s.dec,
    magnitude: s.mag,
    spectralType: s.spectralType,
  }));
  constellations = [];
}
```

### Option B: Hybrid Approach (Recommended for Performance)

Keep using local JSON for initial load (fast), but allow dynamic queries:

```typescript
// Keep existing local JSON loading for fast initial render
// Add Supabase queries for specific use cases:

// Example: Search for stars by name
import { supabase } from '../src/lib/supabase';

async function searchStars(query: string) {
  const { data, error } = await supabase
    .from('stars')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(100);
  
  return data || [];
}

// Example: Get stars in a specific region
import { fetchStarsFromSupabase } from '../src/services/supabase-service';

const regionStars = await fetchStarsFromSupabase(
  0, 6,      // RA range (hours)
  -30, 30,   // Dec range (degrees)
  6.0        // Max magnitude
);
```

## Step 4: Add Star Search Feature (Optional)

Create a search component to find stars by name:

```typescript
// apps/web/src/components/StarSearch.tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function StarSearch({ onStarSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('stars')
      .select('*')
      .ilike('name', `%${searchQuery}%`)
      .order('magnitude', { ascending: true })
      .limit(20);

    setResults(data || []);
    setLoading(false);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search stars..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          handleSearch(e.target.value);
        }}
      />
      {loading && <div>Searching...</div>}
      <ul>
        {results.map((star) => (
          <li key={star.id} onClick={() => onStarSelect(star)}>
            {star.name || `HIP ${star.hip_id}`} - Mag {star.magnitude.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Performance Comparison

### Local JSON (Current)
- ✅ Load time: <1 second
- ✅ Offline capable
- ✅ No API calls
- ❌ Can't search/filter dynamically
- ❌ Can't update without redeploying

### Supabase Database
- ✅ Dynamic queries (search, filter)
- ✅ Real-time updates possible
- ✅ Can add more stars anytime
- ❌ Requires internet connection
- ❌ Initial load: 2-3 seconds for 50K stars
- ❌ API costs for queries

### Hybrid Approach (Recommended)
- ✅ Fast initial load (local JSON)
- ✅ Dynamic search when needed (Supabase)
- ✅ Best of both worlds
- ✅ Fallback to local if offline

## Recommended Architecture

```
┌─────────────────────────────────────────┐
│         Initial Page Load               │
│  Load 50K stars from local JSON         │
│  Fast, offline, no API calls            │
└─────────────────┬───────────────────────┘
                  │
                  ├─── User clicks star
                  │    Show details from local data
                  │
                  ├─── User searches by name
                  │    Query Supabase for matches
                  │
                  └─── User filters by region
                       Query Supabase for region
```

## Verification

After uploading, verify in Supabase:

1. Go to your Supabase dashboard
2. Navigate to Table Editor
3. Select the `stars` table
4. You should see 50,000 rows
5. Try a query:
   ```sql
   SELECT COUNT(*) FROM stars;
   -- Should return 50000
   
   SELECT * FROM stars WHERE name IS NOT NULL ORDER BY magnitude LIMIT 10;
   -- Should show brightest named stars
   ```

## Troubleshooting

### Upload fails with "relation does not exist"
**Solution:** Run the SQL schema from Step 1 first

### Upload is very slow
**Solution:** This is normal - 50K stars takes 2-3 minutes. The script shows progress.

### "Permission denied" errors
**Solution:** Check your Supabase RLS policies allow inserts with your anon key, or use service role key

### Out of memory errors
**Solution:** The script uploads in batches of 1000. If still failing, reduce batch size in the script.

## Next Steps

1. ✅ Upload stars to Supabase
2. ⬜ Choose your loading strategy (local, Supabase, or hybrid)
3. ⬜ Add star search feature
4. ⬜ Add region-based filtering
5. ⬜ Enable real-time star updates

## Summary

You now have:
- 50,000 stars in your Supabase database
- Ability to query stars dynamically
- Search and filter capabilities
- Option to keep fast local loading
- Flexibility to add more stars anytime

Choose the approach that best fits your needs!
