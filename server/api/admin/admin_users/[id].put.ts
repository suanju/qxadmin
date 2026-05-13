import { updateAdminUser } from '#server/services/auth/admin_account'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效管理员 ID' })
  }
  const body = await readBody<Record<string, unknown>>(event)
  return updateAdminUser(event, id, body)
})
