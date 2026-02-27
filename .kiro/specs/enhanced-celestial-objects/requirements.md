# Requirements Document

## Introduction

This feature enhances the stargazing-app by adding a horizon line visualization and expanding the celestial object catalog beyond stars and planets. The enhancement includes the Moon with phase information, the Sun with safety warnings, constellation patterns, deep sky objects (Messier catalog), satellite/ISS tracking, and meteor shower radiants. These additions will integrate with the existing astronomy-engine package and render on both mobile (React Native) and web (Next.js/Three.js) platforms.

## Glossary

- **Horizon_Line**: A visual indicator rendered at altitude 0 degrees representing the boundary between sky and ground
- **Moon_Calculator**: A module that computes the Moon's position (RA/Dec) and current phase information
- **Sun_Calculator**: A module that computes the Sun's position (RA/Dec) with associated safety warnings
- **Constellation_Renderer**: A component that draws lines connecting stars to form constellation patterns
- **Deep_Sky_Object**: Non-stellar astronomical objects such as nebulae, galaxies, and star clusters (e.g., Messier objects)
- **Deep_Sky_Catalog**: A data store containing deep sky object information including position, type, and magnitude
- **Satellite_Tracker**: A module that calculates satellite positions using Two-Line Element (TLE) data
- **TLE_Data**: Two-Line Element set data format used to describe satellite orbital parameters
- **Meteor_Shower_Radiant**: The apparent point in the sky from which meteors in a shower appear to originate
- **Lunar_Phase**: The illuminated portion of the Moon as seen from Earth (e.g., New Moon, Full Moon, Waxing Crescent)
- **Messier_Object**: One of 110 astronomical objects cataloged by Charles Messier, including galaxies, nebulae, and star clusters

## Requirements

### Requirement 1: Horizon Line Visualization

**User Story:** As a stargazer, I want to see a horizon line on the sky view, so that I can understand which celestial objects are above or below my local horizon.

#### Acceptance Criteria

1. THE Horizon_Line SHALL render as a continuous line at altitude 0 degrees across all azimuth values (0-360 degrees)
2. WHEN the observer's location changes, THE Horizon_Line SHALL recalculate its position relative to the new observer coordinates
3. THE Horizon_Line SHALL be visually distinct from celestial objects using a configurable color and opacity
4. WHILE a celestial object has altitude less than 0 degrees, THE Sky_Calculator SHALL mark that object as below the horizon

### Requirement 2: Moon Position and Phase Calculation

**User Story:** As a stargazer, I want to see the Moon's position and current phase, so that I can plan my observations around lunar conditions.

#### Acceptance Criteria

1. THE Moon_Calculator SHALL compute the Moon's Right Ascension and Declination for a given timestamp and observer location
2. THE Moon_Calculator SHALL compute the current lunar phase as one of: New Moon, Waxing Crescent, First Quarter, Waxing Gibbous, Full Moon, Waning Gibbous, Last Quarter, Waning Crescent
3. THE Moon_Calculator SHALL compute the Moon's illumination percentage (0-100%)
4. WHEN the timestamp changes, THE Moon_Calculator SHALL recalculate the Moon's position and phase
5. THE Moon_Calculator SHALL compute the Moon's apparent magnitude based on its current phase

### Requirement 3: Sun Position and Safety Warnings

**User Story:** As a stargazer, I want to see the Sun's position with appropriate safety warnings, so that I can understand daylight conditions and avoid eye damage.

#### Acceptance Criteria

1. THE Sun_Calculator SHALL compute the Sun's Right Ascension and Declination for a given timestamp and observer location
2. THE Sun_Calculator SHALL return a safety warning flag when the Sun's altitude is greater than -18 degrees (astronomical twilight threshold)
3. WHEN the Sun's altitude is greater than 0 degrees, THE Sun_Calculator SHALL return a "daylight" status indicator
4. WHEN the Sun's altitude is between -18 and 0 degrees, THE Sun_Calculator SHALL return a "twilight" status indicator
5. WHEN the Sun's altitude is less than -18 degrees, THE Sun_Calculator SHALL return a "night" status indicator
6. THE Renderer SHALL display a prominent safety warning when the Sun is above the horizon

### Requirement 4: Constellation Line Patterns

