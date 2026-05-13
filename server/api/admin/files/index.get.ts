import { listAdminFiles } from '#server/services/file/admin_file'

export default defineEventHandler(async (event) => {
  return listAdminFiles(getQuery(event))
})
