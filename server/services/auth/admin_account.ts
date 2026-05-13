import type { H3Event } from 'h3'
import { and, asc, count, eq, inArray, like, or } from 'drizzle-orm'
import { useDb } from '#server/db'
import { adminPermission, adminRole, adminRolePermission, adminUser, adminUserRole } from '#server/db/schema'
import type {
  AdminRole as AdminRoleRow,
  AdminUser as AdminUserRow
} from '#server/db/schema'
import { signAdminToken } from '#server/lib/auth'
import { hashAdminPassword, verifyAdminPassword } from '#server/lib/auth/password'
import { diffObjects, setAdminAuditContext } from '#server/utils/audit'
import {
  ensureSystemRolesAndPermissions,
  getAdminContextByUserId,
  sanitizePermissionCodes,
  type AdminContext
} from '#server/services/auth/admin_permission'

type AdminUserListItem = Omit<AdminUserRow, 'password_hash'> & {
  roles: Array<{
    role_id: number
    code: string
    name: string
  }>
}

export interface AdminUserListResult {
  list: AdminUserListItem[]
  total: number
  page: number
  pageSize: number
}

export interface AdminMutationResult {
  success: true
  id?: number
}

export type AdminRoleListItem = AdminRoleRow & {
  permissions: string[]
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function normalizeString(value: unknown, max = 255): string {
  return String(value ?? '').trim().slice(0, max)
}

function normalizeIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)))
}

function getCurrentAdmin(event: H3Event): AdminContext | null {
  return ((event.context as Record<string, unknown>).admin as AdminContext | undefined) ?? null
}

function assertManagePermission(event: H3Event): AdminContext {
  const admin = getCurrentAdmin(event)
  if (!admin || (!admin.isSuperAdmin && !admin.permissions.includes('admin_accounts.manage'))) {
    throw createError({ statusCode: 403, message: '当前账号没有管理员账户管理权限' })
  }
  return admin
}

function isStrictRoleModeEnabled(): boolean {
  return process.env.ADMIN_STRICT_ROLE_MODE === 'true'
}

/**
 * 严格角色模式下，普通管理员只能分配自己已经拥有的权限。
 */
function assertAssignableRolePermissions(operator: AdminContext, permissionCodes: string[]): void {
  if (!isStrictRoleModeEnabled() || operator.isSuperAdmin) return

  const requested = Array.from(new Set(permissionCodes.filter(Boolean)))
  const assignablePermissions = new Set(operator.permissions)
  const forbiddenPermissions = requested.filter((permission) => !assignablePermissions.has(permission))

  if (forbiddenPermissions.length > 0) {
    throw createError({
      statusCode: 403,
      message: `严格角色模式已开启，不能分配当前账号未拥有的权限：${forbiddenPermissions.join(', ')}`
    })
  }
}

async function ensureRoleIdsExist(roleIds: number[]): Promise<void> {
  if (roleIds.length === 0) return
  const db = useDb()
  const rows = await db.select({ id: adminRole.id }).from(adminRole).where(inArray(adminRole.id, roleIds))
  if (rows.length !== roleIds.length) {
    throw createError({ statusCode: 400, message: '存在无效角色，请刷新后重试' })
  }
}

async function countActiveSuperAdmins(): Promise<number> {
  const db = useDb()
  const [row] = await db
    .select({ count: count() })
    .from(adminUser)
    .where(and(eq(adminUser.status, 1), eq(adminUser.is_super_admin, 1)))
  return Number(row?.count ?? 0)
}

async function replaceUserRoles(userId: number, roleIds: number[]): Promise<void> {
  const db = useDb()
  const current = await db.select().from(adminUserRole).where(eq(adminUserRole.user_id, userId))
  for (const item of current) {
    await db.delete(adminUserRole).where(eq(adminUserRole.id, item.id))
  }
  if (roleIds.length > 0) {
    const createdAt = nowSec()
    await db.insert(adminUserRole).values(roleIds.map((roleId) => ({
      user_id: userId,
      role_id: roleId,
      created_at: createdAt
    })))
  }
}

