import { flushAdminAuditLog, setAdminAuditContext, shouldAuditAdminMutation } from '#server/utils/audit'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const method = (event.method || '').toUpperCase()
  if (!shouldAuditAdminMutation(url.pathname, method)) return

  setAdminAuditContext(event, {
    requestQuery: getQuery(event) as Record<string, unknown>
  })

  const contentType = (getHeader(event, 'content-type') || '').toLowerCase()
  if (contentType && !contentType.includes('multipart/form-data')) {
    try {
      const body = await readBody(event)
      if (body !== undefined) {
        setAdminAuditContext(event, { requestBody: body })
      }
    } catch {
      // ignore body parse errors for audit; main handler should decide request validity
    }
  }

  const start = Date.now()
  const res = event.node.res

  res.on('finish', () => {
    const statusCode = res.statusCode || 200
    void flushAdminAuditLog(event, {
      statusCode,
      durationMs: Date.now() - start,
      success: statusCode < 400,
      errorMessage: statusCode >= 400 ? res.statusMessage : undefined
    }).catch((error) => {
      // audit logging failure must not break main request flow
      console.error('flushAdminAuditLog failed:', error)
    })
  })
})
