import { updateAdminRole } from '#server/services/auth/admin_account'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效角色 ID' })
  }
  const body = await readBody<Record<string, unknown>>(event)
  return updateAdminRole(event, id, body)
})
