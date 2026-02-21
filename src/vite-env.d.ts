/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly DATABASE_URL: string

    readonly SESSION_SECRET: string
    readonly JWT_SECRET: string

    readonly NODE_ENV: 'development' | 'production' | 'test'
    readonly PORT: string
    readonly CLIENT_URL: string

    readonly DB_POOL_MIN: string
    readonly DB_POOL_MAX: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}