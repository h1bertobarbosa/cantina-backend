-- migrate:up
ALTER TABLE logs
  ADD COLUMN user_name text,
  ADD COLUMN user_email text;

UPDATE logs
SET
  user_name = users.name,
  user_email = users.email
FROM users
WHERE logs.user_id = users.id;

ALTER TABLE logs
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE logs
  DROP CONSTRAINT IF EXISTS logs_user_id_fkey,
  ADD CONSTRAINT logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- migrate:down
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM logs WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot revert logs.user_id to NOT NULL while logs with NULL user_id exist';
  END IF;
END
$$;

ALTER TABLE logs
  DROP CONSTRAINT IF EXISTS logs_user_id_fkey,
  ADD CONSTRAINT logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE logs
  ALTER COLUMN user_id SET NOT NULL,
  DROP COLUMN user_email,
  DROP COLUMN user_name;
