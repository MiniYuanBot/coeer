import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL environment variable is required'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),

    CLIENT_URL: z.string().url().optional().default('http://localhost:5173'),
    API_URL: z.string().url().optional(),

    DB_POOL_MIN: z.coerce.number().min(1).default(2),
    DB_POOL_MAX: z.coerce.number().min(1).default(10),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
    try {
        if (typeof process !== 'undefined' && process.env) {
            return envSchema.parse(process.env)  // Node.js
        }

        if (typeof import.meta !== 'undefined' && import.meta.env) {
            return envSchema.parse(import.meta.env)  // Browser
        }

        throw new Error('Unable to detect environment')
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('\n❌ Environment validation failed:\n')
            error.issues.forEach(issue => {
                console.error(`  ${issue.path.join('.')}: ${issue.message}`)
            })
            console.error('\n📝 Please check your .env file\n')
        } else {
            console.error('❌ Unexpected error:', error)
        }

        // Only exit in Node.js environment
        if (typeof process !== 'undefined' && process.exit) {
            process.exit(1)
        }

        // In browser, throw for error boundary
        throw new Error('Environment configuration error')
    }
}

export const env = parseEnv();

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';