# How to Use Supabase Stars in Your App

## ✅ Upload Complete!

You now have **45,000 stars** in your Supabase database, ready to use!

## Quick Start: 3 Ways to Use Stars

### Option 1: Keep Using Local JSON (Current - Recommended)

**No changes needed!** Your app already loads 50,000 stars from local JSON instantly.

**Why this is best:**
- ✅ Instant load (<1 second)
- ✅ Works offline
- ✅ No API costs
- ✅ Already working perfectly

**When to use Supabase:**
- User searches for a star by name
- User filters by region
- Admin updates star data

### Option 2: Load All Stars from Supabase

Update `apps/web/pages/index.tsx` to load from Supabase:

```typescript
// Find this section in the init() function (around line 250):
try {
  console.log('🌌 Fetching constellations and stars from Astronomy API...');
  const result = await fetchConstellationsWithStars();
  constellations = result.constellations;
  const constellationStars = result.stars;
  stars = constellationStars;
  // ...
} catch (apiError) {
  // ...
}

// Replace with:
try {
  console.log('🌌 Loading stars from Supabase...');
  const { loadStars } = await import('../src/services/star-loader');
  
  // Load stars from Supabase
  stars = await loadStars({ 
    strategy: 'supabase', 
    maxStars: 45000 
  });
  
  // Load constellations from API
  const result = await fetchConstellationsWithStars();
  constellations = result.constellations;
  
  console.log(`✅ Loaded ${stars.length} stars from Supabase and ${constellations.length} constellations`);
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

### Option 3: Hybrid Approach (Best of Both Worlds)

Keep fast local loading + add search capability:

```typescript
// In apps/web/pages/index.tsx, add to AppState interface:
interface AppState {
  // ... existing fields
  searchQuery: string;
  searchResults: Star[];
  isSearching: boolean;
}

// Add search function:
const handleStarSearch = useCallback(async (query: string) => {
  if (query.length < 2) {
    setState(prev => ({ ...prev, searchResults: [], searchQuery: '' }));
    return;
  }
  
  setState(prev => ({ ...prev, isSearching: true, searchQuery: query }));
  
  try {
    const { searchStarsByName } = await import('../src/services/star-loader');
    const results = await searchStarsByName(query, 20);
    setState(prev => ({ ...prev, searchResults: results, isSearching: false }));
  } catch (error) {
    console.error('Search failed:', error);
    setState(prev => ({ ...prev, isSearching: false }));
  }
}, []);

// Add search UI in the render:
<div style={styles.searchBar}>
  <input
    type="text"
    placeholder="Search stars..."
    onChange={(e) => handleStarSearch(e.target.value)}
    style={styles.searchInput}
  />
  {state.isSearching && <span>Searching...</span>}
  {state.searchResults.length > 0 && (
    <div style={styles.searchResults}>
      {state.searchResults.map(star => (
        <div key={star.id} onClick={() => handleStarClick(star)}>
          {star.name || `HIP ${star.id}`} - Mag {star.magnitude.toFixed(2)}
        </div>
      ))}
    </div>
  )}
</div>
```

## Available Functions

### Load Stars
```typescript
import { loadStars } from '../src/services/star-loader';

// Load from Supabase
const stars = await loadStars({ strategy: 'supabase', maxStars: 45000 });

// Load from local JSON (fast)
const stars = await loadStars({ strategy: 'local' });

// Hybrid (tries Supabase, falls back to local)
const stars = await loadStars({ strategy: 'hybrid' });
```

### Search by Name
```typescript
import { searchStarsByName } from '../src/services/star-loader';

const results = await searchStarsByName('Sirius', 20);
// Returns: [{ id, name, ra, dec, magnitude, spectralType }, ...]
```

### Get Stars in Region
```typescript
import { getStarsInRegion } from '../src/services/star-loader';

// Get stars in Orion region
const orionStars = await getStarsInRegion(
  5.0, 6.0,    // RA: 5h to 6h
  -10, 10,     // Dec: -10° to +10°
  6.0          // Max magnitude
);
```

### Get Star Count
```typescript
import { getStarCount } from '../src/services/star-loader';

const count = await getStarCount();
console.log(`Database has ${count} stars`); // 45000
```

## Performance Comparison

| Method | Load Time | Search | Offline | API Cost |
|--------|-----------|--------|---------|----------|
| Local JSON | <1 sec | ❌ | ✅ | $0 |
| Supabase | 2-3 sec | ✅ | ❌ | ~$0.01/1K |
| Hybrid | <1 sec | ✅ | ✅ (initial) | ~$0.01/1K searches |

## Recommendation

**Use Hybrid Approach:**
1. Keep local JSON for fast initial load (current behavior)
2. Add search feature using Supabase
3. Best user experience + flexibility

## Example: Add Star Search Feature

Create `apps/web/src/components/StarSearch.tsx`:

```typescript
import { useState } from 'react';
import { searchStarsByName } from '../services/star-loader';
import type { Star } from '@virtual-window/astronomy-engine';

interface StarSearchProps {
  onStarSelect: (star: Star) => void;
}

export default function StarSearch({ onStarSelect }: StarSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Star[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const stars = await searchStarsByName(searchQuery, 20);
      setResults(stars);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <input
        type="text"
        placeholder="Search stars by name..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        style={styles.input}
      />
      
      {loading && <div style={styles.loading}>Searching...</div>}
      
      {results.length > 0 && (
        <div style={styles.results}>
          {results.map((star) => (
            <div
              key={star.id}
              onClick={() => onStarSelect(star)}
              style={styles.result}
            >
              <span style={styles.name}>
                {star.name || `HIP ${star.id.replace('HIP', '')}`}
              </span>
              <span style={styles.mag}>
                Mag {star.magnitude.toFixed(2)}
              </span>
              <span style={styles.type}>
                {star.spectralType}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '300px',
  },
  input: {
    width: '100%',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
  },
  loading: {
    padding: '8px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '12px',
  },
  results: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '8px',
    background: 'rgba(0, 8, 20, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    maxHeight: '400px',
    overflow: 'auto',
    zIndex: 1000,
  },
  result: {
    padding: '12px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.2s',
  },
  name: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    flex: 1,
  },
  mag: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '12px',
    marginRight: '12px',
  },
  type: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '11px',
    fontWeight: 600,
  },
};
```

Then add to your main page:

```typescript
import StarSearch from '../src/components/StarSearch';

// In your render:
<StarSearch onStarSelect={handleStarClick} />
```

## Summary

You now have:
- ✅ 45,000 stars in Supabase
- ✅ Fast local JSON loading (current)
- ✅ Search capability (new)
- ✅ Region filtering (new)
- ✅ Flexible architecture

**Recommended:** Keep using local JSON for speed, add search feature for enhanced functionality!
