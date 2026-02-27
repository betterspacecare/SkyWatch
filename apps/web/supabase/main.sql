-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_users (
  user_id uuid NOT NULL,
  role text DEFAULT 'admin'::text CHECK (role = ANY (ARRAY['admin'::text, 'moderator'::text])),
  granted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (user_id),
  CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.api_key_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL,
  endpoint character varying NOT NULL,
  method character varying NOT NULL,
  status_code integer,
  ip_address inet,
  user_agent text,
  request_body jsonb,
  response_time_ms integer,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT api_key_logs_pkey PRIMARY KEY (id),
  CONSTRAINT api_key_logs_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id)
);
CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text,
  key_hash character varying NOT NULL UNIQUE,
  key_prefix character varying NOT NULL,
  permissions ARRAY DEFAULT ARRAY['read'::text],
  is_active boolean DEFAULT true,
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon_url text,
  requirement_type text CHECK (requirement_type = ANY (ARRAY['observation_count'::text, 'specific_object'::text, 'mission_complete'::text, 'referral_count'::text, 'special'::text])),
  requirement_value jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT badges_pkey PRIMARY KEY (id)
);
CREATE TABLE public.celestial_objects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  messier_number text,
  ngc_number text,
  description text,
  difficulty text CHECK (difficulty = ANY (ARRAY['easy'::text, 'moderate'::text, 'challenging'::text, 'expert'::text])),
  CONSTRAINT celestial_objects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_comment_id uuid,
  content text NOT NULL CHECK (length(TRIM(BOTH FROM content)) > 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.observations(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id)
);
CREATE TABLE public.event_attendees (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rsvp_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  location text NOT NULL,
  latitude numeric,
  longitude numeric,
  event_date timestamp with time zone NOT NULL,
  capacity integer,
  is_paid boolean DEFAULT false,
  price numeric,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['bug'::text, 'feature'::text, 'improvement'::text, 'other'::text])),
  message text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  page_url text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id),
  CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id)
);
CREATE TABLE public.group_event_attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  user_id uuid,
  rsvp_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_event_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT group_event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.group_events(id),
  CONSTRAINT group_event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.group_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid,
  title character varying NOT NULL,
  description text,
  location character varying NOT NULL,
  latitude numeric,
  longitude numeric,
  event_date timestamp with time zone NOT NULL,
  capacity integer,
  created_by uuid,
  is_approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_events_pkey PRIMARY KEY (id),
  CONSTRAINT group_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid,
  user_id uuid,
  role character varying DEFAULT 'member'::character varying CHECK (role::text = ANY (ARRAY['owner'::character varying, 'admin'::character varying, 'moderator'::character varying, 'member'::character varying]::text[])),
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (id),
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text,
  cover_image_url text,
  created_by uuid,
  is_public boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  member_count integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.guild_leader_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  reason text NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT guild_leader_applications_pkey PRIMARY KEY (id),
  CONSTRAINT guild_leader_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT guild_leader_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);
