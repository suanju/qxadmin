import { listAdminUsers } from '#server/services/auth/admin_account'

export default defineEventHandler(async (event) => {
  return listAdminUsers(getQuery(event) as Record<string, unknown>)
})
