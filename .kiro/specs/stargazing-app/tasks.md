# Implementation Plan: Virtual Window Stargazing App

## Overview

This implementation plan builds the Virtual Window stargazing application using a monorepo architecture with Turborepo. The plan progresses from foundational setup through core astronomy calculations, platform-specific rendering, and comprehensive testing. Each task builds incrementally on previous work, ensuring no orphaned code.

## Tasks

- [x] 1. Set up monorepo structure and project foundation
  - [x] 1.1 Initialize Turborepo monorepo with packages and apps directories
    - Create root package.json with Turborepo configuration
    - Set up turbo.json with build pipeline for packages → apps dependency
    - Configure TypeScript base config (tsconfig.base.json)
    - _Requirements: 8.1, 8.5_

  - [x] 1.2 Create astronomy-engine package scaffold
    - Initialize packages/astronomy-engine with package.json
    - Set up TypeScript config extending base
    - Create src/index.ts with core type exports (GeographicCoordinates, CelestialCoordinates, HorizontalCoordinates, Star, Planet, SpectralType)
    - _Requirements: 8.2, 8.3_

  - [x] 1.3 Create React Native mobile app scaffold
    - Initialize apps/mobile with React Native + TypeScript template
    - Add react-native-svg dependency
    - Configure to import from astronomy-engine package
    - _Requirements: 8.4_

  - [x] 1.4 Create Next.js web app scaffold
    - Initialize apps/web with Next.js + TypeScript
    - Add three, @react-three/fiber, @react-three/drei dependencies
    - Configure to import from astronomy-engine package
    - _Requirements: 8.4_

  - [x] 1.5 Set up testing infrastructure
    - Add vitest and fast-check to astronomy-engine package
    - Configure test scripts in turbo.json pipeline
    - Create test generators directory structure
    - _Requirements: 8.6_

- [x] 2. Checkpoint - Verify monorepo builds
  - Ensure `turbo build` succeeds for all packages
  - Ensure all tests pass, ask the user if questions arise

- [x] 3. Implement core astronomy calculations in astronomy-engine
  - [x] 3.1 Implement LST_Calculator module
    - Create lst-calculator.ts with calculateLST and lstToUTC functions
    - Use Julian Date calculations for sidereal time
    - Return LST as decimal hours [0, 24)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.2 Write property tests for LST_Calculator
    - **Property 1: LST Round-Trip** - Verify LST→UTC→LST produces original within 1 second
    - **Property 6: LST Output Range** - Verify output always in [0, 24)
    - **Validates: Requirements 3.3, 3.5**

  - [x] 3.3 Implement Coordinate_Converter module
    - Create coordinate-converter.ts with celestialToHorizontal and horizontalToCelestial
    - Implement raHoursToDegrees and raDegreesToHours utilities
    - Use spherical trigonometry for transformations
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.4 Write property tests for Coordinate_Converter
    - **Property 2: Coordinate Conversion Round-Trip** - Verify RA/Dec→Az/Alt→RA/Dec within 0.01°
    - **Property 7: Horizontal Coordinate Output Ranges** - Verify Az [0, 360), Alt [-90, 90]
    - **Property 8: RA Format Equivalence** - Verify hours vs degrees produce identical results
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.7**

  - [x] 3.5 Implement geographic coordinate validation
    - Add validation functions for latitude [-90, +90] and longitude [-180, +180]
    - Ensure precision preservation to 4 decimal places
    - _Requirements: 2.2, 2.3, 2.5_

  - [x] 3.6 Write property tests for geographic validation
    - **Property 4: Geographic Coordinate Validation** - Verify acceptance/rejection at boundaries
    - **Property 5: Coordinate Precision Preservation** - Verify 4 decimal place precision
    - **Validates: Requirements 2.2, 2.3, 2.5**

- [x] 4. Checkpoint - Core astronomy calculations complete
  - Ensure all property tests pass with 100+ iterations
  - Ensure all tests pass, ask the user if questions arise

- [x] 5. Implement Star Catalog with API + local fallback
  - [x] 5.1 Create local star catalog JSON data file
    - Create data/stars.json with stars magnitude ≤5.0
    - Include id, name, ra, dec, magnitude, spectralType for each star
    - Include 8 major planets with symbols
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 5.2 Implement Star_Catalog module
    - Create star-catalog.ts with initialize, getStars, getPlanets, getVisibleStars
    - Implement API fetch with local JSON fallback
    - Add caching logic for offline use
    - _Requirements: 5.3, 5.5, 5.6_

  - [x] 5.3 Write unit tests for Star_Catalog
    - Test API fetch success path
    - Test fallback to local catalog on API failure
    - Test cache expiration logic
    - **Property 10: Star Data Completeness** - Verify all required fields present
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.6**

  - [x] 5.4 Implement Planet_Calculator using astronomy-engine library
    - Create planet-calculator.ts wrapping astronomy-engine npm package
    - Implement calculatePlanetPositions for all 8 planets
    - Update positions based on timestamp and observer location
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 5.5 Write property tests for Planet_Calculator
    - **Property 16: Planet Position Calculation** - Verify valid RA/Dec for all planets
    - **Validates: Requirements 9.1, 9.2**

