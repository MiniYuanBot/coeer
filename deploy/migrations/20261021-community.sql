-- Additive upgrade. Existing users and business data are preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type varchar(40) NOT NULL,
    title varchar(200) NOT NULL,
    content text NOT NULL,
    href text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at);
CREATE TABLE IF NOT EXISTS password_resets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    email_hash varchar(64) NOT NULL,
    token_hash varchar(64) NOT NULL UNIQUE,
    password_version varchar(64),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS password_resets_email_created_idx ON password_resets(email_hash, created_at);
COMMIT;
