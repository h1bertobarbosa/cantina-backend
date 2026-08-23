-- migrate:up
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  name varchar(150) NOT NULL,
  email varchar(150) NOT NULL,
  document varchar(20) NOT NULL,
  slug varchar(150) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE UNIQUE INDEX accounts_slug_idx ON accounts (slug);

-- migrate:down
DROP TABLE accounts;
