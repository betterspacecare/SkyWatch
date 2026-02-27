-- Stars Table Schema for Supabase
-- Run this in your Supabase SQL Editor before uploading stars

-- Create stars table
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
CREATE INDEX IF NOT EXISTS idx_stars_name ON stars(name) WHERE name IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE stars ENABLE ROW LEVEL SECURITY;

-- Allow public read access to stars (everyone can view)
DROP POLICY IF EXISTS "Stars are viewable by everyone" ON stars;
CREATE POLICY "Stars are viewable by everyone"
  ON stars FOR SELECT
  USING (true);

-- Only authenticated users can insert/update (for admin purposes)
DROP POLICY IF EXISTS "Authenticated users can insert stars" ON stars;
CREATE POLICY "Authenticated users can insert stars"
  ON stars FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update stars" ON stars;
CREATE POLICY "Authenticated users can update stars"
  ON stars FOR UPDATE
  TO authenticated
  USING (true);

-- Comments for documentation
COMMENT ON TABLE stars IS 'Catalog of 50,000 stars from HYG Database v4.2';
COMMENT ON COLUMN stars.hip_id IS 'Hipparcos catalog ID (unique identifier)';
COMMENT ON COLUMN stars.ra IS 'Right Ascension in hours (0-24)';
COMMENT ON COLUMN stars.dec IS 'Declination in degrees (-90 to +90)';
COMMENT ON COLUMN stars.magnitude IS 'Apparent visual magnitude (brightness)';
COMMENT ON COLUMN stars.name IS 'Common name of the star (if any)';
COMMENT ON COLUMN stars.spectral_type IS 'Spectral classification (O, B, A, F, G, K, M)';

-- Verify table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'stars'
ORDER BY ordinal_position;
