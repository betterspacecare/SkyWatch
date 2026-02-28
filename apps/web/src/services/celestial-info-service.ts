/**
 * Celestial Info Service
 * Fetches educational information about celestial objects from the database
 */

import { supabase } from '../lib/supabase';

export interface CelestialInfo {
  id: string;
  object_type: string;
  object_id: string;
  object_name: string;
  
  // Science
  science_summary: string | null;
  science_facts: string[];
  distance: string | null;
  size: string | null;
  composition: string | null;
  discovery: string | null;
  
  // Mythology
  mythology_summary: string | null;
  mythology_facts: string[];
  origin_culture: string | null;
  indian_mythology: string | null; // Hindu/Vedic mythology and Nakshatra references
  
  // Astrology
  astrology_summary: string | null;
  astrology_facts: string[];
  zodiac_sign: string | null;
  
  // Observation
  best_viewing_season: string | null;
  best_viewing_conditions: string | null;
  observation_tips: string[];
  
  // Notable objects
  notable_stars: { name: string; description: string }[];
  notable_deepsky: { id: string; name: string; type: string; description: string }[];
  
  // Media
  image_url: string | null;
  thumbnail_url: string | null;
}

/**
 * Fetch celestial info from database
 */
export async function getCelestialInfo(
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

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - not an error, just no data
        return null;
      }
      console.error('Error fetching celestial info:', error);
      return null;
    }

    return data as CelestialInfo;
  } catch (err) {
    console.error('Error in getCelestialInfo:', err);
    return null;
  }
}

/**
 * Get all celestial info for a type (e.g., all constellations)
 */
export async function getAllCelestialInfoByType(
  objectType: string
): Promise<CelestialInfo[]> {
  try {
    const { data, error } = await supabase
      .from('celestial_info')
      .select('*')
      .eq('object_type', objectType.toLowerCase())
      .order('object_name');

    if (error) {
      console.error('Error fetching celestial info by type:', error);
      return [];
    }

    return (data || []) as CelestialInfo[];
  } catch (err) {
    console.error('Error in getAllCelestialInfoByType:', err);
    return [];
  }
}

/**
 * Fallback constellation data when database is empty
 * This provides basic info for the 88 constellations
 */
