import { listAdminRoles } from '#server/services/auth/admin_account'

export default defineEventHandler(async () => {
  return listAdminRoles()
})
