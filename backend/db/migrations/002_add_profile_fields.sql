-- Migration: Add missing columns to farmer_profiles if they don't exist
ALTER TABLE farmer_profiles
ADD COLUMN IF NOT EXISTS education_level VARCHAR(50) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS irrigation_available BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS loan_status VARCHAR(30) DEFAULT 'none' CHECK (loan_status IN ('none', 'active', 'repaid', 'defaulted')),
ADD COLUMN IF NOT EXISTS bank_account_linked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS aadhaar_linked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS caste_category VARCHAR(30) DEFAULT 'general' CHECK (caste_category IN ('general', 'obc', 'sc', 'st', 'nt', 'vjnt')),
ADD COLUMN IF NOT EXISTS livestock TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS soil_type VARCHAR(50) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS water_source VARCHAR(50) DEFAULT 'rainfed',
ADD COLUMN IF NOT EXISTS machinery_owned TEXT[] DEFAULT '{}';
