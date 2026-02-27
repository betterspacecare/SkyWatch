/**
 * Time Slider Logic
 * Shared logic for time control UI across platforms
 */

export interface TimeSliderState {
  currentTime: Date;
  isRealTime: boolean;
  minTime: Date;
  maxTime: Date;
}

export interface TimeSliderConfig {
  onTimeChange?: (time: Date) => void;
  onRealTimeToggle?: (isRealTime: boolean) => void;
}

/**
 * Creates initial time slider state with ±1 year range
 */
export function createTimeSliderState(): TimeSliderState {
  const now = new Date();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  
  return {
    currentTime: now,
    isRealTime: true,
    minTime: new Date(now.getTime() - oneYear),
    maxTime: new Date(now.getTime() + oneYear),
  };
}

/**
 * Converts Date to slider value (0-1 range)
 */
export function dateToSliderValue(date: Date, min: Date, max: Date): number {
  const range = max.getTime() - min.getTime();
  const value = date.getTime() - min.getTime();
  return Math.max(0, Math.min(1, value / range));
}

/**
 * Converts slider value (0-1) to Date
 */
export function sliderValueToDate(value: number, min: Date, max: Date): Date {
  const range = max.getTime() - min.getTime();
  const time = min.getTime() + value * range;
  return new Date(time);
}

/**
 * Formats date for display
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats date for short display
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats time for display
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Constrains a date to the valid range
 */
export function constrainDate(date: Date, min: Date, max: Date): Date {
  const time = date.getTime();
  if (time < min.getTime()) return new Date(min);
  if (time > max.getTime()) return new Date(max);
  return date;
}

/**
 * Checks if a date is within the valid range
 */
export function isDateInRange(date: Date, min: Date, max: Date): boolean {
  const time = date.getTime();
  return time >= min.getTime() && time <= max.getTime();
}

/**
 * Time slider reducer for state management
 */
export type TimeSliderAction =
  | { type: 'SET_TIME'; time: Date }
  | { type: 'SET_REAL_TIME' }
  | { type: 'TICK' };

export function timeSliderReducer(
  state: TimeSliderState,
  action: TimeSliderAction
): TimeSliderState {
  switch (action.type) {
    case 'SET_TIME':
      return {
        ...state,
        currentTime: constrainDate(action.time, state.minTime, state.maxTime),
        isRealTime: false,
      };
    
    case 'SET_REAL_TIME':
      return {
        ...state,
        currentTime: new Date(),
        isRealTime: true,
      };
    
    case 'TICK':
      if (state.isRealTime) {
        return {
          ...state,
          currentTime: new Date(),
        };
      }
      return state;
    
    default:
      return state;
  }
}
