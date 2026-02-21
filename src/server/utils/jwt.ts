import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@shared/types/auth';
import { env } from '../config';

const JWT_SECRET = env.JWT_SECRET
const JWT_EXPIRES_IN = '7d';

export function generateToken(payload: Omit<JWTPayload, 'exp' | 'iat'>): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
        return null;
    }
}

export function decodeToken(token: string): JWTPayload | null {
    try {
        return jwt.decode(token) as JWTPayload;
    } catch (error) {
        return null;
    }
}