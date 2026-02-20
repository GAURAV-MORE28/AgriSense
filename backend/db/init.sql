-- KRISHI-AI Database Schema
-- PostgreSQL initialization script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- OTP tokens table (for OTP persistence)
CREATE TABLE IF NOT EXISTS otp_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile VARCHAR(10) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_mobile ON otp_tokens(mobile);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile VARCHAR(10) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Farmer profiles table
CREATE TABLE IF NOT EXISTS farmer_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(10) NOT NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    village VARCHAR(100),
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    land_type VARCHAR(20) CHECK (land_type IN ('irrigated', 'dry', 'mixed')),
    acreage DECIMAL(10, 2) NOT NULL,
    main_crops TEXT[] NOT NULL,
    family_count INTEGER NOT NULL,
    annual_income DECIMAL(12, 2) NOT NULL,
    farmer_type VARCHAR(20) CHECK (farmer_type IN ('owner', 'tenant', 'sharecropper')),
    -- Extended profile fields
    education_level VARCHAR(50) DEFAULT 'none',
    irrigation_available BOOLEAN DEFAULT FALSE,
    loan_status VARCHAR(30) DEFAULT 'none' CHECK (loan_status IN ('none', 'active', 'repaid', 'defaulted')),
    bank_account_linked BOOLEAN DEFAULT FALSE,
    aadhaar_linked BOOLEAN DEFAULT FALSE,
    caste_category VARCHAR(30) DEFAULT 'general' CHECK (caste_category IN ('general', 'obc', 'sc', 'st', 'nt', 'vjnt')),
    livestock TEXT[] DEFAULT '{}',
    soil_type VARCHAR(50) DEFAULT 'unknown',
    water_source VARCHAR(50) DEFAULT 'rainfed',
    machinery_owned TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    doc_type VARCHAR(50),
    ocr_fields JSONB,
    ocr_confidence DECIMAL(3, 2),
    file_path VARCHAR(500),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
    application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    profile_id UUID REFERENCES farmer_profiles(profile_id),
    scheme_id VARCHAR(50) NOT NULL,
    scheme_name VARCHAR(255) NOT NULL,
    documents UUID[] DEFAULT '{}',
    form_data JSONB,
    gov_application_id VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    status_history JSONB DEFAULT '[]',
    synced BOOLEAN DEFAULT TRUE,
    client_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sync queue table for offline support (persistent)
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    operation VARCHAR(20) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    client_id VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat history table for persistent chatbot conversations
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    language VARCHAR(5) DEFAULT 'en',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Schemes table
CREATE TABLE IF NOT EXISTS schemes (
    scheme_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_hi VARCHAR(255),
    name_mr VARCHAR(255),
    description TEXT,
    description_hi TEXT,
    description_mr TEXT,
    benefit_estimate DECIMAL(12, 2),
    benefit_type VARCHAR(50), -- "subsidy", "loan", "direct_transfer", "insurance"
    eligibility_rules JSONB NOT NULL,
    required_documents TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    department VARCHAR(255),
    state VARCHAR(100), -- NULL for central schemes
    is_active BOOLEAN DEFAULT TRUE,
    priority_weight DECIMAL(3, 2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schemes_state ON schemes(state);
CREATE INDEX IF NOT EXISTS idx_schemes_active ON schemes(is_active);
CREATE INDEX idx_profiles_user_id ON farmer_profiles(user_id);
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_sync_queue_user_status ON sync_queue(user_id, status);
CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON farmer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
