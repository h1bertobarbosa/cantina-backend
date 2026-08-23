-- migrate:up
CREATE TABLE billing_items (
  id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES transactions ON DELETE RESTRICT,
  billing_id uuid NOT NULL REFERENCES billings ON DELETE RESTRICT,
  type varchar(15) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX billing_items_billing_id_idx ON billing_items (billing_id);
CREATE INDEX billing_items_transaction_id_idx ON billing_items (transaction_id);

-- migrate:down
DROP TABLE billing_items;
