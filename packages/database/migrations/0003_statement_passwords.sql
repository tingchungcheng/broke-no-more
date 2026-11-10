-- Preset passwords for opening the user's own statement files. The password is sealed before it is stored.

CREATE TABLE statement_passwords (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  encryption_key_version TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX statement_passwords_user_id_idx ON statement_passwords (user_id);
CREATE UNIQUE INDEX statement_passwords_user_label_unique ON statement_passwords (user_id, lower(label));
