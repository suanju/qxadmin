import { createAdminRole } from '#server/services/auth/admin_account'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  return createAdminRole(event, body)
})
