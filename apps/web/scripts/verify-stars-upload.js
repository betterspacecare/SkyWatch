/**
 * Verify Stars Upload
 * Check how many stars were successfully uploaded to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyUpload() {
  console.log('🔍 Verifying stars upload...\n');
  
  // Get total count
  const { count, error: countError } = await supabase
    .from('stars')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('❌ Error getting count:', countError);
    return;
  }
  
  console.log(`✅ Total stars in database: ${count}`);
  
  // Get brightest stars
  const { data: brightStars, error: brightError } = await supabase
    .from('stars')
    .select('name, magnitude, spectral_type')
    .not('name', 'is', null)
    .order('magnitude', { ascending: true })
    .limit(10);
  
  if (!brightError && brightStars) {
    console.log('\n🌟 Top 10 Brightest Named Stars:');
    brightStars.forEach((star, i) => {
      console.log(`${i + 1}. ${star.name.padEnd(20)} Mag: ${star.magnitude.toFixed(2).padStart(6)}  Type: ${star.spectral_type}`);
    });
  }
  
  // Get magnitude distribution
  const { data: stats, error: statsError } = await supabase
    .from('stars')
    .select('magnitude')
    .order('magnitude', { ascending: true });
  
  if (!statsError && stats) {
    const namedCount = await supabase
      .from('stars')
      .select('*', { count: 'exact', head: true })
      .not('name', 'is', null);
    
    console.log('\n📊 Database Statistics:');
    console.log(`   Total stars: ${count}`);
    console.log(`   Named stars: ${namedCount.count}`);
    console.log(`   Brightest: ${stats[0].magnitude.toFixed(2)}`);
    console.log(`   Faintest: ${stats[stats.length - 1].magnitude.toFixed(2)}`);
  }
  
  console.log('\n✅ Verification complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Your stars are ready to use!');
  console.log('   2. Check STARS_DATABASE_SUMMARY.md for usage examples');
  console.log('   3. Use the star-loader service to load stars in your app');
}

verifyUpload().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
