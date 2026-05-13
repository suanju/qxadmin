import type { H3Event } from 'h3'
import { adminOperationLog } from '#server/db/schema'
import { useDb } from '#server/db'
import { verifyAdminToken } from '#server/lib/auth'

type JsonLike = Record<string, unknown>

export interface AuditChangeItem {
  field: string
  before: unknown
  after: unknown
}

export interface AdminAuditContext {
  eventType?: string
  eventCategory?: string
  targetType?: string
  targetId?: string | number
  targetName?: string
  detail?: string
  requestBody?: unknown
  requestQuery?: Record<string, unknown>
  beforeData?: unknown
  afterData?: unknown
  changeItems?: AuditChangeItem[]
  errorMessage?: string
  skip?: boolean
}

const SENSITIVE_KEYS = [
  'password',
  'token',
  'access_token',
  'authorization',
  'secret',
  'key',
  'private_key',
  'cookie'
]

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * 判断一个值是否为普通对象。
 * 用于审计数据清洗时区分对象、数组和基本类型。
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 统一规范请求路径，移除末尾多余斜杠。
 * 这样可避免同一路径因格式差异被识别成不同审计事件。
 */
function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

/**
 * 粗略判断路径片段是否像资源 ID。
 * 支持纯数字和较长的十六进制/UUID 风格字符串，便于自动推断审计目标。
 */
function isLikelyIdSegment(segment: string | undefined): boolean {
  if (!segment) return false
  return /^\d+$/.test(segment) || /^[a-fA-F0-9-]{8,}$/.test(segment)
}

/**
 * 将任意值转换为指定长度内的安全字符串。
 * 超长内容会被截断，避免写入审计表时出现字段溢出。
 */
function toSafeString(value: unknown, max = 255): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return str.length > max ? `${str.slice(0, max - 3)}...` : str
}

/**
 * 尝试将任意值稳定序列化为字符串。
 * 主要用于对象差异比较时给复杂结构提供兜底表达。
 */
function tryStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * 将输入转换为有限数值。
 * 失败时返回备用值，避免审计日志写入非数字字段时报错。
 */
function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * 对简单 JSON 结构做深拷贝。
 * 主要用于冻结请求上下文快照，防止后续对象被业务代码继续修改。
 */
function cloneSimple<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

/**
 * 递归清洗待写入审计表的数据。
 * 会屏蔽敏感字段、限制最大深度与字符串长度，控制审计内容的安全性和体积。
 */
export function sanitizeAuditData(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (depth > 4) return '[max-depth]'

  if (typeof value === 'string') {
    return value.length > 2000 ? `${value.slice(0, 1997)}...` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAuditData(item, depth + 1))
  }

  if (!isObject(value)) {
    return String(value)
  }

  const output: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase()
    if (SENSITIVE_KEYS.some((x) => lower.includes(x))) {
      output[k] = '***'
      continue
    }
    output[k] = sanitizeAuditData(v, depth + 1)
  }
  return output
}

/**
 * 比较两个值是否可视为相等。
 * 对对象会退化为序列化字符串比较，避免浅比较遗漏结构相同的情况。
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return tryStringify(a) === tryStringify(b)
}

/**
 * 计算两个对象之间的字段变更列表。
 * 结果会保留变更前后值的审计安全版本，适合直接写入操作日志。
 */
function getObjectField(value: object | null | undefined, key: string): unknown {
  if (!value) return undefined
  return (value as { [field: string]: unknown })[key]
}

export function diffObjects(
  before: object | null | undefined,
  after: object | null | undefined,
  fields?: string[]
): AuditChangeItem[] {
  const keys = fields && fields.length > 0
    ? Array.from(new Set(fields))
    : Array.from(new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]))

  const changes: AuditChangeItem[] = []
  for (const key of keys) {
    const from = getObjectField(before, key)
    const to = getObjectField(after, key)
    if (!isEqual(from, to)) {
      changes.push({
        field: key,
        before: sanitizeAuditData(from),
        after: sanitizeAuditData(to)
      })
    }
  }
  return changes
}

/**
 * 根据请求路径和方法推断默认审计事件信息。
 * 当业务侧未显式指定事件类型时，这里会给出一份可用的兜底分类。
 */
