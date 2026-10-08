-- migrate:up
ALTER TABLE clients
  ADD CONSTRAINT clients_id_account_id_uniq UNIQUE (id, account_id),
  ADD COLUMN responsible_client_id uuid,
  ADD CONSTRAINT clients_responsible_not_self_chk
    CHECK (
      responsible_client_id IS NULL
      OR responsible_client_id <> id
    ),
  ADD CONSTRAINT clients_responsible_same_account_fkey
    FOREIGN KEY (responsible_client_id, account_id)
    REFERENCES clients (id, account_id)
    ON DELETE RESTRICT;

CREATE INDEX clients_account_responsible_idx
  ON clients (account_id, responsible_client_id)
  WHERE responsible_client_id IS NOT NULL;

-- migrate:down
DROP INDEX IF EXISTS clients_account_responsible_idx;

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_responsible_same_account_fkey,
  DROP CONSTRAINT IF EXISTS clients_responsible_not_self_chk,
  DROP COLUMN IF EXISTS responsible_client_id,
  DROP CONSTRAINT IF EXISTS clients_id_account_id_uniq;
