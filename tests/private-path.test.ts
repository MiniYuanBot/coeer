import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPrivateJSON } from '../src/server/open-space/adapters/official/config'
import { privateTarget } from '../src/server/open-space/adapters/official/session'

let directory: string | undefined
afterEach(() => { vi.restoreAllMocks(); if (directory) rmSync(directory, { recursive: true, force: true }) })

describe('local private runtime files', () => {
    it('permits the ignored directory and external files, while refusing source/public paths', () => {
        directory = mkdtempSync(join(tmpdir(), 'coeer-private-test-'))
        const project = join(directory, 'project')
        mkdirSync(join(project, '.coeer-local'), { recursive: true, mode: 0o700 })
        mkdirSync(join(project, 'public'))
        vi.spyOn(process, 'cwd').mockReturnValue(project)
        const privateFile = join(project, '.coeer-local', 'fixture.json')
        const externalFile = join(directory, 'outside.json')
        const publicFile = join(project, 'public', 'fixture.json')
        for (const file of [privateFile, externalFile, publicFile]) writeFileSync(file, '{"private":true}', { mode: 0o600 })
        expect(readPrivateJSON(privateFile)).toEqual({ private: true })
        expect(readPrivateJSON(externalFile)).toEqual({ private: true })
        expect(() => readPrivateJSON(publicFile)).toThrow()
        expect(() => privateTarget(join(project, '.coeer-local', 'new-session.json'))).not.toThrow()
        expect(() => privateTarget(join(project, 'public', 'new-session.json'))).toThrow()
    })
})
