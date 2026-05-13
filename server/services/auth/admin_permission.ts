import { and, asc, eq, inArray } from 'drizzle-orm'
import { useDb } from '#server/db'
import { adminPermission, adminRole, adminRolePermission, adminUser, adminUserRole } from '#server/db/schema'
import {
  type AdminPermissionCode,
  type AdminPermissionCatalog,
  type AdminPermissionGroup
} from '~~/shared/constants/admin_permissions'
import {
  getKnownPermissionCodes,
  getPermissionCatalogSnapshot
} from '#server/services/auth/admin_permission_catalog'

export interface AdminRoleBrief {
  id: number
  code: string
  name: string
}

export interface AdminContext {
  id: number
  username: string
  displayName: string
  isSuperAdmin: boolean
  tokenVersion: number
  permissions: string[]
  roles: AdminRoleBrief[]
}

export const SYSTEM_ADMIN_ROLES = [
  { code: 'super_admin', name: '超级管理员', description: '拥有全部后台权限，负责账号、角色与高风险配置', sort: 10 },
  { code: 'system_admin', name: '系统管理员', description: '负责系统设置、管理员账户、角色授权与资源上传', sort: 20 },
  { code: 'auditor', name: '审计员', description: '只读查看后台概览、系统设置和操作日志', sort: 30 }
]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, AdminPermissionCode[]> = {
  super_admin: [],
  system_admin: [
    'dashboard.read',
    'settings.read',
    'settings.create',
    'settings.update',
    'settings.delete',
    'operation_logs.read',
    'files.read',
    'files.manage',
    'upload.create',
    'admin_accounts.read',
    'admin_accounts.manage'
  ],
  auditor: [
    'dashboard.read',
    'settings.read',
    'operation_logs.read',
    'admin_accounts.read'
  ]
}

export async function sanitizePermissionCodes(values: unknown): Promise<string[]> {
  const list = Array.isArray(values) ? values : []
  const normalized = Array.from(new Set(list.map((item) => String(item)).filter(Boolean)))
  const knownCodes = new Set(await getKnownPermissionCodes())
  return normalized.filter((item) => knownCodes.has(item))
}

export async function getAdminPermissionCatalog(): Promise<AdminPermissionCatalog> {
  return await getPermissionCatalogSnapshot()
}

export async function getAdminPermissionGroups(): Promise<AdminPermissionGroup[]> {
  return (await getAdminPermissionCatalog()).groups
}

export function hasAdminPermission(admin: AdminContext, permissionCode: string): boolean {
  return admin.isSuperAdmin || admin.permissions.includes(permissionCode as AdminPermissionCode)
}

export function hasAnyAdminPermission(admin: AdminContext, permissionCodes: string[]): boolean {
  if (permissionCodes.length === 0) return true
  return admin.isSuperAdmin || permissionCodes.some((permission) => admin.permissions.includes(permission as AdminPermissionCode))
}

/**
 * 确保系统内置角色和默认授权存在。
 * 仅对缺失授权的角色进行补齐，避免覆盖已有手工调整。
 */
export async function ensureSystemRolesAndPermissions(): Promise<void> {
  const db = useDb()
  const now = Math.floor(Date.now() / 1000)

  for (const systemRole of SYSTEM_ADMIN_ROLES) {
    const [existing] = await db.select().from(adminRole).where(eq(adminRole.code, systemRole.code)).limit(1)
    if (!existing) {
      await db.insert(adminRole).values({
        code: systemRole.code,
        name: systemRole.name,
        description: systemRole.description,
        status: 1,
        is_system: 1,
        sort: systemRole.sort,
        created_at: now,
        updated_at: now
      })
    }
  }

  const roles = await db.select().from(adminRole)
  for (const role of roles) {
    const defaults = role.code === 'super_admin'
      ? await getKnownPermissionCodes(true)
      : DEFAULT_ROLE_PERMISSIONS[role.code]
    if (!defaults || defaults.length === 0) continue

    const existingPermissions = await db
      .select({ code: adminRolePermission.permission_code })
      .from(adminRolePermission)
      .where(eq(adminRolePermission.role_id, role.id))

    if (existingPermissions.length > 0) continue

    const permissionRows = await db
      .select({ id: adminPermission.id, code: adminPermission.code })
      .from(adminPermission)
      .where(inArray(adminPermission.code, defaults))
    const permissionIdByCode = new Map(permissionRows.map((item) => [item.code, item.id]))

    await db.insert(adminRolePermission).values(defaults.map((permission) => ({
      role_id: role.id,
      permission_id: permissionIdByCode.get(permission) ?? 0,
      permission_code: permission,
      created_at: now
    })))
  }
}

/**
 * 读取管理员上下文，包含角色和权限。
 * 超级管理员权限始终来自代码字典，避免角色授权异常时锁死后台。
 */
export async function getAdminContextByUserId(userId: number): Promise<AdminContext | null> {
  const db = useDb()
  const [user] = await db.select().from(adminUser).where(eq(adminUser.id, userId)).limit(1)
  if (!user || user.status !== 1) return null

  const roles = await db
    .select({
      id: adminRole.id,
      code: adminRole.code,
      name: adminRole.name
    })
    .from(adminUserRole)
    .innerJoin(adminRole, eq(adminUserRole.role_id, adminRole.id))
    .where(and(eq(adminUserRole.user_id, user.id), eq(adminRole.status, 1)))
    .orderBy(asc(adminRole.sort), asc(adminRole.id))

  let permissions: string[] = []
  if (user.is_super_admin === 1) {
    permissions = await getKnownPermissionCodes(true)
  } else if (roles.length > 0) {
    const roleIds = roles.map((role) => role.id)
    const permissionRows = await db
      .select({ code: adminRolePermission.permission_code })
      .from(adminRolePermission)
      .where(inArray(adminRolePermission.role_id, roleIds))
    permissions = await sanitizePermissionCodes(permissionRows.map((row) => row.code))
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    isSuperAdmin: user.is_super_admin === 1,
    tokenVersion: user.token_version,
    permissions,
    roles
  }
}
