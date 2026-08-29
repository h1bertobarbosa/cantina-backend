-- migrate:up
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs (created_at);
CREATE INDEX IF NOT EXISTS logs_log_type_idx ON logs (log_type);
CREATE INDEX IF NOT EXISTS logs_user_email_idx ON logs (user_email);
CREATE INDEX IF NOT EXISTS logs_account_id_created_at_idx ON logs (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS logs_obs_trgm_idx ON logs USING gin (obs gin_trgm_ops);
CREATE INDEX IF NOT EXISTS logs_user_email_trgm_idx ON logs USING gin (user_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS logs_data_text_trgm_idx ON logs USING gin ((data::text) gin_trgm_ops);

-- migrate:down
DROP INDEX IF EXISTS logs_data_text_trgm_idx;
DROP INDEX IF EXISTS logs_user_email_trgm_idx;
DROP INDEX IF EXISTS logs_obs_trgm_idx;
DROP INDEX IF EXISTS logs_account_id_created_at_idx;
DROP INDEX IF EXISTS logs_user_email_idx;
DROP INDEX IF EXISTS logs_log_type_idx;
DROP INDEX IF EXISTS logs_created_at_idx;
