import type { ComputedRef, Ref } from 'vue'
import {
  resolveAdminPagePermissionFromNavGroups,
  type AdminPermissionCatalog,
  type AdminNavPermissionGroup,
  type AdminNavPermissionItem,
  type AdminPermissionCode
} from '~~/shared/constants/admin_permissions'

export interface CurrentAdminRole {
  id: number
  code: string
  name: string
}

export interface CurrentAdminUser {
  id: number
  username: string
  displayName: string
  isSuperAdmin: boolean
  tokenVersion: number
  permissions: string[]
  roles: CurrentAdminRole[]
  permissionCatalog?: AdminPermissionCatalog
}

export interface UseAdminAuthReturn {
  currentAdmin: Ref<CurrentAdminUser | null>
  permissions: ComputedRef<string[]>
  isSuperAdmin: ComputedRef<boolean>
  adminAuthLoading: Ref<boolean>
  adminAuthLoaded: Ref<boolean>
  navGroups: ComputedRef<AdminNavPermissionGroup[]>
  navItems: ComputedRef<AdminNavPermissionItem[]>
  permissionGroups: ComputedRef<AdminPermissionCatalog['groups']>
  allPermissionCodes: ComputedRef<AdminPermissionCode[]>
  highRiskPermissionCodes: ComputedRef<AdminPermissionCode[]>
  can: (permission?: string | string[] | null) => boolean
  resolvePagePermission: (pathname: string) => AdminPermissionCode | undefined
  refreshCurrentAdmin: () => Promise<CurrentAdminUser | null>
  clearCurrentAdmin: () => void
}

const EMPTY_PERMISSION_CATALOG: AdminPermissionCatalog = {
  tree: [],
  groups: [],
  navGroups: [],
  pagePermissions: {},
  allPermissionCodes: [],
  highRiskPermissionCodes: []
}

const currentAdmin = ref<CurrentAdminUser | null>(null)
const permissionCatalog = ref<AdminPermissionCatalog>(EMPTY_PERMISSION_CATALOG)
const adminAuthLoading = ref(false)
const adminAuthLoaded = ref(false)

/**
 * 后台当前管理员状态。
 * 用于菜单裁剪、按钮权限判断和登录态初始化；真正安全边界仍在服务端 RBAC 中间件。
 */
export function useAdminAuth(): UseAdminAuthReturn {
  const { adminFetch } = useAdminFetch()

  const permissions = computed(() => currentAdmin.value?.permissions ?? [])
  const isSuperAdmin = computed(() => currentAdmin.value?.isSuperAdmin === true)

  function can(permission?: string | string[] | null): boolean {
    if (!permission) return true
    if (isSuperAdmin.value) return true
    const required = Array.isArray(permission) ? permission : [permission]
    if (required.length === 0) return true
    return required.some((item) => permissions.value.includes(item))
  }

  const navGroups = computed(() =>
    permissionCatalog.value.navGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission))
    })).filter((group) => group.items.length > 0)
  )

  const navItems = computed(() => navGroups.value.flatMap((group) => group.items))
  const permissionGroups = computed(() => permissionCatalog.value.groups)
  const allPermissionCodes = computed(() => permissionCatalog.value.allPermissionCodes)
  const highRiskPermissionCodes = computed(() => permissionCatalog.value.highRiskPermissionCodes)

  function resolvePagePermission(pathname: string): AdminPermissionCode | undefined {
    return resolveAdminPagePermissionFromNavGroups(pathname, permissionCatalog.value.navGroups)
  }

  async function refreshCurrentAdmin(): Promise<CurrentAdminUser | null> {
    adminAuthLoading.value = true
    try {
      const data = await adminFetch<CurrentAdminUser>('/api/admin/auth/me')
      currentAdmin.value = data
      permissionCatalog.value = data.permissionCatalog ?? EMPTY_PERMISSION_CATALOG
      adminAuthLoaded.value = true
      return data
    } finally {
      adminAuthLoading.value = false
    }
  }

  function clearCurrentAdmin() {
    currentAdmin.value = null
    permissionCatalog.value = EMPTY_PERMISSION_CATALOG
    adminAuthLoaded.value = false
  }

  return {
    currentAdmin,
    permissions,
    isSuperAdmin,
    adminAuthLoading,
    adminAuthLoaded,
    navGroups,
    navItems,
    permissionGroups,
    allPermissionCodes,
    highRiskPermissionCodes,
    can,
    resolvePagePermission,
    refreshCurrentAdmin,
    clearCurrentAdmin
  }
}
