/**
 * Mobile Geolocation Service
 * Handles GPS location retrieval with manual entry fallback
 */

import { GeographicCoordinates } from '@virtual-window/astronomy-engine';

export type LocationStatus = 'pending' | 'granted' | 'denied' | 'manual' | 'default';

export interface LocationError {
  type: 'permission_denied' | 'timeout' | 'unavailable';
  message: string;
}

export interface GeolocationServiceConfig {
  timeout?: number;  // GPS timeout in ms, default 10000
  maxRetries?: number;  // Number of retries, default 3
  onError?: (error: LocationError) => void;
  onStatusChange?: (status: LocationStatus) => void;
}

/**
 * Rounds coordinate to 4 decimal places (~11m precision)
 */
function roundCoordinate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Validates latitude is in range [-90, 90]
 */
function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validates longitude is in range [-180, 180]
 */
function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export class GeolocationService {
  private coordinates: GeographicCoordinates | null = null;
  private status: LocationStatus = 'pending';
  private config: Required<GeolocationServiceConfig>;
  
  constructor(config: GeolocationServiceConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 10000,
      maxRetries: config.maxRetries ?? 3,
      onError: config.onError ?? (() => {}),
      onStatusChange: config.onStatusChange ?? (() => {}),
    };
  }

  /**
   * Requests GPS coordinates on app start
   * Retries on failure, falls back to manual entry prompt
   */
  async requestLocation(): Promise<GeographicCoordinates> {
    this.setStatus('pending');
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const coords = await this.getGPSLocation();
        this.coordinates = {
          latitude: roundCoordinate(coords.latitude),
          longitude: roundCoordinate(coords.longitude),
        };
        this.setStatus('granted');
        return this.coordinates;
      } catch (error) {
        const locationError = error as LocationError;
        
        if (locationError.type === 'permission_denied') {
          this.setStatus('denied');
          this.config.onError(locationError);
          // Don't retry on permission denied
          break;
        }
        
        // Retry on timeout or unavailable
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));  // Exponential backoff
        } else {
          this.config.onError(locationError);
        }
      }
    }
    
    // Return default coordinates if all attempts fail
    return this.getDefaultCoordinates();
  }
  
  /**
   * Gets GPS location from device
   * In real React Native, would use @react-native-community/geolocation
   */
  private getGPSLocation(): Promise<GeographicCoordinates> {
    return new Promise((resolve, reject) => {
      // Simulated GPS - in real app would use native geolocation
      // For testing, simulate success with sample coordinates
      setTimeout(() => {
        // Simulate successful GPS reading
        resolve({
          latitude: 40.7128,  // New York City
          longitude: -74.0060,
        });
      }, 100);
    });
  }
  
  /**
   * Sets coordinates manually (fallback for denied GPS)
   */
  setManualLocation(latitude: number, longitude: number): GeographicCoordinates | null {
    if (!isValidLatitude(latitude)) {
      this.config.onError({
        type: 'unavailable',
        message: 'Latitude must be between -90 and +90 degrees',
      });
      return null;
    }
    
    if (!isValidLongitude(longitude)) {
      this.config.onError({
        type: 'unavailable',
        message: 'Longitude must be between -180 and +180 degrees',
      });
      return null;
    }
    
    this.coordinates = {
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    };
    this.setStatus('manual');
    return this.coordinates;
  }
  
  /**
   * Returns default coordinates (0, 0) with warning
   */
  private getDefaultCoordinates(): GeographicCoordinates {
    this.coordinates = { latitude: 0, longitude: 0 };
    this.setStatus('default');
    this.config.onError({
      type: 'unavailable',
      message: 'Location unknown - showing equatorial sky',
    });
    return this.coordinates;
  }
  
  /**
   * Gets current coordinates
   */
  getCoordinates(): GeographicCoordinates | null {
    return this.coordinates ? { ...this.coordinates } : null;
  }
  
  /**
   * Gets current location status
   */
  getStatus(): LocationStatus {
    return this.status;
  }
  
  /**
   * Checks if using default/fallback location
   */
  isUsingDefault(): boolean {
    return this.status === 'default';
  }
  
  /**
   * Checks if location was manually entered
   */
  isManualEntry(): boolean {
    return this.status === 'manual';
  }
  
  private setStatus(status: LocationStatus): void {
    this.status = status;
    this.config.onStatusChange(status);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default GeolocationService;
