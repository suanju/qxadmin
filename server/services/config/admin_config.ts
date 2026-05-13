import type { H3Event } from 'h3'
import { asc, eq } from 'drizzle-orm'
import { useDb } from '#server/db'
import { config as configTable } from '#server/db/schema'
import type { NewConfig } from '#server/db/schema'
import { diffObjects, setAdminAuditContext } from '#server/utils/audit'

const CONFIG_TYPES = ['string', 'text', 'int', 'bool', 'array', 'datetime', 'date', 'file', 'image'] as const

export type ConfigMutationBody = {
  name?: string
  group?: string
  title?: string
  tip?: string
  type?: string
  value?: string | null
}

function normalizeConfigType(type?: string): string {
  const normalized = (type?.trim() || 'string').toLowerCase()
  if (!CONFIG_TYPES.includes(normalized as (typeof CONFIG_TYPES)[number])) {
    throw createError({ statusCode: 400, message: `type 必须是: ${CONFIG_TYPES.join(', ')}` })
  }
  return normalized
}

/**
 * 查询后台系统配置列表。
 */
export async function listAdminConfigs() {
  const db = useDb()
  return db.select().from(configTable).orderBy(asc(configTable.group), asc(configTable.id))
}

/**
 * 创建后台系统配置。
 */
export async function createAdminConfig(event: H3Event, body: Required<Pick<ConfigMutationBody, 'name'>> & ConfigMutationBody) {
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, message: '变量名 name 不能为空' })
  }

  const payload = {
    name: body.name.trim(),
    group: body.group?.trim() ?? '',
    title: body.title?.trim() ?? '',
    tip: body.tip?.trim() ?? '',
    type: normalizeConfigType(body.type),
    value: body.value ?? null
  }

  const db = useDb()
  const [row] = await db
    .insert(configTable)
    .values(payload)
    .$returningId()

  if (!row) {
    throw createError({ statusCode: 500, message: '插入失败' })
  }

  setAdminAuditContext(event, {
    eventType: 'config.create',
    eventCategory: 'create',
    targetType: 'config',
    targetId: row.id,
    targetName: payload.name,
    requestBody: body,
    afterData: {
      id: row.id,
      ...payload
    },
    detail: `创建系统配置: ${payload.name}`
  })

  return row
}

/**
 * 更新后台系统配置。
 */
export async function updateAdminConfig(event: H3Event, id: number, body: ConfigMutationBody) {
  const db = useDb()
  const updates: Partial<Pick<NewConfig, 'name' | 'group' | 'title' | 'tip' | 'type' | 'value'>> = {}

  if (body?.name !== undefined) updates.name = body.name.trim()
  if (body?.group !== undefined) updates.group = body.group.trim()
  if (body?.title !== undefined) updates.title = body.title.trim()
  if (body?.tip !== undefined) updates.tip = body.tip.trim()
  if (body?.type !== undefined) updates.type = normalizeConfigType(body.type)
  if (body?.value !== undefined) updates.value = body.value

  const [beforeRow] = await db.select().from(configTable).where(eq(configTable.id, id))
  if (!beforeRow) {
    throw createError({ statusCode: 404, message: '记录不存在' })
  }

  if (Object.keys(updates).length > 0) {
    await db.update(configTable).set(updates).where(eq(configTable.id, id))
  }

  const [afterRow] = await db.select().from(configTable).where(eq(configTable.id, id))
  if (!afterRow) {
    throw createError({ statusCode: 404, message: '记录不存在' })
  }

  const diffKeys = Object.keys(updates)
  const changes = diffObjects(beforeRow as Record<string, unknown>, afterRow as Record<string, unknown>, diffKeys)

  setAdminAuditContext(event, {
    eventType: 'config.update',
    eventCategory: 'update',
    targetType: 'config',
    targetId: id,
    targetName: String(afterRow.name || beforeRow.name || id),
    requestBody: body,
    beforeData: beforeRow,
    afterData: afterRow,
    changeItems: changes,
    detail: changes.length > 0
      ? `修改系统配置(${id})字段: ${changes.map((item) => item.field).join(', ')}`
      : `提交系统配置更新但无字段变化(${id})`
  })

  return afterRow
}

/**
 * 删除后台系统配置。
 */
export async function deleteAdminConfig(event: H3Event, id: number) {
  const db = useDb()
  const [beforeRow] = await db.select().from(configTable).where(eq(configTable.id, id))

  await db.delete(configTable).where(eq(configTable.id, id))

  setAdminAuditContext(event, {
    eventType: 'config.delete',
    eventCategory: 'delete',
    targetType: 'config',
    targetId: id,
    targetName: String(beforeRow?.name || id),
    beforeData: beforeRow ?? null,
    afterData: null,
    detail: beforeRow
      ? `删除系统配置: ${beforeRow.name}`
      : `删除系统配置(可能不存在): ${id}`
  })

  return { success: true }
}
