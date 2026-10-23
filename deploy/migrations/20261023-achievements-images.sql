-- Add explicit achievement conditions and durable administrator image uploads.
-- New enum values are used only after this transaction has committed.
BEGIN;
ALTER TYPE achievement_condition_type ADD VALUE IF NOT EXISTS 'registration';
ALTER TYPE achievement_condition_type ADD VALUE IF NOT EXISTS 'login_days';
ALTER TYPE achievement_condition_type ADD VALUE IF NOT EXISTS 'points_earned';
ALTER TYPE achievement_condition_type ADD VALUE IF NOT EXISTS 'feedback_count';
ALTER TYPE achievement_condition_type ADD VALUE IF NOT EXISTS 'group_count';
ALTER TYPE achievement_condition_type ADD VALUE IF NOT EXISTS 'card_count';
CREATE TABLE IF NOT EXISTS uploaded_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mime_type varchar(30) NOT NULL,
    data text NOT NULL,
    uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
