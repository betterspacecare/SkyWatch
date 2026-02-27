# Requirements Document

## Introduction

A cross-platform stargazing application called "Virtual Window" that provides real-time celestial visualization. The app uses device GPS and motion sensors to map celestial coordinates (Right Ascension/Declination) onto screen coordinates (Azimuth/Altitude), creating an augmented reality-like experience where users can point their device at the sky to identify stars and planets. The solution targets React Native for mobile platforms and Next.js for web, sharing core astronomy logic through a monorepo architecture.

## Glossary

- **Astronomy_Engine**: The shared TypeScript package containing all celestial coordinate calculations and transformations
- **Coordinate_Converter**: The utility module that transforms celestial coordinates (RA/Dec) to horizontal coordinates (Az/Alt)
- **Sensor_Manager**: The mobile module responsible for reading and filtering device sensor data
- **Sky_Renderer**: The component responsible for rendering celestial objects on screen (Three.js for web, react-native-svg for mobile)
- **Star_Catalog**: The data source containing star and planet information up to magnitude 5.0
- **LST_Calculator**: The utility that computes Local Sidereal Time from geographic position and timestamp
- **Low_Pass_Filter**: The signal processing algorithm that smooths sensor readings to reduce UI jitter
- **Right_Ascension (RA)**: The celestial equivalent of longitude, measured in hours/minutes/seconds
- **Declination (Dec)**: The celestial equivalent of latitude, measured in degrees
- **Azimuth (Az)**: The horizontal angle from north, measured clockwise in degrees
- **Altitude (Alt)**: The vertical angle above the horizon, measured in degrees
- **SkyView_Component**: The main React Native component displaying the 2D star field
- **Sky_Dome**: The Three.js spherical mesh representing the celestial sphere on web

## Requirements

### Requirement 1: Sensor Integration

**User Story:** As a mobile user, I want the app to read my device's orientation sensors, so that the sky view updates as I move my device.

#### Acceptance Criteria

1. WHEN the mobile app initializes, THE Sensor_Manager SHALL request access to Magnetometer, Accelerometer, and Gyroscope sensors
2. WHILE the app is in foreground, THE Sensor_Manager SHALL read sensor data at a minimum rate of 30Hz
3. THE Sensor_Manager SHALL apply a Low_Pass_Filter to all sensor readings with a configurable smoothing factor between 0.1 and 0.5
4. WHEN sensor readings are received, THE Sensor_Manager SHALL compute device heading (yaw), pitch, and roll from raw sensor data
5. IF sensor access is denied, THEN THE Sensor_Manager SHALL display an error message explaining required permissions
6. IF a sensor is unavailable on the device, THEN THE Sensor_Manager SHALL fall back to available sensors and notify the user of reduced functionality

### Requirement 2: Geographic Position

**User Story:** As a user, I want the app to know my location, so that celestial calculations are accurate for my position on Earth.

#### Acceptance Criteria

1. WHEN the app starts, THE Astronomy_Engine SHALL request the user's geographic coordinates via GPS or browser geolocation API
2. THE Astronomy_Engine SHALL accept latitude values between -90 and +90 degrees
3. THE Astronomy_Engine SHALL accept longitude values between -180 and +180 degrees
4. IF GPS access is denied, THEN THE Astronomy_Engine SHALL allow manual entry of latitude and longitude
5. WHEN location is obtained, THE Astronomy_Engine SHALL store coordinates with at least 4 decimal places of precision
6. IF location cannot be determined, THEN THE Astronomy_Engine SHALL default to coordinates (0, 0) and display a warning

### Requirement 3: Local Sidereal Time Calculation

**User Story:** As a user, I want accurate time-based calculations, so that star positions reflect the current moment.

#### Acceptance Criteria

1. WHEN geographic coordinates and timestamp are provided, THE LST_Calculator SHALL compute Local Sidereal Time
2. THE LST_Calculator SHALL accept timestamps in UTC format
3. THE LST_Calculator SHALL return LST as a decimal hour value between 0 and 24
4. THE LST_Calculator SHALL update LST calculations at least once per second during active viewing
5. FOR ALL valid inputs, computing LST then converting back to UTC SHALL produce the original timestamp within 1 second tolerance (round-trip property)

### Requirement 4: Coordinate Conversion

**User Story:** As a user, I want celestial objects displayed at correct screen positions, so that I can identify what I'm looking at in the real sky.

#### Acceptance Criteria

1. WHEN RA, Dec, latitude, longitude, and LST are provided, THE Coordinate_Converter SHALL compute Azimuth and Altitude
2. THE Coordinate_Converter SHALL return Azimuth as degrees between 0 and 360 (clockwise from north)
3. THE Coordinate_Converter SHALL return Altitude as degrees between -90 and +90
4. THE Coordinate_Converter SHALL accept RA in decimal hours (0 to 24) or degrees (0 to 360)
5. THE Coordinate_Converter SHALL accept Declination in degrees (-90 to +90)
6. WHEN Altitude is negative, THE Sky_Renderer SHALL mark the object as below horizon
7. FOR ALL valid RA/Dec inputs, converting to Az/Alt then back to RA/Dec SHALL produce values within 0.01 degrees of the original (round-trip property)

### Requirement 5: Star Catalog Data

**User Story:** As a user, I want to see stars visible to the naked eye, so that I can match the app display to what I see in the sky.

#### Acceptance Criteria