export const CONSTELLATION_FALLBACK_DATA: Record<string, Partial<CelestialInfo>> = {
  orion: {
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
      'According to legend, he was killed by a scorpion sent by Gaia, which is why Orion and Scorpius are never visible in the sky at the same time',
      'The Egyptians associated Orion with Osiris, god of the afterlife'
    ],
    origin_culture: 'Greek',
    astrology_summary: 'While not a zodiac constellation, Orion has been associated with strength, hunting, and winter in various astrological traditions.',
    astrology_facts: [
      'Orion rises in late autumn in the Northern Hemisphere, traditionally marking the start of hunting season',
      'Some traditions associate Orion with courage and adventure'
    ],
    best_viewing_season: 'December to March (Northern Hemisphere)',
    best_viewing_conditions: 'Best viewed on clear, moonless nights away from city lights',
    observation_tips: [
      'Look for the distinctive three-star belt first',
      'Use binoculars to see the Orion Nebula below the belt',
      'Notice the color contrast between red Betelgeuse and blue Rigel'
    ],
    notable_stars: [
      { name: 'Betelgeuse', description: 'Red supergiant marking Orion\'s shoulder, one of the largest known stars' },
      { name: 'Rigel', description: 'Blue supergiant marking Orion\'s foot, the 7th brightest star in the sky' },
      { name: 'Bellatrix', description: 'Blue giant marking Orion\'s other shoulder' },
      { name: 'Mintaka', description: 'Westernmost star of Orion\'s Belt' },
      { name: 'Alnilam', description: 'Central star of Orion\'s Belt' },
      { name: 'Alnitak', description: 'Easternmost star of Orion\'s Belt' }
    ],
    notable_deepsky: [
      { id: 'M42', name: 'Orion Nebula', type: 'Emission Nebula', description: 'One of the brightest nebulae, visible to the naked eye' },
      { id: 'M43', name: 'De Mairan\'s Nebula', type: 'Emission Nebula', description: 'Part of the Orion Nebula complex' },
      { id: 'IC434', name: 'Horsehead Nebula', type: 'Dark Nebula', description: 'Famous dark nebula shaped like a horse\'s head' }
    ]
  },
  ursa_major: {
    object_name: 'Ursa Major',
    science_summary: 'Ursa Major (the Great Bear) is the third-largest constellation and contains the famous Big Dipper asterism. Many of its stars are part of a moving group traveling together through space.',
    science_facts: [
      'Five of the Big Dipper stars belong to the Ursa Major Moving Group, traveling together at about 14 km/s',
      'Mizar and Alcor form a famous naked-eye double star, though Mizar itself is actually a quadruple star system',
      'The two "pointer stars" of the Big Dipper point toward Polaris, the North Star',
      'Ursa Major contains several galaxies including M81 and M82',
      'The constellation covers 1,280 square degrees of sky'
    ],
    distance: 'Stars range from 79 to 124 light-years',
    mythology_summary: 'In Greek mythology, Ursa Major represents Callisto, a nymph transformed into a bear by Zeus to protect her from Hera\'s jealousy.',
    mythology_facts: [
      'Native American cultures saw the Big Dipper as a bear being chased by hunters',
      'In Hindu astronomy, the seven stars represent the Seven Sages (Saptarishi)',
      'Ancient Egyptians saw it as the leg of a bull'
    ],
    origin_culture: 'Greek',
    best_viewing_season: 'Year-round in Northern Hemisphere (circumpolar)',
    observation_tips: [
      'Use the pointer stars to find Polaris',
      'Look for Mizar and Alcor - a test of good eyesight',
      'The Big Dipper\'s handle points to Arcturus ("arc to Arcturus")'
    ]
  },
  scorpius: {
    object_name: 'Scorpius',
    science_summary: 'Scorpius is a zodiac constellation containing the bright red supergiant Antares. Its distinctive curved shape resembles a scorpion\'s tail.',
    science_facts: [
      'Antares is about 700 times larger than the Sun and 10,000 times more luminous',
      'The constellation lies along the Milky Way and contains many star clusters',
      'Scorpius contains the X-ray source Scorpius X-1, the first X-ray source discovered outside our solar system',
      'The star-forming region Rho Ophiuchi is nearby',
      'Several globular clusters (M4, M80) are visible in this region'
    ],
    distance: 'Antares is about 550 light-years away',
    mythology_summary: 'In Greek mythology, Scorpius is the scorpion that killed Orion. The gods placed them on opposite sides of the sky so they would never meet again.',
    mythology_facts: [
      'The scorpion was sent by Gaia (Earth) to kill Orion for his boastfulness',
      'Polynesian cultures saw it as a fishhook',
      'In Chinese astronomy, it was part of the Azure Dragon'
    ],
    origin_culture: 'Greek',
    zodiac_sign: 'Scorpio',
    best_viewing_season: 'June to August (Northern Hemisphere)',
    observation_tips: [
      'Look for the red color of Antares',
      'The curved tail is distinctive and easy to spot',
      'Best viewed from southern latitudes'
    ]
  },
  leo: {
    object_name: 'Leo',
    science_summary: 'Leo is a zodiac constellation representing a lion. It contains the bright star Regulus and is home to several galaxies including the Leo Triplet.',
    science_facts: [
      'Regulus is a quadruple star system about 79 light-years away',
      'The Leo Triplet (M65, M66, NGC 3628) is a group of interacting galaxies',
      'Leo contains many galaxies because it lies away from the Milky Way\'s plane',
      'The Leonid meteor shower radiates from this constellation every November',
      'Regulus spins so fast it\'s noticeably flattened at the poles'
    ],
    distance: 'Regulus is 79 light-years away',
    mythology_summary: 'Leo represents the Nemean Lion slain by Hercules as the first of his twelve labors. The lion\'s hide was impervious to weapons.',
    mythology_facts: [
      'The Nemean Lion was the offspring of Typhon and Echidna',
      'Hercules had to strangle the lion since weapons couldn\'t pierce its hide',
      'In Egyptian astronomy, Leo was associated with the annual Nile floods'
    ],
    origin_culture: 'Greek',
    zodiac_sign: 'Leo',
    best_viewing_season: 'March to May',
    observation_tips: [
      'Look for the distinctive "sickle" asterism forming the lion\'s head',
      'Regulus marks the lion\'s heart',
      'Use binoculars to spot the Leo Triplet galaxies'
    ]
  },
  cassiopeia: {
    object_name: 'Cassiopeia',
    science_summary: 'Cassiopeia is a distinctive W-shaped constellation visible year-round from northern latitudes. It lies in a rich region of the Milky Way.',
    science_facts: [
      'The constellation contains two open clusters visible to the naked eye (M52 and M103)',
      'Tycho\'s Supernova of 1572 appeared in Cassiopeia',
      'Cassiopeia A is one of the strongest radio sources in the sky, a supernova remnant',
      'The constellation contains the Heart Nebula and Soul Nebula',
      'Schedar, the brightest star, is an orange giant about 230 light-years away'
    ],
    distance: 'Stars range from 54 to 613 light-years',
    mythology_summary: 'Cassiopeia was a vain queen in Greek mythology who boasted about her beauty. She was placed in the sky as punishment, sometimes appearing upside down.',
    mythology_facts: [
      'She was the mother of Andromeda and wife of King Cepheus',
      'Her boast that she was more beautiful than the sea nymphs angered Poseidon',
      'She is depicted sitting on her throne in the sky'
    ],
    origin_culture: 'Greek',
    best_viewing_season: 'Year-round (circumpolar in northern latitudes)',
    observation_tips: [
      'The W shape is easy to recognize',
      'Use it to find the Andromeda Galaxy nearby',
      'Scan with binoculars along the Milky Way for clusters'
    ]
  },
  cygnus: {
    object_name: 'Cygnus',
    science_summary: 'Cygnus (the Swan) contains the bright star Deneb and lies along the Milky Way. It\'s also known as the Northern Cross.',
    science_facts: [
      'Deneb is one of the most luminous stars known, about 200,000 times brighter than the Sun',
      'Cygnus X-1 was the first widely accepted black hole candidate',
      'The North America Nebula (NGC 7000) is located here',
      'Deneb forms part of the Summer Triangle asterism',
      'The constellation contains the Cygnus Rift, a dark nebula in the Milky Way'
    ],
    distance: 'Deneb is approximately 2,600 light-years away',
    mythology_summary: 'Cygnus represents Zeus disguised as a swan when he seduced Leda. Various other myths also associate swans with this constellation.',
    mythology_facts: [
      'Another myth says it represents Orpheus, transformed into a swan and placed next to his lyre (Lyra)',
      'In Chinese mythology, it\'s associated with the legend of the Weaver Girl and the Cowherd',
      'Native Americans saw it as a great bird flying along the Milky Way'
    ],
    origin_culture: 'Greek',
    best_viewing_season: 'July to October',
    observation_tips: [
      'Look for the Northern Cross shape',
      'Deneb is at the tail of the swan',
      'The Milky Way runs through the constellation - great for binocular scanning'
    ]
  },
  taurus: {
    object_name: 'Taurus',
    science_summary: 'Taurus contains two famous star clusters: the Pleiades and the Hyades. The red giant Aldebaran marks the bull\'s eye.',
    science_facts: [
      'The Pleiades (M45) is one of the nearest star clusters at about 444 light-years',
      'The Crab Nebula (M1) is the remnant of a supernova observed in 1054 AD',
      'Aldebaran is not part of the Hyades cluster - it\'s much closer at 65 light-years',
      'The Hyades is the nearest open cluster to Earth at about 153 light-years',
      'Taurus contains the radio source Taurus A (the Crab Nebula)'
    ],
    distance: 'Aldebaran is 65 light-years away',
    mythology_summary: 'Taurus represents the bull form Zeus took to abduct Europa. Only the front half of the bull is depicted in the sky.',
    mythology_facts: [
      'The Pleiades were seven sisters placed in the sky by Zeus',
      'The Hyades were half-sisters of the Pleiades, associated with rain',
      'In many cultures, the Pleiades marked important agricultural seasons'
    ],
    origin_culture: 'Greek',
    zodiac_sign: 'Taurus',
    best_viewing_season: 'November to February',
    observation_tips: [
      'The Pleiades are visible to the naked eye as a fuzzy patch',
      'Count how many Pleiades stars you can see (6-7 is typical)',
      'Notice the orange color of Aldebaran'
    ]
  },
  gemini: {
    object_name: 'Gemini',
    science_summary: 'Gemini represents the twins Castor and Pollux. Castor is actually a sextuple star system, while Pollux hosts a confirmed exoplanet.',
    science_facts: [
      'Castor is a system of six stars orbiting each other',
      'Pollux b was one of the first exoplanets discovered around a giant star',
      'The Geminid meteor shower in December is one of the best annual showers',
      'The Eskimo Nebula (NGC 2392) is a planetary nebula in Gemini',
      'Pollux is the closest giant star to our Sun at 34 light-years'
    ],
    distance: 'Pollux is 34 light-years, Castor is 51 light-years',
    mythology_summary: 'Castor and Pollux were twin brothers in Greek mythology. When Castor died, Pollux asked Zeus to let them share immortality.',
    mythology_facts: [
      'The twins were known as the Dioscuri',
      'They were patrons of sailors and appeared as St. Elmo\'s fire',
      'Pollux was immortal (son of Zeus) while Castor was mortal'
    ],
    origin_culture: 'Greek',
    zodiac_sign: 'Gemini',
    best_viewing_season: 'January to March',
    observation_tips: [
      'The two bright stars Castor and Pollux are easy to identify',
      'Watch for Geminid meteors in mid-December',
      'Pollux is slightly brighter and more orange than Castor'
    ]
  },
  virgo: {
    object_name: 'Virgo',
    science_summary: 'Virgo is the second-largest constellation and contains the Virgo Cluster, a massive collection of over 2,000 galaxies about 54 million light-years away.',
    science_facts: [
      'Spica is a binary star system with both stars being blue giants',
      'The Virgo Cluster contains the giant elliptical galaxy M87, home to a supermassive black hole',
      'The first image of a black hole was taken of M87\'s black hole in 2019',
      'Virgo contains over 11 Messier objects, mostly galaxies',
      'The Sombrero Galaxy (M104) is located on the border of Virgo'
    ],
    distance: 'Spica is 250 light-years away',
    mythology_summary: 'Virgo represents various goddesses of harvest and fertility, most commonly associated with Demeter or Persephone in Greek mythology.',
    mythology_facts: [
      'Often depicted holding a sheaf of wheat, represented by the star Spica',
      'Associated with the harvest season in many cultures',
      'In Babylonian astronomy, it was associated with the goddess Ishtar'
    ],
    origin_culture: 'Greek',
    zodiac_sign: 'Virgo',
    best_viewing_season: 'April to June',
    observation_tips: [
      'Spica is easy to find by following the arc of the Big Dipper\'s handle',
      'Use a telescope to explore the many galaxies in this region',
      'The Virgo Cluster is best viewed with a wide-field telescope'
    ]
  },
  aquarius: {
    object_name: 'Aquarius',
    science_summary: 'Aquarius is an ancient constellation representing a water bearer. It contains several notable deep sky objects including the Helix Nebula, one of the closest planetary nebulae to Earth.',
    science_facts: [
      'The Helix Nebula (NGC 7293) is only 700 light-years away',
      'The Saturn Nebula (NGC 7009) is a planetary nebula resembling the planet Saturn',
      'Aquarius contains no stars brighter than magnitude 3',
      'The constellation spans 980 square degrees of sky',
      'TRAPPIST-1, a star with 7 Earth-sized planets, is located in Aquarius'
    ],
    distance: 'Stars range from 100 to 500 light-years',
    mythology_summary: 'In Greek mythology, Aquarius represents Ganymede, a beautiful youth who was carried to Mount Olympus by Zeus to serve as cupbearer to the gods.',
    mythology_facts: [
      'The water being poured represents the rainy season in ancient times',
      'In Egyptian mythology, it was associated with the annual flooding of the Nile',
      'Babylonians saw it as the god Ea, who was often depicted with an overflowing vase'
    ],
    origin_culture: 'Greek',
    zodiac_sign: 'Aquarius',
    best_viewing_season: 'September to November',
    observation_tips: [
      'Look for the Y-shaped asterism called the Water Jar',
      'The Helix Nebula is visible in binoculars as a faint fuzzy patch',
      'Best viewed from dark sky locations due to faint stars'
    ]
  },
  andromeda: {
    object_name: 'Andromeda',
    science_summary: 'Andromeda is famous for containing the Andromeda Galaxy (M31), the nearest major galaxy to the Milky Way and the most distant object visible to the naked eye.',
    science_facts: [
      'The Andromeda Galaxy is 2.5 million light-years away',
      'M31 contains approximately 1 trillion stars, more than the Milky Way',
      'The Andromeda and Milky Way galaxies will collide in about 4.5 billion years',
      'Alpheratz, the brightest star, is actually shared with the constellation Pegasus',
      'M31 is approaching us at about 110 km/s'
    ],
    distance: 'Alpheratz is 97 light-years away',
    mythology_summary: 'Andromeda was an Ethiopian princess in Greek mythology, chained to a rock as a sacrifice to a sea monster but rescued by the hero Perseus.',
    mythology_facts: [
      'Her mother Cassiopeia\'s boast about her beauty angered Poseidon',
      'Perseus used Medusa\'s head to turn the sea monster to stone',
      'She later married Perseus and they had many children'
    ],
    origin_culture: 'Greek',
    best_viewing_season: 'October to December',
    observation_tips: [
      'The Andromeda Galaxy is visible to the naked eye as a fuzzy patch',
      'Use the Great Square of Pegasus to locate Andromeda',
      'Binoculars reveal the galaxy\'s elongated shape'
    ],
    notable_deepsky: [
      { id: 'M31', name: 'Andromeda Galaxy', type: 'Spiral Galaxy', description: 'The nearest major galaxy, visible to the naked eye' },
      { id: 'M32', name: 'Le Gentil', type: 'Elliptical Galaxy', description: 'Satellite galaxy of M31' },
      { id: 'M110', name: 'NGC 205', type: 'Elliptical Galaxy', description: 'Another satellite of M31' }
    ]
  },
  perseus: {
    object_name: 'Perseus',
    science_summary: 'Perseus lies in the Milky Way and contains the famous Double Cluster, as well as the variable star Algol, known as the "Demon Star."',
    science_facts: [
      'Algol is an eclipsing binary that varies in brightness every 2.87 days',
      'The Double Cluster (NGC 869 and NGC 884) is about 7,500 light-years away',
      'The Perseid meteor shower radiates from this constellation every August',
      'Perseus contains the California Nebula (NGC 1499)',
      'Mirfak, the brightest star, is a yellow-white supergiant'
    ],
    distance: 'Mirfak is 510 light-years away',
    mythology_summary: 'Perseus was a Greek hero who slew the Gorgon Medusa and rescued Andromeda from a sea monster.',
    mythology_facts: [
      'He used a mirrored shield to avoid Medusa\'s petrifying gaze',
      'Algol represents the eye of Medusa in his hand',
      'He was the son of Zeus and the mortal Danaë'
    ],
    origin_culture: 'Greek',
    best_viewing_season: 'November to February',
    observation_tips: [
      'The Double Cluster is stunning in binoculars',
      'Watch Algol\'s brightness change over a few hours',
      'The Perseids peak around August 12th each year'
    ]
  }
};

