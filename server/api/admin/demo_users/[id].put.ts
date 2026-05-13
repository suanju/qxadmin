import { updateAdminDemoUser } from '#server/services/user/admin_demo_user'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的用户 ID' })
  }

  const body = await readBody(event)
  return updateAdminDemoUser(event, id, body)
})
