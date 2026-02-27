import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  GeographicCoordinates,
  Star,
  Planet,
  HorizontalCoordinates,
  createSkyCalculator,
  createDefaultStarCatalog,
  createPlanetCalculator,
  SkyPositions,
} from '@virtual-window/astronomy-engine';
import { SensorManager, DeviceOrientation, SensorError } from './src/sensors/sensor-manager';
import { GeolocationService, LocationStatus } from './src/location/geolocation-service';
import { SkyView, SkyViewConfig } from './src/components/SkyView';

interface AppState {
  observer: GeographicCoordinates | null;
  locationStatus: LocationStatus;
  stars: Star[];
  planets: Planet[];
  starPositions: Map<string, HorizontalCoordinates>;
  planetPositions: Map<string, HorizontalCoordinates>;
  viewCenter: HorizontalCoordinates;
  fov: number;
  isLoading: boolean;
  error: string | null;
  isRealTime: boolean;
  currentTime: Date;
}

const initialState: AppState = {
  observer: null,
  locationStatus: 'pending',
  stars: [],
  planets: [],
  starPositions: new Map(),
  planetPositions: new Map(),
  viewCenter: { azimuth: 180, altitude: 45 },
  fov: 60,
  isLoading: true,
  error: null,
  isRealTime: true,
  currentTime: new Date(),
};

export default function App(): React.JSX.Element {
  const [state, setState] = useState<AppState>(initialState);
  const sensorManagerRef = useRef<SensorManager | null>(null);
  const geolocationRef = useRef<GeolocationService | null>(null);
  const skyCalculatorRef = useRef<ReturnType<typeof createSkyCalculator> | null>(null);

  // Handle sensor errors
  const handleSensorError = useCallback((error: SensorError) => {
    console.warn('Sensor error:', error.message);
    if (error.type === 'permission_denied') {
      Alert.alert('Sensor Permission', error.message);
    }
  }, []);

  // Handle orientation updates from sensors
  const handleOrientationChange = useCallback((orientation: DeviceOrientation) => {
    setState(prev => ({
      ...prev,
      viewCenter: {
        azimuth: orientation.heading,
        altitude: Math.max(-90, Math.min(90, 90 - orientation.pitch)),
      },
    }));
  }, []);

  // Handle sky position updates
  const handlePositionsUpdate = useCallback((positions: SkyPositions) => {
    setState(prev => ({
      ...prev,
      starPositions: positions.starPositions,
      planetPositions: positions.planetPositions,
      currentTime: positions.timestamp,
    }));
  }, []);

  // Initialize app
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize geolocation
        geolocationRef.current = new GeolocationService({
          onStatusChange: (status) => {
            setState(prev => ({ ...prev, locationStatus: status }));
          },
          onError: (error) => {
            console.warn('Location error:', error.message);
          },
        });

        const coords = await geolocationRef.current.requestLocation();
        setState(prev => ({ ...prev, observer: coords }));

        // Initialize star catalog
        const catalog = createDefaultStarCatalog();
        await catalog.initialize();
        const stars = catalog.getStars();
        
        // Initialize planet calculator
        const planetCalc = createPlanetCalculator();
        const planets = planetCalc.calculatePlanetPositions(new Date(), coords);

        setState(prev => ({ ...prev, stars, planets }));

        // Initialize sky calculator
        skyCalculatorRef.current = createSkyCalculator({
          observer: coords,
          onPositionsUpdate: handlePositionsUpdate,
        });
        skyCalculatorRef.current.setStars(stars);
        skyCalculatorRef.current.setPlanets(planets);
        skyCalculatorRef.current.startUpdates();

        // Initialize sensors
        sensorManagerRef.current = new SensorManager({
          filterAlpha: 0.3,
          onError: handleSensorError,
        });
        await sensorManagerRef.current.initialize();
        sensorManagerRef.current.onOrientationChange(handleOrientationChange);
        sensorManagerRef.current.startUpdates(30);

        setState(prev => ({ ...prev, isLoading: false }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Initialization failed',
        }));
      }
    };

    init();

    return () => {
      sensorManagerRef.current?.stopUpdates();
      skyCalculatorRef.current?.dispose();
    };
  }, [handleSensorError, handleOrientationChange, handlePositionsUpdate]);

  // Handle FOV change from pinch gesture
  const handleFovChange = useCallback((newFov: number) => {
    setState(prev => ({ ...prev, fov: newFov }));
  }, []);

  // Handle star press
  const handleStarPress = useCallback((star: Star) => {
    Alert.alert(
      star.name || 'Unknown Star',
      `Magnitude: ${star.magnitude.toFixed(2)}\nRA: ${star.ra.toFixed(4)}h\nDec: ${star.dec.toFixed(4)}°\nType: ${star.spectralType}`
    );
  }, []);

  // Handle planet press
  const handlePlanetPress = useCallback((planet: Planet) => {
    Alert.alert(
      planet.name,
      `Magnitude: ${planet.magnitude.toFixed(2)}\nRA: ${planet.ra.toFixed(4)}h\nDec: ${planet.dec.toFixed(4)}°`
    );
  }, []);

  // Toggle real-time mode
  const toggleRealTime = useCallback(() => {
    if (skyCalculatorRef.current) {
      if (state.isRealTime) {
        // Switch to manual time (current time frozen)
        skyCalculatorRef.current.setTime(new Date());
      } else {
        skyCalculatorRef.current.setRealTime();
      }
      setState(prev => ({ ...prev, isRealTime: !prev.isRealTime }));
    }
  }, [state.isRealTime]);

  const skyViewConfig: SkyViewConfig = {
    fov: state.fov,
    maxMagnitude: state.fov < 45 ? 6.0 : 5.0,
    showLabels: true,
    labelMagnitudeThreshold: 2.0,
  };

  if (state.isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading Virtual Window...</Text>
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {state.error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SkyView
        stars={state.stars}
        planets={state.planets}
        starPositions={state.starPositions}
        planetPositions={state.planetPositions}
        viewCenter={state.viewCenter}
        config={skyViewConfig}
        onStarPress={handleStarPress}
        onPlanetPress={handlePlanetPress}
        onFovChange={handleFovChange}
      />
      
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          FOV: {state.fov.toFixed(0)}° | {state.locationStatus}
        </Text>
        <TouchableOpacity onPress={toggleRealTime} style={styles.timeButton}>
          <Text style={styles.timeButtonText}>
            {state.isRealTime ? '⏱ Live' : '⏸ Paused'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Time display */}
      <View style={styles.timeDisplay}>
        <Text style={styles.timeText}>
          {state.currentTime.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000011',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  errorText: {
    color: '#ff6666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
    padding: 20,
  },
  statusBar: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  statusText: {
    color: '#888888',
    fontSize: 12,
  },
  timeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  timeButtonText: {
    color: '#ffffff',
    fontSize: 12,
  },
  timeDisplay: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  timeText: {
    color: '#888888',
    fontSize: 14,
  },
});
