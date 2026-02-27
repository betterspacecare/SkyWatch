# Implementation Plan: Enhanced Celestial Objects

## Overview

This implementation plan extends the astronomy-engine package with new celestial object calculators, data catalogs, and renderer updates. Tasks are organized to build incrementally, with each module tested before integration. Property-based tests validate correctness properties from the design document.

## Tasks

- [ ] 1. Create data files and type definitions
  - [x] 1.1 Create constellations.json with all 88 IAU constellations
    - Include id, name, lines (star pairs), and star coordinates (RA/Dec)
    - Store in `packages/astronomy-engine/data/constellations.json`
    - _Requirements: 4.1, 4.2_

  - [x] 1.2 Create messier.json with all 110 Messier objects
    - Include id, name, ra, dec, magnitude, and type for each object
    - Types: Galaxy, Nebula, Open Cluster, Globular Cluster, Planetary Nebula
    - Store in `packages/astronomy-engine/data/messier.json`
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 1.3 Create meteor-showers.json with major annual showers
    - Include: Quadrantids, Lyrids, Eta Aquariids, Perseids, Orionids, Leonids, Geminids
    - Include id, name, ra, dec, peakMonth, peakDay, zhr for each
    - Store in `packages/astronomy-engine/data/meteor-showers.json`
    - _Requirements: 7.1, 7.2, 7.4_

- [ ] 2. Implement Horizon_Line module
  - [x] 2.1 Create horizon-line.ts with HorizonLine interface implementation
    - Implement getHorizonPoints() generating points at altitude 0° for all azimuths
    - Implement isBelowHorizon(altitude) returning true when altitude < 0
    - Implement configurable color, opacity, and point count
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 2.2 Write property test for horizon altitude invariant
    - **Property 1: Horizon Altitude Invariant**
    - **Validates: Requirements 1.1**

  - [x] 2.3 Write property test for below horizon flag
    - **Property 2: Below Horizon Flag Correctness**
    - **Validates: Requirements 1.4**

- [ ] 3. Implement Moon_Calculator module
  - [x] 3.1 Create moon-calculator.ts using astronomy-engine npm package
    - Implement calculate() returning MoonPosition with RA, Dec, azimuth, altitude
    - Compute lunar phase name from phase angle
    - Compute illumination percentage (0-100%)
    - Compute apparent magnitude based on phase
    - Use existing Coordinate_Converter for RA/Dec to Az/Alt
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Write property test for celestial body RA/Dec validity
    - **Property 3: Celestial Body RA/Dec Validity**
    - **Validates: Requirements 2.1, 3.1**

  - [x] 3.3 Write property test for moon phase name validity
    - **Property 4: Moon Phase Name Validity**
    - **Validates: Requirements 2.2**

  - [x] 3.4 Write property test for moon illumination bounds
    - **Property 5: Moon Illumination Bounds**
    - **Validates: Requirements 2.3**

  - [x] 3.5 Write property test for moon magnitude validity
    - **Property 6: Moon Magnitude Validity**
    - **Validates: Requirements 2.5**

- [ ] 4. Implement Sun_Calculator module
  - [x] 4.1 Create sun-calculator.ts using astronomy-engine npm package
    - Implement calculate() returning SunPosition with RA, Dec, azimuth, altitude
    - Implement getSkyStatus() returning 'daylight', 'twilight', or 'night'
    - Set safetyWarning flag when altitude > -18°
    - Use existing Coordinate_Converter for RA/Dec to Az/Alt
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Write property test for sun status and safety flag
    - **Property 7: Sun Status and Safety Flag Correctness**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

- [x] 5. Checkpoint - Core celestial body calculators complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Constellation_Renderer module
  - [x] 6.1 Create constellation-renderer.ts loading from constellations.json
    - Implement getConstellations() returning all 88 IAU constellations
    - Implement getVisibleLines() calculating horizontal coordinates for line segments
    - Set isPartiallyVisible flag when one star is below horizon
    - Implement getConstellationCenters() for label placement
    - Implement configurable line color, thickness, and enable/disable toggle
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.2 Write property test for constellation partial visibility
    - **Property 8: Constellation Partial Visibility**
    - **Validates: Requirements 4.3**

- [ ] 7. Implement Deep_Sky_Catalog module
  - [x] 7.1 Create deep-sky-catalog.ts loading from messier.json
    - Implement getAllObjects() returning all 110 Messier objects
    - Implement getObjectsByType() filtering by object type
    - Implement getObject() for single object lookup
    - Implement getVisibleObjects() calculating positions and applying magnitude filter
    - Use existing Coordinate_Converter for RA/Dec to Az/Alt
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.2 Write property test for deep sky object type validity
    - **Property 9: Deep Sky Object Type Validity**
    - **Validates: Requirements 5.2**

  - [x] 7.3 Write property test for deep sky magnitude visibility
    - **Property 10: Deep Sky Magnitude Visibility**
    - **Validates: Requirements 5.3**

  - [x] 7.4 Write property test for coordinate conversion validity
    - **Property 11: Coordinate Conversion Validity**
    - **Validates: Requirements 5.5, 7.5**

