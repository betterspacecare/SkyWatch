import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import {
  GeographicCoordinates,
  Star,
  Planet,
  createSkyCalculator,
  createPlanetCalculator,
  SkyPositions,
  createHorizonLine,
  HorizonPoint,
  MoonPosition,
  SunPosition,
  Constellation,
  createDeepSkyCatalog,
  DeepSkyPosition,
  createSatelliteTracker,
  SatellitePosition,
  SatelliteTrackerError,
  createMeteorShowerCatalog,
  MeteorShowerPosition,
  calculateLST,
} from '@virtual-window/astronomy-engine';
import { getSunPosition, getMoonPosition, getISSPosition, getVisibleSatellites } from '../src/services/celestial-service';
import { WebGeolocationService, LocationStatus } from '../src/services/geolocation-service';
import { isWebGLAvailable } from '../src/components/SkyView2D';
import { fetchConstellationsWithStars } from '../src/services/astronomy-api';
import { supabase } from '../src/lib/supabase';
import type { User } from '@supabase/supabase-js';

// Dynamic imports for Three.js components (client-side only)
const SkyDome = dynamic(() => import('../src/components/SkyDome'), { ssr: false });
const SkyView2D = dynamic(() => import('../src/components/SkyView2D'), { ssr: false });
const AuthPanel = dynamic(() => import('../src/components/AuthPanel'), { ssr: false });
const ObjectDetailPanel = dynamic(() => import('../src/components/ObjectDetailPanel'), { ssr: false });

interface AppState {
  observer: GeographicCoordinates | null;
  locationStatus: LocationStatus;
  locationName: string | null;
  stars: Star[];
  planets: Planet[];
  fov: number;
  isLoading: boolean;
  error: string | null;
  isRealTime: boolean;
  currentTime: Date;
  useWebGL: boolean;
  viewAzimuth: number;
  viewAltitude: number;
  horizonPoints: HorizonPoint[];
  moonPosition: MoonPosition | null;
  sunPosition: SunPosition | null;
  constellations: Constellation[];
  deepSkyPositions: Map<string, DeepSkyPosition>;
  satellitePositions: Map<string, SatellitePosition | SatelliteTrackerError>;
  meteorShowerRadiants: Map<string, MeteorShowerPosition>;
  // Display toggles
  showConstellations: boolean;
  showDeepSky: boolean;
  showSatellites: boolean;
  showMeteorShowers: boolean;
  showAllDeepSky: boolean; // Show all Messier objects regardless of horizon
  // Zoom level for progressive star loading
  zoomLevel: number; // 1 = default, 2 = 2x zoom, etc.
  maxMagnitude: number; // Maximum star magnitude to display
  // Real-time update tracking
  lastUpdateTime: Date | null;
  isUpdating: boolean;
  // User and UI state
  user: User | null;
  showAuthPanel: boolean;
  selectedObject: {
    type: 'star' | 'planet' | 'messier' | 'constellation' | 'moon' | 'sun' | 'deepsky';
    id: string;
    name: string;
    ra?: number;
    dec?: number;
    magnitude?: number;
    spectralType?: string;
    // Additional fields for specific object types
    illumination?: number;
    phaseName?: string;
    objectType?: string; // For deep sky objects (Galaxy, Nebula, etc.)
    status?: string; // For sun (daylight, twilight, night)
  } | null;
  // Progressive loading state
  loadingProgress: number; // 0-100
  totalStarsToLoad: number;
  // Local Sidereal Time for real-time sky rotation
  lst: number;
}

