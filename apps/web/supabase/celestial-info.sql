-- Celestial Object Information Table
-- Stores educational content about celestial objects (constellations, stars, planets, etc.)

CREATE TABLE IF NOT EXISTS celestial_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type VARCHAR(50) NOT NULL, -- 'constellation', 'star', 'planet', 'deepsky', 'moon', 'sun'
  object_id VARCHAR(100) NOT NULL, -- e.g., 'orion', 'sirius', 'mars', 'M31'
  object_name VARCHAR(200) NOT NULL,
  
  -- Science section (primary focus)
  science_summary TEXT, -- Brief scientific overview
  science_facts JSONB DEFAULT '[]', -- Array of scientific facts
  distance TEXT, -- Distance from Earth
  size TEXT, -- Physical size/dimensions
  composition TEXT, -- What it's made of
  discovery TEXT, -- Discovery history
  
  -- Mythology section
  mythology_summary TEXT, -- Brief mythology overview
  mythology_facts JSONB DEFAULT '[]', -- Array of mythology facts
  origin_culture VARCHAR(100), -- Primary cultural origin (Greek, Roman, etc.)
  
  -- Astrology section (for reference only, clearly marked as non-scientific)
  astrology_summary TEXT,
  astrology_facts JSONB DEFAULT '[]',
  zodiac_sign VARCHAR(50), -- Associated zodiac sign if applicable
  
  -- Observation tips
  best_viewing_season VARCHAR(100),
  best_viewing_conditions TEXT,
  observation_tips JSONB DEFAULT '[]',
  
  -- Notable objects within (for constellations)
  notable_stars JSONB DEFAULT '[]', -- Array of {name, description}
  notable_deepsky JSONB DEFAULT '[]', -- Array of {id, name, type, description}
  
  -- Media
  image_url TEXT,
  thumbnail_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(object_type, object_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_celestial_info_type ON celestial_info(object_type);
CREATE INDEX IF NOT EXISTS idx_celestial_info_object_id ON celestial_info(object_id);
CREATE INDEX IF NOT EXISTS idx_celestial_info_name ON celestial_info(object_name);

-- Function to get celestial info
CREATE OR REPLACE FUNCTION get_celestial_info(
  p_object_type VARCHAR,
  p_object_id VARCHAR
)
RETURNS celestial_info AS $$
BEGIN
  RETURN (
    SELECT * FROM celestial_info
    WHERE object_type = p_object_type
    AND object_id = p_object_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_celestial_info_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS celestial_info_updated_at ON celestial_info;
CREATE TRIGGER celestial_info_updated_at
  BEFORE UPDATE ON celestial_info
  FOR EACH ROW
  EXECUTE FUNCTION update_celestial_info_timestamp();

-- Enable RLS
ALTER TABLE celestial_info ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON celestial_info
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update (for admin purposes)
CREATE POLICY "Allow authenticated insert" ON celestial_info
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON celestial_info
  FOR UPDATE USING (auth.role() = 'authenticated');

COMMENT ON TABLE celestial_info IS 'Educational information about celestial objects';
