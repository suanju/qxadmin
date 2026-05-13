import { asc, eq, inArray } from 'drizzle-orm'
import { useDb } from '#server/db'
import { adminPermission, adminRolePermission } from '#server/db/schema'
import {
  buildAdminPermissionCatalogFromTree,
  getAllAdminPermissionCodesFromTree,
  type AdminPermissionCatalog,
  type AdminPermissionNode
} from '~~/shared/constants/admin_permissions'
import { serviceLogger } from '#server/utils/log'

export type AdminApiMatchType = 'exact' | 'prefix' | 'pattern' | 'regex'

export interface AdminApiPermissionMatcher {
  id: number
  code: string
  parentId: number
  parentCode: string
  requiredCodes: string[]
  method: string
  path: string
  matchType: AdminApiMatchType
  name: string
  module: string
  isHighRisk: boolean
}

export interface AdminApiPermissionResolution {
  matched: boolean
  apiPermission?: AdminApiPermissionMatcher
  permissions: string[]
}

interface CatalogCache {
  tree: AdminPermissionNode[]
  apiMatchers: AdminApiPermissionMatcher[]
  loadedAt: number
}

const CACHE_TTL_MS = 30_000
let catalogCache: CatalogCache | null = null

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

function patternPathToRegExp(patternPath: string): RegExp {
  const escaped = normalizePath(patternPath)
    .split('/')
    .map((segment) => {
      if (!segment) return ''
      if (/^:.+\*$/.test(segment)) return '.+'
      if (/^:.+\?$/.test(segment)) return '[^/]*'
      if (/^:.+/.test(segment)) return '[^/]+'
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return new RegExp(`^${escaped}$`)
}

function apiPathMatches(matcher: AdminApiPermissionMatcher, pathname: string): boolean {
  const apiPath = normalizePath(matcher.path)
  const currentPath = normalizePath(pathname)

  if (matcher.matchType === 'exact') return apiPath === currentPath
  if (matcher.matchType === 'prefix') return currentPath === apiPath || currentPath.startsWith(`${apiPath}/`)
  if (matcher.matchType === 'pattern') return patternPathToRegExp(apiPath).test(currentPath)
  if (matcher.matchType === 'regex') return new RegExp(apiPath).test(currentPath)
  return false
}

function toNode(row: typeof adminPermission.$inferSelect): AdminPermissionNode {
  return {
    id: row.id,
    parentId: row.parent_id,
    type: row.type,
    code: row.code,
    name: row.name,
    description: row.description,
    module: row.module,
    routePath: row.route_path,
    componentKey: row.component_key,
    activeMenu: row.active_menu,
    keepalive: row.keepalive === 1,
    icon: row.icon,
    sort: row.sort,
    visible: row.visible === 1,
    isSystem: row.is_system === 1,
    isHighRisk: row.is_high_risk === 1,
    children: []
  }
}

function buildTree(rows: Array<typeof adminPermission.$inferSelect>): AdminPermissionNode[] {
  const nodeById = new Map<number, AdminPermissionNode>()
  const roots: AdminPermissionNode[] = []

  for (const row of rows) {
    nodeById.set(row.id, toNode(row))
  }

  for (const node of nodeById.values()) {
    if (node.parentId > 0 && nodeById.has(node.parentId)) {
      nodeById.get(node.parentId)?.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: AdminPermissionNode[]) => {
    nodes.sort((a, b) => a.sort - b.sort || a.id - b.id)
    for (const node of nodes) sortNodes(node.children)
  }
  sortNodes(roots)

  return roots
}

async function loadCatalog(): Promise<CatalogCache> {
  const db = useDb()
  const rows = await db
    .select()
    .from(adminPermission)
    .where(eq(adminPermission.status, 1))
    .orderBy(asc(adminPermission.sort), asc(adminPermission.id))

  const codeById = new Map(rows.map((row) => [row.id, row.code]))
  const apiMatchers = rows
    .filter((row) => row.type === 'api')
    .map((row): AdminApiPermissionMatcher => {
      const parentCode = row.parent_id > 0 ? (codeById.get(row.parent_id) || '') : ''
      return {
        id: row.id,
        code: row.code,
        parentId: row.parent_id,
        parentCode,
        requiredCodes: Array.from(new Set([parentCode, row.code].filter(Boolean))),
        method: row.api_method.toUpperCase(),
        path: row.api_path,
        matchType: row.api_match_type as AdminApiMatchType,
        name: row.name,
        module: row.module,
        isHighRisk: row.is_high_risk === 1
      }
    })

  return {
    tree: buildTree(rows),
    apiMatchers,
    loadedAt: Date.now()
  }
}

async function getCatalog(): Promise<CatalogCache> {
  if (catalogCache && Date.now() - catalogCache.loadedAt < CACHE_TTL_MS) {
    return catalogCache
  }
  catalogCache = await loadCatalog()
  return catalogCache
}

/** 清理动态权限目录缓存，用于权限或角色变更后刷新运行时 matcher。 */
export function clearAdminPermissionCatalogCache(): void {
  catalogCache = null
}

/** 读取启用中的动态权限树。 */
export async function getPermissionTree(): Promise<AdminPermissionNode[]> {
  return (await getCatalog()).tree
}

/** 读取前后端共用的权限目录快照。 */
export async function getPermissionCatalogSnapshot(): Promise<AdminPermissionCatalog> {
  try {
    const tree = await getPermissionTree()
    if (tree.length === 0) {
      throw new Error('数据库权限目录为空，请先执行 npm run rbac:sync')
    }
    return buildAdminPermissionCatalogFromTree(tree)
  } catch (error) {
    serviceLogger.error('读取数据库权限目录失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw createError({ statusCode: 500, message: '数据库权限目录不可用，请联系管理员' })
  }
}

/** 读取启用中的权限 code，用于角色授权入参校验和超级管理员权限补全。 */
export async function getKnownPermissionCodes(assignableOnly = false): Promise<string[]> {
  try {
    const tree = await getPermissionTree()
    if (tree.length === 0) {
      throw new Error('数据库权限目录为空，请先执行 npm run rbac:sync')
    }
    if (assignableOnly) return buildAdminPermissionCatalogFromTree(tree).allPermissionCodes
    return getAllAdminPermissionCodesFromTree(tree)
  } catch (error) {
    serviceLogger.error('读取数据库权限 code 失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw createError({ statusCode: 500, message: '数据库权限目录不可用，请联系管理员' })
  }
}

/** 读取启用中的后台 API 权限 matcher。 */
export async function getApiMatchers(): Promise<AdminApiPermissionMatcher[]> {
  return (await getCatalog()).apiMatchers
}

/** 根据请求方法和路径匹配数据库中的后台 API 权限。 */
export async function matchAdminApiPermission(pathname: string, method: string): Promise<AdminApiPermissionResolution> {
  const normalizedMethod = method.toUpperCase()
  const matcher = (await getApiMatchers()).find((item) =>
    (item.method === '*' || item.method === normalizedMethod) && apiPathMatches(item, pathname)
  )

  if (!matcher) return { matched: false, permissions: [] }

  return {
    matched: true,
    apiPermission: matcher,
    permissions: matcher.requiredCodes
  }
}

/** 读取角色拥有的权限 code，保留动态 `api.*` 与旧业务权限 code。 */
export async function getRolePermissionCodes(roleIds: number[]): Promise<string[]> {
  if (roleIds.length === 0) return []

  const db = useDb()
  const rows = await db
    .select({ code: adminRolePermission.permission_code })
    .from(adminRolePermission)
    .where(inArray(adminRolePermission.role_id, roleIds))

  return Array.from(new Set(rows.map((row) => row.code).filter(Boolean)))
}
