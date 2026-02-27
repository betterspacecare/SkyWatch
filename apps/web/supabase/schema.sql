-- SkyWatch Database Schema for Supabase
-- INTEGRATION WITH EXISTING DATABASE
-- Only run the parts you don't already have

-- NOTE: You already have these tables, so SKIP them:
-- - stars (already exists)
-- - observations (already exists)  
-- - user_favorites (already exists)
-- - users (already exists)

-- Your existing schema is compatible! Just verify these indexes exist:

-- Indexes for stars table (if not already present)
CREATE INDEX IF NOT EXISTS idx_stars_magnitude ON stars(magnitude);
CREATE INDEX IF NOT EXISTS idx_stars_ra_dec ON stars(ra, dec);
CREATE INDEX IF NOT EXISTS idx_stars_hip_id ON stars(hip_id);

-- Indexes for observations (if not already present)
CREATE INDEX IF NOT EXISTS idx_observations_user_id ON observations(user_id);
CREATE INDEX IF NOT EXISTS idx_observations_category ON observations(category);
CREATE INDEX IF NOT EXISTS idx_observations_date ON observations(observation_date DESC);

-- Indexes for user_favorites (if not already present)
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_object_type ON user_favorites(object_type);

-- Helper functions for spatial queries

-- Function to get stars within a region
CREATE OR REPLACE FUNCTION get_stars_in_region(
  min_ra DOUBLE PRECISION,
  max_ra DOUBLE PRECISION,
  min_dec DOUBLE PRECISION,
  max_dec DOUBLE PRECISION,
  max_magnitude DOUBLE PRECISION DEFAULT 8.5
)
RETURNS SETOF stars AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM stars
  WHERE ra >= min_ra
    AND ra <= max_ra
    AND dec >= min_dec
    AND dec <= max_dec
    AND magnitude <= max_magnitude
  ORDER BY magnitude ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get brightest stars
CREATE OR REPLACE FUNCTION get_brightest_stars(
  limit_count INTEGER DEFAULT 1000
)
RETURNS SETOF stars AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM stars
  ORDER BY magnitude ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get stars by magnitude range
CREATE OR REPLACE FUNCTION get_stars_by_magnitude(
  min_mag DOUBLE PRECISION DEFAULT -2.0,
  max_mag DOUBLE PRECISION DEFAULT 8.5,
  limit_count INTEGER DEFAULT 10000
)
RETURNS SETOF stars AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM stars
  WHERE magnitude >= min_mag
    AND magnitude <= max_mag
  ORDER BY magnitude ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON FUNCTION get_stars_in_region IS 'Get stars within a specific RA/Dec region';
COMMENT ON FUNCTION get_brightest_stars IS 'Get the N brightest stars';
COMMENT ON FUNCTION get_stars_by_magnitude IS 'Get stars within a magnitude range';

