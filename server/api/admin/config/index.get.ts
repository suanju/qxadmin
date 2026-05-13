import { listAdminConfigs } from '#server/services/config/admin_config'

export default defineEventHandler(async () => {
  return listAdminConfigs()
})
