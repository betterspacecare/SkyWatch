/**
 * Sky Calculator
 * Integrates time control with astronomy calculations
 * Recalculates celestial positions when time changes
 */

import { GeographicCoordinates, HorizontalCoordinates, Star, Planet } from './index';
import { calculateLST } from './lst-calculator';
import { celestialToHorizontal } from './coordinate-converter';
import { createTimeController, TimeController } from './time-controller';
import { createHorizonLine, HorizonLine, HorizonPoint } from './horizon-line';
import { createMoonCalculator, MoonCalculator, MoonPosition } from './moon-calculator';
import { createSunCalculator, SunCalculator, SunPosition } from './sun-calculator';
import { createConstellationRenderer, ConstellationRenderer, ConstellationLineSegment } from './constellation-renderer';
import { createDeepSkyCatalog, DeepSkyCatalog, DeepSkyPosition } from './deep-sky-catalog';
import { createSatelliteTracker, SatelliteTracker, SatellitePosition, SatelliteTrackerError } from './satellite-tracker';
import { createMeteorShowerCatalog, MeteorShowerCatalog, MeteorShowerPosition } from './meteor-shower-catalog';

export interface SkyCalculatorConfig {
  observer: GeographicCoordinates;
  onPositionsUpdate?: (positions: SkyPositions) => void;
}

export interface SkyPositions {
  // Existing fields
  starPositions: Map<string, HorizontalCoordinates>;
  planetPositions: Map<string, HorizontalCoordinates>;
  lst: number;
  timestamp: Date;
  
  // New fields
  horizonPoints: HorizonPoint[];
  moonPosition: MoonPosition | null;
  sunPosition: SunPosition | null;
  deepSkyPositions: Map<string, DeepSkyPosition>;
  satellitePositions: Map<string, SatellitePosition | SatelliteTrackerError>;
  meteorShowerRadiants: Map<string, MeteorShowerPosition>;
  constellationLines: ConstellationLineSegment[];
}

export class SkyCalculator {
  private observer: GeographicCoordinates;
  private timeController: TimeController;
  private stars: Star[] = [];
  private planets: Planet[] = [];
  private onPositionsUpdate: ((positions: SkyPositions) => void) | undefined;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private lastPositions: SkyPositions | null = null;
  
  // New module instances
  private horizonLine: HorizonLine;
  private moonCalculator: MoonCalculator;
  private sunCalculator: SunCalculator;
  private constellationRenderer: ConstellationRenderer;
  private deepSkyCatalog: DeepSkyCatalog;
  private satelliteTracker: SatelliteTracker;
  private meteorShowerCatalog: MeteorShowerCatalog;
  
  constructor(config: SkyCalculatorConfig) {
    this.observer = config.observer;
    this.onPositionsUpdate = config.onPositionsUpdate;
    this.timeController = createTimeController();
    
    // Initialize all new calculator modules
    this.horizonLine = createHorizonLine();
    this.moonCalculator = createMoonCalculator();
    this.sunCalculator = createSunCalculator();
    this.constellationRenderer = createConstellationRenderer();
    this.deepSkyCatalog = createDeepSkyCatalog();
    this.satelliteTracker = createSatelliteTracker();
    this.meteorShowerCatalog = createMeteorShowerCatalog();
  }
  
  /**
   * Sets the star catalog
   */
  setStars(stars: Star[]): void {
    this.stars = stars;
    this.recalculate();
  }
  
  /**
   * Sets the planet list
   */
  setPlanets(planets: Planet[]): void {
    this.planets = planets;
    this.recalculate();
  }
  
  /**
   * Updates observer location
   */
  setObserver(observer: GeographicCoordinates): void {
    this.observer = observer;
    this.recalculate();
  }
  
  /**
   * Sets a specific time for calculations
   */
  setTime(time: Date): void {
    this.timeController.setTime(time);
    this.recalculate();
  }
  
  /**
   * Returns to real-time mode
   */
  setRealTime(): void {
    this.timeController.setRealTime();
    this.recalculate();
  }
  
  /**
   * Gets current time controller state
   */
  isRealTime(): boolean {
    return this.timeController.isRealTime();
  }
  
