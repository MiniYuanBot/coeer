export const AUTH = {
    GET_SUCCESS: { code: 'GET_SUCCESS', message: '会话已就绪' } as const,
    LOGIN_SUCCESS: { code: 'LOGIN_SUCCESS', message: '登录成功' } as const,
    SIGNUP_SUCCESS: { code: 'SIGNUP_SUCCESS', message: '注册成功' } as const,
    LOGOUT_SUCCESS: { code: 'LOGOUT_SUCCESS', message: '已退出登录' } as const,
    PROFILE_UPDATED: { code: 'PROFILE_UPDATED', message: '昵称已更新' } as const,
    PASSWORD_CHANGED: { code: 'PASSWORD_CHANGED', message: '密码已更新，请重新登录' } as const,
    RESET_REQUESTED: { code: 'RESET_REQUESTED', message: '如果该邮箱对应有效账号，你会收到密码重置邮件。请检查收件箱和垃圾邮件，并稍后再试。' } as const,
    RESET_INVALID: { code: 'RESET_INVALID', message: '重置链接无效或已过期，请重新申请' } as const,
    MAIL_UNAVAILABLE: { code: 'MAIL_UNAVAILABLE', message: '密码找回服务暂不可用，请联系管理员' } as const,

    INVALID_STUDENT_EMAIL: { code: 'INVALID_STUDENT_EMAIL', message: '请使用 10 位学号的学生邮箱注册，例如 2026201234@stu.pku.edu.cn' } as const,
    INVALID_INPUT: { code: 'INVALID_INPUT', message: '请检查输入内容' } as const,
    INVALID_CURRENT_PASSWORD: { code: 'INVALID_CURRENT_PASSWORD', message: '当前密码不正确' } as const,
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
