-- Run db:unicode scan/apply FIRST on existing databases. Duplicate canonical names
-- intentionally make this migration fail rather than silently renaming accounts.
CREATE UNIQUE INDEX IF NOT EXISTS users_name_unicode_key ON users
    ((translate(normalize(name, NFKC), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') COLLATE "C"));
