import { getAdminContextByUserId, getAdminPermissionCatalog } from '#server/services/auth/admin_permission'

export default defineEventHandler(async (event) => {
  const admin = (event.context as Record<string, unknown>).admin as { id?: number; isSuperAdmin?: boolean } | undefined
  if (!admin) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期，请先登录后台' })
  }

  const fresh = await getAdminContextByUserId(admin.id)
  if (!fresh) {
    throw createError({ statusCode: 401, message: '账号不存在、已禁用或登录态已失效' })
  }

  return {
    ...fresh,
    permissionCatalog: await getAdminPermissionCatalog()
  }
})