async function sanitizeRolePermissionInput(permissionCodes: string[]): Promise<string[]> {
  const permissions = await sanitizePermissionCodes(permissionCodes)
  if (permissions.length !== Array.from(new Set(permissionCodes)).length) {
    throw createError({ statusCode: 400, message: '存在无效权限点，请刷新后重试' })
  }
  return permissions
}

async function replaceRolePermissions(roleId: number, permissionCodes: string[]): Promise<void> {
  const db = useDb()
  const permissions = await sanitizeRolePermissionInput(permissionCodes)

  const current = await db.select().from(adminRolePermission).where(eq(adminRolePermission.role_id, roleId))
  for (const item of current) {
    await db.delete(adminRolePermission).where(eq(adminRolePermission.id, item.id))
  }
  if (permissions.length > 0) {
    const createdAt = nowSec()
    const permissionRows = await db
      .select({ id: adminPermission.id, code: adminPermission.code })
      .from(adminPermission)
      .where(inArray(adminPermission.code, permissions))
    const permissionIdByCode = new Map(permissionRows.map((item) => [item.code, item.id]))

    await db.insert(adminRolePermission).values(permissions.map((permission) => ({
      role_id: roleId,
      permission_id: permissionIdByCode.get(permission) ?? 0,
      permission_code: permission,
      created_at: createdAt
    })))
  }
}

