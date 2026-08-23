-- migrate:up
ALTER TABLE billing_items ADD COLUMN purchased_at timestamptz NOT NULL DEFAULT current_timestamp;

-- migrate:down
ALTER TABLE billing_items DROP COLUMN purchased_at;
