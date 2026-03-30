-- Parody Everything Database Schema for Neon
-- Run this in the Neon SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles table (linked to Clerk user IDs)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,  -- Clerk user ID
  email TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'single', 'creator', 'pro')),
  parodies_used INT DEFAULT 0,
  parodies_limit INT DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  creator_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parodies table
CREATE TABLE IF NOT EXISTS parodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id),
  slug TEXT UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  site_type TEXT CHECK (site_type IN ('ecommerce', 'travel', 'social', 'booking', 'news', 'corporate', 'food', 'other')),
  parody_name TEXT,
  parody_data JSONB,
  parody_config JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'generating', 'complete', 'failed')),
  expires_at TIMESTAMP WITH TIME ZONE,
  backlink_size TEXT DEFAULT 'large' CHECK (backlink_size IN ('large', 'small', 'none')),
  creator_url TEXT,
  tone TEXT DEFAULT 'negative' CHECK (tone IN ('positive', 'negative', 'balanced', 'erotic')),
  theme TEXT DEFAULT 'default' CHECK (theme IN ('default', 'christmas', 'easter', 'sport', 'sensual', 'retro')),
  notification_email TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: Add error_message column if it doesn't exist
-- ALTER TABLE parodies ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Engagement tracking columns
-- Run these as migrations on existing database:
-- ALTER TABLE parodies ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;
-- ALTER TABLE parodies ADD COLUMN IF NOT EXISTS share_count INT DEFAULT 0;
-- ALTER TABLE parodies ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{"dead":0,"fire":0,"savage":0,"too_real":0}';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_parodies_user_id ON parodies(user_id);
CREATE INDEX IF NOT EXISTS idx_parodies_slug ON parodies(slug);
CREATE INDEX IF NOT EXISTS idx_parodies_status ON parodies(status);
