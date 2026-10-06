-- migrate:up
ALTER TABLE billings
  ADD COLUMN status varchar(20);

UPDATE billings
SET status = CASE
  WHEN payed_at IS NOT NULL THEN 'PAID'
  WHEN COALESCE(amount, 0) < 0 THEN 'CREDIT_BALANCE'
  WHEN COALESCE(amount_payed, 0) > 0 THEN 'PARTIAL'
  ELSE 'OPEN'
END;

ALTER TABLE billings
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'OPEN',
  ADD CONSTRAINT billings_status_chk
    CHECK (status IN ('OPEN', 'PARTIAL', 'PAID', 'CREDIT_BALANCE'));

CREATE UNIQUE INDEX billings_one_active_per_client_idx
  ON billings (account_id, client_id)
  WHERE status IN ('OPEN', 'PARTIAL');

CREATE INDEX billings_account_client_status_idx
  ON billings (account_id, client_id, status);

ALTER TABLE billing_items
  ADD COLUMN reversal_of_item_id uuid REFERENCES billing_items(id) ON DELETE RESTRICT,
  ADD COLUMN reversal_reason text,
  ADD COLUMN reversed_at timestamptz,
  ADD COLUMN reversed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reversed_by_user_name text,
  ADD COLUMN reversed_by_user_email text,
  ADD CONSTRAINT billing_items_reversal_metadata_chk
    CHECK (
      (
        reversal_of_item_id IS NULL
        AND reversal_reason IS NULL
        AND reversed_at IS NULL
        AND reversed_by_user_id IS NULL
        AND reversed_by_user_name IS NULL
        AND reversed_by_user_email IS NULL
      )
      OR (
        reversal_of_item_id IS NOT NULL
        AND reversal_reason IS NOT NULL
        AND reversed_at IS NOT NULL
      )
    );

CREATE UNIQUE INDEX billing_items_one_reversal_per_item_idx
  ON billing_items (reversal_of_item_id)
  WHERE reversal_of_item_id IS NOT NULL;

CREATE INDEX billing_items_reversal_of_item_id_idx
  ON billing_items (reversal_of_item_id);

-- migrate:down
DROP INDEX IF EXISTS billing_items_reversal_of_item_id_idx;
DROP INDEX IF EXISTS billing_items_one_reversal_per_item_idx;

ALTER TABLE billing_items
  DROP CONSTRAINT IF EXISTS billing_items_reversal_metadata_chk,
  DROP COLUMN IF EXISTS reversed_by_user_email,
  DROP COLUMN IF EXISTS reversed_by_user_name,
  DROP COLUMN IF EXISTS reversed_by_user_id,
  DROP COLUMN IF EXISTS reversed_at,
  DROP COLUMN IF EXISTS reversal_reason,
  DROP COLUMN IF EXISTS reversal_of_item_id;

DROP INDEX IF EXISTS billings_account_client_status_idx;
DROP INDEX IF EXISTS billings_one_active_per_client_idx;

ALTER TABLE billings
  DROP CONSTRAINT IF EXISTS billings_status_chk,
  DROP COLUMN IF EXISTS status;
