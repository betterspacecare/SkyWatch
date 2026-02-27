/**
 * Build Bright Stars Database
 * 
 * This script fetches bright stars (magnitude <= 6.0) from the HYG database
 * to populate the sky with visible stars beyond just constellation stars.
 * 
 * Data source: HYG Database v4.2 (http://astronexus.com/hyg) - Public Domain
 * 
 * Run: node apps/web/scripts/build-bright-stars.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// HYG Database v4.2 CSV URL (uncompressed)
const HYG_CSV_URL = 'https://admin.skyguild.club/hyg_v42.csv';

// Configuration
const MAX_MAGNITUDE = 8.5; // Include very faint stars for zoomed-in views
const MAX_STARS = 50000; // Increase limit to ensure full sky coverage

console.log(`🌟 Building bright stars database (magnitude <= ${MAX_MAGNITUDE})...`);

// Fetch and parse HYG CSV
https.get(HYG_CSV_URL, (response) => {
  let csvData = '';
  
  response.on('data', (chunk) => {
    csvData += chunk;
  });
  
  response.on('end', () => {
    console.log(`✅ Downloaded HYG database (${(csvData.length / 1024 / 1024).toFixed(2)} MB)`);
    parseAndBuildDatabase(csvData);
  });
}).on('error', (err) => {
  console.error('❌ Error fetching HYG database:', err.message);
  process.exit(1);
});

function parseAndBuildDatabase(csvData) {
  const lines = csvData.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  console.log(`📋 CSV Headers: ${headers.slice(0, 10).join(', ')}...`);
  
  // Find column indices
  const hipIndex = headers.indexOf('hip');
  const raIndex = headers.indexOf('ra');
  const decIndex = headers.indexOf('dec');
  const magIndex = headers.indexOf('mag');
  const properIndex = headers.indexOf('proper');
  const spectIndex = headers.indexOf('spect');
  
  console.log(`📍 Column indices - hip: ${hipIndex}, ra: ${raIndex}, dec: ${decIndex}, mag: ${magIndex}, proper: ${properIndex}, spect: ${spectIndex}`);

  
  if (hipIndex === -1 || raIndex === -1 || decIndex === -1 || magIndex === -1) {
    console.error('❌ Required columns not found in CSV');
    process.exit(1);
  }
  
  const brightStars = [];
  let processedLines = 0;
  
  // Parse CSV and extract bright stars
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    processedLines++;
    
    // Simple CSV parsing (handles quoted fields)
    const cols = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current); // Add last column
    
    const mag = parseFloat(cols[magIndex]);
    
    // Only include bright stars (magnitude <= 6.0)
    if (isNaN(mag) || mag > MAX_MAGNITUDE) continue;
    
    const hipStr = cols[hipIndex]?.trim();
    const hipId = hipStr ? parseInt(hipStr) : null;
    const ra = parseFloat(cols[raIndex]);
    const dec = parseFloat(cols[decIndex]);
    const name = cols[properIndex]?.replace(/"/g, '').trim() || '';
    const spect = cols[spectIndex]?.replace(/"/g, '').trim() || 'G';
    
    if (!isNaN(ra) && !isNaN(dec)) {
      // Determine spectral type (first letter)
      const spectralType = spect.charAt(0).toUpperCase() || 'G';
      
      brightStars.push({
        id: hipId ? `HIP${hipId}` : `STAR${i}`,
        hipId: hipId,
        ra: ra,
        dec: dec,
        mag: mag,
        name: name,
        spectralType: ['O', 'B', 'A', 'F', 'G', 'K', 'M'].includes(spectralType) ? spectralType : 'G'
      });
    }
    
    // Progress indicator
    if (processedLines % 10000 === 0) {
      console.log(`⏳ Processed ${processedLines} lines, found ${brightStars.length} bright stars...`);
    }
  }
  
  console.log(`✅ Found ${brightStars.length} stars with magnitude <= ${MAX_MAGNITUDE}`);
  
  // Sort by magnitude (brightest first) to ensure even distribution
  brightStars.sort((a, b) => a.mag - b.mag);
  
  // Limit to MAX_STARS after sorting
  if (brightStars.length > MAX_STARS) {
    console.log(`⚠️  Limiting to ${MAX_STARS} brightest stars`);
    brightStars.length = MAX_STARS;
  }
  
  console.log(`✅ Found ${brightStars.length} bright stars (magnitude <= ${MAX_MAGNITUDE})`);
  
  // Calculate statistics
  const spectralCounts = {};
  brightStars.forEach(star => {
    spectralCounts[star.spectralType] = (spectralCounts[star.spectralType] || 0) + 1;
  });
  
  console.log(`📊 Spectral type distribution:`, spectralCounts);
  console.log(`📊 Brightest star: ${brightStars[0].name || brightStars[0].id} (mag ${brightStars[0].mag.toFixed(2)})`);
  console.log(`📊 Faintest star: mag ${brightStars[brightStars.length - 1].mag.toFixed(2)}`);
  
  saveDatabase(brightStars);
}

function saveDatabase(brightStars) {
  const output = {
    version: '1.0',
    source: 'HYG Database v4.2 (http://astronexus.com/hyg) - Public Domain',
    generated: new Date().toISOString(),
    maxMagnitude: MAX_MAGNITUDE,
    totalStars: brightStars.length,
    stars: brightStars
  };
  
  const outputPath = path.join(__dirname, '../public/data/bright-stars.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`✅ Created ${outputPath}`);
  console.log(`📊 Total stars: ${output.totalStars}`);
  console.log(`📦 File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
}
