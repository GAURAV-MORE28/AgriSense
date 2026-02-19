-- Migration: Add otp_tokens table for existing databases
-- Run this if your database was created before otp_tokens was added to init.sql

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
