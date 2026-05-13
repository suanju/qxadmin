import { listAdminOperationLogs } from '#server/services/log/admin_operation_log'

export default defineEventHandler(async (event) => {
  return listAdminOperationLogs(getQuery(event))
})
