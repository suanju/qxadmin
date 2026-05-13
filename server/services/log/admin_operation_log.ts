import { and, count, desc, eq, gte, like, lt, or } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { useDb } from '#server/db'
import { adminOperationLog } from '#server/db/schema'
import { resolveIpLocation } from '#server/utils/ip/ip_location'

function normalizeSingleQuery(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  const result = String(raw ?? '').trim()
  return result ? result : undefined
}

function parseDateStart(dateStr?: string): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000)
}

function parseDateEnd(dateStr?: string): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() / 1000)
}

/**
 * 分页查询后台操作日志，并补充 IP 归属地。
 */
export async function listAdminOperationLogs(params: {
  limit?: number
  offset?: number
  keyword?: string | string[] | undefined
  q?: string | string[] | undefined
  eventType?: string | string[] | undefined
  eventCategory?: string | string[] | undefined
  targetType?: string | string[] | undefined
  operator?: string | string[] | undefined
  result?: string | string[] | undefined
  dateStart?: string | string[] | undefined
  dateEnd?: string | string[] | undefined
}) {
  const limit = Math.min(Number(params.limit) || 20, 100)
  const offset = Math.max(0, Number(params.offset) || 0)
  const db = useDb()

  const keyword = normalizeSingleQuery(
    (params.keyword as string | string[] | undefined) ?? (params.q as string | string[] | undefined)
  )
  const eventType = normalizeSingleQuery(params.eventType as string | string[] | undefined)
  const eventCategory = normalizeSingleQuery(params.eventCategory as string | string[] | undefined)
  const targetType = normalizeSingleQuery(params.targetType as string | string[] | undefined)
  const operator = normalizeSingleQuery(params.operator as string | string[] | undefined)
  const resultRaw = normalizeSingleQuery(params.result as string | string[] | undefined)
  const dateStart = parseDateStart(normalizeSingleQuery(params.dateStart as string | string[] | undefined))
  const dateEnd = parseDateEnd(normalizeSingleQuery(params.dateEnd as string | string[] | undefined))

  const conditions: SQL[] = []

  if (keyword) {
    const pattern = `%${keyword}%`
    const keywordCondition = or(
      like(adminOperationLog.event_type, pattern),
      like(adminOperationLog.target_type, pattern),
      like(adminOperationLog.target_id, pattern),
      like(adminOperationLog.target_name, pattern),
      like(adminOperationLog.operator_name, pattern),
      like(adminOperationLog.operator_id, pattern),
      like(adminOperationLog.detail, pattern),
      like(adminOperationLog.request_path, pattern),
      like(adminOperationLog.ip, pattern),
      like(adminOperationLog.error_message, pattern)
    )
    if (keywordCondition) conditions.push(keywordCondition)
  }

  if (eventType) conditions.push(eq(adminOperationLog.event_type, eventType))
  if (eventCategory) conditions.push(eq(adminOperationLog.event_category, eventCategory))
  if (targetType) conditions.push(eq(adminOperationLog.target_type, targetType))

  if (operator) {
    const pattern = `%${operator}%`
    const operatorCondition = or(like(adminOperationLog.operator_name, pattern), like(adminOperationLog.operator_id, pattern))
    if (operatorCondition) conditions.push(operatorCondition)
  }

  if (resultRaw === '1' || resultRaw === '0') {
    conditions.push(eq(adminOperationLog.result, Number(resultRaw)))
  }

  if (dateStart !== null) conditions.push(gte(adminOperationLog.created_at, dateStart))
  if (dateEnd !== null) conditions.push(lt(adminOperationLog.created_at, dateEnd))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const totalResult = await db
    .select({ count: count() })
    .from(adminOperationLog)
    .where(whereClause)
  const totalRow = totalResult[0] ?? { count: 0 }

  const list = await db
    .select({
      id: adminOperationLog.id,
      operator_type: adminOperationLog.operator_type,
      operator_id: adminOperationLog.operator_id,
      operator_name: adminOperationLog.operator_name,
      event_type: adminOperationLog.event_type,
      event_category: adminOperationLog.event_category,
      target_type: adminOperationLog.target_type,
      target_id: adminOperationLog.target_id,
      target_name: adminOperationLog.target_name,
      detail: adminOperationLog.detail,
      result: adminOperationLog.result,
      status_code: adminOperationLog.status_code,
      duration_ms: adminOperationLog.duration_ms,
      request_method: adminOperationLog.request_method,
      request_path: adminOperationLog.request_path,
      ip: adminOperationLog.ip,
      error_message: adminOperationLog.error_message,
      created_at: adminOperationLog.created_at
    })
    .from(adminOperationLog)
    .where(whereClause)
    .orderBy(desc(adminOperationLog.id))
    .limit(limit)
    .offset(offset)

  const listWithGeo = await Promise.all(list.map(async (item) => ({
    ...item,
    ...(await resolveIpLocation(item.ip))
  })))

  return {
    list: listWithGeo,
    total: totalRow.count,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit
  }
}

/**
 * 查询单条后台操作日志。
 */
export async function getAdminOperationLogById(id: number) {
  const db = useDb()
  const [row] = await db
    .select()
    .from(adminOperationLog)
    .where(eq(adminOperationLog.id, id))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, message: '日志记录不存在' })
  }

  return row
}
