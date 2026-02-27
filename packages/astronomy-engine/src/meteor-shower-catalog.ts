/**
 * Meteor_Shower_Catalog - Meteor Shower Radiant Data and Activity Status
 *
 * Provides access to meteor shower radiant positions with activity status
 * based on proximity to peak dates.
 *
 * @module meteor-shower-catalog
 */

import type { GeographicCoordinates, HorizontalCoordinates } from './index';
import { celestialToHorizontal } from './coordinate-converter';
import meteorShowerData from '../data/meteor-showers.json';

/**
 * Represents a meteor shower with its radiant position and peak information
 */
export interface MeteorShower {
  /** Identifier (e.g., 'PER' for Perseids) */
  id: string;
  /** Full name */
  name: string;
  /** Radiant RA in hours */
  ra: number;
  /** Radiant Dec in degrees */
  dec: number;
  /** Peak month (1-12) */
  peakMonth: number;
  /** Peak day of month */
  peakDay: number;
  /** Zenithal Hourly Rate at peak */
  zhr: number;
}

/**
 * Meteor shower position with activity status
 */
export interface MeteorShowerPosition {
  /** The meteor shower data */
  shower: MeteorShower;
  /** Azimuth in degrees (0-360) */
  azimuth: number;
  /** Altitude in degrees (-90 to +90) */
  altitude: number;
  /** True if within 7 days of peak */
  isActive: boolean;
  /** Days from peak (negative = before peak) */
  daysFromPeak: number;
}

/**
 * Interface for the Meteor Shower Catalog
 */
export interface MeteorShowerCatalog {
  /**
   * Gets all meteor showers
   */
  getAllShowers(): MeteorShower[];

  /**
   * Gets active showers (within 7 days of peak)
   */
  getActiveShowers(currentDate: Date): MeteorShower[];

  /**
   * Calculates radiant positions for all showers
   */
  getRadiantPositions(
    currentDate: Date,
    observer: GeographicCoordinates,
    lst: number
  ): MeteorShowerPosition[];

  /**
   * Checks if a shower is active (within 7 days of peak)
   */
  isShowerActive(shower: MeteorShower, currentDate: Date): boolean;

  /**
   * Gets days from peak (negative = before peak)
   */
  getDaysFromPeak(shower: MeteorShower, currentDate: Date): number;
}

/** Number of days to consider a shower as active before/after peak */
const ACTIVE_WINDOW_DAYS = 7;

/** Milliseconds per day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculates the days from peak for a meteor shower
 * Handles year boundary cases (e.g., Quadrantids in early January)
 *
 * @param shower - The meteor shower
 * @param currentDate - The current date
 * @returns Days from peak (negative = before peak)
 */
function calculateDaysFromPeak(shower: MeteorShower, currentDate: Date): number {
  const currentYear = currentDate.getFullYear();

  // Create peak date for current year
  const peakCurrentYear = new Date(currentYear, shower.peakMonth - 1, shower.peakDay);

  // Calculate difference in days
  const diffMs = currentDate.getTime() - peakCurrentYear.getTime();
  const diffDays = diffMs / MS_PER_DAY;

  // Handle year boundary: if we're far from the peak in current year,
  // check if we're closer to the peak in adjacent years
  if (diffDays > 180) {
    // We're past the peak by more than half a year, check next year's peak
    const peakNextYear = new Date(currentYear + 1, shower.peakMonth - 1, shower.peakDay);
    const diffNextYear = (currentDate.getTime() - peakNextYear.getTime()) / MS_PER_DAY;
    return diffNextYear;
  } else if (diffDays < -180) {
    // We're before the peak by more than half a year, check previous year's peak
    const peakPrevYear = new Date(currentYear - 1, shower.peakMonth - 1, shower.peakDay);
    const diffPrevYear = (currentDate.getTime() - peakPrevYear.getTime()) / MS_PER_DAY;
    return diffPrevYear;
  }

  return diffDays;
}

/**
 * Creates a Meteor Shower Catalog instance
 */
export function createMeteorShowerCatalog(): MeteorShowerCatalog {
  // Load showers from JSON data
  const showers: MeteorShower[] = meteorShowerData.showers.map((s) => ({
    id: s.id,
    name: s.name,
    ra: s.ra,
    dec: s.dec,
    peakMonth: s.peakMonth,
    peakDay: s.peakDay,
    zhr: s.zhr,
  }));

  return {
    getAllShowers(): MeteorShower[] {
      return [...showers];
    },

    getActiveShowers(currentDate: Date): MeteorShower[] {
      return showers.filter((shower) => this.isShowerActive(shower, currentDate));
    },

    getRadiantPositions(
      currentDate: Date,
      observer: GeographicCoordinates,
      lst: number
    ): MeteorShowerPosition[] {
      return showers.map((shower) => {
        // Convert RA/Dec to horizontal coordinates
        const horizontal: HorizontalCoordinates = celestialToHorizontal(
          { ra: shower.ra, dec: shower.dec },
          observer,
          lst
        );

        const daysFromPeak = this.getDaysFromPeak(shower, currentDate);
        const isActive = Math.abs(daysFromPeak) <= ACTIVE_WINDOW_DAYS;

        return {
          shower,
          azimuth: horizontal.azimuth,
          altitude: horizontal.altitude,
          isActive,
          daysFromPeak,
        };
      });
    },

    isShowerActive(shower: MeteorShower, currentDate: Date): boolean {
      const daysFromPeak = this.getDaysFromPeak(shower, currentDate);
      return Math.abs(daysFromPeak) <= ACTIVE_WINDOW_DAYS;
    },

    getDaysFromPeak(shower: MeteorShower, currentDate: Date): number {
      return calculateDaysFromPeak(shower, currentDate);
    },
  };
}

/**
 * Default meteor shower catalog instance
 */
export const meteorShowerCatalog = createMeteorShowerCatalog();

export default meteorShowerCatalog;
