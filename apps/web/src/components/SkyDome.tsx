/**
 * SkyDome Component
 * 3D sky dome rendering using Three.js and react-three-fiber
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Star, 
  Planet, 
  SpectralType, 
  HorizonPoint,
  MoonPosition,
  SunPosition,
  Constellation,
  DeepSkyPosition,
  DeepSkyObjectType,
  SatellitePosition,
  SatelliteTrackerError,
  MeteorShowerPosition,
} from '@virtual-window/astronomy-engine';

// Spectral type to color mapping - brighter colors for better visibility
const SPECTRAL_COLORS: Record<SpectralType, string> = {
  'O': '#9bb0ff', // Blue
  'B': '#aabfff', // Blue-white  
  'A': '#cad7ff', // White with blue tint
  'F': '#f8f7ff', // White with slight yellow
  'G': '#fff4ea', // Yellow-white (like our Sun)
  'K': '#ffd2a1', // Orange
  'M': '#ffcc6f', // Red-orange
};

// Deep sky object type icons
const DEEP_SKY_ICONS: Record<DeepSkyObjectType, string> = {
  'Galaxy': '🌀',
  'Nebula': '☁️',
  'Open Cluster': '✨',
  'Globular Cluster': '⭐',
  'Planetary Nebula': '💫',
};

export interface CameraOrientation {
  azimuth: number;
  altitude: number;
  fov: number;
}

export interface SkyDomeConfig {
  fov: number;
  maxMagnitude: number;
  showLabels: boolean;
  labelMagnitudeThreshold: number;
}

export interface SkyDomeProps {
  stars: Star[];
  planets: Planet[];
  config: SkyDomeConfig;
  horizonPoints?: HorizonPoint[];
  horizonConfig?: {
    color?: string;
    opacity?: number;
    lineWidth?: number;
  };
  moonPosition?: MoonPosition | null;
  sunPosition?: SunPosition | null;
  constellations?: Constellation[];
  constellationConfig?: {
    enabled?: boolean;
    lineColor?: string;
    lineOpacity?: number;
    showNames?: boolean;
    nameColor?: string;
  };
  deepSkyPositions?: Map<string, DeepSkyPosition>;
  deepSkyConfig?: {
    enabled?: boolean;
    showLabels?: boolean;
    showAll?: boolean; // Show all objects regardless of horizon
  };
  satellitePositions?: Map<string, SatellitePosition | SatelliteTrackerError>;
  satelliteConfig?: {
    enabled?: boolean;
    showLabels?: boolean;
  };
  meteorShowerRadiants?: Map<string, MeteorShowerPosition>;
  meteorShowerConfig?: {
    enabled?: boolean;
    showLabels?: boolean;
    showInactive?: boolean;
  };
  // Coordinate grid config
  gridConfig?: {
    showAltitude?: boolean;
    showAzimuth?: boolean;
    showEquatorial?: boolean;
    altitudeColor?: string;
    azimuthColor?: string;
    equatorialColor?: string;
    opacity?: number;
  };
  // Ground panorama texture (equirectangular image, sky removed)
  groundTexture?: string;
  // Atmosphere and ground visibility toggles
  showAtmosphere?: boolean;
  showGround?: boolean;
  // Real-time position updates
  lst?: number; // Local Sidereal Time in decimal hours
  observerLatitude?: number; // Observer's latitude in degrees
  // Highlighted object for search
  highlightedObjectId?: string | null;
  // Camera target for auto-centering on search
  cameraTarget?: { azimuth: number; altitude: number } | null;
  // Close highlight callback
  onCloseHighlight?: () => void;
  // Click handlers for all object types
  onStarClick?: (star: Star) => void;
  onPlanetClick?: (planet: Planet) => void;
  onDeepSkyClick?: (object: DeepSkyPosition) => void;
  onMoonClick?: (moon: MoonPosition) => void;
  onSunClick?: (sun: SunPosition) => void;
  onConstellationClick?: (constellation: Constellation) => void;
  onCameraChange?: (orientation: CameraOrientation) => void;
}

// Convert RA/Dec to 3D position on sphere using horizontal coordinates
// This properly accounts for observer location and current time (LST)
function celestialToHorizontal3D(
  ra: number, 
  dec: number, 
  lst: number, 
  observerLatitude: number,
  radius: number = 100
): THREE.Vector3 {
  // Calculate Hour Angle in hours, then convert to degrees and radians
  const haHours = lst - ra;
  const haDegrees = haHours * 15; // 15 degrees per hour
  const haRadians = (haDegrees * Math.PI) / 180;
  
  // Convert Dec and Lat to radians
  const decRad = (dec * Math.PI) / 180;
  const latRad = (observerLatitude * Math.PI) / 180;
  
  // Calculate altitude using spherical trigonometry
  // sin(Alt) = sin(Dec) * sin(Lat) + cos(Dec) * cos(Lat) * cos(HA)
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRadians);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
  
  // Calculate azimuth
  const cosAlt = Math.cos(altitude * Math.PI / 180);
  const cosLat = Math.cos(latRad);
  
  let azimuth: number;
  if (Math.abs(cosAlt) < 1e-10 || Math.abs(cosLat) < 1e-10) {
    azimuth = 0;
  } else {
    const cosAz = (Math.sin(decRad) - sinAlt * Math.sin(latRad)) / (cosAlt * cosLat);
    let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    
    // Adjust azimuth based on hour angle
    // Positive HA means object is west of meridian
    if (Math.sin(haRadians) > 0) {
      azRad = 2 * Math.PI - azRad;
    }
    azimuth = azRad * 180 / Math.PI;
  }
  
  // Normalize azimuth to [0, 360)
  azimuth = ((azimuth % 360) + 360) % 360;
  
  // Mirror the azimuth for correct display (360 - az) since we're inside the sphere looking out
  azimuth = (360 - azimuth) % 360;
  
  // Convert to 3D using horizontal coordinates
  return horizontalTo3D(azimuth, altitude, radius);
}

// Convert horizontal coordinates (azimuth/altitude) to 3D position on sphere
function horizontalTo3D(azimuth: number, altitude: number, radius: number = 100): THREE.Vector3 {
  const azRad = (azimuth * Math.PI) / 180;
  const altRad = (altitude * Math.PI) / 180;
  
  // Spherical to Cartesian (azimuth measured from north, clockwise)
  const x = radius * Math.cos(altRad) * Math.sin(azRad);
  const y = radius * Math.sin(altRad);
  const z = radius * Math.cos(altRad) * Math.cos(azRad);
  
  return new THREE.Vector3(x, y, z);
}

// Magnitude to size mapping - bright stars are larger and more prominent
function magnitudeToSize(magnitude: number, isConstellationStar: boolean = false): number {
  // Extra boost for constellation stars
  const constellationBoost = isConstellationStar ? 1.5 : 1.0;
  
  if (magnitude < -1) {
    // Extremely bright stars like Sirius (-1.46)
    return 1.4 * constellationBoost;
  } else if (magnitude < 0) {
    // Very bright stars
    return 1.1 * constellationBoost;
  } else if (magnitude < 1) {
    // Bright stars like Vega, Arcturus
    return 0.9 * constellationBoost;
  } else if (magnitude < 2) {
    // Notable stars like Polaris
    return 0.7 * constellationBoost;
  } else if (magnitude < 3) {
    // Visible constellation stars
    return 0.5 * constellationBoost;
  } else if (magnitude < 4) {
    return 0.35 * constellationBoost;
  } else if (magnitude < 5) {
    return 0.25;
  } else if (magnitude < 6) {
    return 0.18;
  } else {
    return 0.12;
  }
}

// Optimized stars renderer using Points for maximum performance
interface InstancedStarsProps {
  stars: Star[];
  lst: number;
  observerLatitude: number;
  fov: number; // Field of view for zoom-based sizing
  labelMagnitudeThreshold: number;
  showLabels: boolean;
  onStarClick?: (star: Star) => void;
  constellationStarIds?: Set<string>; // IDs of stars that are part of constellations
}

// Custom shader for circular stars with glow effect
const starVertexShader = `
  attribute float size;
  attribute vec3 customColor;
  uniform float zoomScale;
  varying vec3 vColor;
  varying float vSize;
  
  void main() {
    vColor = customColor;
    vSize = size;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(size * zoomScale * (250.0 / -mvPosition.z), 2.0, 60.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragmentShader = `
  varying vec3 vColor;
  varying float vSize;
  
  void main() {
    vec2 cxy = gl_PointCoord * 2.0 - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    
    // Bright core with soft glow
    float core = 1.0 - smoothstep(0.0, 0.3, sqrt(r));
    float glow = 1.0 - smoothstep(0.0, 1.0, sqrt(r));
    float alpha = core + glow * 0.6;
    
    // Brighter center, color tinted edges
    vec3 finalColor = mix(vColor, vec3(1.0), core * 0.5);
    finalColor *= (1.0 + core * 0.5);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const InstancedStars: React.FC<InstancedStarsProps> = ({ 
  stars, 
  lst, 
  observerLatitude,
  fov,
  labelMagnitudeThreshold,
  showLabels,
  onStarClick,
  constellationStarIds,
}) => {
  const pointsRef = React.useRef<THREE.Points>(null);
  const { camera, raycaster, pointer } = useThree();
  
  // Calculate zoom scale - stars get BIGGER when zoomed in (lower FOV)
  const zoomScale = useMemo(() => {
    return Math.max(0.8, Math.min(4.0, 60 / fov));
  }, [fov]);
  
  // Pre-calculate all star positions and colors - memoized heavily
  const { positions, colors, sizes, starData } = useMemo(() => {
    const posArray = new Float32Array(stars.length * 3);
    const colorArray = new Float32Array(stars.length * 3);
    const sizeArray = new Float32Array(stars.length);
    const dataArray: { star: Star; index: number }[] = [];
    const tempColor = new THREE.Color();
    
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i]!;
      const position = celestialToHorizontal3D(star.ra, star.dec, lst, observerLatitude);
      const color = SPECTRAL_COLORS[star.spectralType as SpectralType] || SPECTRAL_COLORS['G'];
      const isConstellation = constellationStarIds?.has(star.id) ?? false;
      const size = magnitudeToSize(star.magnitude, isConstellation) * 4;
      
      const idx = i * 3;
      posArray[idx] = position.x;
      posArray[idx + 1] = position.y;
      posArray[idx + 2] = position.z;
      
      tempColor.set(color);
      if (isConstellation) {
        colorArray[idx] = Math.min(1, tempColor.r * 1.15);
        colorArray[idx + 1] = Math.min(1, tempColor.g * 1.15);
        colorArray[idx + 2] = Math.min(1, tempColor.b * 1.15);
      } else {
        colorArray[idx] = tempColor.r;
        colorArray[idx + 1] = tempColor.g;
        colorArray[idx + 2] = tempColor.b;
      }
      sizeArray[i] = size;
      dataArray.push({ star, index: i });
    }
    
    return { positions: posArray, colors: colorArray, sizes: sizeArray, starData: dataArray };
  }, [stars, lst, observerLatitude, constellationStarIds]);
  
  // Only show labels for bright named stars - limit count for performance
  const labeledStars = useMemo(() => {
    if (!showLabels) return [];
    const filtered = starData
      .filter(d => d.star.name && d.star.magnitude < labelMagnitudeThreshold)
      .slice(0, 50); // Limit to 50 labels max
    return filtered.map(d => ({
      star: d.star,
      position: new THREE.Vector3(
        positions[d.index * 3] ?? 0,
        positions[d.index * 3 + 1] ?? 0,
        positions[d.index * 3 + 2] ?? 0
      )
    }));
  }, [starData, showLabels, labelMagnitudeThreshold, positions]);
  
  // Create shader material once
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { zoomScale: { value: zoomScale } },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);
  
  // Update zoom scale
  React.useEffect(() => {
    if (shaderMaterial.uniforms.zoomScale) {
      shaderMaterial.uniforms.zoomScale.value = zoomScale;
    }
  }, [zoomScale, shaderMaterial]);
  
  // Handle click via raycasting - find nearest star to click point
  const handleClick = useCallback(() => {
    if (!onStarClick || !pointsRef.current) return;
    
    raycaster.setFromCamera(pointer, camera);
    // Small threshold - only detect clicks very close to stars
    raycaster.params.Points = { threshold: 0.5 };
    
    const intersects = raycaster.intersectObject(pointsRef.current);
    if (intersects.length > 0 && intersects[0]?.index !== undefined) {
      // Only trigger if distance is reasonable (not clicking empty space)
      if (intersects[0].distanceToRay !== undefined && intersects[0].distanceToRay < 1.0) {
        const starInfo = starData[intersects[0].index];
        if (starInfo) {
          onStarClick(starInfo.star);
        }
      }
    }
  }, [onStarClick, camera, raycaster, pointer, starData]);
  
  return (
    <group onClick={handleClick}>
      <points ref={pointsRef} frustumCulled={false} material={shaderMaterial}>
        <bufferGeometry key={`stars-${lst.toFixed(4)}-${observerLatitude}`}>
          <bufferAttribute attach="attributes-position" count={stars.length} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-customColor" count={stars.length} array={colors} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={stars.length} array={sizes} itemSize={1} />
        </bufferGeometry>
      </points>
      
      {/* Labels for bright named stars only - limited count */}
      {labeledStars.map(({ star, position }) => (
        <group key={`label-${star.id}`} position={position}>
          <Html distanceFactor={50} style={{ pointerEvents: 'auto', cursor: 'pointer' }} zIndexRange={[0, 100]}>
            <div onClick={() => onStarClick?.(star)} style={{
              color: 'rgba(255, 255, 220, 0.9)',
              fontSize: '9px',
              whiteSpace: 'nowrap',
              textShadow: '0 0 3px black, 0 0 2px black',
              transform: 'translateY(8px)',
            }}>
              {star.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// Planet component with realistic appearance
interface PlanetPointProps {
  planet: Planet;
  lst: number;
  observerLatitude: number;
  onClick?: (planet: Planet) => void;
  fov?: number; // Field of view for scaling
}

// Planet colors based on actual appearance
const PLANET_COLORS: Record<string, { main: string; secondary: string; glow: string }> = {
  mercury: { main: '#8c8c8c', secondary: '#6b6b6b', glow: '#a0a0a0' },
  venus: { main: '#e6c35c', secondary: '#d4a84b', glow: '#fff4cc' },
  mars: { main: '#c1440e', secondary: '#8b3a0e', glow: '#ff6b4a' },
  jupiter: { main: '#d8ca9d', secondary: '#c4a35a', glow: '#f5e6c8' },
  saturn: { main: '#ead6b8', secondary: '#c9a227', glow: '#fff0d4' },
  uranus: { main: '#b5e3e3', secondary: '#7fc8c8', glow: '#d4f5f5' },
  neptune: { main: '#5b7fde', secondary: '#3a5bb8', glow: '#8fa8f0' },
};

// Planet SVG icons (inline for performance)
const PlanetSVG: React.FC<{ planetId: string; size: number }> = ({ planetId, size }) => {
  const colors = PLANET_COLORS[planetId] || { main: '#ffdd44', secondary: '#ccaa00', glow: '#ffee88' };
  
  if (planetId === 'saturn') {
    // Saturn with rings
    return (
      <svg width={size * 2} height={size * 1.5} viewBox="0 0 60 45" style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}>
        {/* Rings behind */}
        <ellipse cx="30" cy="22" rx="28" ry="8" fill="none" stroke={colors.secondary} strokeWidth="3" opacity="0.6" />
        {/* Planet body */}
        <circle cx="30" cy="22" r="12" fill={colors.main} />
        <ellipse cx="30" cy="20" rx="10" ry="3" fill={colors.secondary} opacity="0.4" />
        {/* Rings in front */}
        <path d="M 2 22 Q 30 30 58 22" fill="none" stroke={colors.secondary} strokeWidth="3" opacity="0.8" />
      </svg>
    );
  }
  
  if (planetId === 'jupiter') {
    // Jupiter with bands
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}>
        <circle cx="20" cy="20" r="18" fill={colors.main} />
        {/* Bands */}
        <ellipse cx="20" cy="12" rx="16" ry="3" fill={colors.secondary} opacity="0.5" />
        <ellipse cx="20" cy="20" rx="17" ry="2" fill="#a67c52" opacity="0.4" />
        <ellipse cx="20" cy="26" rx="15" ry="2.5" fill={colors.secondary} opacity="0.5" />
        {/* Great Red Spot */}
        <ellipse cx="26" cy="22" rx="4" ry="2.5" fill="#c1440e" opacity="0.7" />
      </svg>
    );
  }
  
  if (planetId === 'mars') {
    // Mars with polar cap
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}>
        <circle cx="20" cy="20" r="16" fill={colors.main} />
        {/* Dark regions */}
        <ellipse cx="18" cy="22" rx="6" ry="4" fill={colors.secondary} opacity="0.5" />
        {/* Polar cap */}
        <ellipse cx="20" cy="8" rx="8" ry="4" fill="#ffffff" opacity="0.8" />
      </svg>
    );
  }
  
  if (planetId === 'venus') {
    // Venus with cloud cover
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: `drop-shadow(0 0 6px ${colors.glow})` }}>
        <circle cx="20" cy="20" r="16" fill={colors.main} />
        {/* Cloud swirls */}
        <ellipse cx="16" cy="18" rx="8" ry="4" fill="#fff8dc" opacity="0.4" />
        <ellipse cx="24" cy="24" rx="6" ry="3" fill="#fff8dc" opacity="0.3" />
      </svg>
    );
  }
  
  if (planetId === 'neptune' || planetId === 'uranus') {
    // Ice giants
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}>
        <circle cx="20" cy="20" r="16" fill={colors.main} />
        <ellipse cx="20" cy="20" rx="14" ry="4" fill={colors.secondary} opacity="0.3" />
      </svg>
    );
  }
  
  // Default (Mercury and others)
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: `drop-shadow(0 0 3px ${colors.glow})` }}>
      <circle cx="20" cy="20" r="16" fill={colors.main} />
      {/* Craters for Mercury */}
      {planetId === 'mercury' && (
        <>
          <circle cx="14" cy="16" r="3" fill={colors.secondary} opacity="0.5" />
          <circle cx="26" cy="22" r="4" fill={colors.secondary} opacity="0.4" />
          <circle cx="18" cy="26" r="2" fill={colors.secondary} opacity="0.5" />
        </>
      )}
    </svg>
  );
};

