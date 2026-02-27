/**
 * Low-Pass Filter for Sensor Data
 *
 * Implements an exponential moving average (EMA) algorithm to smooth
 * sensor readings and reduce UI jitter. Processes 3-axis sensor data
 * (x, y, z) independently.
 *
 * EMA Formula: output[n] = alpha * input[n] + (1 - alpha) * output[n-1]
 *
 * @module Low_Pass_Filter
 * @requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

/**
 * Represents a 3D vector for sensor data (x, y, z axes).
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Minimum alpha value for the Sensor_Manager (more smoothing, more delay).
 */
export const SENSOR_MANAGER_ALPHA_MIN = 0.1;

/**
 * Maximum alpha value for the Sensor_Manager (less smoothing, more responsive).
 */
export const SENSOR_MANAGER_ALPHA_MAX = 0.5;

/**
 * Low-Pass Filter using Exponential Moving Average algorithm.
 *
 * The filter smooths sensor readings to reduce noise and jitter:
 * - Alpha closer to 0: smoother but more delayed output
 * - Alpha closer to 1: more responsive but noisier output
 *
 * Each axis (x, y, z) is processed independently.
 */
export class LowPassFilter {
  private alpha: number;
  private previousOutput: Vector3D | null = null;

  /**
   * Creates a new Low-Pass Filter instance.
   *
   * @param alpha - Smoothing factor between 0 and 1
   *   - Closer to 0: smoother but more delayed output
   *   - Closer to 1: more responsive but noisier output
   * @throws Error if alpha is outside the valid range [0, 1]
   */
  constructor(alpha: number) {
    this.alpha = this.validateAndClampAlpha(alpha);
  }

  /**
   * Validates and clamps alpha to the valid range [0, 1].
   *
   * @param alpha - The alpha value to validate
   * @returns The validated alpha value clamped to [0, 1]
   * @throws Error if alpha is not a valid number
   */
  private validateAndClampAlpha(alpha: number): number {
    if (typeof alpha !== 'number' || isNaN(alpha)) {
      throw new Error('Alpha must be a valid number');
    }
    // Clamp alpha to [0, 1] range
    return Math.max(0, Math.min(1, alpha));
  }

  /**
   * Applies the exponential moving average filter to a new sensor reading.
   *
   * Formula: output[n] = alpha * input[n] + (1 - alpha) * output[n-1]
   *
   * Each axis is processed independently.
   *
   * @param input - Raw sensor reading with x, y, z values
   * @returns Filtered sensor reading
   */
  filter(input: Vector3D): Vector3D {
    // If no previous output, initialize with the input
    if (this.previousOutput === null) {
      this.previousOutput = { ...input };
      return { ...input };
    }

    // Apply EMA formula independently to each axis
    const output: Vector3D = {
      x: this.alpha * input.x + (1 - this.alpha) * this.previousOutput.x,
      y: this.alpha * input.y + (1 - this.alpha) * this.previousOutput.y,
      z: this.alpha * input.z + (1 - this.alpha) * this.previousOutput.z,
    };

    // Store for next iteration
    this.previousOutput = { ...output };

    return output;
  }

  /**
   * Resets the filter state, clearing the previous output.
   * The next filter() call will initialize with the new input.
   */
  reset(): void {
    this.previousOutput = null;
  }

  /**
   * Updates the smoothing factor.
   *
   * @param alpha - New smoothing factor between 0 and 1
   * @throws Error if alpha is not a valid number
   */
  setAlpha(alpha: number): void {
    this.alpha = this.validateAndClampAlpha(alpha);
  }

  /**
   * Gets the current smoothing factor.
   *
   * @returns Current alpha value
   */
  getAlpha(): number {
    return this.alpha;
  }

  /**
   * Gets the previous output value (for testing/debugging).
   *
   * @returns Previous output or null if filter hasn't been applied yet
   */
  getPreviousOutput(): Vector3D | null {
    return this.previousOutput ? { ...this.previousOutput } : null;
  }
}

/**
 * Constrains an alpha value to the Sensor_Manager's valid range [0.1, 0.5].
 *
 * @param alpha - The alpha value to constrain
 * @returns Alpha value clamped to [0.1, 0.5]
 */
export function constrainSensorManagerAlpha(alpha: number): number {
  return Math.max(SENSOR_MANAGER_ALPHA_MIN, Math.min(SENSOR_MANAGER_ALPHA_MAX, alpha));
}

/**
 * Creates a new LowPassFilter instance with Sensor_Manager constraints.
 * Alpha is automatically constrained to [0.1, 0.5].
 *
 * @param alpha - Desired smoothing factor (will be constrained to [0.1, 0.5])
 * @returns A new LowPassFilter instance
 */
export function createSensorManagerFilter(alpha: number): LowPassFilter {
  return new LowPassFilter(constrainSensorManagerAlpha(alpha));
}
