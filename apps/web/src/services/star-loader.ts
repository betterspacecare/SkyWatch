/**
 * Star Loader Service
 * Handles loading stars from multiple sources with fallback
 */

import type { Star } from '@virtual-window/astronomy-engine';
import { fetchBrightestStars } from './supabase-service';

export type StarLoadStrategy = 'local' | 'supabase' | 'hybrid';

interface StarLoaderConfig {
  strategy: StarLoadStrategy;
  maxStars?: number;
  maxMagnitude?: number;
  useCache?: boolean;
  onProgress?: (stars: Star[], total: number) => void;
}

/**
 * Load stars using the specified strategy
 */
export async function loadStars(config: StarLoaderConfig = { strategy: 'local' }): Promise<Star[]> {
  const { strategy, maxStars = 50000, onProgress } = config;

  try {
    switch (strategy) {
      case 'supabase':
        return await loadFromSupabase(maxStars, onProgress);
      
      case 'hybrid':
        return await loadHybrid(maxStars, onProgress);
      
      case 'local':
      default:
        return await loadFromLocal();
    }
  } catch (error) {
    // Always fallback to local
    return await loadFromLocal();
  }
}

/**
 * Load stars from local JSON file
 */
async function loadFromLocal(): Promise<Star[]> {
  const response = await fetch('/data/bright-stars.json');
  if (!response.ok) {
    throw new Error('Failed to fetch local stars');
  }
  
  const data = await response.json();
  const stars = data.stars.map((s: any) => ({
    id: s.id,
    name: s.name,
    ra: s.ra,
    dec: s.dec,
    magnitude: s.mag,
    spectralType: s.spectralType,
  }));
  
  return stars;
}

/**
 * Load stars from Supabase database with progressive loading
 */
async function loadFromSupabase(
  maxStars: number, 
  onProgress?: (stars: Star[], total: number) => void
): Promise<Star[]> {
  const stars = await fetchBrightestStars(maxStars, onProgress);
  
  if (stars.length === 0) {
    throw new Error('No stars returned from Supabase');
  }
  
  return stars;
}

/**
 * Hybrid approach: Load from local for speed, but enable Supabase queries
 */
async function loadHybrid(
  maxStars: number,
  onProgress?: (stars: Star[], total: number) => void
): Promise<Star[]> {
  // Try Supabase first (for latest data)
  try {
    const supabaseStars = await loadFromSupabase(maxStars, onProgress);
    return supabaseStars;
  } catch (error) {
    return await loadFromLocal();
  }
}

/**
 * Search stars by name (requires Supabase)
 */
export async function searchStarsByName(query: string, limit: number = 20): Promise<Star[]> {
  if (query.length < 2) return [];
  
  const { supabase } = await import('../lib/supabase');
  
  const { data, error } = await supabase
    .from('stars')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('magnitude', { ascending: true })
    .limit(limit);
  
  if (error) {
    console.error('Search error:', error);
    return [];
  }
  
  return (data || []).map((star: any) => ({
    id: star.hip_id ? `HIP${star.hip_id}` : star.id,
    name: star.name,
    ra: star.ra,
    dec: star.dec,
    magnitude: star.magnitude,
    spectralType: star.spectral_type,
  }));
}

/**
 * Get stars in a specific region (requires Supabase)
 */
export async function getStarsInRegion(
  minRa: number,
  maxRa: number,
  minDec: number,
  maxDec: number,
  maxMagnitude: number = 8.5
): Promise<Star[]> {
  const { fetchStarsFromSupabase } = await import('./supabase-service');
  return await fetchStarsFromSupabase(minRa, maxRa, minDec, maxDec, maxMagnitude);
}

/**
 * Get star count from Supabase
 */
export async function getStarCount(): Promise<number> {
  const { supabase } = await import('../lib/supabase');
  
  const { count, error } = await supabase
    .from('stars')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Count error:', error);
    return 0;
  }
  
  return count || 0;
}
