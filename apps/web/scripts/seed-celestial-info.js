/**
 * Seed Celestial Info to Supabase
 * Run this script to populate the celestial_info table with constellation data
 * 
 * Usage: node scripts/seed-celestial-info.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CONSTELLATION_DATA = [
  {
    object_type: 'constellation',
    object_id: 'orion',
    object_name: 'Orion',
    science_summary: 'Orion is one of the most recognizable constellations in the night sky, visible from both hemispheres. It contains two of the brightest stars: Betelgeuse (a red supergiant) and Rigel (a blue supergiant).',
    science_facts: [
      'Betelgeuse is about 700 times larger than our Sun and could explode as a supernova within the next 100,000 years',
      'The Orion Nebula (M42) is the closest massive star-forming region to Earth at about 1,344 light-years away',
      'Rigel is approximately 120,000 times more luminous than the Sun',
      'The three stars of Orion\'s Belt are between 800-2,000 light-years from Earth',
      'Orion contains over 200 stars visible to the naked eye under ideal conditions'
    ],
    distance: 'Stars range from 243 to 2,000 light-years',
    mythology_summary: 'In Greek mythology, Orion was a giant huntsman whom Zeus placed among the stars. He is often depicted facing the charge of Taurus the Bull.',
    mythology_facts: [
      'Orion was said to be the son of Poseidon, god of the sea',
      'According to legend, he was killed by a scorpion sent by Gaia',
      'The Egyptians associated Orion with Osiris, god of the afterlife'
    ],
    origin_culture: 'Greek',
    best_viewing_season: 'December to March (Northern Hemisphere)',
    best_viewing_conditions: 'Best viewed on clear, moonless nights away from city lights',
    observation_tips: [
      'Look for the distinctive three-star belt first',
      'Use binoculars to see the Orion Nebula below the belt',
      'Notice the color contrast between red Betelgeuse and blue Rigel'
    ],
    notable_stars: [
      { name: 'Betelgeuse', description: 'Red supergiant marking Orion\'s shoulder' },
      { name: 'Rigel', description: 'Blue supergiant, 7th brightest star in the sky' },
      { name: 'Bellatrix', description: 'Blue giant marking Orion\'s other shoulder' }
    ],
    notable_deepsky: [
      { id: 'M42', name: 'Orion Nebula', type: 'Emission Nebula', description: 'One of the brightest nebulae, visible to the naked eye' },
      { id: 'IC434', name: 'Horsehead Nebula', type: 'Dark Nebula', description: 'Famous dark nebula shaped like a horse\'s head' }
    ]
  },
  // Add more constellations here...
];

async function seedCelestialInfo() {
  console.log('Seeding celestial info...');
  
  for (const data of CONSTELLATION_DATA) {
    const { error } = await supabase
      .from('celestial_info')
      .upsert(data, { onConflict: 'object_type,object_id' });
    
    if (error) {
      console.error(`Error inserting ${data.object_name}:`, error.message);
    } else {
      console.log(`✓ Inserted ${data.object_name}`);
    }
  }
  
  console.log('Done!');
}

seedCelestialInfo().catch(console.error);