const PlanetPoint: React.FC<PlanetPointProps> = ({ planet, lst, observerLatitude, onClick, fov = 60 }) => {
  const position = useMemo(() => 
    celestialToHorizontal3D(planet.ra, planet.dec, lst, observerLatitude), 
    [planet.ra, planet.dec, lst, observerLatitude]
  );
  
  // Scale factor based on FOV - smaller when zoomed in
  const scaleFactor = Math.max(0.4, Math.min(1.2, fov / 60));
  
  // Base sizes for planets - Jupiter and Saturn biggest
  const baseSize = planet.id === 'jupiter' ? 36 : planet.id === 'saturn' ? 40 : planet.id === 'venus' ? 28 : planet.id === 'mars' ? 26 : 22;
  const svgSize = Math.round(baseSize * scaleFactor);
  const labelSize = Math.round(11 * scaleFactor);
  const magSize = Math.round(9 * scaleFactor);
  
  return (
    <group position={position}>
      {/* Invisible mesh for click detection */}
      <mesh onClick={() => onClick?.(planet)}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <Html distanceFactor={50} style={{ pointerEvents: 'auto', cursor: 'pointer' }} zIndexRange={[0, 100]}>
        <div 
          onClick={() => onClick?.(planet)}
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1px',
          }}
        >
          <PlanetSVG planetId={planet.id} size={svgSize} />
          <div style={{
            color: '#ffffff',
            fontSize: `${labelSize}px`,
            fontWeight: 'bold',
            textShadow: '0 0 4px black, 0 0 2px black',
            lineHeight: 1.2,
          }}>
            {planet.name}
          </div>
          {planet.magnitude !== undefined && scaleFactor > 0.5 && (
            <div style={{ 
              color: 'rgba(255,255,255,0.8)',
              fontSize: `${magSize}px`, 
              textShadow: '0 0 3px black',
              lineHeight: 1,
            }}>
              mag {planet.magnitude.toFixed(1)}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};

// Moon SVG with phase visualization
const MoonSVG: React.FC<{ phase: number; size: number }> = ({ phase, size }) => {
  // phase: 0 = new moon, 0.5 = full moon, 1 = new moon again
  // Convert to illumination direction
  const isWaxing = phase < 0.5;
  const illumination = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" style={{ filter: 'drop-shadow(0 0 8px rgba(255,250,205,0.6))' }}>
      {/* Dark side of moon */}
      <circle cx="25" cy="25" r="22" fill="#2a2a2a" />
      {/* Lit side - using clip path for phase */}
      <defs>
        <clipPath id="moonPhase">
          {illumination > 0.5 ? (
            // More than half lit
            <path d={`M 25 3 A 22 22 0 1 1 25 47 A ${22 * (2 * illumination - 1)} 22 0 ${isWaxing ? 1 : 0} ${isWaxing ? 0 : 1} 25 3`} />
          ) : (
            // Less than half lit
            <path d={`M 25 3 A 22 22 0 ${isWaxing ? 0 : 1} ${isWaxing ? 1 : 0} 25 47 A ${22 * (1 - 2 * illumination)} 22 0 ${isWaxing ? 0 : 1} ${isWaxing ? 1 : 0} 25 3`} />
          )}
        </clipPath>
      </defs>
      <circle cx="25" cy="25" r="22" fill="#fffacd" clipPath="url(#moonPhase)" />
      {/* Subtle crater details */}
      <circle cx="18" cy="20" r="4" fill="#e8e4b8" opacity="0.3" />
      <circle cx="30" cy="28" r="5" fill="#e8e4b8" opacity="0.25" />
      <circle cx="22" cy="32" r="3" fill="#e8e4b8" opacity="0.3" />
    </svg>
  );
};

// Moon component with phase visualization
interface MoonPointProps {
  moonPosition: MoonPosition;
  onClick?: ((moon: MoonPosition) => void) | undefined;
  fov?: number;
}

