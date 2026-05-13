import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 天

function getSecret(): Uint8Array {
  const v =
    process.env.NUXT_ADMIN_AUTH_SECRET ||
    process.env.ADMIN_AUTH_SECRET
  if (v && v.length >= 16) return new TextEncoder().encode(v)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '生产环境必须设置 NUXT_ADMIN_AUTH_SECRET 或 ADMIN_AUTH_SECRET（至少 16 字符）用于签名 admin 登录 token'
    )
  }
  return new TextEncoder().encode('dev-admin-auth-secret-change-in-production')
}

export type AdminTokenPayload = {
  sub: 'admin_user'
  exp: number
  iat: number
  jti: string
  userId: number
  username: string
  displayName: string
  isSuperAdmin: boolean
  tokenVersion: number
}

export interface SignAdminTokenInput {
  userId: number
  username: string
  displayName: string
  isSuperAdmin: boolean
  tokenVersion: number
}

function isAdminTokenPayload(payload: JWTPayload): payload is AdminTokenPayload {
  return payload.sub === 'admin_user'
    && typeof payload.exp === 'number'
    && typeof payload.iat === 'number'
    && typeof payload.jti === 'string'
    && typeof payload.userId === 'number'
    && typeof payload.username === 'string'
    && typeof payload.displayName === 'string'
    && typeof payload.isSuperAdmin === 'boolean'
    && typeof payload.tokenVersion === 'number'
}

/**
 * 签发防伪造的 admin 登录 JWT（HMAC 签名，含过期时间）。
 */
export async function signAdminToken(admin: SignAdminTokenInput): Promise<string> {
  const secret = getSecret()
  const payload = {
    sub: 'admin_user',
    userId: admin.userId,
    username: admin.username,
    displayName: admin.displayName,
    isSuperAdmin: admin.isSuperAdmin,
    tokenVersion: admin.tokenVersion
  }

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SEC)
    .setJti(randomUUID())
    .sign(secret)
  return jwt
}

/**
 * 校验 admin token：验证签名并检查未过期。伪造或过期返回 null。
 */
export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  if (!token || typeof token !== 'string') return null
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    if (!isAdminTokenPayload(payload)) return null
    return payload
  } catch {
    return null
  }
}
