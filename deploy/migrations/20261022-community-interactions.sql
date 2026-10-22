-- Additive upgrade for persistent post bookmarks.
BEGIN;
CREATE TABLE IF NOT EXISTS bookmarks (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS bookmarks_user_created_idx ON bookmarks(user_id, created_at);
COMMIT;
