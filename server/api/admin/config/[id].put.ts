import { updateAdminConfig } from '#server/services/config/admin_config'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少 id' })

  const body = await readBody<{
    name?: string
    group?: string
    title?: string
    tip?: string
    type?: string
    value?: string | null
  }>(event)
  return updateAdminConfig(event, Number(id), body)
})
