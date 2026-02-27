/**
 * Upload Missing Bright Stars to Supabase
 * 
 * This script uploads the brightest stars that were missed in the initial upload
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadMissingStars() {
  console.log('🌟 Checking for missing bright stars...');
  
  // Load all stars from JSON
  const starsPath = path.join(__dirname, '../public/data/bright-stars.json');
  const starsData = JSON.parse(fs.readFileSync(starsPath, 'utf8'));
  
  console.log(`📊 Local database has ${starsData.totalStars} stars`);
  
  // Get brightest 5000 stars (these are most important for constellations)
  const brightestStars = starsData.stars
    .filter(s => s.mag < 6.0)
    .slice(0, 5000);
  
  console.log(`🔍 Checking ${brightestStars.length} brightest stars...`);
  
  // Check which ones are missing from Supabase (in batches)
  const hipIds = brightestStars
    .filter(s => s.hipId)
    .map(s => s.hipId);
  
  console.log(`🔍 Checking ${hipIds.length} HIP IDs in database...`);
  
  const existingHipIds = new Set();
  const checkBatchSize = 100;
  
  for (let i = 0; i < hipIds.length; i += checkBatchSize) {
    const batch = hipIds.slice(i, i + checkBatchSize);
    const { data, error } = await supabase
      .from('stars')
      .select('hip_id')
      .in('hip_id', batch);
    
    if (error) {
      console.error(`Error checking batch ${i}:`, error.message);
      continue;
    }
    
    (data || []).forEach(s => existingHipIds.add(s.hip_id));
  }
  
  const missingStars = brightestStars.filter(s => s.hipId && !existingHipIds.has(s.hipId));
  
  console.log(`✅ Found ${existingHipIds.size} stars already in database`);
  console.log(`❌ Missing ${missingStars.length} bright stars`);
  
  if (missingStars.length === 0) {
    console.log('🎉 All bright stars are already in the database!');
    return;
  }
  
  // Show some missing stars
  console.log('\n📋 Sample of missing stars:');
  missingStars.slice(0, 10).forEach(star => {
    console.log(`   - ${star.name || `HIP${star.hipId}`} (mag ${star.mag.toFixed(2)})`);
  });
  
  // Upload missing stars
  console.log(`\n📤 Uploading ${missingStars.length} missing stars...`);
  
  const starsToUpload = missingStars.map(star => ({
    hip_id: star.hipId,
    ra: star.ra,
    dec: star.dec,
    magnitude: star.mag,
    name: star.name || null,
    spectral_type: star.spectralType,
  }));
  
  // Upload in batches
  const batchSize = 500;
  let uploaded = 0;
  
  for (let i = 0; i < starsToUpload.length; i += batchSize) {
    const batch = starsToUpload.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('stars')
      .upsert(batch, { onConflict: 'hip_id' });
    
    if (error) {
      console.error(`❌ Error uploading batch:`, error.message);
      // Wait and retry
      await new Promise(r => setTimeout(r, 2000));
      const { error: retryError } = await supabase
        .from('stars')
        .upsert(batch, { onConflict: 'hip_id' });
      if (retryError) {
        console.error(`❌ Retry failed:`, retryError.message);
        continue;
      }
    }
    
    uploaded += batch.length;
    console.log(`✅ Uploaded ${uploaded}/${starsToUpload.length} missing stars`);
  }
  
  // Verify
  const { count } = await supabase
    .from('stars')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n🎉 Done! Total stars in database: ${count}`);
  
  // Check brightest stars
  const { data: brightest } = await supabase
    .from('stars')
    .select('name, magnitude')
    .not('name', 'is', null)
    .order('magnitude', { ascending: true })
    .limit(10);
  
  console.log('\n🌟 Brightest named stars in database:');
  brightest?.forEach((star, i) => {
    console.log(`   ${i + 1}. ${star.name} (mag ${star.magnitude.toFixed(2)})`);
  });
}

uploadMissingStars().catch(error => {
  console.error('❌ Upload failed:', error);
  process.exit(1);
});