  /**
   * Gets current time
   */
  getCurrentTime(): Date {
    return this.timeController.getCurrentTime();
  }

  /**
   * Starts automatic LST updates (at least once per second)
   */
  startUpdates(): void {
    if (this.updateInterval) return;
    
    // Update LST at least once per second
    this.updateInterval = setInterval(() => {
      if (this.timeController.isRealTime()) {
        this.recalculate();
      }
    }, 1000);
    
    // Initial calculation
    this.recalculate();
  }
  
  /**
   * Stops automatic updates
   */
  stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Recalculates all celestial positions
   * Should complete within 100ms
   */
  recalculate(): SkyPositions {
    const startTime = performance.now();
    
    const timestamp = this.timeController.getCurrentTime();
    const lst = calculateLST(this.observer.longitude, timestamp);
    
    const starPositions = new Map<string, HorizontalCoordinates>();
    const planetPositions = new Map<string, HorizontalCoordinates>();
    
    // Calculate star positions
    for (const star of this.stars) {
      const horizontal = celestialToHorizontal(
        { ra: star.ra, dec: star.dec },
        this.observer,
        lst
      );
      starPositions.set(star.id, horizontal);
    }
    
    // Calculate planet positions
    for (const planet of this.planets) {
      const horizontal = celestialToHorizontal(
        { ra: planet.ra, dec: planet.dec },
        this.observer,
        lst
      );
      planetPositions.set(planet.id, horizontal);
    }
    
    // Get horizon points
    const horizonPoints = this.horizonLine.getHorizonPoints();
    
    // Calculate moon position
    const moonPosition = this.moonCalculator.calculate(timestamp, this.observer, lst);
    
    // Calculate sun position (needed for satellite visibility)
    const sunPosition = this.sunCalculator.calculate(timestamp, this.observer, lst);
    
    // Get constellation lines
    const constellationLines = this.constellationRenderer.getVisibleLines(this.observer, lst);
    
    // Get visible deep sky objects and convert to Map
    const deepSkyArray = this.deepSkyCatalog.getVisibleObjects(this.observer, lst);
    const deepSkyPositions = new Map<string, DeepSkyPosition>();
    for (const dso of deepSkyArray) {
      deepSkyPositions.set(dso.object.id, dso);
    }
    
    // Calculate satellite positions (pass sunPosition for visibility)
    const satellitePositions = this.satelliteTracker.calculateAll(timestamp, this.observer, sunPosition);
    
    // Get meteor shower radiant positions and convert to Map
    const meteorShowerArray = this.meteorShowerCatalog.getRadiantPositions(timestamp, this.observer, lst);
    const meteorShowerRadiants = new Map<string, MeteorShowerPosition>();
    for (const shower of meteorShowerArray) {
      meteorShowerRadiants.set(shower.shower.id, shower);
    }
    
    const positions: SkyPositions = {
      starPositions,
      planetPositions,
      lst,
      timestamp,
      horizonPoints,
      moonPosition,
      sunPosition,
      deepSkyPositions,
      satellitePositions,
      meteorShowerRadiants,
      constellationLines,
    };
    
    this.lastPositions = positions;
    
    const elapsed = performance.now() - startTime;
    if (elapsed > 100) {
      console.warn(`Sky calculation took ${elapsed.toFixed(1)}ms (target: <100ms)`);
    }
    
    // Notify listeners
    if (this.onPositionsUpdate) {
      this.onPositionsUpdate(positions);
    }
    
    return positions;
  }
  
  /**
   * Gets the last calculated positions
   */
  getLastPositions(): SkyPositions | null {
    return this.lastPositions;
  }
  
  /**
   * Gets the time controller for external use
   */
  getTimeController(): TimeController {
    return this.timeController;
  }
  
  /**
   * Cleanup
   */
  dispose(): void {
    this.stopUpdates();
  }
}

/**
 * Creates a new SkyCalculator instance
 */
export function createSkyCalculator(config: SkyCalculatorConfig): SkyCalculator {
  return new SkyCalculator(config);
}

export default SkyCalculator;