/**
 * Fallback data for planets
 */
export const PLANET_FALLBACK_DATA: Record<string, Partial<CelestialInfo>> = {
  mercury: {
    object_name: 'Mercury',
    science_summary: 'Mercury is the smallest planet in our solar system and the closest to the Sun. It has no atmosphere and experiences extreme temperature variations.',
    science_facts: [
      'Mercury completes an orbit around the Sun every 88 Earth days',
      'Surface temperatures range from -180°C at night to 430°C during the day',
      'Despite being closest to the Sun, Venus is hotter due to its greenhouse effect',
      'Mercury has a large iron core that makes up about 75% of its radius',
      'A day on Mercury (sunrise to sunrise) lasts 176 Earth days'
    ],
    distance: '77 million km (average from Earth)',
    size: '4,879 km diameter (38% of Earth)',
    composition: 'Iron core with silicate mantle and crust',
    mythology_summary: 'Named after the Roman messenger god Mercury, known for his speed, reflecting the planet\'s quick orbit around the Sun.',
    mythology_facts: [
      'The Greeks called it Hermes, their messenger god',
      'Ancient astronomers thought it was two different objects (morning and evening star)'
    ],
    origin_culture: 'Roman',
    best_viewing_season: 'Best seen at greatest elongation from the Sun',
    observation_tips: [
      'Look for Mercury low on the horizon just after sunset or before sunrise',
      'Best viewed during greatest elongation (maximum angular distance from Sun)',
      'Use a telescope to see its phases like the Moon'
    ]
  },
  venus: {
    object_name: 'Venus',
    science_summary: 'Venus is the second planet from the Sun and the hottest planet in our solar system due to its thick atmosphere creating a runaway greenhouse effect.',
    science_facts: [
      'Venus rotates backwards compared to most planets (retrograde rotation)',
      'A day on Venus is longer than its year (243 vs 225 Earth days)',
      'Surface temperature is about 465°C - hot enough to melt lead',
      'Atmospheric pressure is 90 times that of Earth',
      'Venus is the brightest natural object in the night sky after the Moon'
    ],
    distance: '41 million km (closest approach to Earth)',
    size: '12,104 km diameter (95% of Earth)',
    composition: 'Rocky planet with thick CO2 atmosphere and sulfuric acid clouds',
    mythology_summary: 'Named after the Roman goddess of love and beauty, Venus has been associated with femininity and romance throughout history.',
    mythology_facts: [
      'Known as the Morning Star and Evening Star in ancient times',
      'The Maya tracked Venus carefully and associated it with warfare',
      'In Babylonian astronomy, it was associated with the goddess Ishtar'
    ],
    origin_culture: 'Roman',
    best_viewing_season: 'Visible as morning or evening star depending on its position',
    observation_tips: [
      'Venus is unmistakable as the brightest "star" in the sky',
      'Observe its phases through a telescope - it shows phases like the Moon',
      'Best viewed when at greatest elongation from the Sun'
    ]
  },
  mars: {
    object_name: 'Mars',
    science_summary: 'Mars is the fourth planet from the Sun, known as the Red Planet due to iron oxide on its surface. It\'s a primary target for human exploration.',
    science_facts: [
      'Mars has the largest volcano in the solar system - Olympus Mons (21 km high)',
      'Valles Marineris is a canyon system 4,000 km long',
      'Mars has two small moons: Phobos and Deimos',
      'A Martian day (sol) is 24 hours and 37 minutes',
      'Evidence suggests Mars once had liquid water on its surface'
    ],
    distance: '225 million km (average from Sun)',
    size: '6,779 km diameter (53% of Earth)',
    composition: 'Rocky planet with iron oxide surface, thin CO2 atmosphere',
    mythology_summary: 'Named after the Roman god of war due to its blood-red appearance, Mars has been associated with conflict and aggression.',
    mythology_facts: [
      'The Greeks called it Ares, their god of war',
      'Ancient Egyptians called it "Her Desher" meaning "the red one"',
      'Mars\' moons are named after the sons of Ares: Fear (Phobos) and Terror (Deimos)'
    ],
    origin_culture: 'Roman',
    zodiac_sign: 'Aries (traditional ruler)',
    best_viewing_season: 'Best during opposition when Earth passes between Mars and Sun',
    observation_tips: [
      'Look for its distinctive red-orange color',
      'During opposition, Mars is at its brightest and closest',
      'A telescope can reveal polar ice caps and surface features'
    ]
  },
  jupiter: {
    object_name: 'Jupiter',
    science_summary: 'Jupiter is the largest planet in our solar system, a gas giant with a mass more than twice that of all other planets combined.',
    science_facts: [
      'Jupiter has at least 95 known moons, including the four large Galilean moons',
      'The Great Red Spot is a storm that has raged for at least 400 years',
      'Jupiter rotates faster than any other planet - one day is about 10 hours',
      'Its magnetic field is 20,000 times stronger than Earth\'s',
      'Jupiter emits more energy than it receives from the Sun'
    ],
    distance: '778 million km from Sun',
    size: '139,820 km diameter (11 times Earth)',
    composition: 'Gas giant - mostly hydrogen and helium with no solid surface',
    mythology_summary: 'Named after the king of the Roman gods, Jupiter was considered the ruler of the heavens and the most powerful deity.',
    mythology_facts: [
      'The Greeks called it Zeus, king of the Olympian gods',
      'Jupiter\'s moons are named after Zeus\'s lovers and companions',
      'Ancient astronomers considered Jupiter a "wandering star"'
    ],
    origin_culture: 'Roman',
    zodiac_sign: 'Sagittarius (traditional ruler)',
    best_viewing_season: 'Visible for most of the year, brightest at opposition',
    observation_tips: [
      'Even small binoculars can reveal Jupiter\'s four Galilean moons',
      'A telescope shows cloud bands and the Great Red Spot',
      'Watch the moons change position from night to night'
    ]
  },
  saturn: {
    object_name: 'Saturn',
    science_summary: 'Saturn is the sixth planet from the Sun, famous for its spectacular ring system made of ice and rock particles.',
    science_facts: [
      'Saturn\'s rings span up to 282,000 km but are only about 10 meters thick',
      'Saturn has at least 146 known moons, including Titan with a thick atmosphere',
      'Saturn is the least dense planet - it would float in water',
      'Winds on Saturn can reach 1,800 km/h',
      'Saturn\'s moon Enceladus has geysers that spray water into space'
    ],
    distance: '1.4 billion km from Sun',
    size: '116,460 km diameter (9.5 times Earth)',
    composition: 'Gas giant - hydrogen and helium with ice and rock rings',
    mythology_summary: 'Named after the Roman god of agriculture and time, Saturn was the father of Jupiter in mythology.',
    mythology_facts: [
      'The Greeks called it Kronos, the Titan who ruled before Zeus',
      'Saturday is named after Saturn',
      'Saturn was associated with wealth and agriculture in Roman culture'
    ],
    origin_culture: 'Roman',
    zodiac_sign: 'Capricorn (traditional ruler)',
    best_viewing_season: 'Visible for most of the year, rings best seen at opposition',
    observation_tips: [
      'Even a small telescope reveals Saturn\'s rings',
      'Look for the Cassini Division - a gap in the rings',
      'Titan is visible as a bright point near Saturn'
    ]
  },
  uranus: {
    object_name: 'Uranus',
    science_summary: 'Uranus is the seventh planet from the Sun, an ice giant that rotates on its side, likely due to a massive ancient collision.',
    science_facts: [
      'Uranus rotates on its side with an axial tilt of 98 degrees',
      'It takes 84 Earth years to orbit the Sun',
      'Uranus has 27 known moons, all named after Shakespeare and Pope characters',
      'The planet appears blue-green due to methane in its atmosphere',
      'Uranus was the first planet discovered with a telescope (1781)'
    ],
    distance: '2.9 billion km from Sun',
    size: '50,724 km diameter (4 times Earth)',
    composition: 'Ice giant - water, methane, and ammonia ices with hydrogen/helium atmosphere',
    mythology_summary: 'Named after the Greek god of the sky, Uranus was the father of the Titans and grandfather of the Olympian gods.',
    mythology_facts: [
      'Uranus is the only planet named after a Greek rather than Roman god',
      'In Greek mythology, Uranus was the personification of the heavens',
      'William Herschel originally wanted to name it "Georgium Sidus" after King George III'
    ],
    origin_culture: 'Greek',
    zodiac_sign: 'Aquarius (modern ruler)',
    best_viewing_season: 'Visible to naked eye under dark skies, best at opposition',
    observation_tips: [
      'Uranus is barely visible to the naked eye under perfect conditions',
      'Binoculars show it as a faint star-like point',
      'A telescope reveals its distinctive blue-green color'
    ]
  },
  neptune: {
    object_name: 'Neptune',
    science_summary: 'Neptune is the eighth and farthest planet from the Sun, an ice giant with the strongest winds in the solar system.',
    science_facts: [
      'Neptune has winds reaching 2,100 km/h - the fastest in the solar system',
      'It takes 165 Earth years to orbit the Sun',
      'Neptune was discovered through mathematical predictions before being observed',
      'Its largest moon Triton orbits backwards and may be a captured Kuiper Belt object',
      'Neptune has a faint ring system discovered in 1984'
    ],
    distance: '4.5 billion km from Sun',
    size: '49,528 km diameter (3.9 times Earth)',
    composition: 'Ice giant - similar to Uranus with water, methane, and ammonia ices',
    mythology_summary: 'Named after the Roman god of the sea, Neptune\'s blue color made this name particularly fitting.',
    mythology_facts: [
      'The Greeks called the sea god Poseidon',
      'Neptune\'s trident symbol is used to represent the planet',
      'Its moon Triton is named after Poseidon\'s son'
    ],
    origin_culture: 'Roman',
    zodiac_sign: 'Pisces (modern ruler)',
    best_viewing_season: 'Requires telescope, best at opposition',
    observation_tips: [
      'Neptune requires binoculars or telescope to see',
      'It appears as a tiny blue disk in larger telescopes',
      'Use star charts to locate it among background stars'
    ]
  }
};

