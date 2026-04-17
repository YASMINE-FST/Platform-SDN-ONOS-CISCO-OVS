CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');
CREATE TYPE alert_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved', 'false_positive');
CREATE TYPE device_status AS ENUM ('active', 'inactive', 'unknown');
CREATE TYPE flow_action AS ENUM ('allow', 'drop', 'redirect', 'mirror');

-- USERS
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(64) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret      TEXT,
    mfa_backup_codes TEXT[],
    last_login      TIMESTAMPTZ,
    last_login_ip   INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REFRESH TOKENS
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    device_info TEXT,
    ip_address  INET,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    username    VARCHAR(64),
    action      VARCHAR(128) NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    success     BOOLEAN NOT NULL DEFAULT TRUE,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DEVICES
CREATE TABLE devices (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    onos_id      VARCHAR(128) UNIQUE,
    name         VARCHAR(128) NOT NULL,
    type         VARCHAR(64),
    ip_address   INET,
    status       device_status NOT NULL DEFAULT 'unknown',
    manufacturer VARCHAR(128),
    sw_version   VARCHAR(64),
    ports        JSONB DEFAULT '[]',
    location     VARCHAR(255),
    last_seen    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FLOW RULES
CREATE TABLE flow_rules (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id        VARCHAR(128) UNIQUE,
    device_id      UUID REFERENCES devices(id) ON DELETE CASCADE,
    onos_device_id VARCHAR(128),
    priority       INTEGER NOT NULL DEFAULT 100,
    is_permanent   BOOLEAN DEFAULT TRUE,
    timeout        INTEGER DEFAULT 0,
    action         flow_action NOT NULL DEFAULT 'allow',
    match_criteria JSONB NOT NULL DEFAULT '{}',
    instructions   JSONB NOT NULL DEFAULT '{}',
    bytes          BIGINT DEFAULT 0,
    packets        BIGINT DEFAULT 0,
    created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ALERTS
CREATE TABLE alerts (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    severity         alert_severity NOT NULL DEFAULT 'medium',
    status           alert_status NOT NULL DEFAULT 'open',
    source_ip        INET,
    destination_ip   INET,
    source_port      INTEGER,
    destination_port INTEGER,
    protocol         VARCHAR(32),
    device_id        UUID REFERENCES devices(id) ON DELETE SET NULL,
    mitre_tactic     VARCHAR(128),
    mitre_technique  VARCHAR(128),
    acknowledged_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at  TIMESTAMPTZ,
    resolved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at      TIMESTAMPTZ,
    notes            TEXT,
    raw_payload      JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI DETECTIONS
CREATE TABLE ai_detections (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id     UUID REFERENCES alerts(id) ON DELETE CASCADE,
    model_name   VARCHAR(128) NOT NULL,
    attack_type  VARCHAR(128),
    confidence   FLOAT CHECK (confidence BETWEEN 0 AND 1),
    is_anomaly   BOOLEAN NOT NULL,
    features     JSONB DEFAULT '{}',
    explanation  JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEX
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_flows_device ON flow_rules(device_id);

-- AUTO updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_flows_updated BEFORE UPDATE ON flow_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

