/**
 * Celestial AI Service
 * Uses Gemini API to generate educational content about celestial objects
 * Caches generated content in Supabase for future use
 */

import { supabase } from '../lib/supabase';
import { CelestialInfo } from './celestial-info-service';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
// Use available Gemini models (2.0/2.5 series)
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest'
];

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

/**
 * Generate celestial info using Gemini API
 */
async function generateWithGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not configured');
    return null;
  }

  // Try each model until one works
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096, // Increased to prevent truncation
          },
        }),
      });

      if (response.ok) {
        const data: GeminiResponse = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text;
        }
      }
    } catch (error) {
      // Continue to next model
    }
  }
  
  return null;
}

/**
 * Build prompt for generating celestial object info
 */
function buildPrompt(objectType: string, objectName: string, objectId: string): string {
  const typeSpecificInfo = getTypeSpecificPrompt(objectType, objectName, objectId);
  
  return `Generate brief educational info about "${objectName}" (${objectType}).

${typeSpecificInfo}

CRITICAL: Return ONLY valid JSON, no markdown, no code blocks. Keep all text SHORT (under 100 chars per field).

{
  "science_summary": "1-2 short sentences max",
  "science_facts": ["short fact 1", "short fact 2", "short fact 3"],
  "distance": "e.g. 400 light-years",
  "size": "brief size info",
  "composition": "brief composition",
  "discovery": "brief discovery info or null",
  "mythology_summary": "Western (Greek/Roman) mythology only",
  "mythology_facts": ["Western myth 1", "Western myth 2"],
  "origin_culture": "Greek, Roman, etc.",
  "indian_mythology": "Indian/Vedic significance - Nakshatra, Rashi references. Use 'Indian' not 'Hindu'",
  "astrology_summary": "Western astrology only",
  "astrology_facts": [],
  "zodiac_sign": "Western zodiac sign",
  "best_viewing_season": "e.g. Winter",
  "best_viewing_conditions": "Clear dark skies",
  "observation_tips": ["tip 1", "tip 2"],
  "notable_stars": [{"name": "Star", "description": "brief"}],
  "notable_deepsky": []
}

IMPORTANT: 
- Keep ALL strings under 100 characters
- For indian_mythology: Include Nakshatra associations, Sanskrit names. Always use "Indian" not "Hindu"
- mythology_summary should ONLY contain Western mythology
- Do NOT duplicate Indian content in mythology_facts`;
}

function getTypeSpecificPrompt(objectType: string, _objectName: string, objectId: string): string {
  switch (objectType.toLowerCase()) {
    case 'constellation':
      return `This is a constellation. Include information about:
- Its position in the sky and visibility
- Major stars within it (with their names and characteristics)
- Any Messier or notable deep sky objects within its boundaries
- Its mythological origin story
- Best time of year to observe it`;
    
    case 'planet':
      return `This is a planet in our solar system. Include information about:
- Physical characteristics (size, mass, composition)
- Orbital period and distance from Sun
- Notable features (rings, moons, atmosphere)
- Historical observations and discoveries
- Current visibility and how to observe it`;
    
    case 'deepsky':
    case 'messier':
      return `This is a deep sky object (${objectId}). Include information about:
- What type of object it is (galaxy, nebula, cluster, etc.)
- Its distance and size
- What makes it notable or interesting
- Discovery history
- How to observe it (naked eye, binoculars, telescope)`;
    
    case 'star':
      return `This is a star. Include information about:
- Spectral type and classification
- Distance from Earth
- Physical characteristics (size, temperature, luminosity)
- Any notable features (variable, binary, etc.)
- Cultural/historical significance`;
    
    case 'moon':
      return `This is Earth's Moon. Include information about:
- Physical characteristics
- Phases and their significance
- Notable features (maria, craters)
- Historical importance in astronomy
- Observation tips for different phases`;
    
    case 'sun':
      return `This is our Sun. Include information about:
- Physical characteristics and composition
- Solar activity (sunspots, flares, etc.)
- Importance for life on Earth
- Safe observation methods
- Historical and cultural significance`;
    
    default:
      return `Include relevant scientific information about this celestial object.`;
  }
}

/**
 * Parse Gemini response into CelestialInfo format
 */
function parseGeminiResponse(
  response: string,
  objectType: string,
  objectId: string,
  objectName: string
): Partial<CelestialInfo> | null {
  try {
    // Clean up the response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.slice(7);
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3);
    }
    cleanResponse = cleanResponse.trim();
    
    // Find JSON object boundaries
    const firstBrace = cleanResponse.indexOf('{');
    const lastBrace = cleanResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleanResponse = cleanResponse.slice(firstBrace, lastBrace + 1);
    }

    // Try to fix common JSON issues
    cleanResponse = cleanResponse
      .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
      .replace(/,\s*}/g, '}') // Remove trailing commas before }
      .replace(/,\s*]/g, ']') // Remove trailing commas before ]
      .replace(/"\s*\n\s*"/g, '", "'); // Fix broken string arrays

    let data;
    try {
      data = JSON.parse(cleanResponse);
    } catch {
      // Try to repair truncated JSON
      let repaired = cleanResponse;
      
      // Count open brackets/braces
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;
      
      // Remove trailing incomplete content
      repaired = repaired.replace(/,\s*"[^"]*$/, '');
      repaired = repaired.replace(/:\s*"[^"]*$/, ': ""');
      repaired = repaired.replace(/,\s*$/, '');
      
      // Close arrays and objects
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += '}';
      }
      
      data = JSON.parse(repaired);
    }
    
    return {
      object_type: objectType.toLowerCase(),
      object_id: objectId.toLowerCase(),
      object_name: objectName,
      science_summary: data.science_summary || null,
      science_facts: Array.isArray(data.science_facts) ? data.science_facts : [],
      distance: data.distance || null,
      size: data.size || null,
      composition: data.composition || null,
      discovery: data.discovery || null,
      mythology_summary: data.mythology_summary || null,
      mythology_facts: Array.isArray(data.mythology_facts) ? data.mythology_facts : [],
      origin_culture: data.origin_culture || null,
      indian_mythology: data.indian_mythology || null,
      astrology_summary: data.astrology_summary || null,
      astrology_facts: Array.isArray(data.astrology_facts) ? data.astrology_facts : [],
      zodiac_sign: data.zodiac_sign || null,
      best_viewing_season: data.best_viewing_season || null,
      best_viewing_conditions: data.best_viewing_conditions || null,
      observation_tips: Array.isArray(data.observation_tips) ? data.observation_tips : [],
      notable_stars: Array.isArray(data.notable_stars) ? data.notable_stars : [],
      notable_deepsky: Array.isArray(data.notable_deepsky) ? data.notable_deepsky : [],
    };
  } catch (error) {
    return null;
  }
}