const MoonPoint: React.FC<MoonPointProps> = ({ moonPosition, onClick, fov = 60 }) => {
  const position = useMemo(
    () => {
      // Mirror the azimuth to match star positions (360 - azimuth)
      const mirroredAzimuth = (360 - moonPosition.azimuth) % 360;
      return horizontalTo3D(mirroredAzimuth, moonPosition.altitude);
    },
    [moonPosition.azimuth, moonPosition.altitude]
  );
  
  // Scale factor based on FOV
  const scaleFactor = Math.max(0.4, Math.min(1.2, fov / 60));
  const moonSize = Math.round(40 * scaleFactor);
  const labelSize = Math.round(11 * scaleFactor);
  const phaseSize = Math.round(9 * scaleFactor);
  
  // Calculate phase value (0-1) from phase name
  const phaseValue = useMemo(() => {
    const phaseMap: Record<string, number> = {
      'New Moon': 0,
      'Waxing Crescent': 0.125,
      'First Quarter': 0.25,
      'Waxing Gibbous': 0.375,
      'Full Moon': 0.5,
      'Waning Gibbous': 0.625,
      'Last Quarter': 0.75,
      'Waning Crescent': 0.875,
    };
    return phaseMap[moonPosition.phaseName] ?? 0.5;
  }, [moonPosition.phaseName]);
  
  return (
    <group position={position}>
      {/* Invisible mesh for click detection */}
      <mesh onClick={() => onClick?.(moonPosition)}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <Html distanceFactor={50} style={{ pointerEvents: 'auto', cursor: 'pointer' }} zIndexRange={[0, 100]}>
        <div 
          onClick={() => onClick?.(moonPosition)}
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1px',
          }}
        >
          <MoonSVG phase={phaseValue} size={moonSize} />
          <div style={{
            color: '#ffffff',
            fontSize: `${labelSize}px`,
            fontWeight: 'bold',
            textShadow: '0 0 4px black, 0 0 2px black',
            lineHeight: 1.2,
          }}>
            Moon
          </div>
          <div style={{ 
            color: 'rgba(255,255,255,0.9)',
            fontSize: `${phaseSize}px`, 
            textShadow: '0 0 3px black',
            lineHeight: 1,
          }}>
            {moonPosition.phaseName}
          </div>
          {scaleFactor > 0.5 && (
            <div style={{ 
              color: 'rgba(255,255,255,0.7)',
              fontSize: `${phaseSize}px`, 
              textShadow: '0 0 2px black',
              lineHeight: 1,
            }}>
              {moonPosition.illumination.toFixed(0)}%
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};

// Sun SVG with corona effect
const SunSVG: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ filter: 'drop-shadow(0 0 12px #ff8800)' }}>
      {/* Outer corona */}
      <circle cx="30" cy="30" r="28" fill="#ff6600" opacity="0.2" />
      <circle cx="30" cy="30" r="24" fill="#ff8800" opacity="0.3" />
      {/* Sun rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1={30 + 18 * Math.cos(angle * Math.PI / 180)}
          y1={30 + 18 * Math.sin(angle * Math.PI / 180)}
          x2={30 + 26 * Math.cos(angle * Math.PI / 180)}
          y2={30 + 26 * Math.sin(angle * Math.PI / 180)}
          stroke="#ffcc00"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
      ))}
      {/* Main body */}
      <circle cx="30" cy="30" r="16" fill="#ffdd00" />
      {/* Bright center */}
      <circle cx="30" cy="30" r="10" fill="#ffee66" />
      <circle cx="30" cy="30" r="5" fill="#ffffcc" />
    </svg>
  );
};

// Sun component with safety warning and dynamic glow
interface SunPointProps {
  sunPosition: SunPosition;
  onClick?: ((sun: SunPosition) => void) | undefined;
  fov?: number;
}

const SunPoint: React.FC<SunPointProps> = ({ sunPosition, onClick, fov = 60 }) => {
  const position = useMemo(
    () => {
      // Mirror the azimuth to match star positions (360 - azimuth)
      const mirroredAzimuth = (360 - sunPosition.azimuth) % 360;
      return horizontalTo3D(mirroredAzimuth, sunPosition.altitude);
    },
    [sunPosition.azimuth, sunPosition.altitude]
  );
  
  // Calculate glow intensity based on sun altitude
  // Full glow when sun is high, reduced during twilight, minimal at night
  const glowIntensity = useMemo(() => {
    const alt = sunPosition.altitude;
    if (alt > 10) return 1.0; // Full daylight
    if (alt > 0) return 0.7 + (alt / 10) * 0.3; // Rising/setting
    if (alt > -6) return 0.4 + ((alt + 6) / 6) * 0.3; // Civil twilight
    if (alt > -12) return 0.2 + ((alt + 12) / 6) * 0.2; // Nautical twilight
    if (alt > -18) return 0.1 + ((alt + 18) / 6) * 0.1; // Astronomical twilight
    return 0.05; // Night - very subtle glow
  }, [sunPosition.altitude]);
  
  // Calculate glow color based on sun altitude (golden hour effect)
  const glowColor = useMemo(() => {
    const alt = sunPosition.altitude;
    if (alt > 20) return { inner: '#fffbe6', outer: '#fff4b3', ambient: 'rgba(255, 251, 230, 0.15)' }; // High sun - white/yellow
    if (alt > 5) return { inner: '#fff5cc', outer: '#ffdb80', ambient: 'rgba(255, 219, 128, 0.12)' }; // Mid sun - warm yellow
    if (alt > 0) return { inner: '#ffd699', outer: '#ff9933', ambient: 'rgba(255, 153, 51, 0.1)' }; // Low sun - orange
    if (alt > -6) return { inner: '#ffb366', outer: '#ff6600', ambient: 'rgba(255, 102, 0, 0.08)' }; // Sunset - deep orange
    if (alt > -12) return { inner: '#ff8080', outer: '#cc3300', ambient: 'rgba(204, 51, 0, 0.05)' }; // Twilight - red
    return { inner: '#804040', outer: '#401010', ambient: 'rgba(64, 16, 16, 0.02)' }; // Night - dim red
  }, [sunPosition.altitude]);
  
  // Scale factor based on FOV
  const scaleFactor = Math.max(0.4, Math.min(1.2, fov / 60));
  const sunSize = Math.round(56 * scaleFactor); // Bigger sun
  const labelSize = Math.round(12 * scaleFactor);
  
  // Glow sizes - moderate when sun is up
  const innerGlowSize = Math.round(120 * scaleFactor * glowIntensity);
  const midGlowSize = Math.round(200 * scaleFactor * glowIntensity);
  const outerGlowSize = Math.round(350 * scaleFactor * glowIntensity);
  const ambientGlowSize = Math.round(500 * scaleFactor * glowIntensity);
  
  return (
    <group position={position}>
      {/* Invisible mesh for click detection */}
      <mesh onClick={() => onClick?.(sunPosition)}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* Massive ambient glow layer - covers large area */}
      {glowIntensity > 0.1 && (
        <Html distanceFactor={30} style={{ pointerEvents: 'none' }} zIndexRange={[0, 5]}>
          <div style={{
            position: 'absolute',
            width: `${ambientGlowSize}px`,
            height: `${ambientGlowSize}px`,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${glowColor.ambient} 0%, transparent 70%)`,
            borderRadius: '50%',
            filter: 'blur(50px)',
          }} />
        </Html>
      )}
      
      {/* Outer glow layer */}
      {glowIntensity > 0.05 && (
        <Html distanceFactor={40} style={{ pointerEvents: 'none' }} zIndexRange={[0, 10]}>
          <div style={{
            position: 'absolute',
            width: `${outerGlowSize}px`,
            height: `${outerGlowSize}px`,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${glowColor.outer}${Math.round(glowIntensity * 30).toString(16).padStart(2, '0')} 0%, transparent 60%)`,
            borderRadius: '50%',
            filter: 'blur(30px)',
          }} />
        </Html>
      )}
      
      {/* Mid glow layer */}
      {glowIntensity > 0.1 && (
        <Html distanceFactor={45} style={{ pointerEvents: 'none' }} zIndexRange={[0, 20]}>
          <div style={{
            position: 'absolute',
            width: `${midGlowSize}px`,
            height: `${midGlowSize}px`,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${glowColor.inner}${Math.round(glowIntensity * 50).toString(16).padStart(2, '0')} 0%, ${glowColor.outer}${Math.round(glowIntensity * 25).toString(16).padStart(2, '0')} 40%, transparent 70%)`,
            borderRadius: '50%',
            filter: 'blur(15px)',
          }} />
        </Html>
      )}
      
      {/* Inner bright glow */}
      {glowIntensity > 0.2 && (
        <Html distanceFactor={48} style={{ pointerEvents: 'none' }} zIndexRange={[0, 30]}>
          <div style={{
            position: 'absolute',
            width: `${innerGlowSize}px`,
            height: `${innerGlowSize}px`,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${glowColor.inner}${Math.round(glowIntensity * 80).toString(16).padStart(2, '0')} 0%, ${glowColor.inner}${Math.round(glowIntensity * 40).toString(16).padStart(2, '0')} 30%, transparent 60%)`,
            borderRadius: '50%',
            filter: 'blur(5px)',
          }} />
        </Html>
      )}
      
      {/* Sun icon and label */}
      <Html distanceFactor={50} style={{ pointerEvents: 'auto', cursor: 'pointer' }} zIndexRange={[0, 100]}>
        <div 
          onClick={() => onClick?.(sunPosition)}
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1px',
          }}
        >
          <SunSVG size={sunSize} />
          <div style={{
            color: '#ffffff',
            fontSize: `${labelSize}px`,
            fontWeight: 'bold',
            textShadow: '0 0 4px black, 0 0 2px black',
            lineHeight: 1.2,
          }}>
            Sun
          </div>
          {/* Safety warning when Sun is above horizon */}
          {sunPosition.safetyWarning && !sunPosition.isBelowHorizon && scaleFactor > 0.5 && (
            <div style={{
              backgroundColor: 'rgba(255, 0, 0, 0.9)',
              color: 'white',
              fontSize: `${Math.round(8 * scaleFactor)}px`,
              fontWeight: 'bold',
              padding: '1px 4px',
              borderRadius: '2px',
            }}>
              ⚠️ DON'T LOOK
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};

// Camera controller to track orientation changes and update FOV
interface CameraControllerProps {
  onCameraChange: ((orientation: CameraOrientation) => void) | undefined;
  fov: number;
  targetAzimuth?: number | null;
  targetAltitude?: number | null;
  controlsRef?: React.RefObject<any>;
}

const CameraController: React.FC<CameraControllerProps> = ({ onCameraChange, fov, targetAzimuth, targetAltitude, controlsRef }) => {
  const { camera } = useThree();
  const targetRef = React.useRef<{ azimuth: number; altitude: number } | null>(null);
  const isAnimatingRef = React.useRef(false);
  const lastTargetRef = React.useRef<string | null>(null);
  const animatedAzRef = React.useRef<number | null>(null);
  const animatedAltRef = React.useRef<number | null>(null);
  
  // Update camera FOV when it changes
  React.useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, fov]);
  
  // Set target when props change
  React.useEffect(() => {
    if (targetAzimuth !== null && targetAzimuth !== undefined && 
        targetAltitude !== null && targetAltitude !== undefined) {
      // Create a unique key for this target to detect changes
      const targetKey = `${targetAzimuth.toFixed(2)}-${targetAltitude.toFixed(2)}`;
      
      // Only start animation if this is a new target
      if (targetKey !== lastTargetRef.current) {
        console.log(`🎯 Camera target set: az=${targetAzimuth.toFixed(1)}°, alt=${targetAltitude.toFixed(1)}°`);
        targetRef.current = { azimuth: targetAzimuth, altitude: targetAltitude };
        isAnimatingRef.current = true;
        lastTargetRef.current = targetKey;
        // Reset animated values to start fresh
        animatedAzRef.current = null;
        animatedAltRef.current = null;
      }
    }
  }, [targetAzimuth, targetAltitude]);
  
  useFrame(() => {
    const controls = controlsRef?.current;
    
    // Calculate current azimuth and altitude from camera direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Convert camera direction to azimuth/altitude
    // Using same coordinate system as horizontalTo3D:
    // x = cos(alt) * sin(az), y = sin(alt), z = cos(alt) * cos(az)
    // So: az = atan2(x, z), alt = asin(y)
    let currentAzimuth = (Math.atan2(direction.x, direction.z) * 180 / Math.PI + 360) % 360;
    const currentAltitude = Math.asin(Math.max(-1, Math.min(1, direction.y))) * 180 / Math.PI;
    
    // Animate towards target if set
    if (isAnimatingRef.current && targetRef.current && controls) {
      const target = targetRef.current;
      
      // Initialize animated values from current camera position on first frame
      if (animatedAzRef.current === null) {
        animatedAzRef.current = currentAzimuth;
        animatedAltRef.current = currentAltitude;
        console.log(`📍 Starting animation from: az=${currentAzimuth.toFixed(1)}°, alt=${currentAltitude.toFixed(1)}°`);
      }
      
      // Calculate shortest path for azimuth (handle wrap-around)
      let deltaAz = target.azimuth - animatedAzRef.current;
      if (deltaAz > 180) deltaAz -= 360;
      if (deltaAz < -180) deltaAz += 360;
      
      const deltaAlt = target.altitude - animatedAltRef.current!;
      
      // Check if we're close enough to stop
      if (Math.abs(deltaAz) < 0.5 && Math.abs(deltaAlt) < 0.5) {
        console.log(`✅ Camera reached target`);
        isAnimatingRef.current = false;
        controls.enabled = true;
      } else {
        // Disable user controls during animation
        controls.enabled = false;
        
        // Smooth interpolation (ease-out)
        const speed = 0.08;
        animatedAzRef.current = ((animatedAzRef.current + deltaAz * speed) % 360 + 360) % 360;
        animatedAltRef.current = Math.max(-85, Math.min(85, animatedAltRef.current! + deltaAlt * speed));
        
        const newAzimuth = animatedAzRef.current;
        const newAltitude = animatedAltRef.current;
        
        // Convert to look direction using SAME formula as horizontalTo3D
        const azRad = (newAzimuth * Math.PI) / 180;
        const altRad = (newAltitude * Math.PI) / 180;
        
        // This is exactly the horizontalTo3D formula
        const radius = 100;
        const targetX = radius * Math.cos(altRad) * Math.sin(azRad);
        const targetY = radius * Math.sin(altRad);
        const targetZ = radius * Math.cos(altRad) * Math.cos(azRad);
        
        // Set OrbitControls target - camera will look at this point
        controls.target.set(targetX, targetY, targetZ);
        camera.position.set(0, 0, 0.01);
        controls.update();
      }
    }
    
    if (onCameraChange) {
      onCameraChange({
        azimuth: currentAzimuth,
        altitude: currentAltitude,
        fov: (camera as THREE.PerspectiveCamera).fov,
      });
    }
  });
  
  return null;
};

