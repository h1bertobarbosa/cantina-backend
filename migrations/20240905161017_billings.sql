-- migrate:up
CREATE TABLE billings (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients ON DELETE RESTRICT,
  payment_method varchar(15) NOT NULL,
  description varchar(150) NOT NULL,
  amount decimal(6,2) NOT NULL,
  amount_payed decimal(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  payed_at timestamptz
);
CREATE INDEX billings_account_id_idx ON billings (account_id);
CREATE INDEX billings_client_id_idx ON billings (client_id);
CREATE INDEX billings_payed_at_idx ON billings (payed_at);

-- migrate:down
DROP TABLE billings;
