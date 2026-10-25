import { usernameError } from '../src/shared/username-policy.mjs'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { hash } from 'bcryptjs'

export function validateAdministratorInput(email, name, password, confirmation) {
  const normalized = email.trim().toLowerCase()
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalized) || normalized.length > 254) throw new Error('请输入有效的管理员邮箱。')
  const nameError = usernameError(name)
  if (nameError) throw new Error(nameError)
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('密码至少 8 位，最多 72 字节。')
  if (password !== confirmation) throw new Error('两次密码输入不一致。')
  return { email: normalized, name: name.normalize('NFKC') }
}

export async function promptAdministrator({ input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY || !output.isTTY) throw new Error('setup 需要交互式终端；不接受密码参数或管道输入。')
  let muted = false
  const terminal = new Writable({ write(chunk, encoding, callback) { if (!muted) output.write(chunk, encoding); callback() } })
  const controller = new AbortController()
  const reader = createInterface({ input, output: terminal, terminal: true })
  reader.on('SIGINT', () => controller.abort())
  reader.on('close', () => controller.abort())
  const question = async (label, hidden = false) => {
    output.write(label)
    muted = hidden
    try { return await reader.question('', { signal: controller.signal }) }
    finally { muted = false; if (hidden) output.write('\n') }
  }
  try {
    const email = await question('管理员邮箱：')
    const name = await question('管理员昵称：')
    const password = await question('管理员密码（不回显）：', true)
    const confirmation = await question('再次输入密码（不回显）：', true)
    const values = validateAdministratorInput(email, name, password, confirmation)
    return { ...values, passwordHash: await hash(password, 12) }
  } finally { reader.close(); terminal.end() }
}
