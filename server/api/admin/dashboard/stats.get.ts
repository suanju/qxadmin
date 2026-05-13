import { getAdminDashboardStats } from '#server/services/dashboard/admin_dashboard'

export default defineEventHandler(async (event) => {
  return await getAdminDashboardStats()
})