1. THE Star_Catalog SHALL contain all stars with apparent magnitude 5.0 or brighter
2. THE Star_Catalog SHALL store for each star: name (if named), RA, Dec, apparent magnitude, and spectral type
3. WHEN the app loads, THE Star_Catalog SHALL be available from either a local JSON file or the AstronomyAPI
4. THE Star_Catalog SHALL include the 8 major planets of the solar system
5. WHEN fetching from AstronomyAPI, THE Star_Catalog SHALL cache results locally for offline use
6. IF API fetch fails, THEN THE Star_Catalog SHALL fall back to the bundled local JSON catalog

### Requirement 6: Mobile Sky Rendering (React Native)

**User Story:** As a mobile user, I want a smooth visual representation of the sky, so that I can easily identify celestial objects.

#### Acceptance Criteria

1. THE SkyView_Component SHALL render stars as SVG circles using react-native-svg
2. THE SkyView_Component SHALL scale star circle radius based on apparent magnitude (brighter stars appear larger)
3. WHEN sensor orientation changes, THE SkyView_Component SHALL update star positions within 33ms (30fps minimum)
4. THE SkyView_Component SHALL only render stars currently within the device's field of view
5. THE SkyView_Component SHALL display star names for stars brighter than magnitude 2.0
6. WHILE the user pans the view, THE SkyView_Component SHALL smoothly interpolate star positions
7. THE SkyView_Component SHALL color-code stars based on spectral type (blue for O/B, white for A/F, yellow for G, orange for K, red for M)

### Requirement 7: Web Sky Rendering (Next.js/Three.js)

**User Story:** As a web user, I want an immersive 3D sky dome, so that I can explore the night sky interactively.

#### Acceptance Criteria

1. THE Sky_Dome SHALL render as a Three.js sphere using react-three-fiber
2. THE Sky_Dome SHALL place stars on the inner surface of the sphere at correct RA/Dec positions
3. THE Sky_Dome SHALL support mouse drag to rotate the view
4. THE Sky_Dome SHALL support scroll wheel to zoom in/out
5. WHEN the user clicks a star, THE Sky_Dome SHALL display an info panel with star name, magnitude, and coordinates
6. THE Sky_Dome SHALL render at minimum 30fps on devices with WebGL support
7. IF WebGL is unavailable, THEN THE Sky_Dome SHALL fall back to a 2D canvas rendering

### Requirement 8: Monorepo Project Structure

**User Story:** As a developer, I want shared code between platforms, so that astronomy logic is consistent and maintainable.

#### Acceptance Criteria

1. THE project SHALL use Turborepo or Nx as the monorepo build system
2. THE Astronomy_Engine SHALL be a separate package importable by both Next.js and React Native apps
3. THE Astronomy_Engine package SHALL have zero platform-specific dependencies
4. THE project SHALL contain separate app directories for web (Next.js) and mobile (React Native)
5. THE project SHALL use TypeScript for all shared packages and applications
6. WHEN the Astronomy_Engine is modified, THE build system SHALL trigger rebuilds of dependent apps

### Requirement 9: Planet Position Calculation

**User Story:** As a user, I want to see planets in their current positions, so that I can locate them in the night sky.

#### Acceptance Criteria

1. WHEN timestamp and observer location are provided, THE Astronomy_Engine SHALL calculate current RA/Dec for all 8 planets
2. THE Astronomy_Engine SHALL use the astronomy-engine library for planetary calculations
3. THE Astronomy_Engine SHALL update planet positions at least once per minute
4. THE Sky_Renderer SHALL display planets with distinct icons differentiating them from stars
5. THE Sky_Renderer SHALL label all visible planets with their names

### Requirement 10: Low-Pass Filter Implementation

**User Story:** As a mobile user, I want stable sensor readings, so that the sky view doesn't jitter or shake.

#### Acceptance Criteria

1. THE Low_Pass_Filter SHALL implement an exponential moving average algorithm
2. THE Low_Pass_Filter SHALL accept a smoothing factor (alpha) parameter between 0 and 1
3. WHEN alpha is closer to 0, THE Low_Pass_Filter SHALL produce smoother but more delayed output
4. WHEN alpha is closer to 1, THE Low_Pass_Filter SHALL produce more responsive but noisier output
5. THE Low_Pass_Filter SHALL process 3-axis sensor data (x, y, z) independently
6. FOR ALL input sequences, applying the filter twice with alpha=0.5 SHALL produce the same result as applying once with alpha=0.25 (idempotence-like property for steady-state)

### Requirement 11: Field of View Management

**User Story:** As a user, I want to control how much of the sky I see, so that I can zoom in on areas of interest.

#### Acceptance Criteria

1. THE Sky_Renderer SHALL support configurable field of view between 30 and 120 degrees
2. WHEN field of view changes, THE Sky_Renderer SHALL recalculate which stars are visible
3. THE Sky_Renderer SHALL provide pinch-to-zoom gesture on mobile to adjust field of view
4. THE Sky_Renderer SHALL display current field of view value to the user
5. WHEN field of view is narrow (less than 45 degrees), THE Sky_Renderer SHALL display fainter stars (up to magnitude 6.0)

### Requirement 12: Time Control

**User Story:** As a user, I want to view the sky at different times, so that I can plan future observations or review past events.

#### Acceptance Criteria

1. THE Astronomy_Engine SHALL accept arbitrary timestamps for calculations, not just current time
2. THE app SHALL provide a time slider allowing selection of any time within ±1 year from current date
3. WHEN time is changed, THE Astronomy_Engine SHALL recalculate all celestial positions within 100ms
4. THE app SHALL display the currently selected date and time prominently
5. THE app SHALL provide a "Now" button to instantly return to real-time viewing
