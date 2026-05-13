export type BuiltInAdminPermissionCode =
  | 'dashboard.read'
  | 'settings.read'
  | 'settings.create'
  | 'settings.update'
  | 'settings.delete'
  | 'operation_logs.read'
  | 'files.read'
  | 'files.manage'
  | 'upload.create'
  | 'demo_users.read'
  | 'demo_users.manage'
  | 'admin_accounts.read'
  | 'admin_accounts.manage'

export type AdminPermissionCode = BuiltInAdminPermissionCode | (string & {})

export type AdminPermissionNodeType = 'catalog' | 'menu' | 'page' | 'button' | 'api' | (string & {})

export interface AdminPermissionNode {
  id: number
  parentId: number
  type: AdminPermissionNodeType
  code: string
  name: string
  description: string
  module: string
  routePath: string
  componentKey: string
  activeMenu: string
  keepalive: boolean
  icon: string
  sort: number
  visible: boolean
  isSystem: boolean
  isHighRisk: boolean
  children: AdminPermissionNode[]
}

export interface AdminPermissionItem {
  code: AdminPermissionCode
  name: string
  description?: string
  highRisk?: boolean
}

export interface AdminPermissionGroup {
  key: string
  name: string
  menuKey: string
  menuName: string
  permissions: AdminPermissionItem[]
}

export interface AdminNavPermissionItem {
  label: string
  to: string
  icon: string
  permission: AdminPermissionCode
  menuKey: string
  menuName: string
}

export interface AdminNavPermissionGroup {
  key: string
  name: string
  icon: string
  items: AdminNavPermissionItem[]
}

export interface AdminPagePermissionRule {
  pattern: RegExp
  permission: AdminPermissionCode
  description: string
}

export interface AdminPermissionCatalog {
  tree: AdminPermissionNode[]
  groups: AdminPermissionGroup[]
  navGroups: AdminNavPermissionGroup[]
  pagePermissions: Record<string, AdminPermissionCode>
  allPermissionCodes: AdminPermissionCode[]
  highRiskPermissionCodes: AdminPermissionCode[]
}

export const ADMIN_PAGE_PERMISSION_RULES: AdminPagePermissionRule[] = []

function normalizeAdminPagePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

function isAssignablePermissionNode(node: AdminPermissionNode): boolean {
  return node.type === 'menu' || node.type === 'page' || node.type === 'button'
}

function isNavPermissionNode(node: AdminPermissionNode): boolean {
  return (node.type === 'menu' || node.type === 'page') && Boolean(node.routePath)
}

function nodeToPermissionItem(node: AdminPermissionNode): AdminPermissionItem {
  return {
    code: node.code,
    name: node.name,
    description: node.description || node.module,
    highRisk: node.isHighRisk
  }
}

function uniquePermissionItems(items: AdminPermissionItem[]): AdminPermissionItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}

function collectAssignablePermissionItems(node: AdminPermissionNode): AdminPermissionItem[] {
  return node.children.flatMap((child) => [
    ...(isAssignablePermissionNode(child) ? [nodeToPermissionItem(child)] : []),
    ...collectAssignablePermissionItems(child)
  ])
}

function collectAllPermissionCodes(nodes: AdminPermissionNode[]): AdminPermissionCode[] {
  const codes = nodes.flatMap((node) => [
    ...(node.code ? [node.code] : []),
    ...collectAllPermissionCodes(node.children)
  ])
  return Array.from(new Set(codes))
}

/**
 * 根据数据库权限树构建角色授权分组。
 * 仅展示可授权给角色的菜单、页面和按钮；API matcher 由其父级权限承载。
 */
export function buildAdminPermissionGroupsFromTree(tree: AdminPermissionNode[]): AdminPermissionGroup[] {
  const groups: AdminPermissionGroup[] = []

  for (const root of tree) {
    const menuKey = root.code || String(root.id)
    const menuName = root.name
    const groupRoots = root.type === 'catalog' ? root.children : [root]

    for (const item of groupRoots) {
      if (!isAssignablePermissionNode(item) && !item.children.some((child) => isAssignablePermissionNode(child))) {
        continue
      }

      const permissions = uniquePermissionItems([
        ...(isAssignablePermissionNode(item) ? [nodeToPermissionItem(item)] : []),
        ...collectAssignablePermissionItems(item)
      ])

      if (permissions.length === 0) continue

      groups.push({
        key: item.code || String(item.id),
        name: item.name,
        menuKey,
        menuName,
        permissions
      })
    }
  }

  return groups
}

function collectNavPermissionItems(
  nodes: AdminPermissionNode[],
  menuKey: string,
  menuName: string
): AdminNavPermissionItem[] {
  return nodes.flatMap((node) => [
    ...(node.visible && isNavPermissionNode(node)
      ? [{
          label: node.name,
          to: node.routePath,
          icon: node.icon || 'i-lucide-folder',
          permission: node.code,
          menuKey,
          menuName
        }]
      : []),
    ...collectNavPermissionItems(node.children, menuKey, menuName)
  ])
}

/** 根据数据库权限树构建后台导航分组。 */
export function buildAdminNavPermissionGroupsFromTree(tree: AdminPermissionNode[]): AdminNavPermissionGroup[] {
  return tree.flatMap((root) => {
    const menuKey = root.code || String(root.id)
    const menuName = root.name
    const nodes = root.type === 'catalog' ? root.children : [root]
    const items = collectNavPermissionItems(nodes, menuKey, menuName)
    if (items.length === 0) return []

    return [{
      key: menuKey,
      name: menuName,
      icon: root.icon || items[0]?.icon || 'i-lucide-folder',
      items
    }]
  })
}

export function buildAdminPagePermissionsFromNavGroups(
  navGroups: AdminNavPermissionGroup[]
): Record<string, AdminPermissionCode> {
  return Object.fromEntries(
    navGroups.flatMap((group) => group.items.map((item) => [item.to, item.permission]))
  ) as Record<string, AdminPermissionCode>
}

export function resolveAdminPagePermissionFromNavGroups(
  pathname: string,
  navGroups: AdminNavPermissionGroup[]
): AdminPermissionCode | undefined {
  const normalizedPath = normalizeAdminPagePath(pathname)
  return Object.entries(buildAdminPagePermissionsFromNavGroups(navGroups))
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => normalizedPath === path || normalizedPath.startsWith(`${path}/`))?.[1]
}

export function buildAdminPermissionCatalogFromTree(tree: AdminPermissionNode[]): AdminPermissionCatalog {
  const groups = buildAdminPermissionGroupsFromTree(tree)
  const navGroups = buildAdminNavPermissionGroupsFromTree(tree)
  const allPermissionCodes = uniquePermissionItems(groups.flatMap((group) => group.permissions)).map((item) => item.code)
  const highRiskPermissionCodes = uniquePermissionItems(
    groups.flatMap((group) => group.permissions.filter((permission) => permission.highRisk))
  ).map((item) => item.code)

  return {
    tree,
    groups,
    navGroups,
    pagePermissions: buildAdminPagePermissionsFromNavGroups(navGroups),
    allPermissionCodes,
    highRiskPermissionCodes
  }
}

export function getAllAdminPermissionCodesFromTree(tree: AdminPermissionNode[]): AdminPermissionCode[] {
  return collectAllPermissionCodes(tree)
}
