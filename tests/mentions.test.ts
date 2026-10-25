import { expect, it } from 'vitest'
import { mentionedUserIds, mentionToken } from '@shared/mentions'

it('deduplicates stable IDs and ignores code and escaped mentions', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const token = mentionToken({ id, name: '小明[测试]' })
    expect(mentionedUserIds(`${token} ${token}`)).toEqual([id])
    expect(mentionedUserIds('`' + token + '`\n```md\n' + token + '\n```\n\\' + token)).toEqual([])
    expect(mentionedUserIds('@小明 test@example.com')).toEqual([])
})
