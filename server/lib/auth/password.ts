import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const PASSWORD_HASH_PREFIX = 'scrypt'
const KEY_LENGTH = 64

/**
 * 生成后台管理员密码哈希。
 * 使用 Node 内置 scrypt，避免新增重依赖；保存格式保留算法参数，便于后续升级。
 */
export async function hashAdminPassword(password: string): Promise<string> {
  const normalized = String(password ?? '')
  if (!normalized) {
    throw createError({ statusCode: 400, message: '密码不能为空' })
  }

  const salt = randomBytes(16).toString('base64url')
  const n = 16384
  const r = 8
  const p = 1
  const derived = (await scrypt(normalized, salt, KEY_LENGTH, { N: n, r, p })) as Buffer
  return `${PASSWORD_HASH_PREFIX}$N=${n},r=${r},p=${p}$${salt}$${derived.toString('base64url')}`
}

/**
 * 校验后台管理员密码。
 * 非 scrypt 格式直接返回 false。
 */
export async function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
  const normalized = String(password ?? '')
  const stored = String(storedHash ?? '')
  const [prefix, paramsRaw, salt, hashRaw] = stored.split('$')
  if (!normalized || prefix !== PASSWORD_HASH_PREFIX || !paramsRaw || !salt || !hashRaw) return false

  const params = Object.fromEntries(paramsRaw.split(',').map((item) => {
    const [key, value] = item.split('=')
    return [key, Number(value)]
  }))

  const n = Number(params.N)
  const r = Number(params.r)
  const p = Number(params.p)
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false

  const actual = (await scrypt(normalized, salt, KEY_LENGTH, { N: n, r, p })) as Buffer
  const expected = Buffer.from(hashRaw, 'base64url')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
