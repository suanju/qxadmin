import { uploadAdminFile } from '#server/services/file/admin_file'

export default defineEventHandler(async (event) => {
  return uploadAdminFile(event)
})
