/**
 * Supabase Service
 * Handles all interactions with Supabase database
 */

import { supabase } from '../lib/supabase';
import type { Star } from '@virtual-window/astronomy-engine';

export interface UserObservation {
  id: string;
  user_id: string;
  object_name: string;
  category: string;
  observation_date: string;
  location: string | null;
  notes: string | null;
  photo_url: string | null;
  points_awarded: number;
  is_seasonal_rare: boolean;
  created_at: string;
  comments_count: number;
  likes_count: number;
}

export interface UserFavorite {
  id: string;
  user_id: string;
  object_type: 'star' | 'planet' | 'messier' | 'constellation' | 'moon' | 'sun' | 'deepsky';
  object_id: string;
  object_name: string;
  created_at: string;
}

/**
 * Fetch stars from Supabase by region
 */
export async function fetchStarsFromSupabase(
  minRa: number,
  maxRa: number,
  minDec: number,
  maxDec: number,
  maxMagnitude: number = 8.5
): Promise<Star[]> {
  const { data, error } = await supabase
    .rpc('get_stars_in_region', {
      min_ra: minRa,
      max_ra: maxRa,
      min_dec: minDec,
      max_dec: maxDec,
      max_magnitude: maxMagnitude,
    });

  if (error) {
    console.error('Error fetching stars from Supabase:', error);
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
 * Fetch brightest stars from Supabase
 * Fetches in batches and calls onProgress callback for progressive loading
 */
export async function fetchBrightestStars(
  limit: number = 45000,
  onProgress?: (stars: Star[], total: number) => void
): Promise<Star[]> {
  const batchSize = 1000;
  const allStars: Star[] = [];
  let offset = 0;
  
  while (offset < limit) {
    const currentBatchSize = Math.min(batchSize, limit - offset);
    
    const { data, error } = await supabase
      .from('stars')
      .select('*')
      .order('magnitude', { ascending: true })
      .range(offset, offset + currentBatchSize - 1);

    if (error) {
      console.error('Error fetching stars batch:', error);
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    const stars = data.map((star: any) => ({
      id: star.hip_id ? `HIP${star.hip_id}` : star.id,
      name: star.name,
      ra: star.ra,
      dec: star.dec,
      magnitude: star.magnitude,
      spectralType: star.spectral_type,
    }));
    
    allStars.push(...stars);
    offset += data.length;
    
    // Call progress callback with current stars
    if (onProgress) {
      onProgress([...allStars], limit);
    }
    
    // If we got fewer than requested, we've reached the end
    if (data.length < currentBatchSize) {
      break;
    }
  }
  
  return allStars;
}

/**
 * Upload observation photo to Supabase Storage
 * Returns null if upload fails (bucket not found, etc.) - photo is optional
 */
export async function uploadObservationPhoto(file: File, userId: string): Promise<string | null> {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('observation_photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn('Photo upload failed (bucket may not exist):', error.message);
      return null; // Return null instead of throwing - photo is optional
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('observation_photos')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    console.warn('Photo upload error:', err);
    return null;
  }
}

/**
 * Save user observation
 */
export async function saveObservation(observation: {
  category: 'Moon' | 'Planet' | 'Nebula' | 'Galaxy' | 'Cluster' | 'Constellation';
  object_name: string;
  notes?: string | undefined;
  location?: string | undefined;
  observation_date: Date;
  points_awarded?: number;
  photo_url?: string | undefined;
}): Promise<UserObservation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('User not authenticated');
    return null;
  }

  const insertData: any = {
    user_id: user.id,
    object_name: observation.object_name,
    category: observation.category,
    observation_date: observation.observation_date.toISOString().split('T')[0],
    points_awarded: observation.points_awarded || 10,
    is_seasonal_rare: false,
  };

  // Only add optional fields if defined
  if (observation.notes) {
    insertData.notes = observation.notes;
  }
  if (observation.location) {
    insertData.location = observation.location;
  }
  if (observation.photo_url) {
    insertData.photo_url = observation.photo_url;
  }

  const { data, error } = await supabase
    .from('observations')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error saving observation:', error);
    console.error('Insert data was:', insertData);
    throw new Error(error.message || 'Failed to save observation');
  }

  return data;
}

/**
 * Get user observations
 */
export async function getUserObservations(): Promise<UserObservation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return [];

  const { data, error } = await supabase
    .from('observations')
    .select('*')
    .eq('user_id', user.id)
    .order('observation_date', { ascending: false });

  if (error) {
    console.error('Error fetching observations:', error);
    return [];
  }

  return data || [];
}

// Map frontend object types to database-allowed types for favorites
function mapToFavoriteType(type: string): 'star' | 'planet' | 'messier' | 'constellation' {
  switch (type) {
    case 'moon':
    case 'sun':
      return 'planet'; // Moon and Sun stored as planet type
    case 'deepsky':
      return 'messier'; // Deep sky objects stored as messier
    default:
      return type as 'star' | 'planet' | 'messier' | 'constellation';
  }
}

/**
 * Add to favorites
 */
export async function addToFavorites(
  object_type: 'star' | 'planet' | 'messier' | 'constellation' | 'moon' | 'sun' | 'deepsky',
  object_id: string,
  object_name: string
): Promise<UserFavorite | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('User not authenticated');
    return null;
  }

  const dbType = mapToFavoriteType(object_type);

  // Check if already favorited first
  const { data: existing } = await supabase
    .from('user_favorites')
    .select('*')
    .eq('user_id', user.id)
    .eq('object_type', dbType)
    .eq('object_id', object_id)
    .maybeSingle();

  if (existing) {
    // Already favorited, return existing
    return existing;
  }

  const { data, error } = await supabase
    .from('user_favorites')
    .insert({
      user_id: user.id,
      object_type: dbType,
      object_id,
      object_name,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate key error gracefully
    if (error.code === '23505') {
      return null;
    }
    console.error('Error adding to favorites:', error);
    throw error;
  }

  return data;
}

/**
 * Remove from favorites
 */
export async function removeFromFavorites(favoriteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('id', favoriteId);

  if (error) {
    console.error('Error removing from favorites:', error);
    return false;
  }

  return true;
}

/**
 * Get user favorites
 */
export async function getUserFavorites(): Promise<UserFavorite[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_favorites')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }

  return data || [];
}

/**
 * Check if object is favorited
 */
export async function isFavorited(
  object_type: string,
  object_id: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;

  const dbType = mapToFavoriteType(object_type);

  const { data, error } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('object_type', dbType)
    .eq('object_id', object_id)
    .maybeSingle(); // Use maybeSingle instead of single to avoid error when no row found

  if (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }

  return !!data;
}
