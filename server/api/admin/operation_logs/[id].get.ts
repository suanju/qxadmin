import { getAdminOperationLogById } from '#server/services/log/admin_operation_log'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id || Number.isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }
  return getAdminOperationLogById(id)
})