function inferEvent(pathname: string, method: string): Pick<Required<AdminAuditContext>, 'eventType' | 'eventCategory' | 'targetType' | 'targetId'> {
  const normalized = normalizePath(pathname)
  const parts = normalized.split('/').filter(Boolean)
  const targetType = parts[2] ?? 'admin'
  const maybeId = parts[3]
  const targetId = isLikelyIdSegment(maybeId) ? String(maybeId) : ''

  if (parts[2] === 'auth' && parts[3] === 'login') {
    return { eventType: 'auth.login', eventCategory: 'login', targetType: 'admin_auth', targetId: '' }
  }

  switch (method.toUpperCase()) {
    case 'POST':
      return { eventType: `${targetType}.create`, eventCategory: 'create', targetType, targetId }
    case 'PUT':
    case 'PATCH':
      return { eventType: `${targetType}.update`, eventCategory: 'update', targetType, targetId }
    case 'DELETE':
      return { eventType: `${targetType}.delete`, eventCategory: 'delete', targetType, targetId }
    default:
      return { eventType: `${targetType}.action`, eventCategory: 'action', targetType, targetId }
  }
}

/**
 * 从管理员登录态中解析当前操作人信息。
 * 当 token 缺失或失效时，也会返回可识别的匿名/失效占位值，保证审计写入不中断。
 */
async function resolveOperator(event: H3Event): Promise<{ operatorId: string; operatorName: string; operatorType: string }> {
  const admin = (event.context as JsonLike).admin as {
    id?: number
    username?: string
    displayName?: string
  } | undefined

  if (admin?.id !== undefined) {
    return {
      operatorId: String(admin.id),
      operatorName: String(admin.displayName || admin.username || admin.id),
      operatorType: 'admin'
    }
  }

  const token = getCookie(event, 'admin_auth')
  if (!token) {
    return {
      operatorId: 'anonymous',
      operatorName: 'anonymous',
      operatorType: 'admin'
    }
  }

  const payload = await verifyAdminToken(token)
  if (!payload) {
    return {
      operatorId: 'invalid-token',
      operatorName: 'invalid-token',
      operatorType: 'admin'
    }
  }

  const id = payload.userId || payload.jti || payload.sub || 'admin'
  return {
    operatorId: String(id),
    operatorName: String(payload.displayName || payload.username || payload.sub || 'admin'),
    operatorType: 'admin'
  }
}

/**
 * 获取当前请求的客户端 IP，并限制最大长度。
 * 这里独立实现是为了让审计模块在写日志时不依赖其他业务工具函数。
 */
function getClientIp(event: H3Event): string {
  const xff = getHeader(event, 'x-forwarded-for') || ''
  const fromHeader = xff.split(',')[0]?.trim()
  const xRealIp = getHeader(event, 'x-real-ip') || ''
  const fromSocket = event.node.req.socket.remoteAddress
  return toSafeString(fromHeader || xRealIp || fromSocket || '', 45)
}

/**
 * 读取当前请求已缓存的审计上下文。
 * 若上下文尚未初始化，则返回空对象，方便调用方直接合并。
 */
function getAuditContext(event: H3Event): AdminAuditContext {
  return (event.context.adminAudit || {}) as AdminAuditContext
}

/**
 * 将一段审计信息合并到当前请求上下文中。
 * 会尽量保留已有快照数据，避免多个中间件或路由处理器互相覆盖关键字段。
 */
export function setAdminAuditContext(event: H3Event, patch: AdminAuditContext) {
  const current = getAuditContext(event)
  const merged: AdminAuditContext = {
    ...current,
    ...patch
  }

  if (current.changeItems || patch.changeItems) {
    merged.changeItems = patch.changeItems ?? current.changeItems
  }
  if (current.requestBody !== undefined && patch.requestBody === undefined) {
    merged.requestBody = current.requestBody
  }
  if (current.requestQuery !== undefined && patch.requestQuery === undefined) {
    merged.requestQuery = current.requestQuery
  }

  event.context.adminAudit = merged
}

/**
 * 判断当前请求是否属于需要自动记录的后台写操作。
 * 仅对 `/api/admin` 下的新增、修改、删除类请求启用审计。
 */
export function shouldAuditAdminMutation(pathname: string, method: string): boolean {
  if (!WRITE_METHODS.has(method.toUpperCase())) return false
  return normalizePath(pathname).startsWith('/api/admin')
}

/**
 * 将当前请求累积的审计上下文落库到管理员操作日志表。
 * 会自动补齐操作人、事件类型、请求信息和执行结果等标准字段。
 */
