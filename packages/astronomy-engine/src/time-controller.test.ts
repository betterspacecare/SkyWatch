import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTimeController, timeController, TimeController } from './time-controller';

describe('TimeController', () => {
  let controller: TimeController;

  beforeEach(() => {
    controller = createTimeController();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCurrentTime', () => {
    it('should return current real time when in real-time mode', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      const result = controller.getCurrentTime();
      expect(result.getTime()).toBe(now.getTime());
    });

    it('should return set time when not in real-time mode', () => {
      const setTime = new Date('2024-03-15T10:30:00Z');
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));

      controller.setTime(setTime);
      const result = controller.getCurrentTime();

      expect(result.getTime()).toBe(setTime.getTime());
    });

    it('should return a new Date instance each time', () => {
      const time1 = controller.getCurrentTime();
      const time2 = controller.getCurrentTime();

      expect(time1).not.toBe(time2);
      expect(time1.getTime()).toBe(time2.getTime());
    });
  });

  describe('setTime', () => {
    it('should set the current time to the specified timestamp', () => {
      const targetTime = new Date('2024-05-20T15:45:00Z');
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));

      controller.setTime(targetTime);

      expect(controller.getCurrentTime().getTime()).toBe(targetTime.getTime());
    });

    it('should switch to non-real-time mode', () => {
      expect(controller.isRealTime()).toBe(true);

      controller.setTime(new Date('2024-05-20T15:45:00Z'));

      expect(controller.isRealTime()).toBe(false);
    });

    it('should clamp timestamps beyond +1 year to max range', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      const twoYearsLater = new Date(now.getTime() + 2 * 365 * 24 * 60 * 60 * 1000);
      controller.setTime(twoYearsLater);

      const result = controller.getCurrentTime();
      const range = controller.getTimeRange();

      expect(result.getTime()).toBe(range.max.getTime());
    });

    it('should clamp timestamps beyond -1 year to min range', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
      controller.setTime(twoYearsAgo);

      const result = controller.getCurrentTime();
      const range = controller.getTimeRange();

      expect(result.getTime()).toBe(range.min.getTime());
    });

    it('should accept timestamps within valid range without clamping', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      controller.setTime(sixMonthsAgo);

      expect(controller.getCurrentTime().getTime()).toBe(sixMonthsAgo.getTime());
    });

    it('should notify subscribers when time changes', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      const callback = vi.fn();
      controller.onTimeChange(callback);

      const newTime = new Date('2024-05-20T15:45:00Z');
      controller.setTime(newTime);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(Date));
      expect(callback.mock.calls[0][0].getTime()).toBe(newTime.getTime());
    });
  });

  describe('setRealTime', () => {
    it('should switch back to real-time mode', () => {
      controller.setTime(new Date('2024-05-20T15:45:00Z'));
      expect(controller.isRealTime()).toBe(false);

      controller.setRealTime();

      expect(controller.isRealTime()).toBe(true);
    });

    it('should return current real time after switching', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      controller.setTime(new Date('2024-05-20T15:45:00Z'));
      controller.setRealTime();

      expect(controller.getCurrentTime().getTime()).toBe(now.getTime());
    });

    it('should notify subscribers when switching to real-time', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      const callback = vi.fn();
      controller.onTimeChange(callback);

      controller.setRealTime();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].getTime()).toBe(now.getTime());
    });
  });

  describe('isRealTime', () => {
    it('should return true initially', () => {
      expect(controller.isRealTime()).toBe(true);
    });

    it('should return false after setTime is called', () => {
      controller.setTime(new Date('2024-05-20T15:45:00Z'));
      expect(controller.isRealTime()).toBe(false);
    });

    it('should return true after setRealTime is called', () => {
      controller.setTime(new Date('2024-05-20T15:45:00Z'));
      controller.setRealTime();
      expect(controller.isRealTime()).toBe(true);
    });
  });

  describe('getTimeRange', () => {
    it('should return min and max dates ±1 year from now', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      const range = controller.getTimeRange();
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;

      expect(range.min.getTime()).toBe(now.getTime() - oneYearMs);
      expect(range.max.getTime()).toBe(now.getTime() + oneYearMs);
    });

    it('should update range based on current real time', () => {
      const time1 = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(time1);
      const range1 = controller.getTimeRange();

      const time2 = new Date('2024-07-15T12:00:00Z');
      vi.setSystemTime(time2);
      const range2 = controller.getTimeRange();

      expect(range2.min.getTime()).toBeGreaterThan(range1.min.getTime());
      expect(range2.max.getTime()).toBeGreaterThan(range1.max.getTime());
    });
  });

  describe('onTimeChange', () => {
    it('should call callback when time is set', () => {
      const callback = vi.fn();
      controller.onTimeChange(callback);

      controller.setTime(new Date('2024-05-20T15:45:00Z'));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should call callback when switching to real-time', () => {
      const callback = vi.fn();
      controller.onTimeChange(callback);

      controller.setRealTime();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      controller.onTimeChange(callback1);
      controller.onTimeChange(callback2);

      controller.setTime(new Date('2024-05-20T15:45:00Z'));

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function that removes callback', () => {
      const callback = vi.fn();
      const unsubscribe = controller.onTimeChange(callback);

      controller.setTime(new Date('2024-05-20T15:45:00Z'));
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      controller.setTime(new Date('2024-06-20T15:45:00Z'));
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should handle subscriber errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = vi.fn();

      controller.onTimeChange(errorCallback);
      controller.onTimeChange(normalCallback);

      // Should not throw
      expect(() => controller.setTime(new Date('2024-05-20T15:45:00Z'))).not.toThrow();

      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('default singleton instance', () => {
    it('should export a default timeController instance', () => {
      expect(timeController).toBeDefined();
      expect(typeof timeController.getCurrentTime).toBe('function');
      expect(typeof timeController.setTime).toBe('function');
      expect(typeof timeController.setRealTime).toBe('function');
      expect(typeof timeController.isRealTime).toBe('function');
      expect(typeof timeController.getTimeRange).toBe('function');
      expect(typeof timeController.onTimeChange).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle timestamps at exact boundary of range', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      vi.setSystemTime(now);

      const range = controller.getTimeRange();

      // Set to exact min boundary
      controller.setTime(range.min);
      expect(controller.getCurrentTime().getTime()).toBe(range.min.getTime());

      // Set to exact max boundary
      controller.setTime(range.max);
      expect(controller.getCurrentTime().getTime()).toBe(range.max.getTime());
    });

    it('should handle rapid successive time changes', () => {
      const callback = vi.fn();
      controller.onTimeChange(callback);

      const times = [
        new Date('2024-03-01T00:00:00Z'),
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-05-01T00:00:00Z'),
      ];

      times.forEach((time) => controller.setTime(time));

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should handle unsubscribing during callback execution', () => {
      let unsubscribe: () => void;
      const callback = vi.fn(() => {
        unsubscribe();
      });

      unsubscribe = controller.onTimeChange(callback);

      // Should not throw when callback unsubscribes itself
      expect(() => controller.setTime(new Date('2024-05-20T15:45:00Z'))).not.toThrow();
    });
  });
});
