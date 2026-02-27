/**
 * Sensor Manager for React Native
 * Manages device sensors (magnetometer, accelerometer, gyroscope) for orientation tracking
 */

import { LowPassFilter, Vector3D } from './low-pass-filter';

export interface DeviceOrientation {
  heading: number;  // Yaw: 0-360 degrees
  pitch: number;    // -90 to +90 degrees
  roll: number;     // -180 to +180 degrees
}

export type SensorState = 'available' | 'unavailable' | 'denied';

export interface SensorStatus {
  magnetometer: SensorState;
  accelerometer: SensorState;
  gyroscope: SensorState;
}

export interface SensorError {
  type: 'permission_denied' | 'sensor_unavailable' | 'initialization_failed';
  sensor?: 'magnetometer' | 'accelerometer' | 'gyroscope';
  message: string;
}

export interface SensorManagerConfig {
  filterAlpha?: number;  // Default 0.3, constrained to [0.1, 0.5]
  onError?: (error: SensorError) => void;
}

type OrientationCallback = (orientation: DeviceOrientation) => void;
type ErrorCallback = (error: SensorError) => void;

/**
 * Manages device sensors for orientation tracking
 * Uses low-pass filtering to smooth sensor data
 */
export class SensorManager {
  private magnetometerFilter: LowPassFilter;
  private accelerometerFilter: LowPassFilter;
  private gyroscopeFilter: LowPassFilter;
  
  private status: SensorStatus = {
    magnetometer: 'unavailable',
    accelerometer: 'unavailable',
    gyroscope: 'unavailable',
  };
  
  private listeners: Set<OrientationCallback> = new Set();
  private errorCallback: ErrorCallback | null = null;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  
  // Simulated sensor data (in real RN app, would come from native modules)
  private lastMagnetometer: Vector3D = { x: 0, y: 0, z: 0 };
  private lastAccelerometer: Vector3D = { x: 0, y: 0, z: -9.8 };
  private lastGyroscope: Vector3D = { x: 0, y: 0, z: 0 };
  private lastValidOrientation: DeviceOrientation | null = null;
  
  constructor(config: SensorManagerConfig = {}) {
    const alpha = this.constrainAlpha(config.filterAlpha ?? 0.3);
    this.magnetometerFilter = new LowPassFilter(alpha);
    this.accelerometerFilter = new LowPassFilter(alpha);
    this.gyroscopeFilter = new LowPassFilter(alpha);
    this.errorCallback = config.onError ?? null;
  }
  
  /**
   * Constrains alpha to valid range [0.1, 0.5] for Sensor_Manager
   */
  private constrainAlpha(alpha: number): number {
    return Math.max(0.1, Math.min(0.5, alpha));
  }
  
  /**
   * Initializes sensors and requests permissions
   * In a real React Native app, this would use native sensor APIs
   */
  async initialize(): Promise<SensorStatus> {
    // In a real implementation, this would:
    // 1. Check if sensors are available on device
    // 2. Request permissions if needed
    // 3. Return actual sensor status
    
    // For now, simulate available sensors
    this.status = {
      magnetometer: 'available',
      accelerometer: 'available',
      gyroscope: 'available',
    };
    
    // Check for any denied or unavailable sensors and notify
    this.checkSensorStatus();
    
    return this.status;
  }
  
  /**
   * Checks sensor status and emits appropriate errors
   */
  private checkSensorStatus(): void {
    const sensors: Array<'magnetometer' | 'accelerometer' | 'gyroscope'> = 
      ['magnetometer', 'accelerometer', 'gyroscope'];
    
    for (const sensor of sensors) {
      if (this.status[sensor] === 'denied') {
        this.emitError({
          type: 'permission_denied',
          sensor,
          message: `Permission denied for ${sensor}. Please enable in device settings.`,
        });
      } else if (this.status[sensor] === 'unavailable') {
        this.emitError({
          type: 'sensor_unavailable',
          sensor,
          message: `${sensor} is not available on this device.`,
        });
      }
    }
    
    // Special handling for magnetometer unavailable
    if (this.status.magnetometer === 'unavailable' || 
        this.status.magnetometer === 'denied') {
      this.emitError({
        type: 'sensor_unavailable',
        sensor: 'magnetometer',
        message: 'Compass unavailable - heading may drift',
      });
    }
    
    // Check if all sensors are unavailable
    if (sensors.every(s => this.status[s] !== 'available')) {
      this.emitError({
        type: 'initialization_failed',
        message: 'All sensors unavailable - using manual navigation',
      });
    }
  }
  
