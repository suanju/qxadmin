import { getAdminPermissionCatalog } from '#server/services/auth/admin_permission'

export default defineEventHandler(async () => {
  const catalog = await getAdminPermissionCatalog()
  return {
    groups: catalog.groups,
    navGroups: catalog.navGroups,
    pagePermissions: catalog.pagePermissions,
    allPermissionCodes: catalog.allPermissionCodes,
    highRiskPermissionCodes: catalog.highRiskPermissionCodes
  }
})
