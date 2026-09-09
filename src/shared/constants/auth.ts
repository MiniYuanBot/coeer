export const AUTH = {
    GET_SUCCESS: { code: 'GET_SUCCESS', message: '会话已就绪' } as const,
    LOGIN_SUCCESS: { code: 'LOGIN_SUCCESS', message: '登录成功' } as const,
    SIGNUP_SUCCESS: { code: 'SIGNUP_SUCCESS', message: '注册成功' } as const,
    LOGOUT_SUCCESS: { code: 'LOGOUT_SUCCESS', message: '已退出登录' } as const,

    ALREADY_EXISTS: { code: 'EMAIL_EXISTS', message: '该邮箱已被注册，或密码不正确' } as const,
    NOT_FOUND: { code: 'USER_NOT_FOUND', message: '账号不存在' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: '请先登录' } as const,
    ACCOUNT_INACTIVE: { code: 'ACCOUNT_INACTIVE', message: '账号已被停用，请联系管理员' } as const,
    INVALID_PASSWORD: { code: 'INVALID_PASSWORD', message: '密码错误' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: '服务器开小差了，请稍后再试' } as const,
} as const;

export type AuthCode = typeof AUTH[keyof typeof AUTH]['code'];
export type AuthState = {
    code: AuthCode;
    message: string;
};
