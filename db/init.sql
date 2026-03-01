-- db/init.sql

-- Assets table must come BEFORE asset_events (FK dependency)
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    asset_key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE assets IS 'Stores basic information for all site assets';

CREATE TABLE IF NOT EXISTS asset_events (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE asset_events IS 'Audit trail for all asset-related events';

CREATE TABLE IF NOT EXISTS measurements (
    id BIGSERIAL PRIMARY KEY,
    measurement_id INT NOT NULL,
    time TIMESTAMP NOT NULL DEFAULT now(),
    parameter TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    quality TEXT,
    asset_key VARCHAR(50)
);
COMMENT ON TABLE measurements IS 'Stores measurements for all devices';

CREATE TABLE IF NOT EXISTS "ems-inputs" (
    id BIGSERIAL PRIMARY KEY,
    input_id INT NOT NULL,
    time TIMESTAMP NOT NULL DEFAULT now(),
    parameter TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    quality TEXT,
    objective VARCHAR(100)
);
COMMENT ON TABLE "ems-inputs" IS 'Stores inputs which were used for optimization';

CREATE TABLE IF NOT EXISTS "ems-outputs" (
    id BIGSERIAL PRIMARY KEY,
    output_id INT NOT NULL,
    time TIMESTAMP NOT NULL DEFAULT now(),
    parameter TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    quality TEXT,
    objective VARCHAR(100)
);
COMMENT ON TABLE "ems-outputs" IS 'Stores outputs which were used for optimization';

CREATE TABLE IF NOT EXISTS forecasts (
    id SERIAL PRIMARY KEY,
    asset_key VARCHAR(50) NOT NULL,
    forecast_timestamp TIMESTAMP NOT NULL,
    horizon_timestamp TIMESTAMP NOT NULL,
    predicted_power FLOAT NOT NULL,
    confidence_lower FLOAT,
    confidence_upper FLOAT,
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_asset FOREIGN KEY (asset_key)
        REFERENCES assets(asset_key) ON DELETE CASCADE,
    CONSTRAINT unique_forecast UNIQUE (asset_key, forecast_timestamp, horizon_timestamp)
);
COMMENT ON TABLE forecasts IS 'Stores ahead-forecasts for devices';

CREATE TABLE IF NOT EXISTS model_metadata (
    id SERIAL PRIMARY KEY,
    asset_key VARCHAR(50) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    training_start_date TIMESTAMP NOT NULL,
    training_end_date TIMESTAMP NOT NULL,
    samples_count INTEGER NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    model_params JSONB,
    performance_metrics JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    trained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_model_asset FOREIGN KEY (asset_key)
        REFERENCES assets(asset_key) ON DELETE CASCADE
);
COMMENT ON TABLE model_metadata IS 'Stores metadata of forecasting models';

CREATE TABLE IF NOT EXISTS forecast_readiness (
    id SERIAL PRIMARY KEY,
    asset_key VARCHAR(50) UNIQUE NOT NULL,
    total_samples INTEGER DEFAULT 0,
    first_measurement TIMESTAMP,
    last_measurement TIMESTAMP,
    data_coverage_pct FLOAT,
    min_samples_required INTEGER DEFAULT 672,
    is_ready_for_forecast BOOLEAN DEFAULT FALSE,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_readiness_asset FOREIGN KEY (asset_key)
        REFERENCES assets(asset_key) ON DELETE CASCADE
);
COMMENT ON TABLE forecast_readiness IS 'Stores information about minimum required data for individual assets';

CREATE TABLE IF NOT EXISTS metrics_summary (
    id SERIAL PRIMARY KEY,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    calculation_time TIMESTAMP NOT NULL,
    metric_category VARCHAR(50) NOT NULL,
    metrics_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_start, period_end, metric_category)
);
COMMENT ON TABLE metrics_summary IS 'Stores general calculated metrics';

CREATE TABLE IF NOT EXISTS asset_metrics (
    id SERIAL PRIMARY KEY,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    asset_key VARCHAR(50) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE PRECISION,
    metric_unit VARCHAR(20),
    calculation_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_start, period_end, asset_key, metric_name)
);
COMMENT ON TABLE asset_metrics IS 'Stores asset related metrics';

CREATE TABLE IF NOT EXISTS metrics_timeseries (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    asset_key VARCHAR(50),
    parameter VARCHAR(100) NOT NULL,
    aggregated_value DOUBLE PRECISION,
    aggregation_type VARCHAR(20) NOT NULL,
    aggregation_interval VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp, asset_key, parameter, aggregation_type, aggregation_interval)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'guest'
        CHECK (role IN ('maintainer', 'guest')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE users IS 'Stores users, roles and encrypted passwords';

CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON session (expire);
COMMENT ON TABLE session IS 'Stores session data for logged users ';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forecasts_asset_horizon ON forecasts(asset_key, horizon_timestamp);
CREATE INDEX IF NOT EXISTS idx_forecasts_timestamp ON forecasts(forecast_timestamp);
CREATE INDEX IF NOT EXISTS idx_model_metadata_asset ON model_metadata(asset_key, is_active);
CREATE INDEX IF NOT EXISTS idx_readiness_ready ON forecast_readiness(is_ready_for_forecast);
CREATE INDEX IF NOT EXISTS idx_metrics_summary_period ON metrics_summary(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_metrics_summary_category ON metrics_summary(metric_category);
CREATE INDEX IF NOT EXISTS idx_asset_metrics_period ON asset_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_asset_metrics_asset ON asset_metrics(asset_key);
CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_timestamp ON metrics_timeseries(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_asset_param ON metrics_timeseries(asset_key, parameter);

-- Default admin user (password: 'admin' — change immediately in production)
INSERT INTO users (username, password, role)
VALUES ('admin', '$2b$12$KyMHN3/33VrD1hiieGV7juJUiG5XBi1.d354cK4Lw2mitpVEvK/t.', 'maintainer')
ON CONFLICT DO NOTHING;