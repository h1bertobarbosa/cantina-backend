-- migrate:up
CREATE TABLE transactions (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients ON DELETE RESTRICT,
  product_id uuid REFERENCES products ON DELETE RESTRICT,
  client_name varchar(150) NOT NULL,
  description varchar(150) NOT NULL,
  payment_method varchar(15) NOT NULL,
  amount decimal(6,2) NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  payed_at timestamptz
);
CREATE INDEX transactions_account_id_idx ON transactions (account_id);
CREATE INDEX transactions_client_id_idx ON transactions (client_id);
CREATE INDEX transactions_payed_at_idx ON transactions (payed_at);

-- migrate:down
DROP TABLE transactions;