- [x] 6. Implement Time Controller
  - [x] 6.1 Create Time_Controller module
    - Implement getCurrentTime, setTime, setRealTime, isRealTime
    - Implement getTimeRange returning ±1 year from current date
    - Add onTimeChange subscription mechanism
    - _Requirements: 12.1, 12.2, 12.5_

  - [ ] 6.2 Write property tests for Time_Controller
    - **Property 24: Time Range Constraint** - Verify timestamps constrained to ±1 year
    - **Property 25: Arbitrary Timestamp Acceptance** - Verify valid Date/ISO strings accepted
    - **Validates: Requirements 12.1, 12.2**

- [x] 7. Checkpoint - Astronomy engine package complete
  - Ensure astronomy-engine exports all modules
  - Ensure all tests pass, ask the user if questions arise

- [ ] 8. Implement mobile sensor integration
  - [x] 8.1 Implement Low_Pass_Filter class
    - Create low-pass-filter.ts with exponential moving average algorithm
    - Accept alpha parameter [0, 1], constrain Sensor_Manager alpha to [0.1, 0.5]
    - Process x, y, z axes independently
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 8.2 Write property tests for Low_Pass_Filter
    - **Property 3: Filter Cascade Property** - Verify alpha=0.5 twice ≈ alpha=0.25 once at steady-state
    - **Property 18: EMA Filter Formula** - Verify formula: output[n] = alpha * input[n] + (1-alpha) * output[n-1]
    - **Property 19: Filter Alpha Range** - Verify alpha acceptance in [0, 1]
    - **Property 20: Filter Smoothness vs Alpha** - Verify lower alpha = smoother output
    - **Property 21: Independent Axis Filtering** - Verify x, y, z processed independently
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

  - [x] 8.3 Implement Sensor_Manager module
    - Create sensor-manager.ts with initialize, startUpdates, stopUpdates
    - Request Magnetometer, Accelerometer, Gyroscope permissions
    - Read sensor data at minimum 30Hz
    - Compute heading (yaw), pitch, roll from raw data
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ] 8.4 Write property tests for Sensor_Manager orientation
    - **Property 26: Sensor Orientation Computation** - Verify heading [0, 360), pitch [-90, 90], roll [-180, 180]
    - **Validates: Requirements 1.4**

  - [x] 8.5 Implement sensor error handling
    - Handle permission denied with error message
    - Handle unavailable sensors with fallback and user notification
    - Apply Low_Pass_Filter with configurable alpha [0.1, 0.5]
    - _Requirements: 1.3, 1.5, 1.6_

  - [ ] 8.6 Write unit tests for sensor error handling
    - Test permission denied flow
    - Test sensor unavailable fallback
    - Test filter alpha configuration
    - **Validates: Requirements 1.3, 1.5, 1.6**

- [ ] 9. Implement mobile geolocation
  - [x] 9.1 Create mobile geolocation service
    - Request GPS coordinates on app start
    - Store coordinates with 4 decimal places precision
    - Implement manual entry fallback for denied GPS
    - Default to (0, 0) with warning if undetermined
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

  - [ ] 9.2 Write unit tests for geolocation service
    - Test GPS success path
    - Test manual entry fallback
    - Test default coordinates warning
    - **Validates: Requirements 2.1, 2.4, 2.6**

- [x] 10. Checkpoint - Mobile sensor and location complete
  - Ensure all tests pass, ask the user if questions arise

- [ ] 11. Implement mobile SkyView rendering
  - [x] 11.1 Create rendering utility functions
    - Implement magnitudeToRadius function (brighter = larger)
    - Implement spectral type to color mapping (O/B→blue, A/F→white, G→yellow, K→orange, M→red)
    - Implement FOV visibility calculation
    - _Requirements: 6.2, 6.7, 6.4_

  - [ ] 11.2 Write property tests for rendering utilities
    - **Property 11: Magnitude-to-Radius Ordering** - Verify lower magnitude = larger radius
    - **Property 14: Spectral Type Color Mapping** - Verify correct color for each type
    - **Property 12: Field of View Visibility** - Verify visibility based on angular distance and altitude
    - **Property 9: Below Horizon Marking** - Verify negative altitude = not visible
    - **Validates: Requirements 6.2, 6.7, 6.4, 4.6**

  - [x] 11.3 Implement SkyView_Component
    - Create SkyView.tsx rendering stars as SVG circles with react-native-svg
    - Scale star radius based on magnitude
    - Color-code stars by spectral type
    - Only render stars within current FOV
    - Update positions within 33ms (30fps)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7_

  - [x] 11.4 Implement star labels and planet rendering
    - Display star names for magnitude < 2.0
    - Render planets with distinct icons (not circles)
    - Always label visible planets
    - _Requirements: 6.5, 9.4, 9.5_

  - [ ] 11.5 Write property tests for star labels
    - **Property 13: Star Label Threshold** - Verify labels shown only for magnitude < 2.0
    - **Property 17: Planet Visual Differentiation** - Verify planets have distinct icons and labels
    - **Validates: Requirements 6.5, 9.4, 9.5**

  - [x] 11.6 Implement FOV management for mobile
    - Support configurable FOV [30, 120] degrees
    - Implement pinch-to-zoom gesture
    - Display current FOV value
    - Show fainter stars (magnitude 6.0) when FOV < 45°
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 11.7 Write property tests for FOV management
    - **Property 22: FOV Range Constraint** - Verify FOV constrained to [30, 120]
    - **Property 23: FOV-Dependent Magnitude Threshold** - Verify magnitude 6.0 when FOV < 45°
    - **Validates: Requirements 11.1, 11.5**

  - [x] 11.8 Implement smooth interpolation during pan
    - Smoothly interpolate star positions during view changes
    - _Requirements: 6.6_