export async function listAdminUsers(params: Record<string, unknown>): Promise<AdminUserListResult> {
  const db = useDb()
  const limit = Math.min(Number(params.limit ?? params.pageSize) || 20, 100)
  const offset = Math.max(0, Number(params.offset) || 0)
  const keyword = normalizeString(params.keyword ?? params.q, 50)
  const statusRaw = normalizeString(params.status, 10)
  const conditions = []

  if (keyword) {
    const pattern = `%${keyword}%`
    conditions.push(or(like(adminUser.username, pattern), like(adminUser.display_name, pattern)))
  }
  if (statusRaw === '0' || statusRaw === '1') {
    conditions.push(eq(adminUser.status, Number(statusRaw)))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const [totalRow] = await db.select({ count: count() }).from(adminUser).where(whereClause)
  const users = await db
    .select()
    .from(adminUser)
    .where(whereClause)
    .orderBy(asc(adminUser.id))
    .limit(limit)
    .offset(offset)

  const userIds = users.map((user) => user.id)
  const roleRows = userIds.length > 0
    ? await db
        .select({
          user_id: adminUserRole.user_id,
          role_id: adminRole.id,
          code: adminRole.code,
          name: adminRole.name
        })
        .from(adminUserRole)
        .innerJoin(adminRole, eq(adminUserRole.role_id, adminRole.id))
        .where(inArray(adminUserRole.user_id, userIds))
    : []

  return {
    list: users.map(({ password_hash: _passwordHash, ...user }) => ({
      ...user,
      roles: roleRows
        .filter((role) => role.user_id === user.id)
        .map(({ user_id: _userId, ...role }) => role)
    })),
    total: Number(totalRow?.count ?? 0),
    page: Math.floor(offset / limit) + 1,
    pageSize: limit
  }
}

export async function createAdminUser(event: H3Event, body: Record<string, unknown>): Promise<AdminMutationResult> {
  const operator = assertManagePermission(event)
  const username = normalizeString(body.username, 50)
  const displayName = normalizeString(body.displayName ?? body.display_name, 100)
  const password = String(body.password ?? '')
  const roleIds = normalizeIdList(body.roleIds ?? body.role_ids)
  const isSuperAdmin = body.isSuperAdmin === true || body.is_super_admin === 1
  const status = Number(body.status) === 0 ? 0 : 1

  if (!/^[A-Za-z0-9_-]{3,50}$/.test(username)) {
    throw createError({ statusCode: 400, message: '用户名只能包含字母、数字、下划线、短横线，长度 3-50 位' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: '初始密码至少 8 位' })
  }
  await ensureRoleIdsExist(roleIds)

  const db = useDb()
  const [existing] = await db.select().from(adminUser).where(eq(adminUser.username, username)).limit(1)
  if (existing) {
    throw createError({ statusCode: 409, message: '用户名已存在' })
  }

  const ts = nowSec()
  await db.insert(adminUser).values({
    username,
    display_name: displayName || username,
    password_hash: await hashAdminPassword(password),
    status,
    is_super_admin: isSuperAdmin ? 1 : 0,
    token_version: 1,
    password_changed_at: ts,
    created_by: operator.id,
    updated_by: operator.id,
    created_at: ts,
    updated_at: ts
  })
  const [created] = await db.select().from(adminUser).where(eq(adminUser.username, username)).limit(1)
  if (created) {
    await replaceUserRoles(created.id, roleIds)
  }

  setAdminAuditContext(event, {
    eventType: 'admin_user.create',
    eventCategory: 'create',
    targetType: 'admin_user',
    targetId: created?.id ?? '',
    targetName: username,
    detail: `新增管理员账户：${username}`,
    afterData: created ? { ...created, password_hash: '***', roleIds } : undefined
  })

  return { success: true, id: created?.id }
}

export async function updateAdminUser(
  event: H3Event,
  id: number,
  body: Record<string, unknown>
): Promise<AdminMutationResult> {
  const operator = assertManagePermission(event)
  const db = useDb()
  const [user] = await db.select().from(adminUser).where(eq(adminUser.id, id)).limit(1)
  if (!user) throw createError({ statusCode: 404, message: '管理员账户不存在' })

  const displayName = normalizeString(body.displayName ?? body.display_name ?? user.display_name, 100)
  const roleIds = normalizeIdList(body.roleIds ?? body.role_ids)
  const status = Number(body.status) === 0 ? 0 : 1
  const isSuperAdmin = body.isSuperAdmin === true || body.is_super_admin === 1

  if (operator.id === user.id && status === 0) {
    throw createError({ statusCode: 400, message: '不能禁用当前登录账号' })
  }
  if (user.is_super_admin === 1 && !operator.isSuperAdmin) {
    throw createError({ statusCode: 403, message: '普通管理员不能修改超级管理员账号' })
  }
  if (operator.id === user.id && user.is_super_admin === 1 && !isSuperAdmin) {
    throw createError({ statusCode: 400, message: '不能取消当前登录账号的超级管理员身份' })
  }
  if (user.is_super_admin === 1 && (status === 0 || !isSuperAdmin) && await countActiveSuperAdmins() <= 1) {
    throw createError({ statusCode: 400, message: '不能禁用或降级最后一个启用中的超级管理员' })
  }
  await ensureRoleIdsExist(roleIds)

  const next = {
    display_name: displayName || user.username,
    status,
    is_super_admin: isSuperAdmin ? 1 : 0,
    token_version: user.token_version + 1,
    updated_by: operator.id,
    updated_at: nowSec()
  }

  await db.update(adminUser).set(next).where(eq(adminUser.id, id))
  await replaceUserRoles(user.id, roleIds)

  const [after] = await db.select().from(adminUser).where(eq(adminUser.id, id)).limit(1)
  setAdminAuditContext(event, {
    eventType: 'admin_user.update',
    eventCategory: 'update',
    targetType: 'admin_user',
    targetId: id,
    targetName: user.username,
    beforeData: { ...user, password_hash: '***' },
    afterData: after ? { ...after, password_hash: '***', roleIds } : undefined,
    changeItems: diffObjects(user, after, [
      'display_name',
      'status',
      'is_super_admin',
      'token_version'
    ]),
    detail: `修改管理员账户：${user.username}`
  })

  return { success: true }
}

/**
 * 删除普通管理员账户。
 * 超级管理员账号和当前登录账号禁止删除，避免破坏后台最高权限与当前会话。
 */
export async function deleteAdminUser(event: H3Event, id: number): Promise<{ success: true }> {
  const operator = assertManagePermission(event)
  const db = useDb()
  const [user] = await db.select().from(adminUser).where(eq(adminUser.id, id)).limit(1)
  if (!user) throw createError({ statusCode: 404, message: '管理员账户不存在' })

  if (user.is_super_admin === 1) {
    throw createError({ statusCode: 400, message: '超级管理员账号不可删除' })
  }
  if (operator.id === user.id) {
    throw createError({ statusCode: 400, message: '不能删除当前登录账号' })
  }

  const roleLinks = await db.select().from(adminUserRole).where(eq(adminUserRole.user_id, user.id))
  for (const link of roleLinks) {
    await db.delete(adminUserRole).where(eq(adminUserRole.id, link.id))
  }
  await db.delete(adminUser).where(eq(adminUser.id, user.id))

  setAdminAuditContext(event, {
    eventType: 'admin_user.delete',
    eventCategory: 'delete',
    targetType: 'admin_user',
    targetId: user.id,
    targetName: user.username,
    beforeData: { ...user, password_hash: '***', roleIds: roleLinks.map((link) => link.role_id) },
    detail: `删除管理员账户：${user.username}`
  })

  return { success: true }
}

export async function resetAdminUserPassword(
  event: H3Event,
  id: number,
  body: Record<string, unknown>
): Promise<AdminMutationResult> {
  const operator = assertManagePermission(event)
  const password = String(body.password ?? '')
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: '新密码至少 8 位' })
  }

  const db = useDb()
  const [user] = await db.select().from(adminUser).where(eq(adminUser.id, id)).limit(1)
  if (!user) throw createError({ statusCode: 404, message: '管理员账户不存在' })

  await db.update(adminUser).set({
    password_hash: await hashAdminPassword(password),
    password_changed_at: nowSec(),
    token_version: user.token_version + 1,
    updated_by: operator.id,
    updated_at: nowSec()
  }).where(eq(adminUser.id, id))

  setAdminAuditContext(event, {
    eventType: 'admin_user.reset_password',
    eventCategory: 'update',
    targetType: 'admin_user',
    targetId: id,
    targetName: user.username,
    detail: `重置管理员密码：${user.username}`
  })

  return { success: true }
}

