/**
 * SkyView2D Component
 * Full-featured 2D canvas sky view with circular viewport and navigation
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { 
  Star, 
  Planet, 
  SpectralType,
  Constellation,
  MoonPosition,
  SunPosition,
  DeepSkyPosition,
  SatellitePosition,
  SatelliteTrackerError,
} from '@virtual-window/astronomy-engine';

// Spectral type to color mapping
const SPECTRAL_COLORS: Record<SpectralType, string> = {
  'O': '#9bb0ff',
  'B': '#aabfff',
  'A': '#cad7ff',
  'F': '#f8f7ff',
  'G': '#fff4ea',
  'K': '#ffd2a1',
  'M': '#ffcc6f',
};

// Planet colors
const PLANET_COLORS: Record<string, string> = {
  mercury: '#8c8c8c',
  venus: '#e6c35c',
  mars: '#c1440e',
  jupiter: '#d8ca9d',
  saturn: '#ead6b8',
  uranus: '#b5e3e3',
  neptune: '#5b7fde',
};

export interface SkyView2DConfig {
  fov: number;
  maxMagnitude: number;
  showLabels: boolean;
  labelMagnitudeThreshold: number;
}

export interface SkyView2DProps {
  stars: Star[];
  planets: Planet[];
  config: SkyView2DConfig;
  viewAzimuth: number;
  viewAltitude: number;
  constellations?: Constellation[];
  moonPosition?: MoonPosition | null;
  sunPosition?: SunPosition | null;
  deepSkyPositions?: Map<string, DeepSkyPosition>;
  satellitePositions?: Map<string, SatellitePosition | SatelliteTrackerError>;
  showConstellations?: boolean;
  showMoon?: boolean;
  showSun?: boolean;
  showDeepSky?: boolean;
  showSatellites?: boolean;
  showHorizon?: boolean;
  showAltitudeGrid?: boolean;
  showAzimuthGrid?: boolean;
  lst?: number;
  observerLatitude?: number;
  onStarClick?: (star: Star) => void;
  onPlanetClick?: (planet: Planet) => void;
  onMoonClick?: (moon: MoonPosition) => void;
  onSunClick?: (sun: SunPosition) => void;
  onDeepSkyClick?: (obj: DeepSkyPosition) => void;
  onConstellationClick?: (constellation: Constellation) => void;
  onViewChange?: (azimuth: number, altitude: number, fov: number) => void;
}

// Convert RA/Dec to horizontal coordinates (Alt/Az)
function raDecToAltAz(ra: number, dec: number, lst: number, latitude: number): { altitude: number; azimuth: number } {
  const haHours = lst - ra;
  const haDegrees = haHours * 15;
  const haRadians = (haDegrees * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRadians);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;

  const cosAlt = Math.cos(altitude * Math.PI / 180);
  const cosLat = Math.cos(latRad);

  let azimuth: number;
  if (Math.abs(cosAlt) < 1e-10 || Math.abs(cosLat) < 1e-10) {
    azimuth = 0;
  } else {
    const cosAz = (Math.sin(decRad) - sinAlt * Math.sin(latRad)) / (cosAlt * cosLat);
    let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(haRadians) > 0) azRad = 2 * Math.PI - azRad;
    azimuth = azRad * 180 / Math.PI;
  }

  // Normalize azimuth to [0, 360)
  azimuth = ((azimuth % 360) + 360) % 360;
  
  // Mirror the azimuth for correct display (matching 3D mode)
  // This is needed because we're viewing the sky as if looking up from inside
  azimuth = (360 - azimuth) % 360;

  return { altitude, azimuth };
}

// Convert horizontal coordinates to circular screen position
// Note: azimuth should already be mirrored if coming from raDecToAltAz
// For objects with pre-calculated alt/az (moon, sun, etc), we need to mirror here
function altAzToCircular(
  altitude: number,
  azimuth: number,
  viewAz: number,
  viewAlt: number,
  fov: number,
  radius: number,
  centerX: number,
  centerY: number,
  needsMirror: boolean = false
): { x: number; y: number; visible: boolean; distance: number } {
  // Mirror azimuth for pre-calculated positions (moon, sun, satellites, deep sky)
  let az = needsMirror ? (360 - azimuth) % 360 : azimuth;
  
  let dAz = az - viewAz;
  while (dAz > 180) dAz -= 360;
  while (dAz < -180) dAz += 360;
  
  const dAlt = altitude - viewAlt;
  
  // Calculate distance from center in degrees
  const angularDist = Math.sqrt(dAz * dAz + dAlt * dAlt);
  const visible = angularDist <= fov / 2;
  
  // Project to circular coordinates
  const scale = radius / (fov / 2);
  const x = centerX + dAz * scale;
  const y = centerY - dAlt * scale;
  
  return { x, y, visible, distance: angularDist };
}

// Magnitude to radius
function magnitudeToRadius(magnitude: number, fov: number): number {
  const zoomFactor = Math.max(0.5, Math.min(2, 60 / fov));
  const baseRadius = 2.5 * zoomFactor;
  const scaleFactor = Math.pow(2.512, (2 - magnitude) / 2.5);
  return Math.max(0.8, Math.min(baseRadius * scaleFactor, 12));
}

// Get compass direction from azimuth
function getCompassDirection(az: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(az / 22.5) % 16;
  return directions[index] || 'N';
}

export const SkyView2D: React.FC<SkyView2DProps> = ({
  stars,
  planets,
  config,
  viewAzimuth: initialAzimuth,
  viewAltitude: initialAltitude,
  constellations = [],
  moonPosition,
  sunPosition,
  deepSkyPositions,
  satellitePositions,
  showConstellations = true,
  showMoon = true,
  showSun = true,
  showDeepSky = true,
  showSatellites = true,
  showHorizon = true,
  showAltitudeGrid = false,
  showAzimuthGrid = false,
  lst = 0,
  observerLatitude = 0,
  onStarClick,
  onPlanetClick,
  onMoonClick,
  onSunClick,
  onDeepSkyClick,
  onConstellationClick,
  onViewChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  const [viewAz, setViewAz] = useState(initialAzimuth);
  const [viewAlt, setViewAlt] = useState(initialAltitude);
  const [fov, setFov] = useState(config.fov);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, az: 0, alt: 0 });
  
  // Calculate circle dimensions - leave room for cardinal labels
  const circleRadius = useMemo(() => Math.min(canvasSize.width, canvasSize.height) / 2 - 25, [canvasSize]);
  const centerX = canvasSize.width / 2;
  const centerY = canvasSize.height / 2;
  
  const constellationStarIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of constellations) {
      for (const line of c.lines) {
        ids.add(`HIP${line.star1.hipId}`);
        ids.add(`HIP${line.star2.hipId}`);
      }
    }
    return ids;
  }, [constellations]);
  
  const visibleStars = useMemo(() => {
    return stars.filter(star => {
      if (constellationStarIds.has(star.id)) return true;
      return star.magnitude <= config.maxMagnitude;
    });
  }, [stars, config.maxMagnitude, constellationStarIds]);
  
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        // Account for header (~60px) and footer (~70px) plus extra padding
        const availableWidth = containerRef.current.clientWidth - 100;
        const availableHeight = containerRef.current.clientHeight - 100;
        const size = Math.min(availableWidth, availableHeight, 600); // Max 600px
        setCanvasSize({ width: Math.max(300, size), height: Math.max(300, size) });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    onViewChange?.(viewAz, viewAlt, fov);
  }, [viewAz, viewAlt, fov, onViewChange]);

  const skyColor = useMemo(() => {
    if (!sunPosition) return '#000011';
    const alt = sunPosition.altitude;
    if (alt > 0) {
      const t = Math.min(1, alt / 30);
      return `rgb(${Math.round(20 + t * 80)}, ${Math.round(30 + t * 100)}, ${Math.round(50 + t * 130)})`;
    } else if (alt > -18) {
      const t = (alt + 18) / 18;
      return `rgb(${Math.round(t * 40)}, ${Math.round(t * 30)}, ${Math.round(20 + t * 30)})`;
    }
    return '#000011';
  }, [sunPosition]);


  // Download canvas as image
  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `skywatch-${getCompassDirection(viewAz)}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [viewAz]);

  // Main render effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvasSize;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Create circular clipping path
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.clip();
    
    // Fill circle with sky color
    ctx.fillStyle = skyColor;
    ctx.fill();
    
    // Draw horizon (subtle line only, no ground fill)
    if (showHorizon) {
      const horizonOffset = -viewAlt * (circleRadius / (fov / 2));
      const horizonY = centerY + horizonOffset;
      
      // Only draw horizon line if visible in the circle
      if (horizonY > centerY - circleRadius && horizonY < centerY + circleRadius) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(centerX - circleRadius, horizonY);
        ctx.lineTo(centerX + circleRadius, horizonY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // Draw altitude grid circles
    if (showAltitudeGrid) {
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let alt = -60; alt <= 90; alt += 15) {
        const dAlt = alt - viewAlt;
        const r = Math.abs(dAlt) * (circleRadius / (fov / 2));
        if (r < circleRadius && r > 0) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    
    // Draw azimuth grid lines
    if (showAzimuthGrid) {
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.15)';
      ctx.lineWidth = 1;
      for (let az = 0; az < 360; az += 30) {
        let dAz = az - viewAz;
        while (dAz > 180) dAz -= 360;
        while (dAz < -180) dAz += 360;
        
        const angle = (dAz * Math.PI) / 180 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(angle) * circleRadius, centerY + Math.sin(angle) * circleRadius);
        ctx.stroke();
      }
    }
    
    // Draw constellation lines
    if (showConstellations && constellations.length > 0) {
      ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)';
      ctx.lineWidth = 1;
      
      for (const constellation of constellations) {
        for (const line of constellation.lines) {
          const pos1 = raDecToAltAz(line.star1.ra, line.star1.dec, lst, observerLatitude);
          const pos2 = raDecToAltAz(line.star2.ra, line.star2.dec, lst, observerLatitude);
          
          const screen1 = altAzToCircular(pos1.altitude, pos1.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY);
          const screen2 = altAzToCircular(pos2.altitude, pos2.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY);
          
          if (screen1.visible || screen2.visible) {
            ctx.beginPath();
            ctx.moveTo(screen1.x, screen1.y);
            ctx.lineTo(screen2.x, screen2.y);
            ctx.stroke();
          }
        }
        
        // Constellation name
        if (config.showLabels && constellation.lines.length > 0 && constellation.lines[0]) {
          const centerPos = raDecToAltAz(constellation.lines[0].star1.ra, constellation.lines[0].star1.dec, lst, observerLatitude);
          const centerScreen = altAzToCircular(centerPos.altitude, centerPos.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY);
          if (centerScreen.visible) {
            ctx.fillStyle = 'rgba(100, 149, 237, 0.7)';
            ctx.font = '10px sans-serif';
            ctx.fillText(constellation.name, centerScreen.x + 8, centerScreen.y - 8);
          }
        }
      }
    }
    
    // Draw deep sky objects
    if (showDeepSky && deepSkyPositions) {
      deepSkyPositions.forEach((obj) => {
        const screen = altAzToCircular(obj.altitude, obj.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, true);
        if (!screen.visible) return;
        
        const size = Math.max(4, 8 - obj.object.magnitude / 2);
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
        ctx.stroke();
        
        if (config.showLabels) {
          ctx.fillStyle = 'rgba(255, 150, 150, 0.8)';
          ctx.font = '9px sans-serif';
          ctx.fillText(obj.object.id, screen.x + size + 3, screen.y + 3);
        }
      });
    }
    
    // Draw satellites
    if (showSatellites && satellitePositions) {
      satellitePositions.forEach((sat) => {
        if ('altitude' in sat && sat.isVisible) {
          const screen = altAzToCircular(sat.altitude, sat.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, true);
          if (!screen.visible) return;
          
          ctx.fillStyle = '#00ff00';
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
          ctx.fill();
          
          if (config.showLabels) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.font = '9px sans-serif';
            ctx.fillText(sat.name, screen.x + 5, screen.y - 5);
          }
        }
      });
    }
    
    // Draw stars
    for (const star of visibleStars) {
      const pos = raDecToAltAz(star.ra, star.dec, lst, observerLatitude);
      const screen = altAzToCircular(pos.altitude, pos.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY);
      
      if (!screen.visible) continue;
      
      const isConstellation = constellationStarIds.has(star.id);
      const radius = magnitudeToRadius(star.magnitude, fov) * (isConstellation ? 1.3 : 1);
      const color = SPECTRAL_COLORS[star.spectralType as SpectralType] || SPECTRAL_COLORS['G'];
      
      // Glow for bright stars
      if (star.magnitude < 2) {
        const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius * 3);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.5, `${color}44`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      if (config.showLabels && star.name && star.magnitude < config.labelMagnitudeThreshold) {
        ctx.fillStyle = 'rgba(255, 255, 220, 0.9)';
        ctx.font = '10px sans-serif';
        ctx.fillText(star.name, screen.x + radius + 4, screen.y + 3);
      }
    }


    // Draw planets
    for (const planet of planets) {
      const pos = raDecToAltAz(planet.ra, planet.dec, lst, observerLatitude);
      const screen = altAzToCircular(pos.altitude, pos.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY);
      
      if (!screen.visible) continue;
      
      const color = PLANET_COLORS[planet.id] || '#ffdd44';
      const size = Math.max(6, 10 - (planet.magnitude || 0) / 2);
      
      const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, size * 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, `${color}66`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      if (config.showLabels) {
        ctx.fillStyle = color;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(planet.name, screen.x + size + 5, screen.y + 4);
      }
    }
    
    // Draw Moon
    if (showMoon && moonPosition && !moonPosition.isBelowHorizon) {
      const screen = altAzToCircular(moonPosition.altitude, moonPosition.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, true);
      
      if (screen.visible) {
        const moonSize = 12;
        
        const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, moonSize * 2);
        gradient.addColorStop(0, 'rgba(255, 250, 205, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 250, 205, 0.3)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, moonSize * 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fffacd';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, moonSize, 0, Math.PI * 2);
        ctx.fill();
        
        if (config.showLabels) {
          ctx.fillStyle = '#fffacd';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('Moon', screen.x + moonSize + 4, screen.y + 3);
        }
      }
    }
    
    // Draw Sun
    if (showSun && sunPosition && !sunPosition.isBelowHorizon) {
      const screen = altAzToCircular(sunPosition.altitude, sunPosition.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, true);
      
      if (screen.visible) {
        const sunSize = 16;
        
        const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, sunSize * 3);
        gradient.addColorStop(0, 'rgba(255, 220, 0, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 180, 0, 0.5)');
        gradient.addColorStop(0.6, 'rgba(255, 100, 0, 0.2)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, sunSize * 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffdd00';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, sunSize, 0, Math.PI * 2);
        ctx.fill();
        
        if (config.showLabels) {
          ctx.fillStyle = '#ffdd00';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('☀ Sun', screen.x + sunSize + 4, screen.y + 3);
        }
      }
    }
    
    ctx.restore(); // Remove clipping
    
    // Draw circle border (subtle)
    ctx.strokeStyle = 'rgba(80, 100, 120, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw cardinal directions around the circle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cardinals = [
      { label: 'N', angle: -90 },
      { label: 'W', angle: 0 },
      { label: 'S', angle: 90 },
      { label: 'E', angle: 180 },
    ];
    
    for (const { label, angle } of cardinals) {
      let dAz = angle - viewAz + 90;
      const rad = (dAz * Math.PI) / 180;
      const labelR = circleRadius + 12;
      const lx = centerX + Math.cos(rad) * labelR;
      const ly = centerY + Math.sin(rad) * labelR;
      ctx.fillText(label, lx, ly);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    
  }, [visibleStars, planets, config, viewAz, viewAlt, fov, canvasSize, skyColor, circleRadius, centerX, centerY,
      constellations, moonPosition, sunPosition, deepSkyPositions, satellitePositions,
      showConstellations, showMoon, showSun, showDeepSky, showSatellites, showHorizon,
      showAltitudeGrid, showAzimuthGrid, lst, observerLatitude, constellationStarIds]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;
    if (Math.sqrt(x * x + y * y) > circleRadius) return; // Outside circle
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, az: viewAz, alt: viewAlt });
  }, [viewAz, viewAlt, centerX, centerY, circleRadius]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const sensitivity = fov / circleRadius;
    
    // Drag direction matches mirrored azimuth (drag left = view moves east)
    let newAz = dragStart.az + dx * sensitivity;
    let newAlt = dragStart.alt + dy * sensitivity;
    
    while (newAz < 0) newAz += 360;
    while (newAz >= 360) newAz -= 360;
    newAlt = Math.max(-90, Math.min(90, newAlt));
    
    setViewAz(newAz);
    setViewAlt(newAlt);
  }, [isDragging, dragStart, fov, circleRadius]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);
  const handleMouseLeave = useCallback(() => setIsDragging(false), []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setFov(prev => Math.max(5, Math.min(120, prev + e.deltaY * 0.05)));
  }, []);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if click is inside circle
    const dx = x - centerX;
    const dy = y - centerY;
    if (Math.sqrt(dx * dx + dy * dy) > circleRadius) return;
    
    // Check objects (Sun, Moon, planets, stars)
    if (showSun && sunPosition && !sunPosition.isBelowHorizon) {
      const screen = altAzToCircular(sunPosition.altitude, sunPosition.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, true);
      if (screen.visible && Math.abs(screen.x - x) < 20 && Math.abs(screen.y - y) < 20) {
        onSunClick?.(sunPosition);
        return;
      }
    }
    
    if (showMoon && moonPosition && !moonPosition.isBelowHorizon) {
      const screen = altAzToCircular(moonPosition.altitude, moonPosition.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, true);
      if (screen.visible && Math.abs(screen.x - x) < 15 && Math.abs(screen.y - y) < 15) {
        onMoonClick?.(moonPosition);
        return;
      }
    }
    
    for (const planet of planets) {
      const pos = raDecToAltAz(planet.ra, planet.dec, lst, observerLatitude);
      const screen = altAzToCircular(pos.altitude, pos.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, false);
      if (screen.visible && Math.abs(screen.x - x) < 12 && Math.abs(screen.y - y) < 12) {
        onPlanetClick?.(planet);
        return;
      }
    }
    
    if (showDeepSky && deepSkyPositions) {
      for (const [, obj] of deepSkyPositions) {
        const screen = altAzToCircular(obj.altitude, obj.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, true);
        if (screen.visible && Math.abs(screen.x - x) < 10 && Math.abs(screen.y - y) < 10) {
          onDeepSkyClick?.(obj);
          return;
        }
      }
    }
    
    for (const star of visibleStars) {
      const pos = raDecToAltAz(star.ra, star.dec, lst, observerLatitude);
      const screen = altAzToCircular(pos.altitude, pos.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY, false);
      const radius = magnitudeToRadius(star.magnitude, fov);
      if (screen.visible && Math.abs(screen.x - x) < radius + 6 && Math.abs(screen.y - y) < radius + 6) {
        onStarClick?.(star);
        return;
      }
    }
    
    // Check constellation name labels
    if (showConstellations && onConstellationClick) {
      for (const constellation of constellations) {
        if (constellation.lines.length > 0 && constellation.lines[0]) {
          const centerPos = raDecToAltAz(constellation.lines[0].star1.ra, constellation.lines[0].star1.dec, lst, observerLatitude);
          const centerScreen = altAzToCircular(centerPos.altitude, centerPos.azimuth, viewAz, viewAlt, fov, circleRadius, centerX, centerY);
          // Check if click is near the constellation name label (approximate text bounds)
          if (centerScreen.visible && Math.abs(centerScreen.x + 8 - x) < 50 && Math.abs(centerScreen.y - 8 - y) < 15) {
            onConstellationClick(constellation);
            return;
          }
        }
      }
    }
  }, [visibleStars, planets, moonPosition, sunPosition, deepSkyPositions, constellations, viewAz, viewAlt, fov, 
      circleRadius, centerX, centerY, lst, observerLatitude, isDragging, showMoon, showSun, showDeepSky, showConstellations,
      onStarClick, onPlanetClick, onMoonClick, onSunClick, onDeepSkyClick, onConstellationClick]);

  return (
    <div ref={containerRef} style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#121212',
      padding: '70px 20px',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Cosmic background - stars layer */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: '#121212',
      }}>
        {/* Static stars pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(1.5px 1.5px at 10% 20%, rgba(230, 230, 230, 0.9), transparent),
            radial-gradient(1px 1px at 40% 60%, rgba(230, 230, 230, 0.85), transparent),
            radial-gradient(1.5px 1.5px at 70% 30%, rgba(230, 230, 230, 0.8), transparent),
            radial-gradient(2px 2px at 25% 80%, rgba(230, 230, 230, 0.85), transparent),
            radial-gradient(1px 1px at 85% 70%, rgba(230, 230, 230, 0.75), transparent),
            radial-gradient(1.5px 1.5px at 55% 15%, rgba(230, 230, 230, 0.9), transparent),
            radial-gradient(1px 1px at 90% 45%, rgba(230, 230, 230, 0.8), transparent),
            radial-gradient(1.2px 1.2px at 15% 55%, rgba(230, 230, 230, 0.7), transparent),
            radial-gradient(1px 1px at 65% 85%, rgba(230, 230, 230, 0.75), transparent),
            radial-gradient(1.5px 1.5px at 35% 40%, rgba(230, 230, 230, 0.8), transparent)
          `,
          opacity: 0.6,
        }} />
        {/* Nebula */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at 15% 15%, rgba(125, 73, 248, 0.35) 0%, transparent 50%),
            radial-gradient(ellipse at 85% 85%, rgba(241, 24, 86, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 75% 20%, rgba(59, 221, 223, 0.25) 0%, transparent 45%),
            radial-gradient(ellipse at 20% 80%, rgba(240, 216, 5, 0.2) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 50%, rgba(125, 73, 248, 0.15) 0%, transparent 55%)
          `,
          filter: 'blur(40px)',
          opacity: 0.7,
        }} />
        
        {/* Animated twinkling stars */}
        {[
          { top: '8%', left: '12%', size: 3, delay: 0, color: '#fff' },
          { top: '15%', left: '78%', size: 2, delay: 0.5, color: '#a78bfa' },
          { top: '22%', left: '45%', size: 2.5, delay: 1, color: '#fff' },
          { top: '35%', left: '88%', size: 2, delay: 1.5, color: '#60a5fa' },
          { top: '42%', left: '8%', size: 3, delay: 2, color: '#f472b6' },
          { top: '55%', left: '32%', size: 2, delay: 0.3, color: '#fff' },
          { top: '62%', left: '72%', size: 2.5, delay: 0.8, color: '#fbbf24' },
          { top: '75%', left: '18%', size: 2, delay: 1.2, color: '#fff' },
          { top: '82%', left: '58%', size: 3, delay: 1.8, color: '#a78bfa' },
          { top: '88%', left: '92%', size: 2, delay: 0.6, color: '#60a5fa' },
          { top: '28%', left: '5%', size: 2, delay: 2.2, color: '#fff' },
          { top: '48%', left: '95%', size: 2.5, delay: 0.9, color: '#f472b6' },
          { top: '68%', left: '42%', size: 2, delay: 1.6, color: '#fff' },
          { top: '12%', left: '55%', size: 2, delay: 2.5, color: '#fbbf24' },
          { top: '92%', left: '25%', size: 2.5, delay: 0.4, color: '#fff' },
        ].map((star, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              background: star.color,
              borderRadius: '50%',
              boxShadow: `0 0 ${star.size * 2}px ${star.size / 2}px ${star.color}40`,
              animation: `twinkle ${2 + Math.random() * 2}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
        
        {/* Shooting stars */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '20%',
          width: 2,
          height: 2,
          background: 'linear-gradient(90deg, white, transparent)',
          animation: 'shootingStar 4s ease-out infinite',
          animationDelay: '1s',
        }} />
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '60%',
          width: 2,
          height: 2,
          background: 'linear-gradient(90deg, white, transparent)',
          animation: 'shootingStar 5s ease-out infinite',
          animationDelay: '3s',
        }} />
        <div style={{
          position: 'absolute',
          top: '70%',
          left: '10%',
          width: 2,
          height: 2,
          background: 'linear-gradient(90deg, white, transparent)',
          animation: 'shootingStar 6s ease-out infinite',
          animationDelay: '5s',
        }} />
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }
        @keyframes shootingStar {
          0% {
            transform: translateX(0) translateY(0);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateX(200px) translateY(200px);
            opacity: 0;
          }
        }
      `}</style>
      <div style={{ position: 'relative', display: 'inline-block', zIndex: 1 }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{ display: 'block', cursor: isDragging ? 'grabbing' : 'grab' }}
        />
        
        {/* Controls overlay - positioned outside the circle at bottom */}
        <div style={{
          position: 'absolute',
          bottom: -35,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
        }}>
          {/* Download button */}
          <button
            onClick={downloadImage}
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.9)',
              padding: '5px 10px',
              borderRadius: '5px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Download as PNG"
          >
            📷 Save
          </button>
          
          {/* View info */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'rgba(255, 255, 255, 0.85)',
            padding: '5px 12px',
            borderRadius: '5px',
            fontSize: '11px',
          }}>
            {getCompassDirection(viewAz)} {Math.round(viewAz)}° | Alt {Math.round(viewAlt)}° | FOV {Math.round(fov)}°
          </div>
          
          {/* Navigation hint */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'rgba(255, 255, 255, 0.5)',
            padding: '5px 8px',
            borderRadius: '5px',
            fontSize: '10px',
          }}>
            Drag • Scroll
          </div>
        </div>
      </div>
    </div>
  );
};

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

export default SkyView2D;