export async function flushAdminAuditLog(
  event: H3Event,
  result: { statusCode: number; durationMs: number; success: boolean; errorMessage?: string }
) {
  const url = getRequestURL(event)
  const method = (event.method || '').toUpperCase()
  if (!shouldAuditAdminMutation(url.pathname, method)) return

  const context = getAuditContext(event)
  if (context.skip) return

  const inferred = inferEvent(url.pathname, method)
  const operator = await resolveOperator(event)
  const now = Math.floor(Date.now() / 1000)
  const query = context.requestQuery ?? cloneSimple(getQuery(event) as Record<string, unknown>)

  const db = useDb()
  await db.insert(adminOperationLog).values({
    trace_id: toSafeString((event.context as JsonLike).requestId ?? '', 64),
    operator_type: toSafeString(operator.operatorType, 30),
    operator_id: toSafeString(operator.operatorId, 64),
    operator_name: toSafeString(operator.operatorName, 100),
    event_type: toSafeString(context.eventType ?? inferred.eventType, 64),
    event_category: toSafeString(context.eventCategory ?? inferred.eventCategory, 30),
    target_type: toSafeString(context.targetType ?? inferred.targetType, 50),
    target_id: toSafeString(context.targetId ?? inferred.targetId, 64),
    target_name: toSafeString(context.targetName ?? '', 255),
    detail: context.detail ? toSafeString(context.detail, 5000) : null,
    request_method: toSafeString(method, 10),
    request_path: toSafeString(normalizePath(url.pathname), 255),
    request_query: sanitizeAuditData(query),
    request_body: sanitizeAuditData(context.requestBody),
    before_data: sanitizeAuditData(context.beforeData),
    after_data: sanitizeAuditData(context.afterData),
    change_items: sanitizeAuditData(context.changeItems),
    result: result.success ? 1 : 0,
    status_code: safeNumber(result.statusCode, 0),
    duration_ms: safeNumber(result.durationMs, 0),
    error_message: toSafeString(context.errorMessage || result.errorMessage || '', 500),
    ip: getClientIp(event),
    user_agent: toSafeString(getHeader(event, 'user-agent') || '', 255),
    created_at: now
  })
}

/**
 * 主动写入一条操作日志。
 * 适用于不走 `/api/admin` 自动审计中间件、但仍希望进入操作日志列表的场景。
 */
export async function writeAdminOperationLog(
  event: H3Event,
  context: AdminAuditContext,
  result: { statusCode: number; durationMs?: number; success: boolean; errorMessage?: string },
  operator?: {
    operatorType?: string
    operatorId?: string
    operatorName?: string
  }
) {
  const url = getRequestURL(event)
  const method = (event.method || '').toUpperCase()
  const inferred = inferEvent(url.pathname, method)
  const now = Math.floor(Date.now() / 1000)
  const query = context.requestQuery ?? cloneSimple(getQuery(event) as Record<string, unknown>)
  const db = useDb()

  await db.insert(adminOperationLog).values({
    trace_id: toSafeString((event.context as JsonLike).requestId ?? '', 64),
    operator_type: toSafeString(operator?.operatorType ?? 'system', 30),
    operator_id: toSafeString(operator?.operatorId ?? 'system', 64),
    operator_name: toSafeString(operator?.operatorName ?? 'system', 100),
    event_type: toSafeString(context.eventType ?? inferred.eventType, 64),
    event_category: toSafeString(context.eventCategory ?? inferred.eventCategory, 30),
    target_type: toSafeString(context.targetType ?? inferred.targetType, 50),
    target_id: toSafeString(context.targetId ?? inferred.targetId, 64),
    target_name: toSafeString(context.targetName ?? '', 255),
    detail: context.detail ? toSafeString(context.detail, 5000) : null,
    request_method: toSafeString(method, 10),
    request_path: toSafeString(normalizePath(url.pathname), 255),
    request_query: sanitizeAuditData(query),
    request_body: sanitizeAuditData(context.requestBody),
    before_data: sanitizeAuditData(context.beforeData),
    after_data: sanitizeAuditData(context.afterData),
    change_items: sanitizeAuditData(context.changeItems),
    result: result.success ? 1 : 0,
    status_code: safeNumber(result.statusCode, 0),
    duration_ms: safeNumber(result.durationMs, 0),
    error_message: toSafeString(context.errorMessage || result.errorMessage || '', 500),
    ip: getClientIp(event),
    user_agent: toSafeString(getHeader(event, 'user-agent') || '', 255),
    created_at: now
  })
}
