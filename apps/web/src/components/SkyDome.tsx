/**
 * SkyDome Component
 * 3D sky dome rendering using Three.js and react-three-fiber
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
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
  // Real-time position updates
  lst?: number; // Local Sidereal Time in decimal hours
  observerLatitude?: number; // Observer's latitude in degrees
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
              color: 'white',
              fontSize: '10px',
              whiteSpace: 'nowrap',
              textShadow: '0 0 3px black',
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

// Sun component with safety warning
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
  
  // Scale factor based on FOV
  const scaleFactor = Math.max(0.4, Math.min(1.2, fov / 60));
  const sunSize = Math.round(56 * scaleFactor); // Bigger sun
  const labelSize = Math.round(12 * scaleFactor);
  
  return (
    <group position={position}>
      {/* Invisible mesh for click detection */}
      <mesh onClick={() => onClick?.(sunPosition)}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
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
}

const CameraController: React.FC<CameraControllerProps> = ({ onCameraChange, fov }) => {
  const { camera } = useThree();
  
  // Update camera FOV when it changes
  React.useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, fov]);
  
  useFrame(() => {
    if (onCameraChange) {
      // Calculate azimuth and altitude from camera direction
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      
      const azimuth = (Math.atan2(-direction.z, direction.x) * 180 / Math.PI + 360) % 360;
      const altitude = Math.asin(direction.y) * 180 / Math.PI;
      
      onCameraChange({
        azimuth,
        altitude,
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

// Atmosphere and ground component - creates gradient effect below horizon
const AtmosphereGround: React.FC = () => {
  // Create a half-sphere below the horizon with gradient
  const groundGeometry = useMemo(() => {
    const geometry = new THREE.SphereGeometry(99.5, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    return geometry;
  }, []);

  // Atmosphere glow at horizon
  const atmosphereGeometry = useMemo(() => {
    const geometry = new THREE.RingGeometry(95, 100, 64);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);

  // Shader for ground gradient
  const groundMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color('#1a1a2e') },
        bottomColor: { value: new THREE.Color('#0a0a12') },
        horizonColor: { value: new THREE.Color('#2d3a4a') },
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
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          // h goes from 0 (horizon) to -1 (nadir)
          float t = clamp(-h, 0.0, 1.0);
          
          // Near horizon: blend to horizon color
          vec3 color = mix(horizonColor, bottomColor, smoothstep(0.0, 0.3, t));
          // Further down: darker
          color = mix(color, bottomColor, smoothstep(0.3, 1.0, t));
          
          // Fade out near horizon for smooth blend
          float alpha = smoothstep(0.0, 0.05, t) * 0.95;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  // Atmosphere glow shader
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color('#3a4a5a') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec2 vUv;
        void main() {
          // Radial gradient from inner to outer
          float dist = length(vUv - 0.5) * 2.0;
          float alpha = smoothstep(1.0, 0.7, dist) * 0.4;
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  return (
    <group>
      {/* Ground hemisphere */}
      <mesh geometry={groundGeometry} material={groundMaterial} />
      
      {/* Atmospheric glow ring at horizon */}
      <mesh geometry={atmosphereGeometry} material={atmosphereMaterial} position={[0, -0.5, 0]} />
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
  const lineGeometries = useMemo(() => {
    const geometries: { id: string; positions: Float32Array }[] = [];
    
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
        
        const positions = new Float32Array([
          startPos.x, startPos.y, startPos.z,
          endPos.x, endPos.y, endPos.z,
        ]);
        
        geometries.push({
          id: `${constellation.id}-${i}`,
          positions,
        });
      }
    }
    
    return geometries;
  }, [constellations, starMap, lst, observerLatitude]);

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
      {/* Render constellation line segments */}
      {lineGeometries.map((geom) => (
        <line key={geom.id}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={geom.positions}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={lineColor}
            opacity={lineOpacity}
            transparent
            depthWrite={false}
            depthTest={true}
          />
        </line>
      ))}
      
      {/* Render constellation name labels */}
      {showNames && constellationLabels.map((label) => (
        <group key={label.id} position={label.position}>
          <Html distanceFactor={60} style={{ pointerEvents: 'none' }} zIndexRange={[0, 50]}>
            <div style={{
              color: nameColor,
              fontSize: '12px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              textShadow: '0 0 6px black, 0 0 3px black, 0 0 1px black',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              {label.name}
            </div>
          </Html>
        </group>
      ))}
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
          <group key={id} position={pos3D}>
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
        // Bright green when visible, dimmer when not
        const color = position.isVisible ? '#00ff44' : '#666666';
        const glowColor = position.isVisible ? '#00ff00' : '#444444';
        
        return (
          <group key={id} position={pos3D}>
            {/* Glowing sphere marker for the satellite */}
            <mesh>
              <sphereGeometry args={[0.8, 12, 12]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Outer glow */}
            {position.isVisible && (
              <mesh>
                <sphereGeometry args={[1.2, 12, 12]} />
                <meshBasicMaterial color={glowColor} transparent opacity={0.3} />
              </mesh>
            )}
            
            {/* Label with satellite icon and name */}
            <Html distanceFactor={50} style={{ pointerEvents: 'none' }} zIndexRange={[0, 100]}>
              <div style={{
                textAlign: 'center',
              }}>
                <div style={{ 
                  fontSize: '20px',
                  filter: position.isVisible ? 'drop-shadow(0 0 4px #00ff00)' : 'none',
                }}>🛰️</div>
                {showLabels && (
                  <div style={{ 
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textShadow: '0 0 4px black, 0 0 2px black',
                  }}>
                    {position.name}
                  </div>
                )}
                {position.isVisible && (
                  <div style={{ 
                    color: '#00ff44',
                    fontSize: '9px',
                    textShadow: '0 0 3px black',
                  }}>
                    VISIBLE
                  </div>
                )}
                {position.isStale && (
                  <div style={{ fontSize: '8px', color: '#ffaa00' }}>
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
  lst = 0, // Default to 0 if not provided
  observerLatitude = 0, // Default to equator if not provided
  onStarClick: _onStarClick, // Not yet implemented for Points renderer
  onPlanetClick,
  onDeepSkyClick,
  onMoonClick,
  onSunClick,
  onConstellationClick: _onConstellationClick, // Not yet implemented
  onCameraChange,
}) => {
  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<Planet | null>(null);
  const [fov, setFov] = useState<number>(config.fov);
  
  // Handle scroll wheel for FOV zoom
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    setFov(prev => {
      const delta = event.deltaY * 0.05; // Adjust sensitivity
      const newFov = Math.max(5, Math.min(120, prev + delta)); // FOV range: 5° to 120°
      return newFov;
    });
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
  // Constellation stars are ALWAYS visible
  const visibleStars = useMemo(() => {
    // Calculate magnitude threshold based on FOV
    // Zoomed in (small FOV) = show fainter stars
    // Zoomed out (large FOV) = show only bright stars
    const minFov = 5;
    const maxFov = 120;
    const minMagnitude = 5.0;  // Show only bright stars when zoomed out
    const maxMagnitude = 8.23;  // Show all stars when zoomed in (matches database)
    
    // Normalize FOV to 0-1 range
    const normalizedFov = Math.min(1, Math.max(0, 
      (fov - minFov) / (maxFov - minFov)
    ));
    
    // Calculate magnitude threshold (inverse: smaller FOV = more stars)
    const magnitudeThreshold = minMagnitude + ((1 - normalizedFov) * (maxMagnitude - minMagnitude));
    
    // Filter bright stars by magnitude, but keep ALL constellation stars
    const filteredBrightStars = brightStars.filter(star => star.magnitude <= magnitudeThreshold);
    const allVisibleStars = [...constellationStars, ...filteredBrightStars];
    
    console.log(`🔍 FOV LOD: FOV=${fov.toFixed(1)}°, mag≤${magnitudeThreshold.toFixed(2)}, stars=${allVisibleStars.length} (${constellationStars.length} constellation + ${filteredBrightStars.length} bright)`);
    
    return allVisibleStars;
  }, [constellationStars, brightStars, fov]);
  
  // Note: Star click handling is now implemented with invisible meshes
  const handleStarClick = useCallback((star: Star) => {
    setSelectedStar(star);
    setSelectedPlanet(null);
    _onStarClick?.(star);
  }, [_onStarClick]);
  
  const handlePlanetClick = useCallback((planet: Planet) => {
    setSelectedPlanet(planet);
    setSelectedStar(null);
    onPlanetClick?.(planet);
  }, [onPlanetClick]);
  
  const handleCameraChange = useCallback((orientation: CameraOrientation) => {
    // Pass to parent
    onCameraChange?.(orientation);
  }, [onCameraChange]);
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} onWheel={handleWheel as any}>
      <Canvas
        camera={{ position: [0, 0, 0.01], fov: fov, near: 0.01, far: 1000 }}
        style={{ background: '#000011' }}
      >
        <CameraController onCameraChange={handleCameraChange} fov={fov} />
        
        {/* Atmosphere and ground effect */}
        <AtmosphereGround />
        
        {/* Render horizon line with cardinal directions */}
        {horizonPoints && horizonPoints.length > 0 && (
          <HorizonLineRing
            color={horizonConfig?.color}
            opacity={horizonConfig?.opacity}
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
        
        {/* Mouse controls - rotation only, zoom handled by scroll wheel */}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.5}
          enableDamping={false}
        />
      </Canvas>
      
      {/* Info panel for selected object */}
      {(selectedStar || selectedPlanet) && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          minWidth: '200px',
        }}>
          {selectedStar && (
            <>
              <h3 style={{ margin: '0 0 10px 0' }}>{selectedStar.name || 'Unknown Star'}</h3>
              <p style={{ margin: '5px 0' }}>Magnitude: {selectedStar.magnitude.toFixed(2)}</p>
              <p style={{ margin: '5px 0' }}>RA: {selectedStar.ra.toFixed(4)}h</p>
              <p style={{ margin: '5px 0' }}>Dec: {selectedStar.dec.toFixed(4)}°</p>
              <p style={{ margin: '5px 0' }}>Type: {selectedStar.spectralType}</p>
            </>
          )}
          {selectedPlanet && (
            <>
              <h3 style={{ margin: '0 0 10px 0' }}>{selectedPlanet.name}</h3>
              <p style={{ margin: '5px 0' }}>Magnitude: {selectedPlanet.magnitude.toFixed(2)}</p>
              <p style={{ margin: '5px 0' }}>RA: {selectedPlanet.ra.toFixed(4)}h</p>
              <p style={{ margin: '5px 0' }}>Dec: {selectedPlanet.dec.toFixed(4)}°</p>
            </>
          )}
          <button
            onClick={() => { setSelectedStar(null); setSelectedPlanet(null); }}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}
      
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
