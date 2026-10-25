/** Stable IDs disambiguate members with the same display name. */
export function mentionToken(member: { id: string; name: string | null }) {
    const label = (member.name || '成员').replace(/[\[\]\\\r\n]/g, '')
    return `[@${label}](#mention-${member.id})`
}

export function mentionedUserIds(content: string): string[] {
    // Code examples and escaped links are not mentions.
    const prose = content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`]*`/g, '')
    return [...new Set([...prose.matchAll(/(?<!\\)\[@[^\]\n]+\]\(#mention-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi)].map(match => match[1].toLowerCase()))]
}
