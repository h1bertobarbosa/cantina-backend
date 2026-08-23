-- migrate:up
CREATE TABLE products (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE RESTRICT,
  name varchar(150) NOT NULL,
  price decimal(6,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX products_account_id_idx ON products (account_id);

-- migrate:down
DROP TABLE products;
