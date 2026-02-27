# Constellation Status

## Current Status

✅ **ALL 88 CONSTELLATIONS ARE NOW AVAILABLE!**

The constellation data file has been updated with all 88 IAU-recognized constellations using data from Stellarium (GPL license).

### Data Source
- **Source**: Stellarium constellation stick figures
- **License**: GPL (from Stellarium project)
- **Format**: HIP star catalog IDs with line connections
- **Total**: 88 constellations

### How It Works
1. Local JSON file contains constellation structure (star connections)
2. App extracts unique HIP IDs from all constellation lines
3. Astronomy API fetches accurate coordinates for each star
4. Constellation lines are rendered connecting the actual stars
5. Constellation names displayed at calculated center points

## All 88 Constellations

### Zodiac (12)
Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpius, Sagittarius, Capricornus, Aquarius, Pisces

### Northern Sky (28)
Andromeda, Auriga, Boötes, Camelopardalis, Canes Venatici, Cassiopeia, Cepheus, Coma Berenices, Corona Borealis, Cygnus, Delphinus, Draco, Equuleus, Hercules, Lacerta, Leo Minor, Lynx, Lyra, Ophiuchus, Pegasus, Perseus, Sagitta, Serpens, Triangulum, Ursa Major, Ursa Minor, Vulpecula

### Southern Sky (48)
Antlia, Apus, Aquila, Ara, Caelum, Canis Major, Canis Minor, Carina, Centaurus, Cetus, Chamaeleon, Circinus, Columba, Corona Australis, Corvus, Crater, Crux, Dorado, Eridanus, Fornax, Grus, Horologium, Hydra, Hydrus, Indus, Lepus, Lupus, Mensa, Microscopium, Monoceros, Musca, Norma, Octans, Orion, Pavo, Phoenix, Pictor, Piscis Austrinus, Puppis, Pyxis, Reticulum, Sculptor, Scutum, Sextans, Telescopium, Triangulum Australe, Tucana, Vela, Volans

## Performance Notes

With all 88 constellations:
- **Total unique stars**: ~500-600 stars (varies by constellation overlap)
- **API fetch time**: ~2-3 minutes (batched requests with rate limiting)
- **Rendering**: Real-time, no performance impact

The app fetches all constellation stars on initial load, then caches them for the session.

## Previous Status

Previously only 24 prominent constellations were available. The update adds 64 additional constellations including:
- All remaining zodiac constellations (Gemini, Cancer, Libra, Capricornus, Ophiuchus)
- Fainter northern constellations (Camelopardalis, Lynx, etc.)
- Southern hemisphere constellations (Dorado, Mensa, Octans, etc.)
- Small constellations (Sagitta, Equuleus, Triangulum, etc.)

### Visible Constellations
1. Aquila (Eagle)
2. Cetus (Whale)
3. Aries (Ram)
4. Boötes (Herdsman)
5. Carina (Keel)
6. Cassiopeia
7. Centaurus (Centaur)
8. Auriga (Charioteer)
9. Crux (Southern Cross)
10. Cygnus (Swan)
11. Draco (Dragon)
12. Ursa Major (Great Bear)
13. Grus (Crane)
14. Leo (Lion)
15. Lyra (Lyre)
16. Orion (Hunter)
17. Pegasus (Winged Horse)
18. Perseus
19. Sagittarius (Archer)
20. Scorpius (Scorpion)
21. Taurus (Bull)
22. Aquarius (Water Bearer)
23. Virgo (Virgin)
24. Vela (Sails)

## Missing Constellations (64)

The following constellations are not yet included:

### Zodiac (Missing 8)
- Gemini, Cancer, Libra, Capricornus, Pisces, Ophiuchus

### Northern Sky (Missing ~30)
- Andromeda, Camelopardalis, Canes Venatici, Coma Berenices, Corona Borealis, Delphinus, Equuleus, Hercules, Lacerta, Leo Minor, Lynx, Monoceros, Sagitta, Serpens, Triangulum, Ursa Minor, Vulpecula, etc.

### Southern Sky (Missing ~26)
- Antlia, Apus, Ara, Caelum, Chamaeleon, Circinus, Columba, Corona Australis, Corvus, Crater, Dorado, Eridanus, Fornax, Horologium, Hydra, Hydrus, Indus, Lepus, Lupus, Mensa, Microscopium, Musca, Norma, Octans, Pavo, Phoenix, Pictor, Piscis Austrinus, Puppis, Pyxis, Reticulum, Sculptor, Scutum, Sextans, Telescopium, Triangulum Australe, Tucana, Volans

## Why Only 24?

The constellation data comes from a local JSON file (`apps/web/public/data/constellations.json`) that currently only includes the 24 most prominent constellations. These were likely chosen because they:

1. Are the brightest and most recognizable
2. Contain the brightest stars
3. Are visible from most locations
4. Include all zodiac constellations except a few

## How to Add More Constellations

To add the remaining 64 constellations:

1. **Obtain constellation line data** - Need HIP IDs for stars that form each constellation's pattern
2. **Add to constellations.json** - Format:
   ```json
   {
     "id": "and",
     "name": "Andromeda",
     "lines": [
       {
         "star1": { "hipId": 677, "ra": 2.065, "dec": 42.33 },
         "star2": { "hipId": 3092, "ra": 9.831, "dec": 38.50 }
       }
     ],
     "centerRA": 10.68,
     "centerDec": 37.5
   }
   ```
3. **Fetch stars from API** - The system will automatically fetch the stars for new constellations

## Data Sources

Constellation line data can be obtained from:
- [Stellarium constellation data](https://github.com/Stellarium/stellarium/tree/master/skycultures/western)
- [IAU constellation boundaries](https://www.iau.org/public/themes/constellations/)
- [HYG Database](https://github.com/astronexus/HYG-Database)

## Current Implementation

The app fetches constellation stars from the Astronomy API:
- Reads constellation structure from local JSON
- Extracts unique HIP IDs from constellation lines
- Fetches star coordinates from Astronomy API in batches
- Renders constellation lines connecting the actual stars
- Displays constellation names at their center points

All 24 constellations are fully functional with accurate star positions from the Astronomy API.
