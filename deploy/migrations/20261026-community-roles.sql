-- Commit enum additions before using them in data changes.
BEGIN;
ALTER TYPE group_member_role ADD VALUE IF NOT EXISTS 'owner';
COMMIT;
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE bulletins ADD COLUMN IF NOT EXISTS notification_mode varchar(10) NOT NULL DEFAULT 'none'
    CHECK (notification_mode IN ('none', 'modal', 'banner'));
-- Restore creators' memberships on the first upgrade. Do not undo later transfers.
INSERT INTO group_members (group_id, user_id, role, status)
SELECT g.id, g.creator_id, 'owner', 'approved' FROM groups g
WHERE g.creator_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.role = 'owner')
ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner', status = 'approved';
-- Legacy groups whose creator account was deleted keep their earliest approved member as owner.
UPDATE group_members SET role = 'owner'
WHERE id IN (SELECT DISTINCT ON (m.group_id) m.id FROM group_members m
    WHERE m.status = 'approved' AND NOT EXISTS (SELECT 1 FROM group_members o WHERE o.group_id = m.group_id AND o.role = 'owner')
    ORDER BY m.group_id, (m.role = 'admin') DESC, m.joined_at, m.id);
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY group_id ORDER BY joined_at, id) AS rank
    FROM group_members WHERE role = 'admin')
UPDATE group_members SET role = 'member' WHERE id IN (SELECT id FROM ranked WHERE rank > 3);
CREATE UNIQUE INDEX IF NOT EXISTS group_members_one_owner_idx ON group_members(group_id) WHERE role = 'owner';
COMMIT;
