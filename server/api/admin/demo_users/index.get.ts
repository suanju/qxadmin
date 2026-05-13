import { listAdminDemoUsers } from '#server/services/user/admin_demo_user'

export default defineEventHandler(async (event) => {
  return listAdminDemoUsers(getQuery(event))
})
