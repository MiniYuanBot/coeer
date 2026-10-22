import nodemailer from 'nodemailer'

function mailConfig() {
    const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_URL } = process.env
    if (!SMTP_HOST || !SMTP_FROM || !APP_URL || (!!SMTP_USER !== !!SMTP_PASSWORD)) return null
    const port = Number(SMTP_PORT)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null
    try {
        const url = new URL(APP_URL)
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return null
        return { host: SMTP_HOST, port, from: SMTP_FROM, origin: url.origin, user: SMTP_USER, password: SMTP_PASSWORD }
    } catch { return null }
}

export function passwordResetMailConfigured() { return mailConfig() !== null }

export async function sendPasswordResetEmail(email: string, token: string) {
    const config = mailConfig()
    if (!config) throw new Error('Password reset mail is not configured')
    const transport = nodemailer.createTransport({
        host: config.host, port: config.port, secure: config.port === 465,
        requireTLS: config.port !== 465,
        auth: config.user ? { user: config.user, pass: config.password } : undefined,
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    })
    // The fragment is never sent in HTTP requests or Referer headers.
    const link = `${config.origin}/reset-password#token=${token}`
    await transport.sendMail({
        from: config.from, to: email, subject: '重置你的 COEER 密码',
        text: `你申请了重置 COEER 密码。请在 30 分钟内打开以下链接设置新密码：\n\n${link}\n\n链接仅可使用一次。如果不是你本人申请，请忽略此邮件。`,
    })
}