**User Story:** As a stargazer, I want to see constellation patterns drawn between stars, so that I can identify and learn constellations in the night sky.

#### Acceptance Criteria

1. THE Constellation_Renderer SHALL draw lines connecting stars according to constellation line data
2. THE Constellation_Renderer SHALL support all 88 IAU-recognized constellations
3. WHEN a constellation's stars are partially below the horizon, THE Constellation_Renderer SHALL render only the visible portion of the constellation lines
4. THE Constellation_Renderer SHALL display the constellation name near its center point
5. THE Constellation_Renderer SHALL allow enabling or disabling constellation line display via a toggle setting
6. THE Constellation_Renderer SHALL use configurable line color and thickness

### Requirement 5: Deep Sky Object Catalog

**User Story:** As a stargazer, I want to see deep sky objects like nebulae, galaxies, and star clusters, so that I can locate and observe these fascinating objects.

#### Acceptance Criteria

1. THE Deep_Sky_Catalog SHALL contain all 110 Messier objects with their positions (RA/Dec), types, and apparent magnitudes
2. THE Deep_Sky_Catalog SHALL categorize objects by type: Galaxy, Nebula, Open Cluster, Globular Cluster, Planetary Nebula
3. WHEN a deep sky object's magnitude exceeds the configured visibility threshold, THE Renderer SHALL hide that object
4. THE Deep_Sky_Catalog SHALL provide common names for objects where available (e.g., "Orion Nebula" for M42)
5. THE Sky_Calculator SHALL compute horizontal coordinates for deep sky objects using the existing coordinate conversion system
6. THE Renderer SHALL display deep sky objects with distinct icons based on their type

### Requirement 6: Satellite and ISS Tracking

**User Story:** As a stargazer, I want to track satellites including the ISS, so that I can observe visible satellite passes.

#### Acceptance Criteria

1. THE Satellite_Tracker SHALL compute satellite positions using Two-Line Element (TLE) data
2. THE Satellite_Tracker SHALL support tracking the International Space Station (ISS) by default
3. WHEN TLE data is older than 14 days, THE Satellite_Tracker SHALL flag the data as stale and request an update
4. THE Satellite_Tracker SHALL compute the satellite's altitude, azimuth, and range from the observer
5. THE Satellite_Tracker SHALL predict satellite visibility based on the satellite's illumination by the Sun and observer's darkness conditions
6. IF TLE data is unavailable or invalid, THEN THE Satellite_Tracker SHALL return an error status and skip that satellite

### Requirement 7: Meteor Shower Radiants

**User Story:** As a stargazer, I want to see meteor shower radiant points, so that I can know where to look during active meteor showers.

#### Acceptance Criteria

1. THE Meteor_Shower_Catalog SHALL contain radiant positions (RA/Dec) for major annual meteor showers
2. THE Meteor_Shower_Catalog SHALL include peak dates and typical Zenithal Hourly Rate (ZHR) for each shower
3. WHEN the current date is within 7 days of a shower's peak, THE Renderer SHALL highlight that shower's radiant as "active"
4. THE Meteor_Shower_Catalog SHALL include at least the following showers: Quadrantids, Lyrids, Eta Aquariids, Perseids, Orionids, Leonids, Geminids
5. THE Sky_Calculator SHALL compute horizontal coordinates for meteor shower radiants using the existing coordinate conversion system

### Requirement 8: Extended Sky Positions Interface

**User Story:** As a developer, I want the SkyPositions interface to include all new celestial object types, so that renderers can access all object positions uniformly.

#### Acceptance Criteria

1. THE SkyPositions interface SHALL include a moonPosition field containing the Moon's horizontal coordinates and phase information
2. THE SkyPositions interface SHALL include a sunPosition field containing the Sun's horizontal coordinates and safety status
3. THE SkyPositions interface SHALL include a deepSkyPositions map containing horizontal coordinates for visible deep sky objects
4. THE SkyPositions interface SHALL include a satellitePositions map containing horizontal coordinates for tracked satellites
5. THE SkyPositions interface SHALL include a meteorShowerRadiants map containing horizontal coordinates for active meteor shower radiants
6. THE SkyPositions interface SHALL include a constellationLines array containing line segment data for visible constellations
7. WHEN recalculate is called, THE Sky_Calculator SHALL update all position fields within the 100ms performance target
