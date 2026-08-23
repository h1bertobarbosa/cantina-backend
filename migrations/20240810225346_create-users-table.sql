-- migrate:up
CREATE TABLE users (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  name varchar(150) NOT NULL,
  email varchar(150) NOT NULL,
  password varchar(150) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX users_account_id_idx ON users (account_id);
CREATE UNIQUE INDEX users_account_id_email_idx ON users (account_id, email);

-- migrate:down
DROP TABLE users;