- [x] 12. Checkpoint - Mobile app rendering complete
  - Ensure all tests pass, ask the user if questions arise

- [ ] 13. Implement web Sky Dome rendering
  - [x] 13.1 Create Sky_Dome component with Three.js
    - Create SkyDome.tsx using react-three-fiber
    - Render as Three.js sphere with stars on inner surface
    - Place stars at correct RA/Dec positions on sphere
    - Render at minimum 30fps
    - _Requirements: 7.1, 7.2, 7.6_

  - [ ] 13.2 Write property tests for 3D star positioning
    - **Property 15: 3D Star Positioning** - Verify angular position matches RA/Dec coordinates
    - **Validates: Requirements 7.2**

  - [x] 13.3 Implement mouse/scroll controls
    - Support mouse drag to rotate view
    - Support scroll wheel to zoom in/out
    - _Requirements: 7.3, 7.4_

  - [x] 13.4 Implement star info panel
    - Display info panel on star click with name, magnitude, coordinates
    - _Requirements: 7.5_

  - [x] 13.5 Implement WebGL fallback
    - Detect WebGL unavailability
    - Fall back to 2D canvas rendering
    - _Requirements: 7.7_

  - [ ] 13.6 Write unit tests for WebGL fallback
    - Test WebGL detection
    - Test 2D canvas fallback rendering
    - **Validates: Requirements 7.7**

- [ ] 14. Implement web geolocation
  - [x] 14.1 Create web geolocation service
    - Use browser geolocation API
    - Implement manual entry fallback
    - Store coordinates with 4 decimal places
    - _Requirements: 2.1, 2.4, 2.5_

- [x] 15. Checkpoint - Web app rendering complete
  - Ensure all tests pass, ask the user if questions arise

- [ ] 16. Implement time control UI
  - [x] 16.1 Create time slider component (shared logic)
    - Allow selection of any time within ±1 year
    - Display currently selected date/time prominently
    - Provide "Now" button for real-time viewing
    - _Requirements: 12.2, 12.4, 12.5_

  - [x] 16.2 Integrate time control with astronomy calculations
    - Recalculate all celestial positions within 100ms on time change
    - Update LST calculations at least once per second during active viewing
    - _Requirements: 12.3, 3.4_

  - [ ] 16.3 Write unit tests for time control integration
    - Test recalculation performance < 100ms
    - Test LST update frequency
    - **Validates: Requirements 12.3, 3.4**

- [ ] 17. Wire up mobile app end-to-end
  - [x] 17.1 Create main App component for mobile
    - Initialize Sensor_Manager on app start
    - Initialize geolocation service
    - Load Star_Catalog with API + fallback
    - Wire sensor orientation → coordinate conversion → SkyView rendering
    - _Requirements: 1.1, 2.1, 5.3_

  - [x] 17.2 Implement app state management
    - Create AppState with location, time, sensors, rendering, data states
    - Handle all error states with appropriate user feedback
    - _Requirements: All error handling from design_

- [ ] 18. Wire up web app end-to-end
  - [x] 18.1 Create main page component for web
    - Initialize geolocation service
    - Load Star_Catalog with API + fallback
    - Wire mouse controls → coordinate conversion → Sky_Dome rendering
    - _Requirements: 2.1, 5.3_

  - [x] 18.2 Implement web app state management
    - Create AppState for web-specific needs
    - Handle WebGL fallback state
    - _Requirements: 7.7_

- [x] 19. Final checkpoint - Full integration complete
  - Ensure `turbo build` succeeds
  - Ensure all property tests pass with 100+ iterations
  - Ensure all unit tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with minimum 100 iterations per property
- The astronomy-engine package has zero platform-specific dependencies
- Mobile uses react-native-svg for 2D rendering, web uses Three.js for 3D
- Star catalog supports both API fetch and local JSON fallback for offline use
