import { z } from 'zod';
import 'dotenv/config'

// Server environment virable schema
const envSchema = z.object({
    // Server-only variables
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CLIENT_URL: z.url().default('http://localhost:5173'),

    PORT: z.coerce.number().default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL environment variable is required'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),

    DB_POOL_MIN: z.coerce.number().min(1).default(2),
    DB_POOL_MAX: z.coerce.number().min(1).default(10),

    // Frontend variables without verify
    VITE_API_URL: z.string().optional(),
    VITE_APP_NAME: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Server-only
function parseEnv(): Env {
    try {
        if (typeof process === 'undefined' || !process.env) {
            throw new Error('This configuration file is for server-side only');
        }
        return envSchema.parse(process.env)
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('\nEnvironment validation failed:\n')
            error.issues.forEach(issue => {
                console.error(`  ${issue.path.join('.')}: ${issue.message}`)
            })
            console.error('\nPlease check your .env file\n')
        } else {
            console.error('Unexpected error:', error)
        }

        process.exit(1)
    }
}

export const env = parseEnv();