/**
 * Get celestial info with fallback to hardcoded data, then AI generation
 */
export async function getCelestialInfoWithFallback(
  objectType: string,
  objectId: string,
  _objectName?: string
): Promise<CelestialInfo | null> {
  // First try database
  const dbInfo = await getCelestialInfo(objectType, objectId);
  if (dbInfo) return dbInfo;

  const normalizedType = objectType.toLowerCase();
  const normalizedId = objectId.toLowerCase().replace(/\s+/g, '_');

  // Fallback for constellations with hardcoded data
  if (normalizedType === 'constellation') {
    const fallback = CONSTELLATION_FALLBACK_DATA[normalizedId];
    if (fallback) {
      return {
        id: normalizedId,
        object_type: 'constellation',
        object_id: normalizedId,
        object_name: fallback.object_name || objectId,
        science_summary: fallback.science_summary || null,
        science_facts: fallback.science_facts || [],
        distance: fallback.distance || null,
        size: fallback.size || null,
        composition: fallback.composition || null,
        discovery: fallback.discovery || null,
        mythology_summary: fallback.mythology_summary || null,
        mythology_facts: fallback.mythology_facts || [],
        origin_culture: fallback.origin_culture || null,
        indian_mythology: null,
        astrology_summary: fallback.astrology_summary || null,
        astrology_facts: fallback.astrology_facts || [],
        zodiac_sign: fallback.zodiac_sign || null,
        best_viewing_season: fallback.best_viewing_season || null,
        best_viewing_conditions: fallback.best_viewing_conditions || null,
        observation_tips: fallback.observation_tips || [],
        notable_stars: fallback.notable_stars || [],
        notable_deepsky: fallback.notable_deepsky || [],
        image_url: null,
        thumbnail_url: null,
      } as CelestialInfo;
    }
  }

  // Fallback for planets with hardcoded data
  if (normalizedType === 'planet') {
    const fallback = PLANET_FALLBACK_DATA[normalizedId];
    if (fallback) {
      return {
        id: normalizedId,
        object_type: 'planet',
        object_id: normalizedId,
        object_name: fallback.object_name || objectId,
        science_summary: fallback.science_summary || null,
        science_facts: fallback.science_facts || [],
        distance: fallback.distance || null,
        size: fallback.size || null,
        composition: fallback.composition || null,
        discovery: fallback.discovery || null,
        mythology_summary: fallback.mythology_summary || null,
        mythology_facts: fallback.mythology_facts || [],
        origin_culture: fallback.origin_culture || null,
        indian_mythology: null,
        astrology_summary: fallback.astrology_summary || null,
        astrology_facts: fallback.astrology_facts || [],
        zodiac_sign: fallback.zodiac_sign || null,
        best_viewing_season: fallback.best_viewing_season || null,
        best_viewing_conditions: fallback.best_viewing_conditions || null,
        observation_tips: fallback.observation_tips || [],
        notable_stars: [],
        notable_deepsky: [],
        image_url: null,
        thumbnail_url: null,
      } as CelestialInfo;
    }
  }

  return null;
}

