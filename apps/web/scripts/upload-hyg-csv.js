/**
 * Upload HYG v4.2 CSV Stars Database to Supabase
 * 
 * This script uploads stars from the HYG CSV file to Supabase,
 * avoiding duplicates by using upsert on hip_id.
 * 
 * Usage: node apps/web/scripts/upload-hyg-csv.js
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

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

// Extract first letter of spectral type
function getSpectralClass(spect) {
  if (!spect || spect === '') return 'G'; // Default to G
  const firstChar = spect.charAt(0).toUpperCase();
  if (['O', 'B', 'A', 'F', 'G', 'K', 'M'].includes(firstChar)) {
    return firstChar;
  }
  return 'G'; // Default
}

async function getExistingStarCount() {
  const { count, error } = await supabase
    .from('stars')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error getting star count:', error);
    return 0;
  }
  return count || 0;
}

async function uploadStars() {
  console.log('🌟 Starting HYG CSV upload to Supabase...\n');
  
  // Check existing count
  const existingCount = await getExistingStarCount();
  console.log(`📊 Current stars in database: ${existingCount}`);
  
  // Read CSV file
  const csvPath = path.join(__dirname, '../../../hyg_v42.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found at:', csvPath);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  console.log(`📋 CSV columns: ${header.length}`);
  
  // Find column indices
  const hipIdx = header.indexOf('hip');
  const raIdx = header.indexOf('ra');
  const decIdx = header.indexOf('dec');
  const magIdx = header.indexOf('mag');
  const properIdx = header.indexOf('proper');
  const spectIdx = header.indexOf('spect');
  
  console.log(`   hip: col ${hipIdx}, ra: col ${raIdx}, dec: col ${decIdx}, mag: col ${magIdx}, proper: col ${properIdx}, spect: col ${spectIdx}`);
  
  // Parse stars
  const stars = [];
  let skippedNoHip = 0;
  let skippedNoCoords = 0;
  let skippedFaint = 0;
  
  // Maximum magnitude to include (fainter = higher number)
  const MAX_MAGNITUDE = 10.0;
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    const hipStr = values[hipIdx];
    const raStr = values[raIdx];
    const decStr = values[decIdx];
    const magStr = values[magIdx];
    const proper = values[properIdx];
    const spect = values[spectIdx];
    
    // Skip if no HIP ID (we need it for deduplication)
    if (!hipStr || hipStr === '') {
      skippedNoHip++;
      continue;
    }
    
    const hip = parseInt(hipStr);
    const ra = parseFloat(raStr);
    const dec = parseFloat(decStr);
    const mag = parseFloat(magStr);
    
    // Skip if invalid coordinates
    if (isNaN(ra) || isNaN(dec)) {
      skippedNoCoords++;
      continue;
    }
    
    // Skip very faint stars
    if (isNaN(mag) || mag > MAX_MAGNITUDE) {
      skippedFaint++;
      continue;
    }
    
    stars.push({
      hip_id: hip,
      ra: ra,
      dec: dec,
      magnitude: mag,
      name: proper && proper !== '' ? proper : null,
      spectral_type: getSpectralClass(spect),
    });
  }
  
  console.log(`\n📊 Parsed ${stars.length} stars from CSV`);
  console.log(`   Skipped ${skippedNoHip} stars without HIP ID`);
  console.log(`   Skipped ${skippedNoCoords} stars with invalid coordinates`);
  console.log(`   Skipped ${skippedFaint} stars fainter than magnitude ${MAX_MAGNITUDE}`);
  
  // Upload in batches using upsert to avoid duplicates
  const batchSize = 1000;
  let uploaded = 0;
  let errors = 0;
  
  console.log(`\n🚀 Uploading ${stars.length} stars in batches of ${batchSize}...`);
  
  for (let i = 0; i < stars.length; i += batchSize) {
    const batch = stars.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('stars')
      .upsert(batch, { 
        onConflict: 'hip_id',
        ignoreDuplicates: false // Update existing records
      });
    
    if (error) {
      console.error(`❌ Error uploading batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errors++;
      continue;
    }
    
    uploaded += batch.length;
    const percent = ((uploaded / stars.length) * 100).toFixed(1);
    process.stdout.write(`\r✅ Uploaded ${uploaded}/${stars.length} stars (${percent}%)`);
  }
  
  console.log('\n');
  
  // Get final count
  const finalCount = await getExistingStarCount();
  const newStars = finalCount - existingCount;
  
  console.log('📊 Summary:');
  console.log(`   Previous count: ${existingCount}`);
  console.log(`   Final count: ${finalCount}`);
  console.log(`   New stars added: ${newStars}`);
  console.log(`   Stars updated: ${uploaded - newStars}`);
  
  if (errors > 0) {
    console.log(`   ⚠️  Batches with errors: ${errors}`);
  }
  
  console.log('\n🎉 Upload complete!');
}

uploadStars().catch(error => {
  console.error('❌ Upload failed:', error);
  process.exit(1);
});
