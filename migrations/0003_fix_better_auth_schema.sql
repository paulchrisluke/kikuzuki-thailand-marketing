-- Fix Better Auth account table schema
-- Add missing refreshTokenExpiresAt and scope columns

ALTER TABLE account ADD COLUMN refreshTokenExpiresAt TEXT;
ALTER TABLE account ADD COLUMN scope TEXT;
