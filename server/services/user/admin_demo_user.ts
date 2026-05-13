import type { H3Event } from 'h3'
import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm'
import { useDb } from '#server/db'
import { adminDemoUser } from '#server/db/schema'
import type { NewAdminDemoUser } from '#server/db/schema'
import { diffObjects, setAdminAuditContext } from '#server/utils/audit'

export interface AdminDemoUserListParams {
  limit?: number
  offset?: number
  keyword?: string | string[] | undefined
  q?: string | string[] | undefined
  status?: string | string[] | undefined
}

export interface AdminDemoUserMutationBody {
  username?: string
  nickname?: string
  email?: string
  mobile?: string
  department?: string
  roleName?: string
  role_name?: string
  status?: number | string
  source?: string
  remark?: string
}

export interface AdminDemoUserBatchBody {
  ids?: number[]
  action?: 'enable' | 'disable' | 'delete'
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function normalizeSingleQuery(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  const result = String(raw ?? '').trim()
  return result ? result : undefined
}

function getCurrentAdmin(event: H3Event): { id: number; username: string; displayName: string } {
  const admin = event.context.admin as { id?: number; username?: string; displayName?: string } | undefined
  return {
    id: Number(admin?.id || 0),
    username: String(admin?.username || ''),
    displayName: String(admin?.displayName || admin?.username || '')
  }
}

function normalizeStatus(value: number | string | undefined, fallback = 1): number {
  if (value === undefined || value === '') return fallback
  const status = Number(value)
  if (status !== 0 && status !== 1) {
    throw createError({ statusCode: 400, message: 'status 只能是 0 或 1' })
  }
  return status
}

function normalizeIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return []
  return Array.from(new Set(ids.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)))
}

function normalizePayload(body: AdminDemoUserMutationBody, fallbackStatus = 1): Omit<NewAdminDemoUser, 'id'> {
  const username = String(body.username ?? '').trim()
  if (!username) {
    throw createError({ statusCode: 400, message: '用户名不能为空' })
  }

  return {
    username,
    nickname: String(body.nickname ?? '').trim(),
    email: String(body.email ?? '').trim(),
    mobile: String(body.mobile ?? '').trim(),
    department: String(body.department ?? '').trim(),
    role_name: String(body.roleName ?? body.role_name ?? '普通用户').trim() || '普通用户',
    status: normalizeStatus(body.status, fallbackStatus),
    source: String(body.source ?? 'manual').trim() || 'manual',
    remark: String(body.remark ?? '').trim(),
    last_active_at: 0,
    created_by: 0,
    updated_by: 0,
    created_at: 0,
    updated_at: 0
  }
}

/**
 * 分页查询示例用户，用于展示统一后台表格。
 */