/**
 * Save generated info to database
 */
async function saveToDB(info: Partial<CelestialInfo>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('celestial_info')
      .upsert({
        ...info,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'object_type,object_id' 
      });

    if (error) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if info exists in database
 */
async function checkDBForInfo(
  objectType: string,
  objectId: string
): Promise<CelestialInfo | null> {
  try {
    const { data, error } = await supabase
      .from('celestial_info')
      .select('*')
      .eq('object_type', objectType.toLowerCase())
      .eq('object_id', objectId.toLowerCase())
      .single();

    if (error || !data) return null;
    return data as CelestialInfo;
  } catch {
    return null;
  }
}

/**
 * Main function: Get or generate celestial info
 * First checks database, then generates with AI if not found
 */
export async function getOrGenerateCelestialInfo(
  objectType: string,
  objectId: string,
  objectName: string
): Promise<CelestialInfo | null> {
  // First, check database
  const existingInfo = await checkDBForInfo(objectType, objectId);
  if (existingInfo) {
    return existingInfo;
  }

  // Not in database, generate with AI
  const prompt = buildPrompt(objectType, objectName, objectId);
  const response = await generateWithGemini(prompt);
  
  if (!response) {
    return null;
  }

  // Parse the response
  const parsedInfo = parseGeminiResponse(response, objectType, objectId, objectName);
  if (!parsedInfo) {
    return null;
  }

  // Save to database for future use
  await saveToDB(parsedInfo);

  return parsedInfo as CelestialInfo;
}

/**
 * Batch generate info for multiple objects (useful for seeding)
 */
export async function batchGenerateCelestialInfo(
  objects: Array<{ type: string; id: string; name: string }>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const obj of objects) {
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = await getOrGenerateCelestialInfo(obj.type, obj.id, obj.name);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

// List of all 88 constellations for reference
export const ALL_CONSTELLATIONS = [
  'Andromeda', 'Antlia', 'Apus', 'Aquarius', 'Aquila', 'Ara', 'Aries', 'Auriga',
  'Boötes', 'Caelum', 'Camelopardalis', 'Cancer', 'Canes Venatici', 'Canis Major',
  'Canis Minor', 'Capricornus', 'Carina', 'Cassiopeia', 'Centaurus', 'Cepheus',
  'Cetus', 'Chamaeleon', 'Circinus', 'Columba', 'Coma Berenices', 'Corona Australis',
  'Corona Borealis', 'Corvus', 'Crater', 'Crux', 'Cygnus', 'Delphinus', 'Dorado',
  'Draco', 'Equuleus', 'Eridanus', 'Fornax', 'Gemini', 'Grus', 'Hercules',
  'Horologium', 'Hydra', 'Hydrus', 'Indus', 'Lacerta', 'Leo', 'Leo Minor', 'Lepus',
  'Libra', 'Lupus', 'Lynx', 'Lyra', 'Mensa', 'Microscopium', 'Monoceros', 'Musca',
  'Norma', 'Octans', 'Ophiuchus', 'Orion', 'Pavo', 'Pegasus', 'Perseus', 'Phoenix',
  'Pictor', 'Pisces', 'Piscis Austrinus', 'Puppis', 'Pyxis', 'Reticulum', 'Sagitta',
  'Sagittarius', 'Scorpius', 'Sculptor', 'Scutum', 'Serpens', 'Sextans', 'Taurus',
  'Telescopium', 'Triangulum', 'Triangulum Australe', 'Tucana', 'Ursa Major',
  'Ursa Minor', 'Vela', 'Virgo', 'Volans', 'Vulpecula'
];

// List of planets
export const PLANETS = [
  { id: 'mercury', name: 'Mercury' },
  { id: 'venus', name: 'Venus' },
  { id: 'mars', name: 'Mars' },
  { id: 'jupiter', name: 'Jupiter' },
  { id: 'saturn', name: 'Saturn' },
  { id: 'uranus', name: 'Uranus' },
  { id: 'neptune', name: 'Neptune' },
];

// Notable Messier objects
export const MESSIER_OBJECTS = [
  { id: 'M1', name: 'Crab Nebula' },
  { id: 'M13', name: 'Hercules Globular Cluster' },
  { id: 'M31', name: 'Andromeda Galaxy' },
  { id: 'M42', name: 'Orion Nebula' },
  { id: 'M45', name: 'Pleiades' },
  { id: 'M51', name: 'Whirlpool Galaxy' },
  { id: 'M57', name: 'Ring Nebula' },
  { id: 'M81', name: 'Bode\'s Galaxy' },
  { id: 'M82', name: 'Cigar Galaxy' },
  { id: 'M101', name: 'Pinwheel Galaxy' },
  { id: 'M104', name: 'Sombrero Galaxy' },
];
