import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'

import { useDb } from '#server/db'
import { adminUser } from '#server/db/schema'
import { signAdminToken } from '#server/lib/auth'
import { verifyLoginCaptcha } from '#server/lib/auth/captcha'
import { verifyAdminPassword } from '#server/lib/auth/password'
import { getClientIp } from '#server/utils/request/client_ip'

export interface AdminLoginBody {
  username?: string
  password: string
  captchaId?: string
  captchaCode?: string
  rememberMe?: boolean
}

export interface AdminLoginResult {
  success: true
}

type LoginAttemptState = {
  count: number
  blockedUntil: number
}

const loginAttempts = new Map<string, LoginAttemptState>()

function shouldUseSecureAdminCookie(): boolean {
  return process.env.ADMIN_AUTH_COOKIE_SECURE === 'true'
}

function setAdminAuthCookie(event: H3Event, token: string, rememberMe: boolean): void {
  const cookieOptions = {
    sameSite: 'lax',
    secure: shouldUseSecureAdminCookie(),
    path: '/',
    httpOnly: false
  } as const

  setCookie(event, 'admin_auth', token, rememberMe
    ? { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 }
    : cookieOptions)
}

function setLoginAuditOperator(
  event: H3Event,
  admin: {
    id: number
    username: string
    displayName: string
    isSuperAdmin: boolean
    tokenVersion: number
  }
): void {
  ;(event.context as Record<string, unknown>).admin = admin
}

function recordLoginFailure(ip: string, state: LoginAttemptState | undefined, now: number): never {
  const current: LoginAttemptState = state ?? { count: 0, blockedUntil: 0 }
  current.count += 1

  if (current.count >= 5) {
    current.blockedUntil = now + 30 * 60 * 1000
  }

  loginAttempts.set(ip, current)

  throw createError({
    statusCode: 401,
    message: `用户名或密码错误，还有 ${Math.max(0, 5 - current.count)} 次机会`
  })
}

/**
 * 后台登录服务。
 * 统一处理验证码校验、密码读取、登录失败限流与 cookie 签发。
 */
export async function loginAdmin(event: H3Event, body: AdminLoginBody): Promise<AdminLoginResult> {
  const username = String(body?.username ?? 'admin').trim() || 'admin'
  const password = String(body?.password ?? '').trim()
  const captchaId = String(body?.captchaId ?? '').trim()
  const captchaCode = String(body?.captchaCode ?? '').trim()
  const rememberMe = body?.rememberMe === true

  if (!password) {
    throw createError({
      statusCode: 400,
      message: '请输入密码'
    })
  }

  const ip = getClientIp(event) || 'unknown'
  const now = Date.now()
  const existingState = loginAttempts.get(ip)

  if (existingState && existingState.blockedUntil <= now) {
    loginAttempts.delete(ip)
  }

  const state = loginAttempts.get(ip)
  if (state && state.blockedUntil > now) {
    throw createError({
      statusCode: 429,
      message: '该 IP 密码错误次数过多，已暂时禁止登录，请稍后再试'
    })
  }

  const captchaResult = verifyLoginCaptcha(event, { captchaId, captchaCode })
  if (!captchaResult.ok) {
    throw createError({
      statusCode: 400,
      message: captchaResult.message
    })
  }

  const db = useDb()

  const [user] = await db
    .select()
    .from(adminUser)
    .where(eq(adminUser.username, username))
    .limit(1)

  if (!user) recordLoginFailure(ip, state, now)
  if (user.status !== 1) {
    throw createError({ statusCode: 401, message: '账号已被禁用，请联系超级管理员' })
  }

  const ok = await verifyAdminPassword(password, user.password_hash)
  if (!ok) recordLoginFailure(ip, state, now)

  await db.update(adminUser).set({
    last_login_at: Math.floor(Date.now() / 1000),
    last_login_ip: ip,
    updated_at: Math.floor(Date.now() / 1000)
  }).where(eq(adminUser.id, user.id))

  loginAttempts.delete(ip)

  const token = await signAdminToken({
    userId: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    isSuperAdmin: user.is_super_admin === 1,
    tokenVersion: user.token_version
  })
  setAdminAuthCookie(event, token, rememberMe)
  setLoginAuditOperator(event, {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    isSuperAdmin: user.is_super_admin === 1,
    tokenVersion: user.token_version
  })

  return { success: true }
}
