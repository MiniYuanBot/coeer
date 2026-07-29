import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type DormQuestionConfig = {
    qid: string
    category: string
    dimension: string
    question_text: string
    options: Array<{ label: string; value: string | number }>
    weight: number
    is_hard: boolean
    active: boolean
    value_type: 'scalar' | 'multi' | 'string'
}

let cached: DormQuestionConfig[] | null = null

export function getDormQuestionConfig(): DormQuestionConfig[] {
    if (cached) return cached
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const jsonPath = path.resolve(currentDir, '../../shared/constants/question_config.json')
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    cached = JSON.parse(raw) as DormQuestionConfig[]
    return cached
}
