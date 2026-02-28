/**
 * Supabase Client Configuration
 * Connects SkyWatch to your existing Supabase platform
 * Uses cookie-based auth for cross-subdomain sharing with Sky Circle
 */

import { createBrowserClient } from '@supabase/ssr';

// Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase credentials not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
}

// Determine if we're in development (localhost)
const isDevelopment = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Create Supabase client with cookie-based auth for cross-subdomain sharing
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: isDevelopment ? undefined : {
    domain: '.skyguild.club',
    path: '/',
    sameSite: 'lax',
    secure: true,
  },
});

// Database types matching your existing schema
export interface Database {
  public: {
    Tables: {
      stars: {
        Row: {
          id: string;
          hip_id: number | null;
          ra: number;
          dec: number;
          magnitude: number;
          name: string | null;
          spectral_type: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stars']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['stars']['Insert']>;
      };
      observations: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['observations']['Row'], 'id' | 'created_at' | 'comments_count' | 'likes_count'>;
        Update: Partial<Database['public']['Tables']['observations']['Insert']>;
      };
      user_favorites: {
        Row: {
          id: string;
          user_id: string;
          object_type: string;
          object_id: string;
          object_name: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_favorites']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_favorites']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          bio: string | null;
          profile_photo_url: string | null;
          telescope_type: string | null;
          experience_level: string | null;
          level: number;
          total_points: number;
          referral_code: string;
          referred_by: string | null;
          created_at: string;
          updated_at: string;
          role: string;
          is_event_creator: boolean;
          guild_leader_application_status: string | null;
        };
      };
    };
  };
}

export default supabase;
