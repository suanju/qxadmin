import { deleteAdminConfig } from '#server/services/config/admin_config'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少 id' })
  return deleteAdminConfig(event, Number(id))
})