const initialState: AppState = {
  observer: null,
  locationStatus: 'pending',
  locationName: null,
  stars: [],
  planets: [],
  fov: 60,
  isLoading: true,
  error: null,
  isRealTime: true,
  currentTime: new Date(),
  useWebGL: true,
  viewAzimuth: 180,
  viewAltitude: 45,
  horizonPoints: [],
  moonPosition: null,
  sunPosition: null,
  constellations: [],
  deepSkyPositions: new Map(),
  satellitePositions: new Map(),
  meteorShowerRadiants: new Map(),
  // Display toggles - default on
  showConstellations: true,
  showDeepSky: true,
  showSatellites: true,
  showMeteorShowers: true,
  showAllDeepSky: false, // Only show objects above horizon by default
  // Zoom settings
  zoomLevel: 1,
  maxMagnitude: 6, // Start with bright stars only
  // Real-time update tracking
  lastUpdateTime: null,
  isUpdating: false,
  // User and UI state
  user: null,
  showAuthPanel: false,
  selectedObject: null,
  // Progressive loading state
  loadingProgress: 0,
  totalStarsToLoad: 45000,
  // Local Sidereal Time
  lst: 0,
};

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [mounted, setMounted] = useState(false);
  const [displayTime, setDisplayTime] = useState<Date>(new Date());
  const geolocationRef = useRef<WebGeolocationService | null>(null);
  const skyCalculatorRef = useRef<ReturnType<typeof createSkyCalculator> | null>(null);
  const horizonLineRef = useRef<ReturnType<typeof createHorizonLine> | null>(null);
  const deepSkyCatalogRef = useRef<ReturnType<typeof createDeepSkyCatalog> | null>(null);
  const satelliteTrackerRef = useRef<ReturnType<typeof createSatelliteTracker> | null>(null);
  const meteorShowerCatalogRef = useRef<ReturnType<typeof createMeteorShowerCatalog> | null>(null);
  const initializationRef = useRef<boolean>(false);

  // Fetch location name using reverse geocoding
  const fetchLocationName = useCallback(async (coords: GeographicCoordinates): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=10`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      // Extract city, state, country
      const address = data.address || {};
      const parts = [
        address.city || address.town || address.village || address.county,
        address.state,
        address.country
      ].filter(Boolean);
      
      return parts.length > 0 ? parts.join(', ') : null;
    } catch (error) {
      console.warn('Failed to fetch location name:', error);
      return null;
    }
  }, []);

  // Track last LST update time for throttling
  const lastLstUpdateRef = useRef<number>(0);
  
  // Handle sky position updates - throttle LST updates to reduce re-renders
  const handlePositionsUpdate = useCallback((positions: SkyPositions) => {
    setState(prev => {
      if (!prev.observer) return { ...prev, currentTime: positions.timestamp };

      const time = positions.timestamp;
      const observer = prev.observer;
      const lst = calculateLST(observer.longitude, time);
      
      // Update LST every 1 second for smooth sky rotation
      const now = Date.now();
      const shouldUpdateLst = now - lastLstUpdateRef.current > 1000;
      if (shouldUpdateLst) {
        lastLstUpdateRef.current = now;
      }

      // Calculate moon position using suncalc
      const moonData = getMoonPosition(time, observer.latitude, observer.longitude);
      const moonPosition: MoonPosition = {
        ra: moonData.ra,
        dec: moonData.dec,
        altitude: moonData.altitude,
        azimuth: moonData.azimuth,
        phaseName: moonData.phaseName as any,
        illumination: moonData.illumination,
        magnitude: -12.7 + (1 - moonData.illumination / 100) * 10, // Approximate magnitude
        isBelowHorizon: moonData.isBelowHorizon,
      };

      // Calculate sun position using suncalc
      const sunData = getSunPosition(time, observer.latitude, observer.longitude);
      const sunPosition: SunPosition = {
        ra: sunData.ra,
        dec: sunData.dec,
        altitude: sunData.altitude,
        azimuth: sunData.azimuth,
        status: sunData.status,
        safetyWarning: sunData.safetyWarning,
        isBelowHorizon: sunData.isBelowHorizon,
      };

      // Calculate deep sky positions - convert array to Map
      const deepSkyArray = deepSkyCatalogRef.current?.getVisibleObjects(observer, lst) ?? [];
      const deepSkyPositions = new Map<string, DeepSkyPosition>();
      for (const pos of deepSkyArray) {
        deepSkyPositions.set(pos.object.id, pos);
      }

      // Calculate satellite positions
      const satellitePositions = sunPosition 
        ? satelliteTrackerRef.current?.calculateAll(time, observer, sunPosition) ?? new Map()
        : new Map<string, SatellitePosition | SatelliteTrackerError>();

      // Calculate meteor shower radiants - convert array to Map
      const meteorArray = meteorShowerCatalogRef.current?.getRadiantPositions(time, observer, lst) ?? [];
      const meteorShowerRadiants = new Map<string, MeteorShowerPosition>();
      for (const pos of meteorArray) {
        meteorShowerRadiants.set(pos.shower.id, pos);
      }

      return {
        ...prev,
        currentTime: time,
        lst: shouldUpdateLst ? lst : prev.lst, // Only update LST every 10 seconds
        moonPosition,
        sunPosition,
        deepSkyPositions,
        satellitePositions,
        meteorShowerRadiants,
      };
    });
  }, []);

  // Update display time every second for real-time clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setDisplayTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Real-time satellite tracking - update every 5 seconds for visible movement
  useEffect(() => {
    if (!state.observer || !state.showSatellites) return;
    
    const updateSatellites = async () => {
      try {
        const satellites = await getVisibleSatellites(state.observer!.latitude, state.observer!.longitude);
        
        setState(prev => {
          const newPositions = new Map<string, SatellitePosition | SatelliteTrackerError>();
          
          // Keep any existing positions from the astronomy-engine tracker
          prev.satellitePositions.forEach((pos, id) => {
            if (!id.startsWith('SAT-') && !id.startsWith('ISS')) {
              newPositions.set(id, pos);
            }
          });
          
          // Add satellites from API
          for (const sat of satellites) {
            if (sat.altitude > -10) { // Show satellites slightly below horizon too
              const satPosition: SatellitePosition = {
                id: `SAT-${sat.id}`,
                name: sat.name,
                altitude: sat.altitude,
                azimuth: sat.azimuth,
                isVisible: sat.isVisible,
                isStale: false,
                range: sat.height,
              };
              newPositions.set(sat.name, satPosition);
            }
          }
          
          return { ...prev, satellitePositions: newPositions };
        });
      } catch (error) {
        console.warn('Failed to update satellites:', error);
      }
    };
    
    // Initial fetch
    updateSatellites();
    
    // Update every 5 seconds for smooth movement
    const satelliteInterval = setInterval(updateSatellites, 5000);
    
    return () => clearInterval(satelliteInterval);
  }, [state.observer, state.showSatellites]);

  // Check auth status
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setState(prev => ({ ...prev, user: session?.user ?? null }));
      })
      .catch((error) => {
        // Handle lock errors gracefully
        console.warn('Auth session check failed:', error.message);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({ ...prev, user: session?.user ?? null }));
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize app
  useEffect(() => {
    // Prevent re-initialization
    if (initializationRef.current) {
      return;
    }
    initializationRef.current = true;
    
    setMounted(true);
    
    const init = async () => {
      try {
        // Check WebGL availability
        const webglAvailable = isWebGLAvailable();
        setState(prev => ({ ...prev, useWebGL: webglAvailable }));

        // Initialize geolocation
        geolocationRef.current = new WebGeolocationService({
          onStatusChange: (status) => {
            setState(prev => ({ ...prev, locationStatus: status }));
          },
          onError: (error) => {
            console.warn('Location error:', error.message);
          },
        });

        const coords = await geolocationRef.current.requestLocation();
        setState(prev => ({ ...prev, observer: coords }));

        // Fetch location name
        const locationName = await fetchLocationName(coords);
        setState(prev => ({ ...prev, locationName }));

        // Initialize star catalog - fetch from Supabase with progress
        let stars: Star[];
        let constellations: Constellation[];
        
        try {
          console.log('🌌 Loading stars from Supabase database...');
          const { loadStars } = await import('../src/services/star-loader');
          
          // Load stars from Supabase with progress callback
          stars = await loadStars({ 
            strategy: 'supabase', 
            maxStars: 48000,
            onProgress: (loadedStars, total) => {
              const progress = Math.round((loadedStars.length / total) * 100);
              setState(prev => ({ 
                ...prev, 
                stars: loadedStars,
                loadingProgress: progress,
                totalStarsToLoad: total,
              }));
            }
          });
          
          console.log(`✅ Loaded ${stars.length} stars from Supabase`);
          
          // Load constellations from API
          console.log('🌌 Fetching constellations from Astronomy API...');
          const result = await fetchConstellationsWithStars();
          constellations = result.constellations;
          
          console.log(`✅ Loaded ${constellations.length} constellations from API`);
          console.log(`📊 Total: ${stars.length} stars + ${constellations.length} constellations`);
          
        } catch (error) {
          console.warn('⚠️  Supabase fetch failed, falling back to local JSON:', error);
          // Fallback to local JSON
          const response = await fetch('/data/bright-stars.json');
          const data = await response.json();
          stars = data.stars.map((s: any) => ({
            id: s.id,
            name: s.name,
            ra: s.ra,
            dec: s.dec,
            magnitude: s.mag,
            spectralType: s.spectralType,
          }));
          
          // Try to load constellations
          try {
            const result = await fetchConstellationsWithStars();
            constellations = result.constellations;
          } catch {
            constellations = [];
          }
          
          console.log(`✅ Loaded ${stars.length} stars from local JSON (fallback)`);
        }
        
        // Fetch celestial bodies (sun, moon, planets) from Astronomy API
        let planets: Planet[] = [];
        let moonPosition: MoonPosition | null = null;
        let sunPosition: SunPosition | null = null;
        
        try {
          console.log('🌍 Fetching celestial bodies from Astronomy API...');
          const { fetchBodiesFromAstronomyAPI } = await import('../src/services/astronomy-api');
          const now = new Date();
          const bodies = await fetchBodiesFromAstronomyAPI(coords, now);
          
          // Convert API planets to Planet type
          planets = bodies.planets.map(p => ({
            id: p.name.toLowerCase(),
            name: p.name,
            ra: p.ra,
            dec: p.dec,
            magnitude: p.magnitude,
          }));
          
          // Use suncalc for accurate moon position
          const moonData = getMoonPosition(now, coords.latitude, coords.longitude);
          moonPosition = {
            ra: moonData.ra,
            dec: moonData.dec,
            altitude: moonData.altitude,
            azimuth: moonData.azimuth,
            phaseName: moonData.phaseName as any,
            illumination: moonData.illumination,
            magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
            isBelowHorizon: moonData.isBelowHorizon,
          };
          
          // Use suncalc for accurate sun position
          const sunData = getSunPosition(now, coords.latitude, coords.longitude);
          sunPosition = {
            ra: sunData.ra,
            dec: sunData.dec,
            altitude: sunData.altitude,
            azimuth: sunData.azimuth,
            status: sunData.status,
            safetyWarning: sunData.safetyWarning,
            isBelowHorizon: sunData.isBelowHorizon,
          };
          
          console.log(`✅ Loaded ${planets.length} planets from API`);
          console.log(`🌙 Moon position (suncalc): alt=${moonPosition.altitude.toFixed(1)}°, az=${moonPosition.azimuth.toFixed(1)}°, phase=${moonPosition.phaseName}`);
          console.log(`☀️ Sun position (suncalc): alt=${sunPosition.altitude.toFixed(1)}°, az=${sunPosition.azimuth.toFixed(1)}°, status=${sunPosition.status}`);
        } catch (bodiesError) {
          console.warn('⚠️  Bodies API fetch failed, using suncalc for moon/sun:', bodiesError);
          // Fallback to local calculators for planets
          const planetCalc = createPlanetCalculator();
          planets = planetCalc.calculatePlanetPositions(new Date(), coords);
          
          // Use suncalc for moon and sun (always reliable)
          const now = new Date();
          const moonData = getMoonPosition(now, coords.latitude, coords.longitude);
          moonPosition = {
            ra: moonData.ra,
            dec: moonData.dec,
            altitude: moonData.altitude,
            azimuth: moonData.azimuth,
            phaseName: moonData.phaseName as any,
            illumination: moonData.illumination,
            magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
            isBelowHorizon: moonData.isBelowHorizon,
          };
          
          const sunData = getSunPosition(now, coords.latitude, coords.longitude);
          sunPosition = {
            ra: sunData.ra,
            dec: sunData.dec,
            altitude: sunData.altitude,
            azimuth: sunData.azimuth,
            status: sunData.status,
            safetyWarning: sunData.safetyWarning,
            isBelowHorizon: sunData.isBelowHorizon,
          };
          
          console.log(`🌙 Moon position (suncalc fallback): alt=${moonPosition.altitude.toFixed(1)}°, az=${moonPosition.azimuth.toFixed(1)}°`);
          console.log(`☀️ Sun position (suncalc fallback): alt=${sunPosition.altitude.toFixed(1)}°, az=${sunPosition.azimuth.toFixed(1)}°`);
        }

        // Initialize horizon line
        horizonLineRef.current = createHorizonLine();
        const horizonPoints = horizonLineRef.current.getHorizonPoints();

        // Initialize deep sky catalog
        deepSkyCatalogRef.current = createDeepSkyCatalog();
        // Set magnitude limit to show all Messier objects (brightest is 1.6, faintest is 10.2)
        deepSkyCatalogRef.current.setConfig({ maxMagnitude: 12.0 });

        // Initialize satellite tracker and load ISS
        satelliteTrackerRef.current = createSatelliteTracker();
        await satelliteTrackerRef.current.loadDefaultISS();
        
        // Also fetch ISS from Where The ISS At API as backup
        const issFromApi = await getISSPosition(coords.latitude, coords.longitude);
        if (issFromApi) {
          console.log(`🛰️ ISS from API: alt=${issFromApi.altitude.toFixed(1)}°, az=${issFromApi.azimuth.toFixed(1)}°, height=${issFromApi.height.toFixed(0)}km`);
        }

        // Initialize meteor shower catalog
        meteorShowerCatalogRef.current = createMeteorShowerCatalog();

        // Calculate initial positions
        const now = new Date();
        const lst = calculateLST(coords.longitude, now);
        
        // Convert deep sky array to Map
        const deepSkyArray = deepSkyCatalogRef.current.getVisibleObjects(coords, lst);
        const deepSkyPositions = new Map<string, DeepSkyPosition>();
        let visibleCount = 0;
        for (const pos of deepSkyArray) {
          deepSkyPositions.set(pos.object.id, pos);
          if (pos.isVisible) visibleCount++;
          
          // Debug M42 specifically
          if (pos.object.id === 'M42') {
            console.log('🔍 M42 (Orion Nebula) details:', {
              ra: pos.object.ra,
              dec: pos.object.dec,
              azimuth: pos.azimuth.toFixed(2),
              altitude: pos.altitude.toFixed(2),
              magnitude: pos.object.magnitude,
              isVisible: pos.isVisible,
              isAboveHorizon: pos.altitude >= 0,
            });
          }
        }
        
        console.log(`🌌 Messier objects: ${deepSkyArray.length} total, ${visibleCount} visible above horizon`);
        
        // Calculate satellite positions only if we have sun position
        const satellitePositions = sunPosition 
          ? satelliteTrackerRef.current.calculateAll(now, coords, sunPosition)
          : new Map<string, SatellitePosition | SatelliteTrackerError>();
        
        console.log(`🛰️ Satellites: ${satellitePositions.size} tracked`);
        satellitePositions.forEach((pos, id) => {
          if ('altitude' in pos) {
            console.log(`  - ${id}: alt=${pos.altitude.toFixed(1)}°, az=${pos.azimuth.toFixed(1)}°, visible=${pos.isVisible}`);
          } else {
            console.log(`  - ${id}: error - ${pos.type}`);
          }
        });
        
        // Convert meteor shower array to Map
        const meteorArray = meteorShowerCatalogRef.current.getRadiantPositions(now, coords, lst);
        const meteorShowerRadiants = new Map<string, MeteorShowerPosition>();
        for (const pos of meteorArray) {
          meteorShowerRadiants.set(pos.shower.id, pos);
        }

        setState(prev => ({
          ...prev,
          stars,
          planets,
          horizonPoints,
          moonPosition,
          sunPosition,
          constellations,
          deepSkyPositions,
          satellitePositions,
          meteorShowerRadiants,
          lst, // Set initial LST for real-time sky rotation
        }));

        // Initialize sky calculator
        skyCalculatorRef.current = createSkyCalculator({
          observer: coords,
          onPositionsUpdate: handlePositionsUpdate,
        });
        skyCalculatorRef.current.setStars(stars);
        skyCalculatorRef.current.setPlanets(planets);
        skyCalculatorRef.current.startUpdates();

        // Set initial last update time
        setState(prev => ({ ...prev, lastUpdateTime: new Date() }));
        
        // Set up real-time updates for celestial bodies (every 5 minutes)
        const updateInterval = setInterval(async () => {
          try {
            setState(prev => ({ ...prev, isUpdating: true }));
            console.log('🔄 Updating celestial body positions...');
            const { fetchBodiesFromAstronomyAPI } = await import('../src/services/astronomy-api');
            const now = new Date();
            const bodies = await fetchBodiesFromAstronomyAPI(coords, now);
            
            // Update planets
            const updatedPlanets = bodies.planets.map(p => ({
              id: p.name.toLowerCase(),
              name: p.name,
              ra: p.ra,
              dec: p.dec,
              magnitude: p.magnitude,
            }));
            
            // Update moon using suncalc
            const moonData = getMoonPosition(now, coords.latitude, coords.longitude);
            const updatedMoon: MoonPosition = {
              ra: moonData.ra,
              dec: moonData.dec,
              altitude: moonData.altitude,
              azimuth: moonData.azimuth,
              phaseName: moonData.phaseName as any,
              illumination: moonData.illumination,
              magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
              isBelowHorizon: moonData.isBelowHorizon,
            };
            
            // Update sun using suncalc
            const sunData = getSunPosition(now, coords.latitude, coords.longitude);
            const updatedSun: SunPosition = {
              ra: sunData.ra,
              dec: sunData.dec,
              altitude: sunData.altitude,
              azimuth: sunData.azimuth,
              status: sunData.status,
              safetyWarning: sunData.safetyWarning,
              isBelowHorizon: sunData.isBelowHorizon,
            };
            
            // Fetch ISS position
            const issData = await getISSPosition(coords.latitude, coords.longitude);
            if (issData) {
              console.log(`🛰️ ISS position: alt=${issData.altitude.toFixed(1)}°, az=${issData.azimuth.toFixed(1)}°, visible=${issData.isVisible}`);
            }
            
            setState(prev => ({
              ...prev,
              planets: updatedPlanets,
              moonPosition: updatedMoon,
              sunPosition: updatedSun,
              lastUpdateTime: new Date(),
              isUpdating: false,
            }));
            
            // Update sky calculator
            if (skyCalculatorRef.current) {
              skyCalculatorRef.current.setPlanets(updatedPlanets);
            }
            
            console.log('✅ Celestial body positions updated');
          } catch (error) {
            console.warn('⚠️  Failed to update celestial bodies:', error);
            setState(prev => ({ ...prev, isUpdating: false }));
          }
        }, 5 * 60 * 1000); // Update every 5 minutes

        setState(prev => ({ ...prev, isLoading: false }));
        
        // Return cleanup function
        return () => {
          clearInterval(updateInterval);
        };
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Initialization failed',
        }));
        // Return empty cleanup function on error
        return () => {};
      }
    };

    init();

    return () => {
      skyCalculatorRef.current?.dispose();
    };
  }, [handlePositionsUpdate]);

  // Handle star click
  const handleStarClick = useCallback((star: Star) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'star',
        id: star.id,
        name: star.name || star.id, // Use star ID (e.g., HIP12345) if no name
        ra: star.ra,
        dec: star.dec,
        magnitude: star.magnitude,
        spectralType: star.spectralType,
      },
    }));
  }, []);

  // Handle planet click
  const handlePlanetClick = useCallback((planet: Planet) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'planet',
        id: planet.id,
        name: planet.name,
        ra: planet.ra,
        dec: planet.dec,
        magnitude: planet.magnitude,
      },
    }));
  }, []);

  // Handle deep sky object click
  const handleDeepSkyClick = useCallback((object: DeepSkyPosition) => {
    // For deep sky objects, prefer showing ID (like M42) with name as secondary
    const displayName = object.object.name 
      ? `${object.object.id} - ${object.object.name}`
      : object.object.id;
    
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'deepsky',
        id: object.object.id,
        name: displayName,
        ra: object.object.ra,
        dec: object.object.dec,
        magnitude: object.object.magnitude,
        objectType: object.object.type,
      },
    }));
  }, []);

  // Handle moon click
  const handleMoonClick = useCallback((moon: MoonPosition) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'moon',
        id: 'moon',
        name: 'Moon',
        ra: moon.ra,
        dec: moon.dec,
        magnitude: moon.magnitude,
        illumination: moon.illumination,
        phaseName: moon.phaseName,
      },
    }));
  }, []);

  // Handle sun click
  const handleSunClick = useCallback((sun: SunPosition) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'sun',
        id: 'sun',
        name: 'Sun',
        ra: sun.ra,
        dec: sun.dec,
        status: sun.status,
      },
    }));
  }, []);

  // Toggle real-time mode
  const toggleRealTime = useCallback(() => {
    if (skyCalculatorRef.current) {
      if (state.isRealTime) {
        skyCalculatorRef.current.setTime(new Date());
      } else {
        skyCalculatorRef.current.setRealTime();
      }
      setState(prev => ({ ...prev, isRealTime: !prev.isRealTime }));
    }
  }, [state.isRealTime]);

  // Manual refresh of celestial bodies
  const refreshCelestialBodies = useCallback(async () => {
    if (!state.observer || state.isUpdating) return;
    
    try {
      setState(prev => ({ ...prev, isUpdating: true }));
      console.log('🔄 Manual refresh: Updating celestial body positions...');
      const { fetchBodiesFromAstronomyAPI } = await import('../src/services/astronomy-api');
      const now = new Date();
      const bodies = await fetchBodiesFromAstronomyAPI(state.observer, now);
      
      // Update planets
      const updatedPlanets = bodies.planets.map(p => ({
        id: p.name.toLowerCase(),
        name: p.name,
        ra: p.ra,
        dec: p.dec,
        magnitude: p.magnitude,
      }));
      
      // Update moon using suncalc
      const moonData = getMoonPosition(now, state.observer.latitude, state.observer.longitude);
      const updatedMoon: MoonPosition = {
        ra: moonData.ra,
        dec: moonData.dec,
        altitude: moonData.altitude,
        azimuth: moonData.azimuth,
        phaseName: moonData.phaseName as any,
        illumination: moonData.illumination,
        magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
        isBelowHorizon: moonData.isBelowHorizon,
      };
      
      // Update sun using suncalc
      const sunData = getSunPosition(now, state.observer.latitude, state.observer.longitude);
      const updatedSun: SunPosition = {
        ra: sunData.ra,
        dec: sunData.dec,
        altitude: sunData.altitude,
        azimuth: sunData.azimuth,
        status: sunData.status,
        safetyWarning: sunData.safetyWarning,
        isBelowHorizon: sunData.isBelowHorizon,
      };
      
      // Fetch ISS position
      const issData = await getISSPosition(state.observer.latitude, state.observer.longitude);
      if (issData) {
        console.log(`🛰️ ISS position: alt=${issData.altitude.toFixed(1)}°, az=${issData.azimuth.toFixed(1)}°, visible=${issData.isVisible}`);
      }
      
      setState(prev => ({
        ...prev,
        planets: updatedPlanets,
        moonPosition: updatedMoon,
        sunPosition: updatedSun,
        lastUpdateTime: new Date(),
        isUpdating: false,
      }));
      
      // Update sky calculator
      if (skyCalculatorRef.current) {
        skyCalculatorRef.current.setPlanets(updatedPlanets);
      }
      
      console.log('✅ Manual refresh: Celestial body positions updated');
    } catch (error) {
      console.warn('⚠️  Manual refresh failed:', error);
      setState(prev => ({ ...prev, isUpdating: false }));
    }
  }, [state.observer, state.isUpdating]);

  // Toggle WebGL/2D mode
  const toggleRenderMode = useCallback(() => {
    setState(prev => ({ ...prev, useWebGL: !prev.useWebGL }));
  }, []);

  // Toggle display options
  const toggleConstellations = useCallback(() => {
    setState(prev => ({ ...prev, showConstellations: !prev.showConstellations }));
  }, []);

  const toggleDeepSky = useCallback(() => {
    setState(prev => ({ ...prev, showDeepSky: !prev.showDeepSky }));
  }, []);

  const toggleAllDeepSky = useCallback(() => {
    setState(prev => ({ ...prev, showAllDeepSky: !prev.showAllDeepSky }));
  }, []);

  const toggleSatellites = useCallback(() => {
    setState(prev => ({ ...prev, showSatellites: !prev.showSatellites }));
  }, []);

  const toggleMeteorShowers = useCallback(() => {
    setState(prev => ({ ...prev, showMeteorShowers: !prev.showMeteorShowers }));
  }, []);

  // Zoom controls with progressive star loading from Astronomy API
  const zoomIn = useCallback(async () => {
    const newZoomLevel = Math.min(state.zoomLevel + 0.5, 5); // Max 5x zoom
    const newMaxMagnitude = Math.min(6 + (newZoomLevel - 1) * 2, 12); // Increase magnitude limit as we zoom
    
    console.log(`🔍 Zooming in: level ${newZoomLevel}, magnitude ${newMaxMagnitude}`);
    
    setState(prev => ({ ...prev, zoomLevel: newZoomLevel, maxMagnitude: newMaxMagnitude, isLoading: true }));
    
    // Keep existing stars and add more from Astronomy API
    try {
      // Calculate how many additional stars we need
      const currentStarCount = state.stars.length;
      const targetStarCount = Math.floor(74 + (newZoomLevel - 1) * 200); // Progressive loading
      
      if (currentStarCount >= targetStarCount) {
        console.log(`✅ Already have ${currentStarCount} stars, no need to fetch more`);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      console.log(`📡 Fetching additional stars from Astronomy API (current: ${currentStarCount}, target: ${targetStarCount})...`);
      
      // Fetch more stars from Astronomy API
      const { fetchStars } = await import('../src/services/astronomy-api');
      const additionalStars = await fetchStars({
        maxMagnitude: newMaxMagnitude,
        limit: targetStarCount - currentStarCount,
      });
      
      // Merge with existing stars (avoid duplicates)
      const starMap = new Map<string, Star>();
      state.stars.forEach(star => starMap.set(star.id, star));
      additionalStars.forEach(star => starMap.set(star.id, star));
      
      const mergedStars = Array.from(starMap.values());
      
      setState(prev => ({ ...prev, stars: mergedStars, isLoading: false }));
      console.log(`✅ Now showing ${mergedStars.length} stars (added ${mergedStars.length - currentStarCount} new stars)`);
    } catch (error) {
      console.error('Failed to load more stars:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.zoomLevel, state.stars]);

  const zoomOut = useCallback(async () => {
    const newZoomLevel = Math.max(state.zoomLevel - 0.5, 1); // Min 1x zoom
    const newMaxMagnitude = Math.min(6 + (newZoomLevel - 1) * 2, 12);
    
    console.log(`🔍 Zooming out: level ${newZoomLevel}, magnitude ${newMaxMagnitude}`);
    
    setState(prev => ({ ...prev, zoomLevel: newZoomLevel, maxMagnitude: newMaxMagnitude }));
    
    // Filter existing stars by magnitude (keep constellation stars)
    const filteredStars = state.stars.filter(star => star.magnitude <= newMaxMagnitude);
    setState(prev => ({ ...prev, stars: filteredStars }));
    console.log(`✅ Showing ${filteredStars.length} stars for zoom level ${newZoomLevel}`);
  }, [state.zoomLevel, state.stars]);

  const resetZoom = useCallback(async () => {
    console.log('🔍 Resetting zoom to 1x');
    
    setState(prev => ({ ...prev, zoomLevel: 1, maxMagnitude: 6 }));
    
    // Reset to initial constellation stars only
    const filteredStars = state.stars.filter(star => star.magnitude <= 6);
    setState(prev => ({ ...prev, stars: filteredStars }));
    console.log(`✅ Reset to ${filteredStars.length} stars`);
  }, [state.stars]);

  const skyConfig = {
    fov: state.fov,
    maxMagnitude: state.fov < 45 ? 6.0 : 5.0,
    showLabels: true,
    labelMagnitudeThreshold: 2.0,
  };

  if (!mounted) {
    return null;
  }

  // Show loading screen only during initial load (before isLoading becomes false)
  if (state.isLoading && state.loadingProgress < 100) {
    return (
      <main style={styles.container}>
        <div style={styles.loadingScreen}>
          <div style={styles.loadingLogo}>✨ SkyWatch</div>
          <div style={styles.loadingTitle}>Loading Stars from Database</div>
          <div style={styles.progressContainer}>
            <div style={styles.progressBar}>
              <div 
                style={{
                  ...styles.progressFill,
                  width: `${state.loadingProgress}%`,
                }}
              />
            </div>
            <div style={styles.progressText}>
              {state.loadingProgress}%
            </div>
          </div>
          <div style={styles.loadingHint}>
            {state.loadingProgress < 30 ? 'Connecting to database...' :
             state.loadingProgress < 60 ? 'Loading bright stars...' :
             state.loadingProgress < 90 ? 'Loading faint stars...' :
             'Almost ready...'}
          </div>
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main style={styles.container}>
        <div style={styles.error}>Error: {state.error}</div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>SkyWatch - Virtual Window to the Stars</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            margin: 0;
            padding: 0;
          }
          
          #__next {
            width: 100%;
            height: 100%;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }
          
          button:active:not(:disabled) {
            transform: translateY(0);
          }
        `}</style>
      </Head>
      <main style={styles.container}>
      {/* Sky renderer */}
      <div style={styles.skyContainer}>
        {state.useWebGL ? (
          <SkyDome
            stars={state.stars}
            planets={state.planets}
            config={skyConfig}
            horizonPoints={state.horizonPoints}
            horizonConfig={{ color: '#4a5568', opacity: 0.6 }}
            moonPosition={state.moonPosition}
            sunPosition={state.sunPosition}
            constellations={state.showConstellations ? state.constellations : []}
            constellationConfig={{ enabled: state.showConstellations, showNames: true }}
            deepSkyPositions={state.showDeepSky ? state.deepSkyPositions : new Map()}
            deepSkyConfig={{ enabled: state.showDeepSky, showLabels: true, showAll: state.showAllDeepSky }}
            satellitePositions={state.showSatellites ? state.satellitePositions : new Map()}
            satelliteConfig={{ enabled: state.showSatellites, showLabels: true }}
            meteorShowerRadiants={state.showMeteorShowers ? state.meteorShowerRadiants : new Map()}
            meteorShowerConfig={{ enabled: state.showMeteorShowers, showLabels: true, showInactive: false }}
            lst={state.lst}
            observerLatitude={state.observer?.latitude ?? 0}
            onStarClick={handleStarClick}
            onPlanetClick={handlePlanetClick}
            onDeepSkyClick={handleDeepSkyClick}
            onMoonClick={handleMoonClick}
            onSunClick={handleSunClick}
          />
        ) : (
          <SkyView2D
            stars={state.stars}
            planets={state.planets}
            config={skyConfig}
            viewAzimuth={state.viewAzimuth}
            viewAltitude={state.viewAltitude}
            onStarClick={handleStarClick}
            onPlanetClick={handlePlanetClick}
          />
        )}
      </div>

      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.logo}>SkyWatch</div>
        <div style={styles.topControls}>
          <button 
            onClick={() => setState(prev => ({ ...prev, showAuthPanel: true }))} 
            style={{...styles.iconButton, ...(state.user ? styles.iconButtonActive : {})}} 
            title={state.user ? 'Account' : 'Sign In'}
          >
            {state.user ? '👤' : '🔓'}
          </button>
          <button 
            onClick={refreshCelestialBodies} 
            style={{...styles.iconButton, ...(state.isUpdating ? styles.iconButtonUpdating : {})}} 
            title="Refresh celestial positions"
            disabled={state.isUpdating}
          >
            {state.isUpdating ? '⟳' : '🔄'}
          </button>
          <button onClick={toggleRealTime} style={styles.iconButton} title={state.isRealTime ? 'Pause' : 'Resume'}>
            {state.isRealTime ? '⏸' : '▶'}
          </button>
          <button onClick={toggleRenderMode} style={styles.iconButton} title={state.useWebGL ? '3D Mode' : '2D Mode'}>
            {state.useWebGL ? '🌐' : '📐'}
          </button>
        </div>
      </div>

      {/* Left Sidebar - Layer Controls */}
      <div style={styles.leftSidebar}>
        <div style={styles.sidebarTitle}>Layers</div>
        <button 
          onClick={toggleConstellations} 
          style={{...styles.layerButton, ...(state.showConstellations ? styles.layerButtonActive : {})}}
        >
          <span style={styles.layerIcon}>⭐</span>
          <span style={styles.layerLabel}>Constellations</span>
        </button>
        <button 
          onClick={toggleDeepSky} 
          style={{...styles.layerButton, ...(state.showDeepSky ? styles.layerButtonActive : {})}}
        >
          <span style={styles.layerIcon}>🌀</span>
          <span style={styles.layerLabel}>Deep Sky</span>
        </button>
        {state.showDeepSky && (
          <button 
            onClick={toggleAllDeepSky} 
            style={{...styles.layerSubButton, ...(state.showAllDeepSky ? styles.layerButtonActive : {})}}
          >
            <span style={styles.layerIcon}>🌐</span>
            <span style={styles.layerLabel}>Show All (110)</span>
          </button>
        )}
        <button 
          onClick={toggleSatellites} 
          style={{...styles.layerButton, ...(state.showSatellites ? styles.layerButtonActive : {})}}
        >
          <span style={styles.layerIcon}>🛰️</span>
          <span style={styles.layerLabel}>Satellites</span>
        </button>
        <button 
          onClick={toggleMeteorShowers} 
          style={{...styles.layerButton, ...(state.showMeteorShowers ? styles.layerButtonActive : {})}}
        >
          <span style={styles.layerIcon}>☄️</span>
          <span style={styles.layerLabel}>Meteors</span>
        </button>
      </div>

      {/* Right Sidebar - Zoom Controls */}
      <div style={styles.rightSidebar}>
        <button 
          onClick={zoomIn} 
          style={{...styles.zoomBtn, ...(state.zoomLevel >= 5 ? styles.zoomBtnDisabled : {})}}
          disabled={state.zoomLevel >= 5}
          title="Zoom In"
        >
          +
        </button>
        <div style={styles.zoomIndicator}>
          <div style={styles.zoomLevel}>{state.zoomLevel.toFixed(1)}×</div>
          <div style={styles.zoomMag}>Mag {state.maxMagnitude.toFixed(1)}</div>
        </div>
        <button 
          onClick={zoomOut} 
          style={{...styles.zoomBtn, ...(state.zoomLevel <= 1 ? styles.zoomBtnDisabled : {})}}
          disabled={state.zoomLevel <= 1}
          title="Zoom Out"
        >
          −
        </button>
        <button 
          onClick={resetZoom} 
          style={{...styles.resetBtn, ...(state.zoomLevel === 1 ? styles.zoomBtnDisabled : {})}}
          disabled={state.zoomLevel === 1}
          title="Reset Zoom"
        >
          ↺
        </button>
      </div>

      {/* Bottom Bar - Info */}
      <div style={styles.bottomBar}>
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>Current Time</span>
          <span style={styles.infoValue}>
            {displayTime.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit',
              hour12: false 
            })}
          </span>
          <span style={styles.infoSubValue}>
            {displayTime.toLocaleDateString([], { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </span>
        </div>
        <div style={styles.infoDivider} />
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>Location</span>
          <span style={styles.infoValue}>
            {state.locationName || (state.observer 
              ? `${state.observer.latitude.toFixed(4)}°, ${state.observer.longitude.toFixed(4)}°`
              : 'Unknown')}
          </span>
          <span style={styles.infoSubValue}>
            {state.observer && !state.locationName
              ? `Lat: ${state.observer.latitude.toFixed(4)}°, Lon: ${state.observer.longitude.toFixed(4)}°`
              : state.locationStatus === 'granted' ? '📍 GPS' : state.locationStatus === 'default' ? '🌍 Default' : '⏳ Loading...'}
          </span>
        </div>
        <div style={styles.infoDivider} />
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>Last Update</span>
          <span style={styles.infoValue}>
            {state.lastUpdateTime 
              ? new Date(state.lastUpdateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Never'}
          </span>
          <span style={styles.infoSubValue}>
            {state.isUpdating ? '🔄 Updating...' : '✓ Synced'}
          </span>
        </div>
      </div>

      {/* Loading Overlay */}
      {state.isLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>Loading...</div>
        </div>
      )}

      {/* Update Status Indicator */}
      {state.isUpdating && !state.isLoading && (
        <div style={styles.updateIndicator}>
          <div style={styles.updateSpinner} />
          <span>Updating positions...</span>
        </div>
      )}

      {/* WebGL fallback notice */}
      {!state.useWebGL && (
        <div style={styles.fallbackNotice}>
          2D Mode Active
        </div>
      )}

      {/* Auth Panel */}
      {state.showAuthPanel && (
        <AuthPanel onClose={() => setState(prev => ({ ...prev, showAuthPanel: false }))} />
      )}

      {/* Object Detail Panel */}
      {state.selectedObject && state.observer && (
        <ObjectDetailPanel
          object={state.selectedObject}
          location={state.observer}
          onClose={() => setState(prev => ({ ...prev, selectedObject: null }))}
        />
      )}
    </main>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: 0,
    background: 'linear-gradient(to bottom, #000814 0%, #001d3d 50%, #000814 100%)',
    position: 'fixed',
    top: 0,
    left: 0,
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  skyContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  
  // Loading Screen with Progress Bar
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '24px',
  },
  loadingLogo: {
    fontSize: '48px',
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: '2px',
    marginBottom: '8px',
  },
  loadingTitle: {
    fontSize: '18px',
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: '0.5px',
  },
  progressContainer: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
    borderRadius: '4px',
    transition: 'width 0.3s ease-out',
  },
  progressText: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  loadingHint: {
    fontSize: '13px',
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '8px',
  },
  
  loading: {
    color: '#ffffff',
    fontSize: '18px',
    textAlign: 'center',
    paddingTop: '100px',
    fontWeight: 300,
  },
  error: {
    color: '#ff6b6b',
    fontSize: '16px',
    textAlign: 'center',
    paddingTop: '100px',
    fontWeight: 300,
  },
  
  // Top Bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    background: 'linear-gradient(180deg, rgba(0, 8, 20, 0.95) 0%, rgba(0, 8, 20, 0) 100%)',
    backdropFilter: 'blur(10px)',
    zIndex: 100,
  },
  logo: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: '0.5px',
  },
  topControls: {
    display: 'flex',
    gap: '8px',
  },
  iconButton: {
    width: '40px',
    height: '40px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
  },
  iconButtonUpdating: {
    animation: 'rotate 1s linear infinite',
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  iconButtonActive: {
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
  },
  
  // Left Sidebar - Layers
  leftSidebar: {
    position: 'absolute',
    left: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'rgba(0, 8, 20, 0.85)',
    backdropFilter: 'blur(20px)',
    padding: '16px 12px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    zIndex: 50,
    minWidth: '160px',
  },
  sidebarTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
    paddingLeft: '4px',
  },
  layerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    textAlign: 'left',
  },
  layerSubButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    padding: '8px 12px 8px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    marginLeft: '8px',
  },
  layerButtonActive: {
    background: 'rgba(99, 102, 241, 0.15)',
    color: '#ffffff',
    border: '1px solid rgba(99, 102, 241, 0.3)',
  },
  layerIcon: {
    fontSize: '16px',
    width: '20px',
    textAlign: 'center',
  },
  layerLabel: {
    fontSize: '13px',
    fontWeight: 500,
  },
  
  // Right Sidebar - Zoom
  rightSidebar: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'rgba(0, 8, 20, 0.85)',
    backdropFilter: 'blur(20px)',
    padding: '12px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    zIndex: 50,
  },
  zoomBtn: {
    width: '48px',
    height: '48px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 300,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  zoomBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  resetBtn: {
    width: '48px',
    height: '48px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  zoomIndicator: {
    padding: '12px 8px',
    textAlign: 'center',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  zoomLevel: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '4px',
  },
  zoomMag: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 500,
  },
  
  // Bottom Bar - Info
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '72px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px',
    background: 'linear-gradient(0deg, rgba(0, 8, 20, 0.95) 0%, rgba(0, 8, 20, 0) 100%)',
    backdropFilter: 'blur(10px)',
    zIndex: 100,
    padding: '0 20px',
  },
  infoGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    minWidth: '100px',
    maxWidth: '180px',
  },
  infoLabel: {
    fontSize: '9px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  infoValue: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  infoSubValue: {
    fontSize: '9px',
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.6)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  infoDivider: {
    width: '1px',
    height: '24px',
    background: 'rgba(255, 255, 255, 0.1)',
  },
  
  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 8, 20, 0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    zIndex: 200,
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTop: '3px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  
  // Fallback Notice
  fallbackNotice: {
    position: 'absolute',
    top: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(255, 193, 7, 0.15)',
    border: '1px solid rgba(255, 193, 7, 0.3)',
    color: '#ffc107',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    backdropFilter: 'blur(10px)',
    zIndex: 90,
  },
  
  // Update Status Indicator
  updateIndicator: {
    position: 'absolute',
    top: '70px',
    right: '20px',
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#818cf8',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    backdropFilter: 'blur(10px)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  updateSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(129, 140, 248, 0.2)',
    borderTop: '2px solid #818cf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
