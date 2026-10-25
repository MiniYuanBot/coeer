-- Run through the normal database upgrade command during a maintenance window.
-- A bounded lock wait makes a busy database fail safely; retry after traffic subsides.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE INDEX IF NOT EXISTS point_transactions_user_created_idx ON point_transactions(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS point_transactions_user_type_source_created_idx ON point_transactions(user_id, type, source, created_at);
CREATE INDEX IF NOT EXISTS group_members_user_status_idx ON group_members(user_id, status, group_id);
CREATE INDEX IF NOT EXISTS group_posts_group_feed_idx ON group_posts(group_id, is_pinned DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS group_posts_created_idx ON group_posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS feedbacks_author_created_idx ON feedbacks(author_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, created_at DESC, id DESC) WHERE read_at IS NULL;
COMMIT;