CREATE TABLE public.interests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  display_name character varying NOT NULL,
  category character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT interests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT likes_pkey PRIMARY KEY (id),
  CONSTRAINT likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.observations(id),
  CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.mission_requirements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  mission_id uuid NOT NULL,
  object_name text NOT NULL,
  category text NOT NULL,
  CONSTRAINT mission_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT mission_requirements_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id)
);
CREATE TABLE public.missions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reward_badge_id uuid,
  bonus_points integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT missions_pkey PRIMARY KEY (id),
  CONSTRAINT missions_reward_badge_id_fkey FOREIGN KEY (reward_badge_id) REFERENCES public.badges(id)
);
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  push_enabled boolean DEFAULT false,
  email_enabled boolean DEFAULT true,
  sky_alerts boolean DEFAULT true,
  event_reminders boolean DEFAULT true,
  badge_notifications boolean DEFAULT true,
  mission_notifications boolean DEFAULT true,
  social_notifications boolean DEFAULT true,
  marketing_emails boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['sky_alert'::text, 'event_reminder'::text, 'badge_earned'::text, 'mission_complete'::text, 'comment'::text, 'like'::text, 'follow'::text, 'system'::text])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.observation_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  points integer DEFAULT 10,
  icon text,
  color text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT observation_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.observations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  object_name text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['Moon'::text, 'Planet'::text, 'Nebula'::text, 'Galaxy'::text, 'Cluster'::text, 'Constellation'::text])),
  observation_date date NOT NULL,
  location text,
  notes text,
  photo_url text,
  points_awarded integer NOT NULL,
  is_seasonal_rare boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  comments_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  CONSTRAINT observations_pkey PRIMARY KEY (id),
  CONSTRAINT observations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  image_url text,
  caption text,
  is_reported boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  comments_count integer DEFAULT 0,
  images jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  reward_points integer DEFAULT 50,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id),
  CONSTRAINT referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.sky_alerts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  message text NOT NULL,
  alert_type text CHECK (alert_type = ANY (ARRAY['text'::text, 'object_visibility'::text, 'meteor_shower'::text, 'special_event'::text])),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sky_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT sky_alerts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.stars (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hip_id integer UNIQUE,
  ra double precision NOT NULL,
  dec double precision NOT NULL,
  magnitude double precision NOT NULL,
  name text,
  spectral_type character varying NOT NULL DEFAULT 'G'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stars_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_alert_reads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  alert_id uuid NOT NULL,
  read_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_alert_reads_pkey PRIMARY KEY (id),
  CONSTRAINT user_alert_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_alert_reads_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.sky_alerts(id)
);
CREATE TABLE public.user_badges (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL,
  earned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_badges_pkey PRIMARY KEY (id),
  CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id)
);
CREATE TABLE public.user_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  object_type character varying NOT NULL CHECK (object_type::text = ANY (ARRAY['star'::character varying, 'planet'::character varying, 'messier'::character varying, 'constellation'::character varying]::text[])),
  object_id text NOT NULL,
  object_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_favorites_pkey PRIMARY KEY (id),
  CONSTRAINT user_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_gears (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name character varying NOT NULL,
  gear_type character varying NOT NULL CHECK (gear_type::text = ANY (ARRAY['telescope'::character varying, 'camera'::character varying, 'mount'::character varying, 'eyepiece'::character varying, 'filter'::character varying, 'accessory'::character varying]::text[])),
  brand character varying,
  model character varying,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_gears_pkey PRIMARY KEY (id),
  CONSTRAINT user_gears_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_interests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  interest_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_interests_pkey PRIMARY KEY (id),
  CONSTRAINT user_interests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_interests_interest_id_fkey FOREIGN KEY (interest_id) REFERENCES public.interests(id)
);
CREATE TABLE public.user_mission_progress (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  completed_requirements jsonb DEFAULT '[]'::jsonb,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  CONSTRAINT user_mission_progress_pkey PRIMARY KEY (id),
  CONSTRAINT user_mission_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_mission_progress_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id)
);
CREATE TABLE public.user_observations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  star_id uuid,
  object_type character varying NOT NULL CHECK (object_type::text = ANY (ARRAY['star'::character varying, 'planet'::character varying, 'messier'::character varying, 'constellation'::character varying]::text[])),
  object_name text NOT NULL,
  notes text,
  location_lat double precision NOT NULL,
  location_lon double precision NOT NULL,
  observed_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_observations_pkey PRIMARY KEY (id),
  CONSTRAINT user_observations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_observations_star_id_fkey FOREIGN KEY (star_id) REFERENCES public.stars(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  display_name text,
  bio text,
  profile_photo_url text,
  telescope_type text,
  experience_level text CHECK (experience_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'expert'::text])),
  level integer DEFAULT 1,
  total_points integer DEFAULT 0,
  referral_code text NOT NULL UNIQUE,
  referred_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'user'::text])),
  is_event_creator boolean DEFAULT false,
  guild_leader_application_status character varying DEFAULT NULL::character varying,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id)
);
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL,
  event_type character varying NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_logs_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id)
);
CREATE TABLE public.webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text,
  url text NOT NULL,
  events ARRAY NOT NULL,
  secret character varying,
  is_active boolean DEFAULT true,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'failed'::character varying]::text[])),
  retry_count integer DEFAULT 0,
  last_triggered_at timestamp with time zone,
  last_success_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhooks_pkey PRIMARY KEY (id)
);