export interface ChangeCurrentAdminPasswordBody {
  currentPassword?: string
  current_password?: string
  newPassword?: string
  new_password?: string
  password?: string
}

/**
 * 当前管理员自助修改密码。
 * 需校验旧密码，更新密码哈希后提升 tokenVersion，并返回新 token 供路由层刷新登录态。
 */
export async function changeCurrentAdminPassword(
  event: H3Event,
  body: ChangeCurrentAdminPasswordBody
): Promise<{ success: true; token: string }> {
  const operator = getCurrentAdmin(event)
  if (!operator?.id) {
    throw createError({ statusCode: 401, message: '当前登录态不支持在线修改密码，请重新登录后再试' })
  }

  const currentPassword = String(body.currentPassword ?? body.current_password ?? '').trim()
  const newPassword = String(body.newPassword ?? body.new_password ?? body.password ?? '')

  if (!currentPassword) {
    throw createError({ statusCode: 400, message: '请输入当前密码' })
  }
  if (newPassword.length < 8) {
    throw createError({ statusCode: 400, message: '新密码至少 8 位' })
  }
  if (currentPassword === newPassword) {
    throw createError({ statusCode: 400, message: '新密码不能与当前密码相同' })
  }

  const db = useDb()
  const [user] = await db.select().from(adminUser).where(eq(adminUser.id, operator.id)).limit(1)
  if (!user || user.status !== 1) {
    throw createError({ statusCode: 401, message: '账号不存在或已被禁用，请重新登录' })
  }

  const passwordOk = await verifyAdminPassword(currentPassword, user.password_hash)
  if (!passwordOk) {
    throw createError({ statusCode: 400, message: '当前密码不正确' })
  }

  const ts = nowSec()
  const nextTokenVersion = user.token_version + 1

  await db.update(adminUser).set({
    password_hash: await hashAdminPassword(newPassword),
    password_changed_at: ts,
    token_version: nextTokenVersion,
    updated_by: user.id,
    updated_at: ts
  }).where(eq(adminUser.id, user.id))

  setAdminAuditContext(event, {
    eventType: 'admin_user.change_self_password',
    eventCategory: 'update',
    targetType: 'admin_user',
    targetId: user.id,
    targetName: user.username,
    detail: `当前管理员修改密码：${user.username}`
  })

  const token = await signAdminToken({
    userId: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    isSuperAdmin: user.is_super_admin === 1,
    tokenVersion: nextTokenVersion
  })

  return { success: true, token }
}

