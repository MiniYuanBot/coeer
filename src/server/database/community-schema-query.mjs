// Resolve feature tables and columns without reading user data.
export const COMMUNITY_SCHEMA_CHECK_SQL = `
    SELECT n.id, n.user_id, n.type, n.title, n.content, n.href, n.read_at, n.created_at,
           b.user_id, b.post_id, b.created_at,
           p.id, p.user_id, p.email_hash, p.token_hash, p.password_version,
           p.created_at, p.expires_at, p.consumed_at,
           i.id, i.mime_type, i.data, i.uploaded_by, i.created_at,
           a.is_hidden, c.is_hidden
    FROM notifications n CROSS JOIN bookmarks b CROSS JOIN password_resets p CROSS JOIN uploaded_images i
         CROSS JOIN achievements a CROSS JOIN cards c
    LIMIT 0
`
