import { loginAdmin, type AdminLoginBody } from '#server/services/auth/admin_login'

export default defineEventHandler(async (event) => {
  const body = await readBody<AdminLoginBody>(event)
  return await loginAdmin(event, body)
})