export async function listAdminRoles(): Promise<AdminRoleListItem[]> {
  await ensureSystemRolesAndPermissions()
  const db = useDb()
  const roles = await db.select().from(adminRole).orderBy(asc(adminRole.sort), asc(adminRole.id))
  const roleIds = roles.map((role) => role.id)
  const permissions = roleIds.length > 0
    ? await db.select().from(adminRolePermission).where(inArray(adminRolePermission.role_id, roleIds))
    : []

  return roles.map((role) => ({
    ...role,
    permissions: permissions.filter((item) => item.role_id === role.id).map((item) => item.permission_code)
  }))
}

export async function createAdminRole(event: H3Event, body: Record<string, unknown>): Promise<AdminMutationResult> {
  const operator = assertManagePermission(event)
  const code = normalizeString(body.code, 50)
  const name = normalizeString(body.name, 100)
  const description = normalizeString(body.description, 255)
  const status = Number(body.status) === 0 ? 0 : 1
  const sort = Number(body.sort) || 100
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : []

  if (!/^[a-z][a-z0-9_]{2,49}$/.test(code)) {
    throw createError({ statusCode: 400, message: '角色编码只能使用小写字母、数字、下划线，且需以字母开头' })
  }
  if (!name) throw createError({ statusCode: 400, message: '请输入角色名称' })

  const db = useDb()
  const [existing] = await db.select().from(adminRole).where(eq(adminRole.code, code)).limit(1)
  if (existing) throw createError({ statusCode: 409, message: '角色编码已存在' })
  const sanitizedPermissions = await sanitizeRolePermissionInput(permissions)
  assertAssignableRolePermissions(operator, sanitizedPermissions)

  const ts = nowSec()
  await db.insert(adminRole).values({
    code,
    name,
    description,
    status,
    is_system: 0,
    sort,
    created_by: operator.id,
    updated_by: operator.id,
    created_at: ts,
    updated_at: ts
  })
  const [created] = await db.select().from(adminRole).where(eq(adminRole.code, code)).limit(1)
  if (created) await replaceRolePermissions(created.id, sanitizedPermissions)

  setAdminAuditContext(event, {
    eventType: 'admin_role.create',
    eventCategory: 'create',
    targetType: 'admin_role',
    targetId: created?.id ?? '',
    targetName: code,
    detail: `新增后台角色：${name}`,
    afterData: created ? { ...created, permissions: sanitizedPermissions } : undefined
  })

  return { success: true, id: created?.id }
}

