/**
 * Upload Stars Database to Supabase
 * 
 * This script uploads the bright stars database to your Supabase instance.
 * Run after setting up the database schema.
 * 
 * Usage: node apps/web/scripts/upload-stars-to-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env.local');
  console.error('Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadStars() {
  console.log('🌟 Starting star database upload to Supabase...');
  
  // Load stars from JSON
  const starsPath = path.join(__dirname, '../public/data/bright-stars.json');
  const starsData = JSON.parse(fs.readFileSync(starsPath, 'utf8'));
  
  console.log(`📊 Loaded ${starsData.totalStars} stars from local database`);
  
  // Prepare data for Supabase
  const starsToUpload = starsData.stars.map(star => ({
    hip_id: star.hipId,
    ra: star.ra,
    dec: star.dec,
    magnitude: star.mag,
    name: star.name || null,
    spectral_type: star.spectralType,
  }));
  
  // Upload in batches (Supabase has a limit)
  const batchSize = 1000;
  let uploaded = 0;
  
  for (let i = 0; i < starsToUpload.length; i += batchSize) {
    const batch = starsToUpload.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('stars')
      .upsert(batch, { onConflict: 'hip_id' });
    
    if (error) {
      console.error(`❌ Error uploading batch ${Math.floor(i / batchSize) + 1}:`, error);
      continue;
    }
    
    uploaded += batch.length;
    console.log(`✅ Uploaded ${uploaded}/${starsToUpload.length} stars (${((uploaded / starsToUpload.length) * 100).toFixed(1)}%)`);
  }
  
  console.log(`🎉 Successfully uploaded ${uploaded} stars to Supabase!`);
}

uploadStars().catch(error => {
  console.error('❌ Upload failed:', error);
  process.exit(1);
});
