const stars = require('./packages/astronomy-engine/data/stars.json');
const constellations = require('./packages/astronomy-engine/data/constellations.json');

const orion = constellations.find(c => c.id === 'ori');
const orionHipIds = new Set();
orion.lines.forEach(l => {
  orionHipIds.add(l.star1.hipId);
  orionHipIds.add(l.star2.hipId);
});

const orionStars = stars.stars.filter(s => orionHipIds.has(parseInt(s.id.replace('HIP', ''))));
console.log('Orion constellation stars:');
orionStars.forEach(s => console.log(`  ${s.name.padEnd(15)} mag ${s.magnitude.toFixed(2)}`));
console.log(`\nMax magnitude: ${Math.max(...orionStars.map(s => s.magnitude)).toFixed(2)}`);
console.log(`Total Orion stars: ${orionStars.length}`);