  /**
   * Emits an error to the error callback
   */
  private emitError(error: SensorError): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }
  
  /**
   * Sets the error callback
   */
  setErrorCallback(callback: ErrorCallback | null): void {
    this.errorCallback = callback;
  }
  
  /**
   * Simulates permission denial for testing
   */
  simulatePermissionDenied(sensor: 'magnetometer' | 'accelerometer' | 'gyroscope'): void {
    this.status[sensor] = 'denied';
    this.emitError({
      type: 'permission_denied',
      sensor,
      message: `Permission denied for ${sensor}. Please enable in device settings.`,
    });
  }
  
  /**
   * Simulates sensor unavailability for testing
   */
  simulateSensorUnavailable(sensor: 'magnetometer' | 'accelerometer' | 'gyroscope'): void {
    this.status[sensor] = 'unavailable';
    this.emitError({
      type: 'sensor_unavailable',
      sensor,
      message: `${sensor} is not available on this device.`,
    });
  }

  /**
   * Starts sensor updates at specified rate
   * @param updateRateHz - Update frequency (minimum 30Hz)
   */
  startUpdates(updateRateHz: number = 30): void {
    if (this.isRunning) return;
    
    const hz = Math.max(30, updateRateHz);
    const intervalMs = Math.floor(1000 / hz);
    
    this.isRunning = true;
    this.updateInterval = setInterval(() => {
      this.processSensorData();
    }, intervalMs);
  }
  
  /**
   * Stops sensor updates
   */
  stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
  }
  
  /**
   * Subscribes to filtered orientation updates
   * @returns Unsubscribe function
   */
  onOrientationChange(callback: OrientationCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  /**
   * Sets low-pass filter smoothing factor
   * Constrained to [0.1, 0.5] range
   */
  setFilterAlpha(alpha: number): void {
    const constrainedAlpha = this.constrainAlpha(alpha);
    this.magnetometerFilter.setAlpha(constrainedAlpha);
    this.accelerometerFilter.setAlpha(constrainedAlpha);
    this.gyroscopeFilter.setAlpha(constrainedAlpha);
  }
  
  /**
   * Gets current sensor status
   */
  getStatus(): SensorStatus {
    return { ...this.status };
  }
  
  /**
   * Gets current filter alpha value
   */
  getFilterAlpha(): number {
    return this.magnetometerFilter.getAlpha();
  }
  
  /**
   * Updates raw sensor data (called by native sensor callbacks in real app)
   */
  updateSensorData(
    magnetometer?: Vector3D,
    accelerometer?: Vector3D,
    gyroscope?: Vector3D
  ): void {
    if (magnetometer) this.lastMagnetometer = magnetometer;
    if (accelerometer) this.lastAccelerometer = accelerometer;
    if (gyroscope) this.lastGyroscope = gyroscope;
  }
  
  /**
   * Processes sensor data and computes orientation
   */
  private processSensorData(): void {
    // Check for invalid sensor data (NaN values)
    if (this.hasInvalidData(this.lastMagnetometer) ||
        this.hasInvalidData(this.lastAccelerometer)) {
      // Skip frame, use last valid reading if available
      if (this.lastValidOrientation) {
        this.listeners.forEach(callback => callback(this.lastValidOrientation!));
      }
      return;
    }
    
    // Apply low-pass filtering
    const filteredMag = this.magnetometerFilter.filter(this.lastMagnetometer);
    const filteredAcc = this.accelerometerFilter.filter(this.lastAccelerometer);
    // Gyroscope filtered but not used directly in orientation calculation
    this.gyroscopeFilter.filter(this.lastGyroscope);
    
    // Compute orientation from filtered sensor data
    const orientation = this.computeOrientation(filteredMag, filteredAcc);
    
    // Validate computed orientation
    if (this.isValidOrientation(orientation)) {
      this.lastValidOrientation = orientation;
      // Notify listeners
      this.listeners.forEach(callback => callback(orientation));
    } else if (this.lastValidOrientation) {
      // Use last valid orientation on computation error
      this.listeners.forEach(callback => callback(this.lastValidOrientation!));
    }
  }
  
  /**
   * Checks if vector contains invalid (NaN or Infinity) values
   */
  private hasInvalidData(v: Vector3D): boolean {
    return !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z);
  }
  
  /**
   * Validates computed orientation values
   */
  private isValidOrientation(o: DeviceOrientation): boolean {
    return Number.isFinite(o.heading) && 
           Number.isFinite(o.pitch) && 
           Number.isFinite(o.roll);
  }
  
  /**
   * Computes device orientation from magnetometer and accelerometer data
   * Uses tilt-compensated compass algorithm
   */
  private computeOrientation(mag: Vector3D, acc: Vector3D): DeviceOrientation {
    // Normalize accelerometer
    const accNorm = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const ax = acc.x / accNorm;
    const ay = acc.y / accNorm;
    const az = acc.z / accNorm;
    
    // Calculate pitch and roll from accelerometer
    // Pitch: rotation around X axis (-90 to +90)
    const pitch = Math.asin(-ax) * (180 / Math.PI);
    
    // Roll: rotation around Y axis (-180 to +180)
    const roll = Math.atan2(ay, az) * (180 / Math.PI);
    
    // Tilt-compensated heading from magnetometer
    const pitchRad = pitch * (Math.PI / 180);
    const rollRad = roll * (Math.PI / 180);
    
    // Compensate magnetometer readings for tilt
    const magX = mag.x * Math.cos(pitchRad) + 
                 mag.z * Math.sin(pitchRad);
    const magY = mag.x * Math.sin(rollRad) * Math.sin(pitchRad) +
                 mag.y * Math.cos(rollRad) -
                 mag.z * Math.sin(rollRad) * Math.cos(pitchRad);
    
    // Calculate heading (yaw)
    let heading = Math.atan2(-magY, magX) * (180 / Math.PI);
    
    // Normalize heading to [0, 360)
    if (heading < 0) heading += 360;
    if (heading >= 360) heading -= 360;
    
    return {
      heading: this.clampHeading(heading),
      pitch: this.clampPitch(pitch),
      roll: this.clampRoll(roll),
    };
  }
  
  /**
   * Clamps heading to [0, 360)
   */
  private clampHeading(heading: number): number {
    let h = heading % 360;
    if (h < 0) h += 360;
    return h;
  }
  
  /**
   * Clamps pitch to [-90, 90]
   */
  private clampPitch(pitch: number): number {
    return Math.max(-90, Math.min(90, pitch));
  }
  
  /**
   * Clamps roll to [-180, 180]
   */
  private clampRoll(roll: number): number {
    let r = roll;
    while (r > 180) r -= 360;
    while (r < -180) r += 360;
    return r;
  }
}

export default SensorManager;
