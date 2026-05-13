import { createAdminDemoUser } from '#server/services/user/admin_demo_user'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return createAdminDemoUser(event, body)
})
