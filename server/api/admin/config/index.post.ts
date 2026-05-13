import { createAdminConfig } from '#server/services/config/admin_config'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    group: string
    title: string
    tip?: string
    type?: string
    value?: string
  }>(event)
  return createAdminConfig(event, body)
})
