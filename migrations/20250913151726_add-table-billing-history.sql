-- migrate:up
CREATE TABLE billing_history (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients ON DELETE RESTRICT,
  description text NOT NULL,
  amount decimal(6,2) NOT NULL,
  ocurrency_date timestamptz NOT NULL DEFAULT current_timestamp,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX billing_history_account_id_idx ON billing_history (account_id);
CREATE INDEX billing_history_account_id_client_id_idx ON billing_history (account_id, client_id);

-- migrate:down
DROP TABLE billing_history;
