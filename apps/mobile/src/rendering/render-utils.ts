/**
 * Rendering Utility Functions
 * Shared utilities for star/planet rendering
 */

import { SpectralType, HorizontalCoordinates } from '@virtual-window/astronomy-engine';

/**
 * Spectral type to color mapping
 * O/B → blue, A/F → white, G → yellow, K → orange, M → red
 */
export const SPECTRAL_COLORS: Record<SpectralType, string> = {
  'O': '#9bb0ff',  // Blue
  'B': '#aabfff',  // Blue-white
  'A': '#cad7ff',  // White
  'F': '#f8f7ff',  // Yellow-white
  'G': '#fff4ea',  // Yellow
  'K': '#ffd2a1',  // Orange
  'M': '#ffcc6f',  // Red-orange
};

/**
 * Converts apparent magnitude to screen radius
 * Brighter stars (lower magnitude) get larger radius
 * @param magnitude - Apparent magnitude of the star
 * @param baseFov - Current field of view in degrees
 * @returns Radius in pixels
 */
export function magnitudeToRadius(magnitude: number, baseFov: number = 60): number {
  // Magnitude scale is logarithmic: each magnitude is ~2.512x brightness
  // Brighter = lower magnitude = larger radius
  const baseRadius = 3;
  const scaleFactor = Math.pow(2.512, (2 - magnitude) / 2);
  const fovScale = 60 / baseFov;  // Adjust for zoom level
  return Math.max(1, baseRadius * scaleFactor * fovScale);
}

/**
 * Gets color for a spectral type
 * @param spectralType - Star's spectral classification
 * @returns Hex color string
 */
export function spectralTypeToColor(spectralType: SpectralType): string {
  return SPECTRAL_COLORS[spectralType] || SPECTRAL_COLORS['G'];  // Default to yellow
}

/**
 * Calculates angular distance between two horizontal coordinates
 * @param a - First coordinate
 * @param b - Second coordinate
 * @returns Angular distance in degrees
 */
export function angularDistance(a: HorizontalCoordinates, b: HorizontalCoordinates): number {
  // Convert to radians
  const az1 = a.azimuth * Math.PI / 180;
  const alt1 = a.altitude * Math.PI / 180;
  const az2 = b.azimuth * Math.PI / 180;
  const alt2 = b.altitude * Math.PI / 180;
  
  // Spherical law of cosines
  const cosDistance = Math.sin(alt1) * Math.sin(alt2) +
                      Math.cos(alt1) * Math.cos(alt2) * Math.cos(az1 - az2);
  
  // Clamp to valid range to avoid NaN from floating point errors
  const clampedCos = Math.max(-1, Math.min(1, cosDistance));
  
  return Math.acos(clampedCos) * 180 / Math.PI;
}

/**
 * Checks if a celestial object is visible in the current field of view
 * @param objectPosition - Object's horizontal coordinates
 * @param viewCenter - Center of the current view
 * @param fov - Field of view in degrees
 * @returns true if object is within FOV and above horizon
 */
export function isInFieldOfView(
  objectPosition: HorizontalCoordinates,
  viewCenter: HorizontalCoordinates,
  fov: number
): boolean {
  // Object must be above horizon (altitude >= 0)
  if (objectPosition.altitude < 0) {
    return false;
  }
  
  // Object must be within half the FOV from view center
  const distance = angularDistance(objectPosition, viewCenter);
  return distance <= fov / 2;
}

/**
 * Checks if an object is above the horizon
 * @param altitude - Object's altitude in degrees
 * @returns true if altitude >= 0
 */
export function isAboveHorizon(altitude: number): boolean {
  return altitude >= 0;
}

/**
 * Gets the magnitude threshold based on FOV
 * Shows fainter stars (mag 6.0) when zoomed in (FOV < 45°)
 * @param fov - Current field of view in degrees
 * @returns Maximum magnitude to display
 */
export function getMagnitudeThreshold(fov: number): number {
  return fov < 45 ? 6.0 : 5.0;
}

/**
 * Constrains FOV to valid range [30, 120] degrees
 * @param fov - Requested field of view
 * @returns Constrained FOV value
 */
export function constrainFov(fov: number): number {
  return Math.max(30, Math.min(120, fov));
}

/**
 * Checks if a star should display its label
 * Labels shown for stars brighter than magnitude 2.0
 * @param magnitude - Star's apparent magnitude
 * @returns true if label should be shown
 */
export function shouldShowLabel(magnitude: number): boolean {
  return magnitude < 2.0;
}

/**
 * Converts horizontal coordinates to screen position
 * @param position - Object's horizontal coordinates
 * @param viewCenter - Center of the current view
 * @param fov - Field of view in degrees
 * @param screenWidth - Screen width in pixels
 * @param screenHeight - Screen height in pixels
 * @returns Screen coordinates {x, y} or null if not visible
 */
export function horizontalToScreen(
  position: HorizontalCoordinates,
  viewCenter: HorizontalCoordinates,
  fov: number,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } | null {
  // Check if in FOV
  if (!isInFieldOfView(position, viewCenter, fov)) {
    return null;
  }
  
  // Calculate relative position from view center
  // Using gnomonic (tangent plane) projection
  const centerAz = viewCenter.azimuth * Math.PI / 180;
  const centerAlt = viewCenter.altitude * Math.PI / 180;
  const objAz = position.azimuth * Math.PI / 180;
  const objAlt = position.altitude * Math.PI / 180;
  
  // Gnomonic projection
  const cosc = Math.sin(centerAlt) * Math.sin(objAlt) +
               Math.cos(centerAlt) * Math.cos(objAlt) * Math.cos(objAz - centerAz);
  
  if (cosc <= 0) return null;  // Behind the viewer
  
  const x = (Math.cos(objAlt) * Math.sin(objAz - centerAz)) / cosc;
  const y = (Math.cos(centerAlt) * Math.sin(objAlt) -
             Math.sin(centerAlt) * Math.cos(objAlt) * Math.cos(objAz - centerAz)) / cosc;
  
  // Convert to screen coordinates
  const fovRad = fov * Math.PI / 180;
  const scale = Math.min(screenWidth, screenHeight) / (2 * Math.tan(fovRad / 2));
  
  const screenX = screenWidth / 2 + x * scale;
  const screenY = screenHeight / 2 - y * scale;  // Y is inverted
  
  return { x: screenX, y: screenY };
}
