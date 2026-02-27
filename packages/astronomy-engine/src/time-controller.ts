/**
 * Time Controller Module
 *
 * Manages time state for astronomical calculations, supporting both real-time
 * viewing and arbitrary timestamp selection within ±1 year from current date.
 *
 * Requirements: 12.1, 12.2, 12.5
 */

/**
 * Interface for the Time Controller
 */
export interface TimeController {
  /**
   * Gets the currently selected timestamp
   */
  getCurrentTime(): Date;

  /**
   * Sets a specific timestamp for calculations
   * @param timestamp - The timestamp to set (will be clamped to valid range)
   */
  setTime(timestamp: Date): void;

  /**
   * Returns to real-time mode
   */
  setRealTime(): void;

  /**
   * Checks if in real-time mode
   */
  isRealTime(): boolean;

  /**
   * Gets the valid time range (±1 year from now)
   */
  getTimeRange(): { min: Date; max: Date };

  /**
   * Subscribes to time changes
   * @param callback - Function called when time changes
   * @returns Unsubscribe function
   */
  onTimeChange(callback: (timestamp: Date) => void): () => void;
}

/**
 * Number of milliseconds in one year (365 days)
 */
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Creates a new TimeController instance
 */
export function createTimeController(): TimeController {
  let currentTime: Date = new Date();
  let realTimeMode: boolean = true;
  const subscribers: Set<(timestamp: Date) => void> = new Set();

  /**
   * Notifies all subscribers of a time change
   */
  function notifySubscribers(timestamp: Date): void {
    subscribers.forEach((callback) => {
      try {
        callback(timestamp);
      } catch (error) {
        // Silently handle subscriber errors to prevent cascading failures
        console.error('Time change subscriber error:', error);
      }
    });
  }

  /**
   * Clamps a timestamp to the valid range (±1 year from now)
   */
  function clampToValidRange(timestamp: Date): Date {
    const range = getTimeRange();
    const time = timestamp.getTime();

    if (time < range.min.getTime()) {
      return new Date(range.min);
    }
    if (time > range.max.getTime()) {
      return new Date(range.max);
    }
    return new Date(timestamp);
  }

  /**
   * Gets the valid time range (±1 year from current real time)
   */
  function getTimeRange(): { min: Date; max: Date } {
    const now = new Date();
    return {
      min: new Date(now.getTime() - ONE_YEAR_MS),
      max: new Date(now.getTime() + ONE_YEAR_MS),
    };
  }

  return {
    getCurrentTime(): Date {
      if (realTimeMode) {
        return new Date();
      }
      return new Date(currentTime);
    },

    setTime(timestamp: Date): void {
      const clampedTime = clampToValidRange(timestamp);
      currentTime = clampedTime;
      realTimeMode = false;
      notifySubscribers(clampedTime);
    },

    setRealTime(): void {
      realTimeMode = true;
      const now = new Date();
      currentTime = now;
      notifySubscribers(now);
    },

    isRealTime(): boolean {
      return realTimeMode;
    },

    getTimeRange,

    onTimeChange(callback: (timestamp: Date) => void): () => void {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}

/**
 * Default singleton instance of the TimeController
 */
export const timeController: TimeController = createTimeController();
