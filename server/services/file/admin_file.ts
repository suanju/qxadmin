import type { H3Event, MultiPartData } from 'h3'
import { createHash } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { and, count, desc, eq, like, or } from 'drizzle-orm'
import { useDb } from '#server/db'
import { adminFile } from '#server/db/schema'
import { setAdminAuditContext } from '#server/utils/audit'

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
])

const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])

const ARCHIVE_MIMES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip'
])

const MAX_SIZE = 10 * 1024 * 1024

export interface AdminFileUploadResult {
  id: number
  path: string
  url: string
  originalName: string
  filename: string
  mime: string
  size: number
  hash: string
  kind: string
  storageDriver: string
}

export interface AdminFileListParams {
  limit?: number
  offset?: number
  keyword?: string | string[] | undefined
  q?: string | string[] | undefined
  kind?: string | string[] | undefined
  status?: string | string[] | undefined
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

function normalizeExt(originalName: string): string {
  return extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 30)
}

function buildStoredName(originalName: string, fileHash: string): string {
  const ext = normalizeExt(originalName)
  const stamp = Date.now().toString(36)
  return `${stamp}_${fileHash.slice(0, 16)}${ext}`.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function detectKind(mime: string, requestedKind?: string): string {
  if (requestedKind === 'image') return 'image'
  if (IMAGE_MIMES.has(mime)) return 'image'
  if (DOCUMENT_MIMES.has(mime)) return 'document'
  if (ARCHIVE_MIMES.has(mime)) return 'archive'
  return 'file'
}

function assertUploadAllowed(field: MultiPartData, kind: string): void {
  if (field.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: '文件大小不能超过 10MB' })
  }

  if (kind === 'image' && !IMAGE_MIMES.has(field.type || '')) {
    throw createError({
      statusCode: 400,
      message: `仅支持图片格式: jpeg, png, gif, webp, svg，当前: ${field.type || '未知'}`
    })
  }
}

function toPublicUploadsPath(filename: string): string {
  return `/uploads/${basename(filename)}`
}

/**
 * 保存后台上传文件，并记录文件元数据。
 */
export async function uploadAdminFile(event: H3Event): Promise<AdminFileUploadResult> {
  const data = await readMultipartFormData(event)
  if (!data?.length) {
    throw createError({ statusCode: 400, message: '请选择要上传的文件' })
  }

  const field = data.find((item) => item.name === 'file')
  if (!field?.data || !field.filename) {
    throw createError({ statusCode: 400, message: '未找到文件字段 file' })
  }

  const query = getQuery(event)
  const requestedKind = String(query.kind || '').trim()
  const mime = String(field.type || '')
  const kind = detectKind(mime, requestedKind)
  assertUploadAllowed(field, requestedKind === 'image' ? 'image' : kind)

  const hash = createHash('sha256').update(field.data).digest('hex')
  const filename = buildStoredName(field.filename, hash)
  const dir = join(process.cwd(), 'public', 'uploads')
  await mkdir(dir, { recursive: true })
  const filepath = join(dir, filename)
  await writeFile(filepath, field.data)

  const admin = getCurrentAdmin(event)
  const publicPath = toPublicUploadsPath(filename)
  const createdAt = nowSec()
  const payload = {
    group_id: 0,
    storage_driver: 'local',
    original_name: field.filename,
    filename,
    ext: normalizeExt(field.filename),
    mime,
    size: field.data.length,
    hash,
    path: publicPath,
    public_url: publicPath,
    kind,
    status: 1,
    uploader_id: admin.id,
    uploader_name: admin.displayName || admin.username,
    meta_json: JSON.stringify({
      uploadKind: requestedKind || kind,
      driver: 'local',
      future: {
        chunkUpload: false,
        objectStorage: false
      }
    }),
    created_at: createdAt,
    updated_at: createdAt
  }

  const db = useDb()
  const [row] = await db.insert(adminFile).values(payload).$returningId()
  if (!row) {
    await unlink(filepath).catch(() => undefined)
    throw createError({ statusCode: 500, message: '文件记录保存失败' })
  }

  const result: AdminFileUploadResult = {
    id: row.id,
    path: publicPath,
    url: publicPath,
    originalName: field.filename,
    filename,
    mime,
    size: field.data.length,
    hash,
    kind,
    storageDriver: 'local'
  }

  setAdminAuditContext(event, {
    eventType: 'file.upload',
    eventCategory: 'create',
    targetType: 'admin_file',
    targetId: row.id,
    targetName: field.filename,
    afterData: result,
    detail: `上传文件：${field.filename}`
  })

  return result
}

/**
 * 分页查询后台上传文件。
 */
export async function listAdminFiles(params: AdminFileListParams) {
  const limit = Math.min(Number(params.limit) || 20, 100)
  const offset = Math.max(0, Number(params.offset) || 0)
  const keyword = normalizeSingleQuery(params.keyword ?? params.q)
  const kind = normalizeSingleQuery(params.kind)
  const statusRaw = normalizeSingleQuery(params.status)
  const conditions = []

  if (keyword) {
    const pattern = `%${keyword}%`
    conditions.push(or(
      like(adminFile.original_name, pattern),
      like(adminFile.filename, pattern),
      like(adminFile.mime, pattern),
      like(adminFile.hash, pattern),
      like(adminFile.path, pattern),
      like(adminFile.uploader_name, pattern)
    ))
  }

  if (kind && kind !== 'all') {
    conditions.push(eq(adminFile.kind, kind))
  }

  if (statusRaw === '0' || statusRaw === '1') {
    conditions.push(eq(adminFile.status, Number(statusRaw)))
  } else {
    conditions.push(eq(adminFile.status, 1))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const db = useDb()
  const totalResult = await db.select({ count: count() }).from(adminFile).where(whereClause)
  const totalRow = totalResult[0] ?? { count: 0 }
  const list = await db
    .select()
    .from(adminFile)
    .where(whereClause)
    .orderBy(desc(adminFile.id))
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
 * 软删除后台文件记录。
 */
export async function deleteAdminFile(event: H3Event, id: number) {
  const db = useDb()
  const [before] = await db.select().from(adminFile).where(eq(adminFile.id, id)).limit(1)
  if (!before || before.status !== 1) {
    throw createError({ statusCode: 404, message: '文件不存在或已删除' })
  }

  await db.update(adminFile).set({
    status: 0,
    updated_at: nowSec()
  }).where(eq(adminFile.id, id))

  setAdminAuditContext(event, {
    eventType: 'file.delete',
    eventCategory: 'delete',
    targetType: 'admin_file',
    targetId: id,
    targetName: before.original_name,
    beforeData: before,
    afterData: { ...before, status: 0 },
    detail: `删除文件记录：${before.original_name}`
  })

  return { success: true }
}
