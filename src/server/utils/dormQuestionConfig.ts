import questionConfig from '@shared/constants/question_config.json'

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
    cached = questionConfig as DormQuestionConfig[]
    return cached
}
