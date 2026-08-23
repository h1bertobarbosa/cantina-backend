-- migrate:up
CREATE TABLE logs (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users ON DELETE RESTRICT,
  data jsonb NOT NULL,
  log_type varchar(30) NOT NULL,
  obs text,
  created_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX logs_account_id_idx ON logs (account_id);
CREATE INDEX logs_user_id_idx ON logs (user_id);

-- migrate:down
DROP TABLE logs;
