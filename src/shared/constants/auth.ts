export const AUTH = {
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    LOGIN_SUCCESS: { code: 'LOGIN_SUCCESS', message: 'Login successful' } as const,
    SIGNUP_SUCCESS: { code: 'SIGNUP_SUCCESS', message: 'Signup successful' } as const,
    LOGOUT_SUCCESS: { code: 'LOGOUT_SUCCESS', message: 'Logout successful' } as const,
    
    ALREADY_EXISTS: { code: 'EMAIL_EXISTS', message: 'User already exists' } as const,
    NOT_FOUND: { code: 'USER_NOT_FOUND', message: 'User not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    INVALID_PASSWORD: { code: 'INVALID_PASSWORD', message: 'Incorrect password' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const;

export type AuthCode = typeof AUTH[keyof typeof AUTH]['code'];
export type AuthState = {
    code: AuthCode;
    message: string;
};