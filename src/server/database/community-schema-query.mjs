// Resolve feature tables and columns without reading user data.
export const COMMUNITY_SCHEMA_CHECK_SQL = `
    SELECT n.id, n.user_id, n.type, n.title, n.content, n.href, n.read_at, n.created_at,
           b.user_id, b.post_id, b.created_at,
           p.id, p.user_id, p.email_hash, p.token_hash, p.password_version,
           p.created_at, p.expires_at, p.consumed_at
    FROM notifications n CROSS JOIN bookmarks b CROSS JOIN password_resets p
    LIMIT 0
`
