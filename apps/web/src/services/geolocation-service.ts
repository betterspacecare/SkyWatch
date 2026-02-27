/**
 * Web Geolocation Service
 * Uses browser geolocation API with manual entry fallback
 */

import { GeographicCoordinates } from '@virtual-window/astronomy-engine';

export type LocationStatus = 'pending' | 'granted' | 'denied' | 'manual' | 'default';

export interface LocationError {
  type: 'permission_denied' | 'timeout' | 'unavailable';
  message: string;
}

export interface GeolocationServiceConfig {
  timeout?: number;
  onError?: (error: LocationError) => void;
  onStatusChange?: (status: LocationStatus) => void;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export class WebGeolocationService {
  private coordinates: GeographicCoordinates | null = null;
  private status: LocationStatus = 'pending';
  private config: Required<GeolocationServiceConfig>;
  
  constructor(config: GeolocationServiceConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 10000,
      onError: config.onError ?? (() => {}),
      onStatusChange: config.onStatusChange ?? (() => {}),
    };
  }
  
  async requestLocation(): Promise<GeographicCoordinates> {
    this.setStatus('pending');
    
    if (!navigator.geolocation) {
      this.config.onError({
        type: 'unavailable',
        message: 'Geolocation is not supported by this browser',
      });
      return this.getDefaultCoordinates();
    }
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.coordinates = {
            latitude: roundCoordinate(position.coords.latitude),
            longitude: roundCoordinate(position.coords.longitude),
          };
          this.setStatus('granted');
          resolve(this.coordinates);
        },
        (error) => {
          let errorType: LocationError['type'] = 'unavailable';
          let message = 'Unable to determine location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorType = 'permission_denied';
              message = 'Location permission denied';
              this.setStatus('denied');
              break;
            case error.POSITION_UNAVAILABLE:
              errorType = 'unavailable';
              message = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorType = 'timeout';
              message = 'Location request timed out';
              break;
          }
          
          this.config.onError({ type: errorType, message });
          resolve(this.getDefaultCoordinates());
        },
        {
          enableHighAccuracy: true,
          timeout: this.config.timeout,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }
  
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
  
  private getDefaultCoordinates(): GeographicCoordinates {
    this.coordinates = { latitude: 0, longitude: 0 };
    this.setStatus('default');
    return this.coordinates;
  }
  
  getCoordinates(): GeographicCoordinates | null {
    return this.coordinates ? { ...this.coordinates } : null;
  }
  
  getStatus(): LocationStatus {
    return this.status;
  }
  
  isUsingDefault(): boolean {
    return this.status === 'default';
  }
  
  private setStatus(status: LocationStatus): void {
    this.status = status;
    this.config.onStatusChange(status);
  }
}

export default WebGeolocationService;
