# Fix: Upload Stars to Supabase

The upload failed due to Row Level Security (RLS) policies. Here are two solutions:

## Solution 1: Temporarily Disable RLS (Easiest)

Run this SQL in your Supabase SQL Editor:

```sql
-- Temporarily disable RLS for upload
ALTER TABLE stars DISABLE ROW LEVEL SECURITY;
```

Then run the upload script:
```bash
node scripts/upload-stars-to-supabase.js
```

After upload completes, re-enable RLS:
```sql
-- Re-enable RLS after upload
ALTER TABLE stars ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY IF NOT EXISTS "Stars are viewable by everyone"
  ON stars FOR SELECT
  USING (true);
```

## Solution 2: Use Service Role Key (More Secure)

The service role key bypasses RLS policies.

### Step 1: Get Your Service Role Key

1. Go to your Supabase dashboard
2. Navigate to Settings → API
3. Copy the `service_role` key (keep this secret!)

### Step 2: Create a Secure Upload Script

Create `.env.upload` file (don't commit this!):
```env
SUPABASE_URL=https://gmsylfwpftqdlzoboqqr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Step 3: Use the Service Role Upload Script

I'll create a new upload script that uses the service role key.

## Solution 3: Upload via Supabase Dashboard (Manual)

If scripts don't work, you can upload via CSV:

### Step 1: Convert JSON to CSV

Run this script:
```bash
node scripts/convert-stars-to-csv.js
```

### Step 2: Upload in Supabase Dashboard

1. Go to Table Editor → stars table
2. Click "Insert" → "Import data from CSV"
3. Upload the generated `stars.csv` file
4. Map columns correctly
5. Click "Import"

## Recommended: Solution 1 (Temporary Disable RLS)

This is the quickest and safest for a one-time upload:

```sql
-- 1. Disable RLS
ALTER TABLE stars DISABLE ROW LEVEL SECURITY;

-- 2. Run upload script
-- node scripts/upload-stars-to-supabase.js

-- 3. Re-enable RLS
ALTER TABLE stars ENABLE ROW LEVEL SECURITY;

-- 4. Add read policy
CREATE POLICY "Stars are viewable by everyone"
  ON stars FOR SELECT
  USING (true);
```

## After Upload: Verify

```sql
-- Check count
SELECT COUNT(*) FROM stars;
-- Should return 50000

-- Check brightest stars
SELECT name, magnitude 
FROM stars 
WHERE name IS NOT NULL 
ORDER BY magnitude 
LIMIT 10;

-- Check data quality
SELECT 
  COUNT(*) as total,
  COUNT(name) as named_stars,
  MIN(magnitude) as brightest,
  MAX(magnitude) as faintest
FROM stars;
```

## Next Steps

Once stars are uploaded:
1. Update app to use Supabase stars (see UPLOAD_STARS_GUIDE.md)
2. Add star search feature
3. Enable dynamic queries

Choose Solution 1 for the quickest path forward!
