-- Add deactivated_at column to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
