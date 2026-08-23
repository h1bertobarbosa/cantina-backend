-- migrate:up
CREATE TABLE clients (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  name varchar(150) NOT NULL,
  phone varchar(150) NOT NULL,
  email varchar(150),
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX clients_account_id_idx ON clients (account_id);

-- migrate:down
DROP TABLE clients;
