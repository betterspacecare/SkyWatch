/**
 * Unit Tests for Low-Pass Filter
 *
 * Tests the exponential moving average filter implementation
 * for sensor data smoothing.
 *
 * @requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LowPassFilter,
  Vector3D,
  constrainSensorManagerAlpha,
  createSensorManagerFilter,
  SENSOR_MANAGER_ALPHA_MIN,
  SENSOR_MANAGER_ALPHA_MAX,
} from './low-pass-filter';

describe('LowPassFilter', () => {
  let filter: LowPassFilter;

  describe('constructor', () => {
    it('should create a filter with valid alpha', () => {
      filter = new LowPassFilter(0.5);
      expect(filter.getAlpha()).toBe(0.5);
    });

    it('should clamp alpha to 0 when negative', () => {
      filter = new LowPassFilter(-0.5);
      expect(filter.getAlpha()).toBe(0);
    });

    it('should clamp alpha to 1 when greater than 1', () => {
      filter = new LowPassFilter(1.5);
      expect(filter.getAlpha()).toBe(1);
    });

    it('should accept alpha at boundary 0', () => {
      filter = new LowPassFilter(0);
      expect(filter.getAlpha()).toBe(0);
    });

    it('should accept alpha at boundary 1', () => {
      filter = new LowPassFilter(1);
      expect(filter.getAlpha()).toBe(1);
    });

    it('should throw error for NaN alpha', () => {
      expect(() => new LowPassFilter(NaN)).toThrow('Alpha must be a valid number');
    });
  });

  describe('filter()', () => {
    beforeEach(() => {
      filter = new LowPassFilter(0.5);
    });

    it('should return input unchanged on first call', () => {
      const input: Vector3D = { x: 10, y: 20, z: 30 };
      const output = filter.filter(input);
      expect(output).toEqual(input);
    });

    it('should apply EMA formula correctly', () => {
      // First input initializes the filter
      filter.filter({ x: 0, y: 0, z: 0 });

      // Second input: output = 0.5 * input + 0.5 * previous
      const input: Vector3D = { x: 10, y: 20, z: 30 };
      const output = filter.filter(input);

      // Expected: 0.5 * 10 + 0.5 * 0 = 5, etc.
      expect(output.x).toBe(5);
      expect(output.y).toBe(10);
      expect(output.z).toBe(15);
    });

    it('should process x, y, z axes independently', () => {
      // Initialize with different values per axis
      filter.filter({ x: 100, y: 0, z: 50 });

      // Apply new input
      const output = filter.filter({ x: 0, y: 100, z: 50 });

      // Each axis should be filtered independently
      // x: 0.5 * 0 + 0.5 * 100 = 50
      // y: 0.5 * 100 + 0.5 * 0 = 50
      // z: 0.5 * 50 + 0.5 * 50 = 50
      expect(output.x).toBe(50);
      expect(output.y).toBe(50);
      expect(output.z).toBe(50);
    });

    it('should converge to constant input over time', () => {
      const constantInput: Vector3D = { x: 100, y: 100, z: 100 };

      // Apply the same input multiple times
      let output: Vector3D = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < 20; i++) {
        output = filter.filter(constantInput);
      }

      // Should converge close to the constant input
      expect(output.x).toBeCloseTo(100, 1);
      expect(output.y).toBeCloseTo(100, 1);
      expect(output.z).toBeCloseTo(100, 1);
    });

    it('should not mutate input object', () => {
      const input: Vector3D = { x: 10, y: 20, z: 30 };
      const inputCopy = { ...input };
      filter.filter(input);
      expect(input).toEqual(inputCopy);
    });

    it('should return new object each time', () => {
      const input: Vector3D = { x: 10, y: 20, z: 30 };
      const output1 = filter.filter(input);
      const output2 = filter.filter(input);
      expect(output1).not.toBe(output2);
    });
  });

  describe('alpha behavior', () => {
    it('should produce smoother output with lower alpha', () => {
      const lowAlphaFilter = new LowPassFilter(0.1);
      const highAlphaFilter = new LowPassFilter(0.9);

      // Initialize both filters
      lowAlphaFilter.filter({ x: 0, y: 0, z: 0 });
      highAlphaFilter.filter({ x: 0, y: 0, z: 0 });

      // Apply a step change
      const stepInput: Vector3D = { x: 100, y: 100, z: 100 };
      const lowAlphaOutput = lowAlphaFilter.filter(stepInput);
      const highAlphaOutput = highAlphaFilter.filter(stepInput);

      // Lower alpha should respond more slowly (smaller change)
      expect(lowAlphaOutput.x).toBeLessThan(highAlphaOutput.x);
      expect(lowAlphaOutput.y).toBeLessThan(highAlphaOutput.y);
      expect(lowAlphaOutput.z).toBeLessThan(highAlphaOutput.z);
    });

    it('should pass through input unchanged with alpha=1', () => {
      filter = new LowPassFilter(1);
      filter.filter({ x: 0, y: 0, z: 0 });

      const input: Vector3D = { x: 100, y: 200, z: 300 };
      const output = filter.filter(input);

      expect(output).toEqual(input);
    });

    it('should ignore new input with alpha=0', () => {
      filter = new LowPassFilter(0);
      const initial: Vector3D = { x: 50, y: 50, z: 50 };
      filter.filter(initial);

      const newInput: Vector3D = { x: 100, y: 200, z: 300 };
      const output = filter.filter(newInput);

      // Should keep the previous output
      expect(output).toEqual(initial);
    });
  });

  describe('reset()', () => {
    beforeEach(() => {
      filter = new LowPassFilter(0.5);
    });

    it('should clear previous output', () => {
      filter.filter({ x: 100, y: 100, z: 100 });
      expect(filter.getPreviousOutput()).not.toBeNull();

      filter.reset();
      expect(filter.getPreviousOutput()).toBeNull();
    });

    it('should make next filter call return input unchanged', () => {
      // Build up some state
      filter.filter({ x: 0, y: 0, z: 0 });
      filter.filter({ x: 50, y: 50, z: 50 });

      // Reset
      filter.reset();

      // Next input should be returned unchanged
      const input: Vector3D = { x: 100, y: 200, z: 300 };
      const output = filter.filter(input);
      expect(output).toEqual(input);
    });
  });

  describe('setAlpha()', () => {
    beforeEach(() => {
      filter = new LowPassFilter(0.5);
    });

    it('should update alpha value', () => {
      filter.setAlpha(0.3);
      expect(filter.getAlpha()).toBe(0.3);
    });

    it('should clamp alpha to valid range', () => {
      filter.setAlpha(-0.5);
      expect(filter.getAlpha()).toBe(0);

      filter.setAlpha(1.5);
      expect(filter.getAlpha()).toBe(1);
    });

    it('should throw error for NaN', () => {
      expect(() => filter.setAlpha(NaN)).toThrow('Alpha must be a valid number');
    });

    it('should preserve filter state when changing alpha', () => {
      filter.filter({ x: 100, y: 100, z: 100 });
      const previousOutput = filter.getPreviousOutput();

      filter.setAlpha(0.3);

      expect(filter.getPreviousOutput()).toEqual(previousOutput);
    });
  });

  describe('getAlpha()', () => {
    it('should return current alpha value', () => {
      filter = new LowPassFilter(0.7);
      expect(filter.getAlpha()).toBe(0.7);
    });
  });

  describe('getPreviousOutput()', () => {
    beforeEach(() => {
      filter = new LowPassFilter(0.5);
    });

    it('should return null before first filter call', () => {
      expect(filter.getPreviousOutput()).toBeNull();
    });

    it('should return copy of previous output', () => {
      filter.filter({ x: 10, y: 20, z: 30 });
      const output1 = filter.getPreviousOutput();
      const output2 = filter.getPreviousOutput();

      expect(output1).toEqual(output2);
      expect(output1).not.toBe(output2);
    });
  });
});

describe('constrainSensorManagerAlpha', () => {
  it('should return value within range unchanged', () => {
    expect(constrainSensorManagerAlpha(0.3)).toBe(0.3);
  });

  it('should clamp values below minimum to 0.1', () => {
    expect(constrainSensorManagerAlpha(0)).toBe(SENSOR_MANAGER_ALPHA_MIN);
    expect(constrainSensorManagerAlpha(0.05)).toBe(SENSOR_MANAGER_ALPHA_MIN);
    expect(constrainSensorManagerAlpha(-1)).toBe(SENSOR_MANAGER_ALPHA_MIN);
  });

  it('should clamp values above maximum to 0.5', () => {
    expect(constrainSensorManagerAlpha(1)).toBe(SENSOR_MANAGER_ALPHA_MAX);
    expect(constrainSensorManagerAlpha(0.7)).toBe(SENSOR_MANAGER_ALPHA_MAX);
    expect(constrainSensorManagerAlpha(2)).toBe(SENSOR_MANAGER_ALPHA_MAX);
  });

  it('should accept boundary values', () => {
    expect(constrainSensorManagerAlpha(0.1)).toBe(0.1);
    expect(constrainSensorManagerAlpha(0.5)).toBe(0.5);
  });
});

describe('createSensorManagerFilter', () => {
  it('should create filter with constrained alpha', () => {
    const filter = createSensorManagerFilter(0.3);
    expect(filter.getAlpha()).toBe(0.3);
  });

  it('should constrain alpha below minimum', () => {
    const filter = createSensorManagerFilter(0);
    expect(filter.getAlpha()).toBe(SENSOR_MANAGER_ALPHA_MIN);
  });

  it('should constrain alpha above maximum', () => {
    const filter = createSensorManagerFilter(1);
    expect(filter.getAlpha()).toBe(SENSOR_MANAGER_ALPHA_MAX);
  });

  it('should return functional filter', () => {
    const filter = createSensorManagerFilter(0.3);
    const input: Vector3D = { x: 10, y: 20, z: 30 };
    const output = filter.filter(input);
    expect(output).toEqual(input);
  });
});

describe('EMA Formula Verification', () => {
  /**
   * Validates: Requirement 10.1
   * THE Low_Pass_Filter SHALL implement an exponential moving average algorithm
   */
  it('should implement correct EMA formula: output[n] = alpha * input[n] + (1 - alpha) * output[n-1]', () => {
    const alpha = 0.3;
    const filter = new LowPassFilter(alpha);

    // Initialize
    const initial: Vector3D = { x: 10, y: 20, z: 30 };
    filter.filter(initial);

    // Apply new input
    const input: Vector3D = { x: 40, y: 50, z: 60 };
    const output = filter.filter(input);

    // Verify EMA formula for each axis
    const expectedX = alpha * input.x + (1 - alpha) * initial.x;
    const expectedY = alpha * input.y + (1 - alpha) * initial.y;
    const expectedZ = alpha * input.z + (1 - alpha) * initial.z;

    expect(output.x).toBeCloseTo(expectedX, 10);
    expect(output.y).toBeCloseTo(expectedY, 10);
    expect(output.z).toBeCloseTo(expectedZ, 10);
  });

  it('should apply EMA formula correctly over multiple iterations', () => {
    const alpha = 0.4;
    const filter = new LowPassFilter(alpha);

    let previousOutput: Vector3D = { x: 0, y: 0, z: 0 };
    filter.filter(previousOutput);

    const inputs: Vector3D[] = [
      { x: 10, y: 20, z: 30 },
      { x: 15, y: 25, z: 35 },
      { x: 20, y: 30, z: 40 },
    ];

    for (const input of inputs) {
      const output = filter.filter(input);

      // Verify EMA formula
      const expectedX = alpha * input.x + (1 - alpha) * previousOutput.x;
      const expectedY = alpha * input.y + (1 - alpha) * previousOutput.y;
      const expectedZ = alpha * input.z + (1 - alpha) * previousOutput.z;

      expect(output.x).toBeCloseTo(expectedX, 10);
      expect(output.y).toBeCloseTo(expectedY, 10);
      expect(output.z).toBeCloseTo(expectedZ, 10);

      previousOutput = output;
    }
  });
});
