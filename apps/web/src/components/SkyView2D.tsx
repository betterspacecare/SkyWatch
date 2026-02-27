/**
 * SkyView2D Component
 * 2D canvas fallback for browsers without WebGL support
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Star, Planet, SpectralType } from '@virtual-window/astronomy-engine';

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
  onStarClick?: (star: Star) => void;
  onPlanetClick?: (planet: Planet) => void;
}

// Convert RA/Dec to screen position
function celestialToScreen(
  ra: number,
  dec: number,
  viewAz: number,
  viewAlt: number,
  fov: number,
  width: number,
  height: number
): { x: number; y: number } | null {
  // Convert RA to azimuth-like angle (simplified)
  const objAz = (ra / 24) * 360;
  const objAlt = dec;
  
  // Calculate angular distance from view center
  const dAz = objAz - viewAz;
  const dAlt = objAlt - viewAlt;
  
  // Check if within FOV
  const distance = Math.sqrt(dAz * dAz + dAlt * dAlt);
  if (distance > fov / 2) return null;
  
  // Project to screen
  const scale = Math.min(width, height) / fov;
  const x = width / 2 + dAz * scale;
  const y = height / 2 - dAlt * scale;
  
  return { x, y };
}

// Magnitude to radius
function magnitudeToRadius(magnitude: number): number {
  const baseRadius = 3;
  const scaleFactor = Math.pow(2.512, (2 - magnitude) / 2);
  return Math.max(1, baseRadius * scaleFactor);
}

export const SkyView2D: React.FC<SkyView2DProps> = ({
  stars,
  planets,
  config,
  viewAzimuth,
  viewAltitude,
  onStarClick,
  onPlanetClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<Planet | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Filter visible stars
  const visibleStars = useMemo(() => {
    return stars.filter(star => star.magnitude <= config.maxMagnitude);
  }, [stars, config.maxMagnitude]);
  
  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          setCanvasSize({
            width: parent.clientWidth,
            height: parent.clientHeight,
          });
        }
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvasSize;
    
    // Clear canvas
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, width, height);
    
    // Draw stars
    for (const star of visibleStars) {
      const pos = celestialToScreen(
        star.ra, star.dec,
        viewAzimuth, viewAltitude,
        config.fov, width, height
      );
      
      if (!pos) continue;
      
      const radius = magnitudeToRadius(star.magnitude);
      const color = SPECTRAL_COLORS[star.spectralType as SpectralType] || SPECTRAL_COLORS['G'];
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Draw label for bright stars
      if (config.showLabels && star.name && star.magnitude < config.labelMagnitudeThreshold) {
        ctx.fillStyle = 'white';
        ctx.font = '10px sans-serif';
        ctx.fillText(star.name, pos.x + radius + 4, pos.y + 4);
      }
    }
    
    // Draw planets
    for (const planet of planets) {
      const pos = celestialToScreen(
        planet.ra, planet.dec,
        viewAzimuth, viewAltitude,
        config.fov, width, height
      );
      
      if (!pos) continue;
      
      // Draw diamond shape for planets
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - 8);
      ctx.lineTo(pos.x + 6, pos.y);
      ctx.lineTo(pos.x, pos.y + 8);
      ctx.lineTo(pos.x - 6, pos.y);
      ctx.closePath();
      ctx.fillStyle = '#ffdd44';
      ctx.fill();
      
      // Always draw planet label
      ctx.fillStyle = '#ffdd44';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(planet.name, pos.x + 10, pos.y + 4);
    }
  }, [visibleStars, planets, config, viewAzimuth, viewAltitude, canvasSize]);
  
  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { width, height } = canvasSize;
    
    // Check planets first
    for (const planet of planets) {
      const pos = celestialToScreen(
        planet.ra, planet.dec,
        viewAzimuth, viewAltitude,
        config.fov, width, height
      );
      if (pos && Math.abs(pos.x - x) < 15 && Math.abs(pos.y - y) < 15) {
        setSelectedPlanet(planet);
        setSelectedStar(null);
        onPlanetClick?.(planet);
        return;
      }
    }
    
    // Check stars
    for (const star of visibleStars) {
      const pos = celestialToScreen(
        star.ra, star.dec,
        viewAzimuth, viewAltitude,
        config.fov, width, height
      );
      const radius = magnitudeToRadius(star.magnitude);
      if (pos && Math.abs(pos.x - x) < radius + 5 && Math.abs(pos.y - y) < radius + 5) {
        setSelectedStar(star);
        setSelectedPlanet(null);
        onStarClick?.(star);
        return;
      }
    }
  }, [visibleStars, planets, config, viewAzimuth, viewAltitude, canvasSize, onStarClick, onPlanetClick]);
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onClick={handleClick}
        style={{ display: 'block' }}
      />
      
      {/* Info panel */}
      {(selectedStar || selectedPlanet) && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
        }}>
          {selectedStar && (
            <>
              <h3 style={{ margin: '0 0 10px 0' }}>{selectedStar.name || 'Unknown Star'}</h3>
              <p style={{ margin: '5px 0' }}>Magnitude: {selectedStar.magnitude.toFixed(2)}</p>
              <p style={{ margin: '5px 0' }}>RA: {selectedStar.ra.toFixed(4)}h</p>
              <p style={{ margin: '5px 0' }}>Dec: {selectedStar.dec.toFixed(4)}°</p>
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
          <button onClick={() => { setSelectedStar(null); setSelectedPlanet(null); }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
};

// WebGL detection utility
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

export default SkyView2D;