// Sky dome sphere (background) - removed, using canvas background color instead

// Horizon line component - renders a ring at altitude 0° with cardinal direction labels
interface HorizonLineProps {
  color?: string | undefined;
  opacity?: number | undefined;
}

// Cardinal and intercardinal directions with their azimuths
// Apply same mirror as stars: (360 - azimuth) to match the mirrored view
const COMPASS_DIRECTIONS = [
  { label: 'N', azimuth: 360 - 0, primary: true },      // 0 -> 360 (same as 0)
  { label: 'NE', azimuth: 360 - 45, primary: false },   // 45 -> 315
  { label: 'E', azimuth: 360 - 90, primary: true },     // 90 -> 270
  { label: 'SE', azimuth: 360 - 135, primary: false },  // 135 -> 225
  { label: 'S', azimuth: 360 - 180, primary: true },    // 180 -> 180
  { label: 'SW', azimuth: 360 - 225, primary: false },  // 225 -> 135
  { label: 'W', azimuth: 360 - 270, primary: true },    // 270 -> 90
  { label: 'NW', azimuth: 360 - 315, primary: false },  // 315 -> 45
];

// Atmosphere and ground component - creates gradient effect for entire sky
interface AtmosphereGroundProps {
  sunAltitude?: number; // Sun altitude in degrees (-90 to 90)
  sunAzimuth?: number; // Sun azimuth in degrees
  showHDRI?: boolean;
  groundTexture?: string; // Path to ground panorama image (equirectangular)
  showAtmosphere?: boolean;
  showGround?: boolean;
}

