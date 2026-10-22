import { isAbsolute, relative, sep } from 'node:path'

/** Private files may live outside the project, or inside its ignored .coeer-local directory. */
export function isPrivateRuntimePath(path: string) {
    const rel = relative(process.cwd(), path)
    return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
        || rel === '.coeer-local' || rel.startsWith(`.coeer-local${sep}`)
}