export async function listAdminDemoUsers(params: AdminDemoUserListParams) {
  const limit = Math.min(Number(params.limit) || 20, 100)
  const offset = Math.max(0, Number(params.offset) || 0)
  const keyword = normalizeSingleQuery(params.keyword ?? params.q)
  const statusRaw = normalizeSingleQuery(params.status)
  const conditions = []

  if (keyword) {
    const pattern = `%${keyword}%`
    conditions.push(or(
      like(adminDemoUser.username, pattern),
      like(adminDemoUser.nickname, pattern),
      like(adminDemoUser.email, pattern),
      like(adminDemoUser.mobile, pattern),
      like(adminDemoUser.department, pattern),
      like(adminDemoUser.role_name, pattern)
    ))
  }

  if (statusRaw === '0' || statusRaw === '1') {
    conditions.push(eq(adminDemoUser.status, Number(statusRaw)))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const db = useDb()
  const totalResult = await db.select({ count: count() }).from(adminDemoUser).where(whereClause)
  const totalRow = totalResult[0] ?? { count: 0 }
  const list = await db
    .select()
    .from(adminDemoUser)
    .where(whereClause)
    .orderBy(desc(adminDemoUser.id))
    .limit(limit)
    .offset(offset)

  return {
    list,
    total: totalRow.count,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit
  }
}

/**
 * 创建示例用户记录。
 */
export async function createAdminDemoUser(event: H3Event, body: AdminDemoUserMutationBody) {
  const admin = getCurrentAdmin(event)
  const ts = nowSec()
  const payload = {
    ...normalizePayload(body),
    created_by: admin.id,
    updated_by: admin.id,
    created_at: ts,
    updated_at: ts
  }

  const db = useDb()
  const [row] = await db.insert(adminDemoUser).values(payload).$returningId()
  if (!row) {
    throw createError({ statusCode: 500, message: '示例用户创建失败' })
  }

  setAdminAuditContext(event, {
    eventType: 'demo_user.create',
    eventCategory: 'create',
    targetType: 'admin_demo_user',
    targetId: row.id,
    targetName: payload.username,
    requestBody: body,
    afterData: { id: row.id, ...payload },
    detail: `创建示例用户：${payload.username}`
  })

  return { id: row.id, ...payload }
}

/**
 * 更新示例用户记录。
 */
export async function updateAdminDemoUser(event: H3Event, id: number, body: AdminDemoUserMutationBody) {
  const db = useDb()
  const [before] = await db.select().from(adminDemoUser).where(eq(adminDemoUser.id, id)).limit(1)
  if (!before) {
    throw createError({ statusCode: 404, message: '示例用户不存在' })
  }

  const admin = getCurrentAdmin(event)
  const normalized = normalizePayload(body, before.status)
  const updates: Partial<NewAdminDemoUser> = {
    username: normalized.username,
    nickname: normalized.nickname,
    email: normalized.email,
    mobile: normalized.mobile,
    department: normalized.department,
    role_name: normalized.role_name,
    status: normalized.status,
    source: normalized.source,
    remark: normalized.remark,
    updated_by: admin.id,
    updated_at: nowSec()
  }

  await db.update(adminDemoUser).set(updates).where(eq(adminDemoUser.id, id))
  const [after] = await db.select().from(adminDemoUser).where(eq(adminDemoUser.id, id)).limit(1)

  setAdminAuditContext(event, {
    eventType: 'demo_user.update',
    eventCategory: 'update',
    targetType: 'admin_demo_user',
    targetId: id,
    targetName: after?.username || before.username,
    requestBody: body,
    beforeData: before,
    afterData: after,
    changeItems: diffObjects(before as Record<string, unknown>, after as Record<string, unknown>, Object.keys(updates)),
    detail: `更新示例用户：${before.username}`
  })

  return after
}

/**
 * 删除单个示例用户记录。
 */
export async function deleteAdminDemoUser(event: H3Event, id: number) {
  const db = useDb()
  const [before] = await db.select().from(adminDemoUser).where(eq(adminDemoUser.id, id)).limit(1)
  if (!before) {
    throw createError({ statusCode: 404, message: '示例用户不存在' })
  }

  await db.delete(adminDemoUser).where(eq(adminDemoUser.id, id))

  setAdminAuditContext(event, {
    eventType: 'demo_user.delete',
    eventCategory: 'delete',
    targetType: 'admin_demo_user',
    targetId: id,
    targetName: before.username,
    beforeData: before,
    detail: `删除示例用户：${before.username}`
  })

  return { success: true }
}

/**
 * 批量处理示例用户，供统一表格批量操作展示。
 */
export async function batchUpdateAdminDemoUsers(event: H3Event, body: AdminDemoUserBatchBody) {
  const ids = normalizeIds(body.ids)
  const action = body.action
  if (ids.length === 0) {
    throw createError({ statusCode: 400, message: '请选择要处理的用户' })
  }
  if (action !== 'enable' && action !== 'disable' && action !== 'delete') {
    throw createError({ statusCode: 400, message: '批量动作不支持' })
  }

  const db = useDb()
  const beforeRows = await db.select().from(adminDemoUser).where(inArray(adminDemoUser.id, ids))
  if (beforeRows.length === 0) {
    throw createError({ statusCode: 404, message: '未找到可处理用户' })
  }

  const admin = getCurrentAdmin(event)
  const foundIds = beforeRows.map(item => item.id)
  if (action === 'delete') {
    await db.delete(adminDemoUser).where(inArray(adminDemoUser.id, foundIds))
  } else {
    await db.update(adminDemoUser).set({
      status: action === 'enable' ? 1 : 0,
      updated_by: admin.id,
      updated_at: nowSec()
    }).where(inArray(adminDemoUser.id, foundIds))
  }

  setAdminAuditContext(event, {
    eventType: `demo_user.batch_${action}`,
    eventCategory: action === 'delete' ? 'delete' : 'batch_update',
    targetType: 'admin_demo_user',
    targetId: foundIds.join(','),
    targetName: `示例用户 ${foundIds.length} 项`,
    requestBody: body,
    beforeData: beforeRows,
    detail: `批量${action === 'enable' ? '启用' : action === 'disable' ? '禁用' : '删除'}示例用户：${foundIds.length} 项`
  })

  return { success: true, count: foundIds.length }
}
