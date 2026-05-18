-- Migration: Add delivery URL columns to business_locations if missing
-- Defensive: Only adds columns if they do not already exist

-- Add grab_url
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pragma_table_info('business_locations') WHERE name = 'grab_url') THEN
        ALTER TABLE business_locations ADD COLUMN grab_url TEXT;
    END IF;
END$$;

-- Add uber_eats_url
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pragma_table_info('business_locations') WHERE name = 'uber_eats_url') THEN
        ALTER TABLE business_locations ADD COLUMN uber_eats_url TEXT;
    END IF;
END$$;

-- Add foodpanda_url
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pragma_table_info('business_locations') WHERE name = 'foodpanda_url') THEN
        ALTER TABLE business_locations ADD COLUMN foodpanda_url TEXT;
    END IF;
END$$;
