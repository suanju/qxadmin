import { verifyAdminToken } from '#server/lib/auth'
import { getAdminContextByUserId, hasAnyAdminPermission } from '#server/services/auth/admin_permission'
import { matchAdminApiPermission } from '#server/services/auth/admin_permission_catalog'
import { serviceLogger } from '#server/utils/log'

const ADMIN_API_PREFIX = '/api/admin'
const LOGIN_PATH = '/api/admin/auth/login'
const CAPTCHA_PATH = '/api/admin/auth/captcha'
const LOGIN_STATE_ONLY_ROUTES = [
  { method: 'GET', path: '/api/admin/auth/me' },
  { method: 'PUT', path: '/api/admin/auth/password' },
  { method: 'GET', path: '/api/admin/auth/permissions' }
]

function isRbacEnforceEnabled(): boolean {
  return process.env.ADMIN_RBAC_ENFORCE === 'true'
}

function isLoginStateOnlyRoute(path: string, method: string): boolean {
  const normalizedMethod = method.toUpperCase()
  return LOGIN_STATE_ONLY_ROUTES.some((route) => route.method === normalizedMethod && route.path === path)
}

/**
 * 后台接口鉴权：仅允许已登录且 cookie 为有效 JWT 的请求访问 /api/admin/*，登录接口除外。
 * 伪造或过期的 token 会返回 401，前端需清 cookie 并重定向到登录页。
 * RBAC 使用数据库权限目录中的 API matcher；ADMIN_RBAC_ENFORCE=true 时才返回 403。
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith(ADMIN_API_PREFIX)) return

  if (path === LOGIN_PATH && event.method === 'POST') return
  if (path === CAPTCHA_PATH && event.method === 'GET') return

  const token = getCookie(event, 'admin_auth')
  const payload = token ? await verifyAdminToken(token) : null
  if (!payload) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: '未登录或登录已过期，请先登录后台'
    })
  }

  const enforce = isRbacEnforceEnabled()
  let dbRoutePermission = { matched: false, permissions: [] as string[] }
  try {
    dbRoutePermission = await matchAdminApiPermission(path, event.method || 'GET')
  } catch (error) {
    serviceLogger.warn('读取数据库 RBAC matcher 失败', {
      method: event.method,
      path,
      error: error instanceof Error ? error.message : String(error)
    })
    if (enforce) {
      throw createError({ statusCode: 500, message: '数据库权限目录读取失败，请联系管理员' })
    }
  }

  if (!payload.userId) {
    throw createError({ statusCode: 401, message: '登录态缺少管理员身份，请重新登录' })
  }

  const admin = await getAdminContextByUserId(Number(payload.userId))
  if (!admin) {
    throw createError({ statusCode: 401, message: '账号不存在、已禁用或登录态已失效' })
  }

  if (Number(payload.tokenVersion ?? 0) !== admin.tokenVersion) {
    throw createError({ statusCode: 401, message: '登录态已失效，请重新登录' })
  }

  ;(event.context as Record<string, unknown>).admin = admin

  if (isLoginStateOnlyRoute(path, event.method || 'GET')) return
  const activeRoutePermission = dbRoutePermission

  if (!activeRoutePermission.matched) {
    serviceLogger.warn('RBAC 未匹配后台 API 路由', {
      method: event.method,
      path,
      adminId: admin.id,
      username: admin.username,
      enforce
    })
    if (enforce && !admin.isSuperAdmin) {
      throw createError({ statusCode: 403, message: '当前接口尚未配置权限映射，请联系管理员' })
    }
    return
  }

  if (!hasAnyAdminPermission(admin, activeRoutePermission.permissions)) {
    serviceLogger.warn('RBAC 观察到无权限后台 API 访问', {
      method: event.method,
      path,
      permissions: activeRoutePermission.permissions,
      adminId: admin.id,
      username: admin.username,
      enforce
    })
    if (enforce) {
      throw createError({ statusCode: 403, message: '当前账号没有权限执行该操作' })
    }
  }
})
