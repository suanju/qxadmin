import { deleteAdminFile } from '#server/services/file/admin_file'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id || Number.isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的文件 ID' })
  }

  return deleteAdminFile(event, id)
})
