-- Fix Better Auth account table schema
-- Add missing accessTokenExpiresAt column

ALTER TABLE account ADD COLUMN accessTokenExpiresAt TEXT;