/**
 * Get celestial info with AI generation fallback
 * This will generate info using Gemini if not found in DB or hardcoded data
 */
export async function getCelestialInfoWithAI(
  objectType: string,
  objectId: string,
  _objectName: string
): Promise<{ info: CelestialInfo | null; isGenerating: boolean; error?: string }> {
  // First try database
  const dbInfo = await getCelestialInfo(objectType, objectId);
  if (dbInfo) {
    return { info: dbInfo, isGenerating: false };
  }

  const normalizedType = objectType.toLowerCase();
  const normalizedId = objectId.toLowerCase().replace(/\s+/g, '_');

  // Check hardcoded fallback for constellations
  if (normalizedType === 'constellation') {
    const fallback = CONSTELLATION_FALLBACK_DATA[normalizedId];
    if (fallback) {
      return {
        info: {
          id: normalizedId,
          object_type: 'constellation',
          object_id: normalizedId,
          object_name: fallback.object_name || objectId,
          science_summary: fallback.science_summary || null,
          science_facts: fallback.science_facts || [],
          distance: fallback.distance || null,
          size: fallback.size || null,
          composition: fallback.composition || null,
          discovery: fallback.discovery || null,
          mythology_summary: fallback.mythology_summary || null,
          mythology_facts: fallback.mythology_facts || [],
          origin_culture: fallback.origin_culture || null,
          indian_mythology: null,
          astrology_summary: fallback.astrology_summary || null,
          astrology_facts: fallback.astrology_facts || [],
          zodiac_sign: fallback.zodiac_sign || null,
          best_viewing_season: fallback.best_viewing_season || null,
          best_viewing_conditions: fallback.best_viewing_conditions || null,
          observation_tips: fallback.observation_tips || [],
          notable_stars: fallback.notable_stars || [],
          notable_deepsky: fallback.notable_deepsky || [],
          image_url: null,
          thumbnail_url: null,
        } as CelestialInfo,
        isGenerating: false,
      };
    }
  }

  // Check hardcoded fallback for planets
  if (normalizedType === 'planet') {
    const fallback = PLANET_FALLBACK_DATA[normalizedId];
    if (fallback) {
      return {
        info: {
          id: normalizedId,
          object_type: 'planet',
          object_id: normalizedId,
          object_name: fallback.object_name || objectId,
          science_summary: fallback.science_summary || null,
          science_facts: fallback.science_facts || [],
          distance: fallback.distance || null,
          size: fallback.size || null,
          composition: fallback.composition || null,
          discovery: fallback.discovery || null,
          mythology_summary: fallback.mythology_summary || null,
          mythology_facts: fallback.mythology_facts || [],
          origin_culture: fallback.origin_culture || null,
          indian_mythology: null,
          astrology_summary: fallback.astrology_summary || null,
          astrology_facts: fallback.astrology_facts || [],
          zodiac_sign: fallback.zodiac_sign || null,
          best_viewing_season: fallback.best_viewing_season || null,
          best_viewing_conditions: fallback.best_viewing_conditions || null,
          observation_tips: fallback.observation_tips || [],
          notable_stars: [],
          notable_deepsky: [],
          image_url: null,
          thumbnail_url: null,
        } as CelestialInfo,
        isGenerating: false,
      };
    }
  }

  // Return null - AI generation will be triggered by the component
  return { info: null, isGenerating: false };
}