- [ ] 8. Implement Satellite_Tracker module
  - [x] 8.1 Create satellite-tracker.ts with TLE parsing and position calculation
    - Implement setTLE() and getTLE() for TLE data management
    - Implement isTLEStale() checking if TLE > 14 days old
    - Implement calculate() returning SatellitePosition or SatelliteTrackerError
    - Implement calculateAll() for batch position calculation
    - Implement predictVisibility() based on satellite illumination and observer darkness
    - Implement loadDefaultISS() for default ISS tracking
    - Return appropriate error types for unavailable/invalid TLE
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 8.2 Write property test for satellite TLE staleness detection
    - **Property 12: Satellite TLE Staleness Detection**
    - **Validates: Requirements 6.3**

  - [x] 8.3 Write property test for satellite position validity
    - **Property 13: Satellite Position Validity**
    - **Validates: Requirements 6.1, 6.4**

  - [x] 8.4 Write property test for satellite visibility prediction
    - **Property 14: Satellite Visibility Prediction**
    - **Validates: Requirements 6.5**

  - [x] 8.5 Write property test for satellite error handling
    - **Property 15: Satellite Error Handling**
    - **Validates: Requirements 6.6**

- [ ] 9. Implement Meteor_Shower_Catalog module
  - [x] 9.1 Create meteor-shower-catalog.ts loading from meteor-showers.json
    - Implement getAllShowers() returning all meteor showers
    - Implement getActiveShowers() filtering showers within 7 days of peak
    - Implement getRadiantPositions() calculating horizontal coordinates
    - Implement isShowerActive() and getDaysFromPeak() helper methods
    - Use existing Coordinate_Converter for RA/Dec to Az/Alt
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 9.2 Write property test for meteor shower data validity
    - **Property 16: Meteor Shower Data Validity**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 9.3 Write property test for meteor shower active status
    - **Property 17: Meteor Shower Active Status**
    - **Validates: Requirements 7.3**

- [x] 10. Checkpoint - All calculator modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Extend SkyPositions interface and SkyCalculator
  - [x] 11.1 Update SkyPositions interface with new fields
    - Add horizonPoints: HorizonPoint[]
    - Add moonPosition: MoonPosition | null
    - Add sunPosition: SunPosition | null
    - Add deepSkyPositions: Map<string, DeepSkyPosition>
    - Add satellitePositions: Map<string, SatellitePosition | SatelliteTrackerError>
    - Add meteorShowerRadiants: Map<string, MeteorShowerPosition>
    - Add constellationLines: ConstellationLineSegment[]
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 11.2 Update SkyCalculator to integrate all new modules
    - Instantiate all new calculator modules
    - Update recalculate() to populate all new SkyPositions fields
    - Ensure all calculations complete within 100ms performance target
    - _Requirements: 8.7_

  - [x] 11.3 Write property test for recalculation performance
    - **Property 18: Recalculation Performance**
    - **Validates: Requirements 8.7**

- [ ] 12. Update Mobile renderer (SkyView.tsx)
  - [x] 12.1 Add horizon line rendering to SkyView component
    - Render horizon line at altitude 0° with configurable styling
    - _Requirements: 1.1, 1.3_

  - [x] 12.2 Add Moon and Sun rendering with phase/safety indicators
    - Display Moon with phase icon and illumination percentage
    - Display Sun with prominent safety warning when above horizon
    - _Requirements: 2.2, 2.3, 3.6_

  - [x] 12.3 Add constellation line rendering with toggle
    - Render constellation lines connecting stars
    - Display constellation names near center points
    - Add toggle setting to enable/disable constellation display
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 12.4 Add deep sky object rendering with type icons
    - Display Messier objects with distinct icons based on type
    - Apply magnitude visibility threshold
    - _Requirements: 5.3, 5.6_

  - [x] 12.5 Add satellite and meteor shower radiant rendering
    - Display tracked satellites with visibility indicator
    - Highlight active meteor shower radiants
    - _Requirements: 6.5, 7.3_

- [ ] 13. Update Web renderer (SkyDome.tsx)
  - [x] 13.1 Add horizon line rendering to SkyDome component
    - Render horizon line at altitude 0° with configurable styling
    - _Requirements: 1.1, 1.3_

  - [x] 13.2 Add Moon and Sun rendering with phase/safety indicators
    - Display Moon with phase visualization and illumination
    - Display Sun with prominent safety warning when above horizon
    - _Requirements: 2.2, 2.3, 3.6_

  - [x] 13.3 Add constellation line rendering with toggle
    - Render constellation lines in Three.js
    - Display constellation names as labels
    - Add toggle setting to enable/disable constellation display
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 13.4 Add deep sky object rendering with type icons
    - Display Messier objects with distinct 3D representations based on type
    - Apply magnitude visibility threshold
    - _Requirements: 5.3, 5.6_

  - [x] 13.5 Add satellite and meteor shower radiant rendering
    - Display tracked satellites with visibility indicator
    - Highlight active meteor shower radiants
    - _Requirements: 6.5, 7.3_

- [x] 14. Final checkpoint - All implementations complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- All modules use the existing Coordinate_Converter for RA/Dec to Az/Alt transformations
- The astronomy-engine npm package is used for Moon and Sun ephemeris calculations
- Data files (JSON) should be created first as they are dependencies for multiple modules
- Property tests use fast-check library already installed in the project