export async function updateAdminRole(
  event: H3Event,
  id: number,
  body: Record<string, unknown>
): Promise<AdminMutationResult> {
  const operator = assertManagePermission(event)
  const db = useDb()
  const [role] = await db.select().from(adminRole).where(eq(adminRole.id, id)).limit(1)
  if (!role) throw createError({ statusCode: 404, message: '角色不存在' })

  const name = normalizeString(body.name ?? role.name, 100)
  const description = normalizeString(body.description ?? role.description, 255)
  const status = Number(body.status) === 0 ? 0 : 1
  const sort = Number(body.sort) || role.sort
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : []

  if (role.code === 'super_admin' && status === 0) {
    throw createError({ statusCode: 400, message: '不能禁用超级管理员系统角色' })
  }
  if (!name) throw createError({ statusCode: 400, message: '请输入角色名称' })
  const sanitizedPermissions = role.code === 'super_admin'
    ? []
    : await sanitizeRolePermissionInput(permissions)
  if (role.code !== 'super_admin') {
    assertAssignableRolePermissions(operator, sanitizedPermissions)
  }

  await db.update(adminRole).set({
    name,
    description,
    status,
    sort,
    updated_by: operator.id,
    updated_at: nowSec()
  }).where(eq(adminRole.id, id))

  if (role.code !== 'super_admin') {
    await replaceRolePermissions(role.id, sanitizedPermissions)
  }

  const [after] = await db.select().from(adminRole).where(eq(adminRole.id, id)).limit(1)
  setAdminAuditContext(event, {
    eventType: 'admin_role.update',
    eventCategory: 'update',
    targetType: 'admin_role',
    targetId: id,
    targetName: role.code,
    beforeData: role,
    afterData: after ? { ...after, permissions: role.code === 'super_admin' ? 'ALL' : sanitizedPermissions } : undefined,
    changeItems: diffObjects(role, after, [
      'name',
      'description',
      'status',
      'sort'
    ]),
    detail: `修改后台角色：${role.name}`
  })

  const userLinks = await db.select().from(adminUserRole).where(eq(adminUserRole.role_id, role.id))
  for (const link of userLinks) {
    const context = await getAdminContextByUserId(link.user_id)
    if (context) {
      await db.update(adminUser).set({
        token_version: context.tokenVersion + 1,
        updated_by: operator.id,
        updated_at: nowSec()
      }).where(eq(adminUser.id, link.user_id))
    }
  }

  return { success: true }
}

/**
 * 删除后台角色。
 * 超级管理员角色禁止删除；删除其他角色时同步清理授权、用户绑定并提升受影响账号 tokenVersion。
 */
export async function deleteAdminRole(event: H3Event, id: number): Promise<{ success: true }> {
  const operator = assertManagePermission(event)
  const db = useDb()
  const [role] = await db.select().from(adminRole).where(eq(adminRole.id, id)).limit(1)
  if (!role) throw createError({ statusCode: 404, message: '角色不存在' })

  if (role.code === 'super_admin') {
    throw createError({ statusCode: 400, message: '超级管理员角色不可删除' })
  }

  const permissionLinks = await db.select().from(adminRolePermission).where(eq(adminRolePermission.role_id, role.id))
  const userLinks = await db.select().from(adminUserRole).where(eq(adminUserRole.role_id, role.id))
  const affectedUserIds = Array.from(new Set(userLinks.map((link) => link.user_id)))

  for (const link of permissionLinks) {
    await db.delete(adminRolePermission).where(eq(adminRolePermission.id, link.id))
  }
  for (const link of userLinks) {
    await db.delete(adminUserRole).where(eq(adminUserRole.id, link.id))
  }
  await db.delete(adminRole).where(eq(adminRole.id, role.id))

  const ts = nowSec()
  for (const userId of affectedUserIds) {
    const [user] = await db.select().from(adminUser).where(eq(adminUser.id, userId)).limit(1)
    if (!user) continue

    await db.update(adminUser).set({
      token_version: user.token_version + 1,
      updated_by: operator.id,
      updated_at: ts
    }).where(eq(adminUser.id, user.id))
  }

  setAdminAuditContext(event, {
    eventType: 'admin_role.delete',
    eventCategory: 'delete',
    targetType: 'admin_role',
    targetId: role.id,
    targetName: role.code,
    beforeData: {
      ...role,
      permissions: permissionLinks.map((link) => link.permission_code),
      userIds: affectedUserIds
    },
    detail: `删除后台角色：${role.name}`
  })

  return { success: true }
}