const AtmosphereGround: React.FC<AtmosphereGroundProps> = ({ sunAltitude = -10, sunAzimuth = 180, showHDRI = false, groundTexture, showAtmosphere = true, showGround = true }) => {
  // Load ground texture if provided
  const texture = useMemo(() => {
    if (!groundTexture) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(groundTexture, 
      () => console.log('Ground texture loaded successfully'),
      undefined,
      (err) => console.error('Failed to load ground texture:', err)
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [groundTexture]);
  // Calculate sky colors based on sun position
  const skyColors = useMemo(() => {
    // Normalize sun altitude to 0-1 range for color interpolation
    // -18° (astronomical twilight) to +20° (full day)
    const t = Math.max(0, Math.min(1, (sunAltitude + 18) / 38));
    
    // Night colors (sun below -18°)
    const nightZenith = new THREE.Color('#050510');
    const nightMid = new THREE.Color('#0a0a18');
    const nightHorizon = new THREE.Color('#151525');
    
    // Twilight colors (-18° to 0°)
    const twilightZenith = new THREE.Color('#1a2035');
    const twilightMid = new THREE.Color('#2a3550');
    const twilightHorizon = new THREE.Color('#c08060');
    
    // Day colors (sun above 0°) - Realistic desaturated blue sky
    const dayZenith = new THREE.Color('#4a80b0');    // Muted blue at top
    const dayMid = new THREE.Color('#7aaaca');       // Softer blue in middle  
    const dayHorizon = new THREE.Color('#b8d4e8');   // Pale blue-white at horizon
    
    let zenithColor, midColor, horizonColor;
    
    if (t < 0.47) {
      // Night to twilight
      const tt = t / 0.47;
      zenithColor = nightZenith.clone().lerp(twilightZenith, tt);
      midColor = nightMid.clone().lerp(twilightMid, tt);
      horizonColor = nightHorizon.clone().lerp(twilightHorizon, tt);
    } else {
      // Twilight to day
      const tt = (t - 0.47) / 0.53;
      zenithColor = twilightZenith.clone().lerp(dayZenith, tt);
      midColor = twilightMid.clone().lerp(dayMid, tt);
      horizonColor = twilightHorizon.clone().lerp(dayHorizon, tt);
    }
    
    return { zenithColor, midColor, horizonColor };
  }, [sunAltitude]);

  // Full sky sphere (entire dome above and below horizon)
  const skyGeometry = useMemo(() => {
    // Full sphere for complete sky coverage
    const geometry = new THREE.SphereGeometry(98, 64, 64);
    return geometry;
  }, []);

  // Calculate sun direction for glow effect (mirrored to match display)
  const sunDirection = useMemo(() => {
    const mirroredAz = (360 - sunAzimuth) % 360;
    const azRad = (mirroredAz * Math.PI) / 180;
    const altRad = (sunAltitude * Math.PI) / 180;
    return new THREE.Vector3(
      Math.cos(altRad) * Math.sin(azRad),
      Math.sin(altRad),
      Math.cos(altRad) * Math.cos(azRad)
    ).normalize();
  }, [sunAltitude, sunAzimuth]);

  // Sky gradient shader - covers entire dome
  const skyMaterial = useMemo(() => {
    // Calculate sun glow intensity
    const sunGlowIntensity = sunAltitude > -6 ? Math.min(1, (sunAltitude + 6) / 26) : 0;
    
    // Sunset/sunrise colors
    const sunsetColor = sunAltitude > -6 && sunAltitude < 10 
      ? new THREE.Color('#ff6030') 
      : new THREE.Color('#ffaa60');
    
    return new THREE.ShaderMaterial({
      uniforms: {
        zenithColor: { value: skyColors.zenithColor },
        midColor: { value: skyColors.midColor },
        horizonColor: { value: skyColors.horizonColor },
        sunDirection: { value: sunDirection },
        sunGlowIntensity: { value: sunGlowIntensity },
        sunsetColor: { value: sunsetColor },
        sunAltitude: { value: sunAltitude },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenithColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDirection;
        uniform float sunGlowIntensity;
        uniform vec3 sunsetColor;
        uniform float sunAltitude;
        varying vec3 vWorldPosition;
        
        void main() {
          vec3 viewDir = normalize(vWorldPosition);
          float h = viewDir.y;
          
          // Sky gradient from horizon to zenith (and below)
          vec3 color;
          if (h >= 0.0) {
            // Above horizon
            float t = pow(h, 0.4); // Adjust curve for more gradual transition
            if (t < 0.5) {
              color = mix(horizonColor, midColor, t * 2.0);
            } else {
              color = mix(midColor, zenithColor, (t - 0.5) * 2.0);
            }
          } else {
            // Below horizon - darker ground colors
            float t = pow(-h, 0.5);
            vec3 groundColor = horizonColor * 0.3;
            vec3 nadirColor = vec3(0.02, 0.02, 0.04);
            color = mix(groundColor, nadirColor, t);
          }
          
          // Sun glow effect - subtle atmospheric glow around sun
          float sunDot = max(0.0, dot(viewDir, sunDirection));
          
          // Multiple glow layers for realistic sun (reduced intensity)
          float innerGlow = pow(sunDot, 512.0) * sunGlowIntensity * 1.5; // Tight bright core
          float midGlow = pow(sunDot, 64.0) * sunGlowIntensity * 0.5; // Medium glow
          float outerGlow = pow(sunDot, 8.0) * sunGlowIntensity * 0.2; // Subtle atmospheric glow
          float wideGlow = pow(sunDot, 2.0) * sunGlowIntensity * 0.08; // Very subtle wide glow
          
          // Sun color varies with altitude
          vec3 sunColor = sunAltitude > 10.0 
            ? vec3(1.0, 0.98, 0.9) // High sun - white
            : mix(sunsetColor, vec3(1.0, 0.95, 0.8), clamp((sunAltitude + 6.0) / 16.0, 0.0, 1.0));
          
          // Apply sun glows
          color += sunColor * innerGlow;
          color += sunColor * midGlow;
          color += mix(sunsetColor, sunColor, 0.5) * outerGlow;
          color += sunsetColor * wideGlow * 0.3;
          
          // Horizon glow when sun is near horizon (reduced)
          if (sunAltitude > -10.0 && sunAltitude < 15.0 && h > -0.1 && h < 0.3) {
            float horizonFactor = 1.0 - abs(h - 0.05) / 0.25;
            float sunHorizonGlow = pow(sunDot, 3.0) * horizonFactor * sunGlowIntensity * 0.15;
            color += sunsetColor * sunHorizonGlow;
          }
          
          // Atmospheric scattering - subtle blue tint near horizon during day
          if (sunAltitude > 0.0 && h > 0.0 && h < 0.3) {
            float scatter = (1.0 - h / 0.3) * sunGlowIntensity * 0.08;
            color += vec3(0.5, 0.6, 0.8) * scatter;
          }
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [skyColors, sunDirection, sunAltitude]);

  // Ground hemisphere geometry (below horizon)
  const groundGeometry = useMemo(() => {
    // Full sphere for ground panorama - extends above horizon for trees/hills
    const geometry = new THREE.SphereGeometry(96, 64, 32);
    return geometry;
  }, []);

  // Ground material - uses texture if provided, otherwise dark gradient
  const groundMaterial = useMemo(() => {
    if (texture) {
      // Custom shader for equirectangular ground panorama
      // Includes dynamic lighting overlay based on sun position
      return new THREE.ShaderMaterial({
        uniforms: {
          map: { value: texture },
          sunAlt: { value: sunAltitude },
          sunDir: { value: sunDirection },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          uniform float sunAlt;
          uniform vec3 sunDir;
          varying vec3 vWorldPosition;
          
          #define PI 3.14159265359
          
          void main() {
            vec3 dir = normalize(vWorldPosition);
            
            // Calculate equirectangular UV from direction
            // Use atan2 equivalent for proper angle calculation
            float theta = atan(dir.x, dir.z); // -PI to PI
            float phi = asin(clamp(dir.y, -1.0, 1.0)); // -PI/2 to PI/2
            
            // Convert to UV coordinates (0 to 1)
            // Offset U by 0.5 to center the seam at the back (south)
            float u = (theta / (2.0 * PI)) + 0.5;
            float v = (phi / PI) + 0.5;
            
            // Ensure U wraps properly
            u = fract(u);
            
            vec4 texColor = texture2D(map, vec2(u, v));
            
            // === LIGHTING OVERLAY BASED ON TIME OF DAY ===
            vec3 litColor = texColor.rgb;
            
            // Night (sun below -12°): dark blue tint, very dim
            // Twilight (-12° to 0°): warm orange/purple tones
            // Golden hour (0° to 10°): warm golden light
            // Day (above 10°): bright natural light
            
            if (sunAlt < -12.0) {
              // Night - dark blue moonlight effect
              float nightFactor = 0.15;
              vec3 nightTint = vec3(0.4, 0.5, 0.7);
              litColor = texColor.rgb * nightFactor * nightTint;
            } else if (sunAlt < -6.0) {
              // Nautical twilight - deep blue/purple
              float t = (sunAlt + 12.0) / 6.0;
              float brightness = mix(0.15, 0.3, t);
              vec3 tint = mix(vec3(0.4, 0.5, 0.7), vec3(0.6, 0.5, 0.7), t);
              litColor = texColor.rgb * brightness * tint;
            } else if (sunAlt < 0.0) {
              // Civil twilight - orange/pink sunrise/sunset
              float t = (sunAlt + 6.0) / 6.0;
              float brightness = mix(0.3, 0.6, t);
              vec3 tint = mix(vec3(0.6, 0.5, 0.7), vec3(1.0, 0.7, 0.5), t);
              litColor = texColor.rgb * brightness * tint;
            } else if (sunAlt < 10.0) {
              // Golden hour - warm golden light
              float t = sunAlt / 10.0;
              float brightness = mix(0.6, 0.9, t);
              vec3 tint = mix(vec3(1.0, 0.7, 0.5), vec3(1.0, 0.95, 0.9), t);
              litColor = texColor.rgb * brightness * tint;
            } else {
              // Full daylight - natural bright light
              float brightness = min(1.0, 0.9 + (sunAlt - 10.0) * 0.005);
              litColor = texColor.rgb * brightness;
            }
            
            // Add subtle directional lighting from sun
            if (sunAlt > -6.0) {
              float sunDot = max(0.0, dot(dir, sunDir));
              float sunLight = pow(sunDot, 2.0) * 0.15 * smoothstep(-6.0, 10.0, sunAlt);
              vec3 sunTint = sunAlt < 10.0 ? vec3(1.0, 0.8, 0.5) : vec3(1.0, 1.0, 0.95);
              litColor += sunLight * sunTint;
            }
            
            // === HORIZON FADE ===
            float alpha = texColor.a;
            
            // Above horizon: fade based on height, but preserve alpha for trees
            if (dir.y > 0.0) {
              float heightFade = 1.0 - smoothstep(0.0, 0.26, dir.y);
              alpha *= heightFade;
            }
            
            // Discard fully transparent pixels
            if (alpha < 0.01) discard;
            
            gl_FragColor = vec4(litColor, alpha);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
        transparent: true,
      });
    }
    // Fallback dark ground gradient
    return new THREE.ShaderMaterial({
      uniforms: {
        horizonColor: { value: skyColors.horizonColor.clone().multiplyScalar(0.3) },
        nadirColor: { value: new THREE.Color('#050508') },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 horizonColor;
        uniform vec3 nadirColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = pow(clamp(-h, 0.0, 1.0), 0.5);
          vec3 color = mix(horizonColor, nadirColor, t);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [texture, skyColors]);

  return (
    <group>
      {/* Full sky dome with gradient and sun glow */}
      {showAtmosphere && <mesh geometry={skyGeometry} material={skyMaterial} />}
      
      {/* Ground hemisphere - panorama texture or dark gradient */}
      {showGround && <mesh geometry={groundGeometry} material={groundMaterial} />}
      
      {/* Optional HDRI environment for reflections (subtle) */}
      {showHDRI && (
        <Environment
          preset="night"
          background={false}
          blur={0.8}
        />
      )}
    </group>
  );
};

const HorizonLineRing: React.FC<HorizonLineProps> = ({ 
  color = '#4a5568', 
  opacity = 0.6 
}) => {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const radius = 100; // Same as star sphere radius
    // Generate points around the horizon circle at y=0 (altitude 0°)
    for (let i = 0; i <= 360; i += 1) {
      const angle = (i * Math.PI) / 180;
      pts.push(new THREE.Vector3(
        radius * Math.cos(angle),
        0, // altitude 0
        radius * Math.sin(angle)
      ));
    }
    return pts;
  }, []);

  const positions = useMemo(() => {
    return new Float32Array(points.flatMap(p => [p.x, p.y, p.z]));
  }, [points]);

  // Calculate 3D positions for direction labels
  const directionLabels = useMemo(() => {
    return COMPASS_DIRECTIONS.map(dir => {
      const pos = horizontalTo3D(dir.azimuth, 2, 100); // Slightly above horizon (2°)
      return { ...dir, position: pos };
    });
  }, []);

  return (
    <group>
      {/* Horizon line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} opacity={opacity} transparent />
      </line>
      
      {/* Cardinal and intercardinal direction labels */}
      {directionLabels.map(dir => (
        <group key={dir.label} position={dir.position}>
          <Html distanceFactor={50} style={{ pointerEvents: 'none' }} zIndexRange={[0, 100]}>
            <div style={{
              color: dir.primary ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
              fontSize: dir.primary ? '16px' : '12px',
              fontWeight: dir.primary ? 'bold' : 'normal',
              whiteSpace: 'nowrap',
              textShadow: '0 0 6px black, 0 0 3px black',
              letterSpacing: '1px',
            }}>
              {dir.label}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// Constellation lines component - renders line segments connecting stars using actual star coordinates
interface ConstellationLinesProps {
  constellations: Constellation[];
  stars: Star[]; // Add stars prop to get actual coordinates
  lst: number;
  observerLatitude: number;
  lineColor?: string | undefined;
  lineOpacity?: number | undefined;
  showNames?: boolean | undefined;
  nameColor?: string | undefined;
  onConstellationClick?: ((constellation: Constellation) => void) | undefined;
}

const ConstellationLines: React.FC<ConstellationLinesProps> = ({
  constellations,
  stars,
  lst,
  observerLatitude,
  lineColor = '#88bbff',
  lineOpacity = 0.8,
  showNames = true,
  nameColor = '#6699ff',
  onConstellationClick,
}) => {
  // Create a map of HIP ID to star for fast lookup
  const starMap = useMemo(() => {
    const map = new Map<string, Star>();
    for (const star of stars) {
      map.set(star.id, star);
    }
    return map;
  }, [stars]);
  
  // Calculate line positions for each segment using ACTUAL star coordinates from rendered stars
  // Create tapered lines by adding intermediate points with varying opacity
  const lineGeometries = useMemo(() => {
    const geometries: { id: string; positions: Float32Array; colors: Float32Array }[] = [];
    
    for (const constellation of constellations) {
      for (let i = 0; i < constellation.lines.length; i++) {
        const line = constellation.lines[i]!;
        
        // Look up the ACTUAL stars being rendered
        const star1 = starMap.get(`HIP${line.star1.hipId}`);
        const star2 = starMap.get(`HIP${line.star2.hipId}`);
        
        // Get RA/Dec - prefer actual star data, fallback to constellation line data
        // NOTE: Star data has RA in HOURS, but constellation JSON has RA in DEGREES
        // Convert degrees to hours when using fallback: hours = degrees / 15
        const ra1 = star1?.ra ?? (line.star1.ra / 15);
        const dec1 = star1?.dec ?? line.star1.dec;
        const ra2 = star2?.ra ?? (line.star2.ra / 15);
        const dec2 = star2?.dec ?? line.star2.dec;
        
        // Use the star coordinates converted to horizontal - same radius as stars (100)
        const startPos = celestialToHorizontal3D(ra1, dec1, lst, observerLatitude, 100);
        const endPos = celestialToHorizontal3D(ra2, dec2, lst, observerLatitude, 100);
        
        // Create tapered line with multiple segments for gradient effect
        const segments = 8;
        const positions: number[] = [];
        const colors: number[] = [];
        
        // Parse line color to RGB
        const color = new THREE.Color(lineColor);
        
        for (let s = 0; s <= segments; s++) {
          const t = s / segments;
          // Interpolate position
          const x = startPos.x + (endPos.x - startPos.x) * t;
          const y = startPos.y + (endPos.y - startPos.y) * t;
          const z = startPos.z + (endPos.z - startPos.z) * t;
          positions.push(x, y, z);
          
          // Tapered opacity: full in middle, fading at ends
          // Use a smooth curve: sin(t * PI) gives 0 at ends, 1 in middle
          const taper = Math.sin(t * Math.PI);
          const alpha = 0.3 + taper * 0.7; // Range from 0.3 to 1.0
          colors.push(color.r * alpha, color.g * alpha, color.b * alpha);
        }
        
        geometries.push({
          id: `${constellation.id}-${i}`,
          positions: new Float32Array(positions),
          colors: new Float32Array(colors),
        });
      }
    }
    
    return geometries;
  }, [constellations, starMap, lst, observerLatitude, lineColor]);

  // Get constellation labels at their center positions
  const constellationLabels = useMemo(() => {
    return constellations.map((constellation) => {
      // Calculate center from actual star positions in the starMap
      const ras: number[] = [];
      const decs: number[] = [];
      
      for (const line of constellation.lines) {
        // Look up actual star coordinates from the starMap (RA in hours)
        const star1 = starMap.get(`HIP${line.star1.hipId}`);
        const star2 = starMap.get(`HIP${line.star2.hipId}`);
        
        if (star1) {
          ras.push(star1.ra);
          decs.push(star1.dec);
        }
        if (star2) {
          ras.push(star2.ra);
          decs.push(star2.dec);
        }
      }
      
      // Calculate average position
      let centerRA = 0;
      let centerDec = 0;
      
      if (ras.length > 0) {
        centerRA = ras.reduce((a, b) => a + b, 0) / ras.length;
        centerDec = decs.reduce((a, b) => a + b, 0) / decs.length;
      }
      
      return {
        id: constellation.id,
        name: constellation.name,
        position: celestialToHorizontal3D(centerRA, centerDec, lst, observerLatitude, 100),
      };
    });
  }, [constellations, starMap, lst, observerLatitude]);

  return (
    <group>
      {/* Render constellation line segments with tapered effect */}
      {lineGeometries.map((geom) => (
        <line key={`${geom.id}-${lst.toFixed(4)}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={geom.positions.length / 3}
              array={geom.positions}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              count={geom.colors.length / 3}
              array={geom.colors}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            opacity={lineOpacity}
            transparent
            depthWrite={false}
            depthTest={true}
          />
        </line>
      ))}
      
      {/* Render constellation name labels */}
      {showNames && constellationLabels.map((label) => {
        const constellation = constellations.find(c => c.id === label.id);
        return (
          <group key={`${label.id}-${lst.toFixed(4)}`} position={label.position}>
            <Html distanceFactor={80} style={{ pointerEvents: onConstellationClick ? 'auto' : 'none' }} zIndexRange={[0, 30]}>
              <div 
                onClick={() => constellation && onConstellationClick?.(constellation)}
                style={{
                  color: nameColor,
                  fontSize: '14px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  textShadow: '0 0 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)',
                  textTransform: 'uppercase',
                  letterSpacing: '3px',
                  opacity: 0.7,
                  transform: 'translateY(-20px)',
                  cursor: onConstellationClick ? 'pointer' : 'default',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (onConstellationClick) {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.background = 'rgba(100, 149, 237, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {label.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

// Deep sky objects component - renders Messier objects with type-specific icons
interface DeepSkyObjectsProps {
  positions: Map<string, DeepSkyPosition>;
  showLabels?: boolean | undefined;
  showAll?: boolean | undefined; // Show all objects regardless of horizon
  onClick?: ((object: DeepSkyPosition) => void) | undefined;
  fov?: number; // Field of view for scaling
  lst?: number; // Local Sidereal Time for position calculation
  observerLatitude?: number; // Observer latitude for position calculation
}

const DeepSkyObjects: React.FC<DeepSkyObjectsProps> = ({
  positions,
  showLabels = true,
  showAll = false,
  onClick,
  fov = 60,
  lst = 0,
  observerLatitude = 0,
}) => {
  // Scale factor based on FOV - smaller when zoomed in (low FOV)
  const scaleFactor = Math.max(0.3, Math.min(1.5, fov / 60));
  
  // Convert Map to array and calculate positions using RA/Dec
  const visibleObjects = useMemo(() => {
    const objects: { id: string; position: DeepSkyPosition; pos3D: THREE.Vector3 }[] = [];
    
    positions.forEach((position, id) => {
      // Render if showAll is true OR if object is visible (above horizon)
      if (showAll || position.isVisible) {
        // Use RA/Dec to calculate position with current LST (same as stars)
        const pos3D = celestialToHorizontal3D(
          position.object.ra, 
          position.object.dec, 
          lst, 
          observerLatitude,
          100 // Same radius as stars
        );
        
        objects.push({
          id,
          position,
          pos3D,
        });
      }
    });
    
    return objects;
  }, [positions, showAll, lst, observerLatitude]);

  return (
    <group>
      {visibleObjects.map(({ id, position, pos3D }) => {
        const icon = DEEP_SKY_ICONS[position.object.type];
        
        // Make objects more visible with larger size and brighter color
        // Dim objects that are below horizon
        const isAboveHorizon = position.isVisible;
        const baseColor = position.object.type === 'Nebula' ? '#ff66ff' : 
                         position.object.type === 'Galaxy' ? '#66ccff' :
                         position.object.type === 'Open Cluster' ? '#ffff66' :
                         position.object.type === 'Globular Cluster' ? '#ff9966' :
                         '#ff66cc'; // Planetary Nebula
        
        const objectColor = isAboveHorizon ? baseColor : '#666666';
        const opacity = isAboveHorizon ? 1.0 : 0.3;
        
        // Scale sizes based on FOV
        const sphereSize = 0.8 * scaleFactor;
        const iconSize = Math.round(16 * scaleFactor);
        const labelSize = Math.round(10 * scaleFactor);
        const nameSize = Math.round(8 * scaleFactor);
        
        return (
          <group key={`${id}-${lst.toFixed(4)}`} position={pos3D}>
            {/* Sphere marker scaled with FOV */}
            <mesh onClick={() => onClick?.(position)}>
              <sphereGeometry args={[sphereSize, 12, 12]} />
              <meshBasicMaterial color={objectColor} opacity={opacity} transparent />
            </mesh>
            
            {/* Label with icon and name - scaled with FOV */}
            <Html distanceFactor={50} style={{ pointerEvents: 'none' }} zIndexRange={[0, 100]}>
              <div style={{
                textAlign: 'center',
                opacity: opacity,
              }}>
                <div style={{ fontSize: `${iconSize}px` }}>{icon}</div>
                {showLabels && (
                  <>
                    <div style={{ 
                      color: '#ffffff',
                      fontSize: `${labelSize}px`,
                      fontWeight: 'bold',
                      textShadow: '0 0 4px black, 0 0 2px black',
                    }}>
                      {position.object.id}
                    </div>
                    {position.object.name && scaleFactor > 0.5 && (
                      <div style={{ 
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: `${nameSize}px`,
                        textShadow: '0 0 3px black',
                      }}>
                        {position.object.name}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

// Satellites component - renders tracked satellites with visibility indicator
interface SatellitesProps {
  positions: Map<string, SatellitePosition | SatelliteTrackerError>;
  showLabels?: boolean | undefined;
}

// Type guard to check if result is a SatellitePosition (not an error)
function isSatellitePosition(
  result: SatellitePosition | SatelliteTrackerError
): result is SatellitePosition {
  return 'azimuth' in result && 'altitude' in result;
}

const Satellites: React.FC<SatellitesProps> = ({
  positions,
  showLabels = true,
}) => {
  // Convert Map to array and filter for valid positions only (not errors)
  const validSatellites = useMemo(() => {
    const satellites: { id: string; position: SatellitePosition; pos3D: THREE.Vector3 }[] = [];
    
    positions.forEach((result, id) => {
      // Only render SatellitePosition (not SatelliteTrackerError)
      if (isSatellitePosition(result)) {
        // Mirror the azimuth to match star positions (360 - azimuth)
        const mirroredAzimuth = (360 - result.azimuth) % 360;
        satellites.push({
          id,
          position: result,
          pos3D: horizontalTo3D(mirroredAzimuth, result.altitude),
        });
      }
    });
    
    return satellites;
  }, [positions]);

  return (
    <group>
      {validSatellites.map(({ id, position, pos3D }) => {
        return (
          <group key={id} position={pos3D}>
            {/* Satellite icon only */}
            <Html distanceFactor={40} style={{ pointerEvents: 'none' }} zIndexRange={[0, 100]}>
              <div style={{
                textAlign: 'center',
              }}>
                <div style={{ 
                  fontSize: '32px',
                  filter: position.isVisible ? 'drop-shadow(0 0 8px #00ff00)' : 'opacity(0.6)',
                }}>🛰️</div>
                {showLabels && (
                  <div style={{ 
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textShadow: '0 0 4px black, 0 0 2px black',
                    marginTop: '2px',
                  }}>
                    {position.name}
                  </div>
                )}
                {position.isVisible && (
                  <div style={{ 
                    color: '#00ff44',
                    fontSize: '10px',
                    fontWeight: 600,
                    textShadow: '0 0 3px black',
                  }}>
                    VISIBLE
                  </div>
                )}
                {position.isStale && (
                  <div style={{ fontSize: '9px', color: '#ffaa00' }}>
                    (stale TLE)
                  </div>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

// Highlight marker component for search results - always faces camera (billboard)
interface HighlightMarkerProps {
  objectId: string | null;
  stars: Star[];
  planets: Planet[];
  constellations: Constellation[];
  deepSkyPositions: Map<string, DeepSkyPosition>;
  satellitePositions: Map<string, SatellitePosition | SatelliteTrackerError>;
  moonPosition: MoonPosition | null;
  sunPosition: SunPosition | null;
  lst: number;
  observerLatitude: number;
  onClose?: () => void;
}

const HighlightMarker: React.FC<HighlightMarkerProps> = ({
  objectId,
  stars,
  planets,
  constellations,
  deepSkyPositions,
  satellitePositions,
  moonPosition,
  sunPosition,
  lst,
  observerLatitude,
  onClose,
}) => {
  const position = useMemo(() => {
    if (!objectId) return null;
    
    // Check planets
    const planet = planets.find(p => p.id === objectId);
    if (planet) {
      return celestialToHorizontal3D(planet.ra, planet.dec, lst, observerLatitude, 95);
    }
    
    // Check moon
    if (objectId === 'moon' && moonPosition) {
      const mirroredAz = (360 - moonPosition.azimuth) % 360;
      return horizontalTo3D(mirroredAz, moonPosition.altitude, 95);
    }
    
    // Check sun
    if (objectId === 'sun' && sunPosition) {
      const mirroredAz = (360 - sunPosition.azimuth) % 360;
      return horizontalTo3D(mirroredAz, sunPosition.altitude, 95);
    }
    
    // Check constellations
    const constellation = constellations.find(c => c.id === objectId);
    if (constellation && constellation.lines[0]) {
      const firstStar = constellation.lines[0].star1;
      return celestialToHorizontal3D(firstStar.ra, firstStar.dec, lst, observerLatitude, 95);
    }
    
    // Check deep sky objects
    const deepSky = deepSkyPositions.get(objectId);
    if (deepSky) {
      const mirroredAz = (360 - deepSky.azimuth) % 360;
      return horizontalTo3D(mirroredAz, deepSky.altitude, 95);
    }
    
    // Check satellites
    const satellite = satellitePositions.get(objectId);
    if (satellite && 'altitude' in satellite) {
      const mirroredAz = (360 - satellite.azimuth) % 360;
      return horizontalTo3D(mirroredAz, satellite.altitude, 95);
    }
    
    // Check stars
    const star = stars.find(s => s.id === objectId);
    if (star) {
      return celestialToHorizontal3D(star.ra, star.dec, lst, observerLatitude, 95);
    }
    
    return null;
  }, [objectId, stars, planets, constellations, deepSkyPositions, satellitePositions, moonPosition, sunPosition, lst, observerLatitude]);

  if (!position) return null;

  // Use Html component which automatically faces camera (billboard behavior)
  return (
    <group position={position}>
      <Html center style={{ pointerEvents: 'auto' }} zIndexRange={[200, 300]}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'highlightPulse 1.5s ease-in-out infinite',
          position: 'relative',
        }}>
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.8)',
                border: '2px solid #fbbf24',
                color: '#fbbf24',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                boxShadow: '0 0 10px rgba(251, 191, 36, 0.5)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fbbf24';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.color = '#fbbf24';
              }}
            >
              ×
            </button>
          )}
          {/* Pulsing target rings */}
          <div style={{
            width: '80px',
            height: '80px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {/* Outer ring */}
            <div style={{
              position: 'absolute',
              width: '80px',
              height: '80px',
              border: '3px solid #fbbf24',
              borderRadius: '50%',
              boxShadow: '0 0 20px #fbbf24, 0 0 40px rgba(251, 191, 36, 0.5)',
              animation: 'ringPulse 1.5s ease-in-out infinite',
            }} />
            {/* Middle ring */}
            <div style={{
              position: 'absolute',
              width: '55px',
              height: '55px',
              border: '2px solid #fbbf24',
              borderRadius: '50%',
              opacity: 0.7,
              animation: 'ringPulse 1.5s ease-in-out infinite 0.2s',
            }} />
            {/* Inner ring */}
            <div style={{
              position: 'absolute',
              width: '30px',
              height: '30px',
              border: '2px solid #fbbf24',
              borderRadius: '50%',
              opacity: 0.5,
              animation: 'ringPulse 1.5s ease-in-out infinite 0.4s',
            }} />
            {/* Center dot */}
            <div style={{
              width: '10px',
              height: '10px',
              background: '#fbbf24',
              borderRadius: '50%',
              boxShadow: '0 0 10px #fbbf24',
            }} />
          </div>
        </div>
        <style>{`
          @keyframes highlightPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes ringPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
          }
        `}</style>
      </Html>
    </group>
  );
};

// Meteor shower radiants component - renders radiant points with active status highlighting
interface MeteorShowerRadiantsProps {
  positions: Map<string, MeteorShowerPosition>;
  showLabels?: boolean | undefined;
  showInactive?: boolean | undefined;
}

const MeteorShowerRadiants: React.FC<MeteorShowerRadiantsProps> = ({
  positions,
  showLabels = true,
  showInactive = true,
}) => {
  // Convert Map to array and optionally filter inactive showers
  const visibleRadiants = useMemo(() => {
    const radiants: { id: string; position: MeteorShowerPosition; pos3D: THREE.Vector3 }[] = [];
    
    positions.forEach((position, id) => {
      // Skip inactive showers if showInactive is false
      if (!showInactive && !position.isActive) {
        return;
      }
      
      // Mirror the azimuth to match star positions (360 - azimuth)
      const mirroredAzimuth = (360 - position.azimuth) % 360;
      radiants.push({
        id,
        position,
        pos3D: horizontalTo3D(mirroredAzimuth, position.altitude),
      });
    });
    
    return radiants;
  }, [positions, showInactive]);

  return (
    <group>
      {visibleRadiants.map(({ id, position, pos3D }) => {
        // Bright orange when active, dimmer when inactive
        const color = position.isActive ? '#ff6600' : '#664422';
        
        return (
          <group key={id} position={pos3D}>
            {/* Small sphere marker for the radiant */}
            <mesh>
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
            
            {/* Label with meteor icon and shower info */}
            <Html distanceFactor={50} style={{ pointerEvents: 'none' }} zIndexRange={[0, 100]}>
              <div style={{
                color: color,
                fontSize: '12px',
                whiteSpace: 'nowrap',
                textShadow: '0 0 4px black, 0 0 2px black',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '16px' }}>☄️</div>
                {showLabels && (
                  <>
                    <div style={{ fontWeight: 'bold' }}>{position.shower.name}</div>
                    {position.isActive && (
                      <div style={{ fontSize: '10px', opacity: 0.9 }}>
                        ZHR: {position.shower.zhr}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

// Altitude-Azimuth Coordinate Grid component
interface CoordinateGridProps {
  showAltitude?: boolean;
  showAzimuth?: boolean;
  altitudeColor?: string;
  azimuthColor?: string;
  opacity?: number;
}

const CoordinateGrid: React.FC<CoordinateGridProps> = ({
  showAltitude = false,
  showAzimuth = false,
  altitudeColor = '#4a5568',
  azimuthColor = '#4a5568',
  opacity = 0.3,
}) => {
  const gridGeometry = useMemo(() => {
    if (!showAltitude && !showAzimuth) return null;
    
    const radius = 99; // Slightly inside the sky sphere
    const segments = 72; // Points per circle for smooth curves
    
    // Create altitude circles (horizontal circles at different elevations)
    const altitudeCircles: THREE.Vector3[][] = [];
    const altitudes = [0, 15, 30, 45, 60, 75]; // Degrees above horizon
    
    if (showAltitude) {
      for (const alt of altitudes) {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const azimuth = (i / segments) * 360;
          const pos = horizontalTo3D(azimuth, alt, radius);
          points.push(pos);
        }
        altitudeCircles.push(points);
      }
    }
    
    // Create azimuth lines (vertical great circles from horizon to zenith)
    const azimuthLines: THREE.Vector3[][] = [];
    const azimuths = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]; // Every 30 degrees
    
    if (showAzimuth) {
      for (const az of azimuths) {
        const points: THREE.Vector3[] = [];
        // Draw from horizon (0°) to zenith (90°)
        for (let alt = 0; alt <= 90; alt += 2) {
          const pos = horizontalTo3D(az, alt, radius);
          points.push(pos);
        }
        azimuthLines.push(points);
      }
    }
    
    return { altitudeCircles, azimuthLines, altitudes, azimuths };
  }, [showAltitude, showAzimuth]);

  if (!gridGeometry || (!showAltitude && !showAzimuth)) return null;

  const { altitudeCircles, azimuthLines, altitudes, azimuths } = gridGeometry;

  return (
    <group>
      {/* Altitude circles */}
      {showAltitude && altitudeCircles.map((points, index) => (
        <line key={`alt-${index}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={altitudeColor} 
            transparent 
            opacity={altitudes[index] === 0 ? opacity * 1.5 : opacity} 
            linewidth={1}
          />
        </line>
      ))}
      
      {/* Azimuth lines */}
      {showAzimuth && azimuthLines.map((points, index) => (
        <line key={`az-${index}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={azimuthColor} 
            transparent 
            opacity={(azimuths[index] ?? 0) % 90 === 0 ? opacity * 1.5 : opacity} 
            linewidth={1}
          />
        </line>
      ))}
      
      {/* Altitude labels */}
      {showAltitude && altitudes.filter(alt => alt > 0).map((alt) => {
        const pos = horizontalTo3D(0, alt, 99); // Place at North (0° azimuth)
        return (
          <Html key={`alt-label-${alt}`} position={[pos.x, pos.y, pos.z]} distanceFactor={60} style={{ pointerEvents: 'none' }}>
            <div style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '10px',
              fontWeight: 500,
              textShadow: '0 0 4px black',
              whiteSpace: 'nowrap',
            }}>
              {alt}°
            </div>
          </Html>
        );
      })}
      
      {/* Azimuth labels at horizon */}
      {showAzimuth && azimuths.filter(az => az % 30 === 0).map((az) => {
        const pos = horizontalTo3D(az, 5, 99); // Slightly above horizon
        const label = az === 0 ? 'N' : az === 90 ? 'E' : az === 180 ? 'S' : az === 270 ? 'W' : `${az}°`;
        const isCardinal = az % 90 === 0;
        return (
          <Html key={`az-label-${az}`} position={[pos.x, pos.y, pos.z]} distanceFactor={60} style={{ pointerEvents: 'none' }}>
            <div style={{
              color: isCardinal ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.4)',
              fontSize: isCardinal ? '12px' : '10px',
              fontWeight: isCardinal ? 600 : 400,
              textShadow: '0 0 4px black',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </div>
          </Html>
        );
      })}
      
      {/* Zenith marker - show when either grid is enabled */}
      {(showAltitude || showAzimuth) && (
        <Html position={[0, 99, 0]} distanceFactor={60} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '11px',
            fontWeight: 500,
            textShadow: '0 0 4px black',
          }}>
            Zenith
          </div>
        </Html>
      )}
    </group>
  );
};

// Equatorial Grid component (RA/Dec) - rotates with the sky
interface EquatorialGridProps {
  enabled?: boolean;
  lst: number;
  observerLatitude: number;
  color?: string;
  opacity?: number;
}

const EquatorialGrid: React.FC<EquatorialGridProps> = ({
  enabled = false,
  lst,
  observerLatitude,
  color = '#22d3ee',
  opacity = 0.25,
}) => {
  const gridGeometry = useMemo(() => {
    if (!enabled) return null;
    
    const radius = 98; // Slightly inside the alt-az grid
    const segments = 72;
    
    // Create declination circles (parallel to celestial equator)
    const decCircles: { points: THREE.Vector3[]; dec: number }[] = [];
    const declinations = [-60, -30, 0, 30, 60]; // Celestial equator at 0°
    
    for (const dec of declinations) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const ra = (i / segments) * 24; // RA in hours (0-24)
        const pos = celestialToHorizontal3D(ra, dec, lst, observerLatitude, radius);
        points.push(pos);
      }
      decCircles.push({ points, dec });
    }
    
    // Create RA lines (hour circles - great circles through poles)
    const raLines: { points: THREE.Vector3[]; ra: number }[] = [];
    const rightAscensions = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]; // Every 2 hours
    
    for (const ra of rightAscensions) {
      const points: THREE.Vector3[] = [];
      // Draw from south pole (-90°) to north pole (+90°)
      for (let dec = -90; dec <= 90; dec += 3) {
        const pos = celestialToHorizontal3D(ra, dec, lst, observerLatitude, radius);
        points.push(pos);
      }
      raLines.push({ points, ra });
    }
    
    // Calculate celestial pole positions
    const northPole = celestialToHorizontal3D(0, 90, lst, observerLatitude, radius);
    const southPole = celestialToHorizontal3D(0, -90, lst, observerLatitude, radius);
    
    return { decCircles, raLines, northPole, southPole };
  }, [enabled, lst, observerLatitude]);

  if (!enabled || !gridGeometry) return null;

  const { decCircles, raLines, northPole, southPole } = gridGeometry;

  return (
    <group>
      {/* Declination circles */}
      {decCircles.map(({ points, dec }, index) => (
        <line key={`dec-${index}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={color} 
            transparent 
            opacity={dec === 0 ? opacity * 2 : opacity} // Celestial equator brighter
            linewidth={1}
          />
        </line>
      ))}
      
      {/* RA lines (hour circles) */}
      {raLines.map(({ points, ra }, index) => (
        <line key={`ra-${index}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={color} 
            transparent 
            opacity={ra % 6 === 0 ? opacity * 1.5 : opacity} // 0h, 6h, 12h, 18h brighter
            linewidth={1}
          />
        </line>
      ))}
      
      {/* Declination labels on 0h RA line */}
      {decCircles.filter(({ dec }) => dec !== 0).map(({ dec }) => {
        const pos = celestialToHorizontal3D(0, dec, lst, observerLatitude, 98);
        return (
          <Html key={`dec-label-${dec}`} position={[pos.x, pos.y, pos.z]} distanceFactor={60} style={{ pointerEvents: 'none' }}>
            <div style={{
              color: 'rgba(34, 211, 238, 0.6)',
              fontSize: '9px',
              fontWeight: 500,
              textShadow: '0 0 4px black',
              whiteSpace: 'nowrap',
            }}>
              {dec > 0 ? `+${dec}°` : `${dec}°`}
            </div>
          </Html>
        );
      })}
      
      {/* RA labels on celestial equator */}
      {raLines.filter(({ ra }) => ra % 2 === 0).map(({ ra }) => {
        const pos = celestialToHorizontal3D(ra, 0, lst, observerLatitude, 98);
        return (
          <Html key={`ra-label-${ra}`} position={[pos.x, pos.y, pos.z]} distanceFactor={60} style={{ pointerEvents: 'none' }}>
            <div style={{
              color: 'rgba(34, 211, 238, 0.7)',
              fontSize: '10px',
              fontWeight: 500,
              textShadow: '0 0 4px black',
              whiteSpace: 'nowrap',
            }}>
              {ra}h
            </div>
          </Html>
        );
      })}
      
      {/* North Celestial Pole marker */}
      {northPole.y > -50 && (
        <Html position={[northPole.x, northPole.y, northPole.z]} distanceFactor={60} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: 'rgba(34, 211, 238, 0.8)',
            fontSize: '11px',
            fontWeight: 600,
            textShadow: '0 0 4px black',
          }}>
            NCP
          </div>
        </Html>
      )}
      
      {/* South Celestial Pole marker */}
      {southPole.y > -50 && (
        <Html position={[southPole.x, southPole.y, southPole.z]} distanceFactor={60} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: 'rgba(34, 211, 238, 0.8)',
            fontSize: '11px',
            fontWeight: 600,
            textShadow: '0 0 4px black',
          }}>
            SCP
          </div>
        </Html>
      )}
      
      {/* Celestial Equator label */}
      <Html position={celestialToHorizontal3D(lst, 0, lst, observerLatitude, 98).toArray()} distanceFactor={60} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: 'rgba(34, 211, 238, 0.7)',
          fontSize: '10px',
          fontWeight: 500,
          textShadow: '0 0 4px black',
          whiteSpace: 'nowrap',
        }}>
          Celestial Equator
        </div>
      </Html>
    </group>
  );
};

// Main SkyDome component
export const SkyDome: React.FC<SkyDomeProps> = ({
  stars,
  planets,
  config,
  horizonPoints,
  horizonConfig,
  moonPosition,
  sunPosition,
  constellations,
  constellationConfig,
  deepSkyPositions,
  deepSkyConfig,
  satellitePositions,
  satelliteConfig,
  meteorShowerRadiants,
  meteorShowerConfig,
  gridConfig,
  groundTexture,
  showAtmosphere = true,
  showGround = true,
  lst = 0, // Default to 0 if not provided
  observerLatitude = 0, // Default to equator if not provided
  highlightedObjectId,
  cameraTarget,
  onStarClick: _onStarClick, // Not yet implemented for Points renderer
  onPlanetClick,
  onDeepSkyClick,
  onMoonClick,
  onSunClick,
  onConstellationClick,
  onCameraChange,
  onCloseHighlight,
}) => {
  const [fov, setFov] = useState<number>(config.fov);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Handle scroll wheel for FOV zoom - use non-passive listener to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setFov(prev => {
        const delta = event.deltaY * 0.05; // Adjust sensitivity
        const newFov = Math.max(5, Math.min(120, prev + delta)); // FOV range: 5° to 120°
        return newFov;
      });
    };
    
    // Add with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);
  
  // Separate constellation stars from bright stars and get constellation star IDs
  const { constellationStars, brightStars, constellationStarIds } = useMemo(() => {
    const constellationIds = new Set<string>();
    
    // Collect all constellation star IDs
    if (constellations) {
      for (const constellation of constellations) {
        for (const line of constellation.lines) {
          constellationIds.add(`HIP${line.star1.hipId}`);
          constellationIds.add(`HIP${line.star2.hipId}`);
        }
      }
    }
    
    // Separate stars
    const constStars: Star[] = [];
    const brightStars: Star[] = [];
    
    for (const star of stars) {
      if (constellationIds.has(star.id)) {
        constStars.push(star);
      } else {
        brightStars.push(star);
      }
    }
    
    return { constellationStars: constStars, brightStars, constellationStarIds: constellationIds };
  }, [stars, constellations]);
  
  // Performance optimization: Filter bright stars based on FOV (zoom level)
  // Constellation stars are ALWAYS visible (to keep constellation lines connected)
  // Other stars are filtered by light pollution
  const visibleStars = useMemo(() => {
    // Use config.maxMagnitude as the upper limit (from light pollution setting)
    // Then further limit based on FOV for performance
    const configMaxMag = config?.maxMagnitude ?? 6.0;
    
    // Calculate magnitude threshold based on FOV
    // Zoomed in (small FOV) = show fainter stars
    // Zoomed out (large FOV) = show only bright stars
    const minFov = 5;
    const maxFov = 120;
    const minMagnitude = Math.min(5.0, configMaxMag);  // Show only bright stars when zoomed out
    const maxMagnitude = Math.min(8.23, configMaxMag);  // Respect light pollution limit
    
    // Normalize FOV to 0-1 range
    const normalizedFov = Math.min(1, Math.max(0, 
      (fov - minFov) / (maxFov - minFov)
    ));
    
    // Calculate magnitude threshold (inverse: smaller FOV = more stars)
    const magnitudeThreshold = minMagnitude + ((1 - normalizedFov) * (maxMagnitude - minMagnitude));
    
    // Filter bright stars by magnitude
    const filteredBrightStars = brightStars.filter(star => star.magnitude <= magnitudeThreshold);
    
    // ALWAYS keep ALL constellation stars visible (regardless of magnitude)
    // This ensures constellation lines remain connected
    const allVisibleStars = [...constellationStars, ...filteredBrightStars];
    
    console.log(`🔍 FOV LOD: FOV=${fov.toFixed(1)}°, lightPollutionLimit=${configMaxMag.toFixed(1)}, mag≤${magnitudeThreshold.toFixed(2)}, stars=${allVisibleStars.length} (${constellationStars.length} constellation + ${filteredBrightStars.length} bright)`);
    
    return allVisibleStars;
  }, [constellationStars, brightStars, fov, config?.maxMagnitude]);
  
  // Note: Star click handling is now implemented with invisible meshes
  const handleStarClick = useCallback((star: Star) => {
    _onStarClick?.(star);
  }, [_onStarClick]);
  
  const handlePlanetClick = useCallback((planet: Planet) => {
    onPlanetClick?.(planet);
  }, [onPlanetClick]);
  
  const handleCameraChange = useCallback((orientation: CameraOrientation) => {
    // Pass to parent
    onCameraChange?.(orientation);
  }, [onCameraChange]);
  
  // Ref for OrbitControls to allow camera animation
  const controlsRef = React.useRef<any>(null);
  
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 0.01], fov: fov, near: 0.01, far: 1000 }}
        style={{ background: '#000011' }}
      >
        <CameraController 
          onCameraChange={handleCameraChange} 
          fov={fov} 
          targetAzimuth={cameraTarget?.azimuth ?? null}
          targetAltitude={cameraTarget?.altitude ?? null}
          controlsRef={controlsRef}
        />
        
        {/* Atmosphere and ground effect */}
        {(showAtmosphere || showGround) && (
          <AtmosphereGround 
            sunAltitude={sunPosition?.altitude ?? -10} 
            sunAzimuth={sunPosition?.azimuth ?? 180}
            {...(groundTexture ? { groundTexture } : {})}
            showAtmosphere={showAtmosphere}
            showGround={showGround}
          />
        )}
        
        {/* Render horizon line with cardinal directions */}
        {horizonPoints && horizonPoints.length > 0 && (
          <HorizonLineRing
            color={horizonConfig?.color}
            opacity={horizonConfig?.opacity}
          />
        )}
        
        {/* Render coordinate grid (Alt-Az) */}
        {(gridConfig?.showAltitude || gridConfig?.showAzimuth) && (
          <CoordinateGrid
            showAltitude={gridConfig.showAltitude ?? false}
            showAzimuth={gridConfig.showAzimuth ?? false}
            altitudeColor={gridConfig.altitudeColor ?? '#4a5568'}
            azimuthColor={gridConfig.azimuthColor ?? '#4a5568'}
            opacity={gridConfig.opacity ?? 0.3}
          />
        )}
        
        {/* Render equatorial grid (RA/Dec) */}
        {gridConfig?.showEquatorial && (
          <EquatorialGrid
            enabled={gridConfig.showEquatorial}
            lst={lst}
            observerLatitude={observerLatitude}
            color={gridConfig.equatorialColor ?? '#22d3ee'}
            opacity={gridConfig.opacity ?? 0.3}
          />
        )}
        
        {/* Render stars using instanced rendering for performance */}
        <InstancedStars
          stars={visibleStars}
          lst={lst}
          observerLatitude={observerLatitude}
          fov={fov}
          showLabels={config.showLabels}
          labelMagnitudeThreshold={config.labelMagnitudeThreshold}
          onStarClick={handleStarClick}
          constellationStarIds={constellationStarIds}
        />
        
        {/* Render planets - positions calculated using horizontal coordinates */}
        {planets.map(planet => (
          <PlanetPoint
            key={planet.id}
            planet={planet}
            lst={lst}
            observerLatitude={observerLatitude}
            onClick={handlePlanetClick}
            fov={fov}
          />
        ))}
        
        {/* Render constellation lines with toggle */}
        {constellations && 
         constellations.length > 0 && 
         constellationConfig?.enabled !== false && (
          <ConstellationLines
            constellations={constellations}
            stars={visibleStars}
            lst={lst}
            observerLatitude={observerLatitude}
            lineColor={constellationConfig?.lineColor}
            lineOpacity={constellationConfig?.lineOpacity}
            showNames={constellationConfig?.showNames}
            nameColor={constellationConfig?.nameColor}
            onConstellationClick={onConstellationClick}
          />
        )}
        
        {/* Objects already using horizontal coordinates */}
        
        {/* Render Moon with phase visualization */}
        {moonPosition && (
          <MoonPoint moonPosition={moonPosition} onClick={onMoonClick} fov={fov} />
        )}
        
        {/* Render Sun with glow effect */}
        {sunPosition && (
          <SunPoint sunPosition={sunPosition} onClick={onSunClick} fov={fov} />
        )}
        
        {/* Render deep sky objects with type icons */}
        {deepSkyPositions && 
         deepSkyPositions.size > 0 && 
         deepSkyConfig?.enabled !== false && (
          <DeepSkyObjects
            positions={deepSkyPositions}
            showLabels={deepSkyConfig?.showLabels}
            showAll={deepSkyConfig?.showAll}
            onClick={onDeepSkyClick}
            fov={fov}
            lst={lst}
            observerLatitude={observerLatitude}
          />
        )}
        
        {/* Render satellites with visibility indicator */}
        {satellitePositions && 
         satellitePositions.size > 0 && 
         satelliteConfig?.enabled !== false && (
          <Satellites
            positions={satellitePositions}
            showLabels={satelliteConfig?.showLabels}
          />
        )}
        
        {/* Render meteor shower radiants with active status highlighting */}
        {meteorShowerRadiants && 
         meteorShowerRadiants.size > 0 && 
         meteorShowerConfig?.enabled !== false && (
          <MeteorShowerRadiants
            positions={meteorShowerRadiants}
            showLabels={meteorShowerConfig?.showLabels}
            showInactive={meteorShowerConfig?.showInactive}
          />
        )}
        
        {/* Highlight marker for search results */}
        {highlightedObjectId && onCloseHighlight && (
          <HighlightMarker
            objectId={highlightedObjectId}
            stars={stars}
            planets={planets}
            constellations={constellations || []}
            deepSkyPositions={deepSkyPositions || new Map()}
            satellitePositions={satellitePositions || new Map()}
            moonPosition={moonPosition || null}
            sunPosition={sunPosition || null}
            lst={lst}
            observerLatitude={observerLatitude}
            onClose={onCloseHighlight}
          />
        )}
        
        {/* Mouse controls - rotation only, zoom handled by scroll wheel */}
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.5}
          enableDamping={false}
        />
      </Canvas>
      
      {/* FOV indicator */}
      <div style={{
        position: 'absolute',
        top: '70px',
        left: '20px',
        background: 'rgba(0, 8, 20, 0.85)',
        backdropFilter: 'blur(20px)',
        padding: '8px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 500,
        zIndex: 90,
      }}>
        FOV: {fov.toFixed(1)}°
      </div>
    </div>
  );
};

export default SkyDome;
