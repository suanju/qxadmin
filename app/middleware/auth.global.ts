export default defineNuxtRouteMiddleware(async (to) => {
  // 登录页本身不需要鉴权
  if (to.path === '/login') {
    return
  }

  const auth = useCookie('admin_auth')

  if (!auth.value) {
    return navigateTo('/login')
  }

  if (to.path === '/no_permission') {
    return
  }

  const { adminAuthLoaded, refreshCurrentAdmin, can, resolvePagePermission } = useAdminAuth()
  if (!adminAuthLoaded.value) {
    try {
      await refreshCurrentAdmin()
    } catch {
      return
    }
  }

  const required = resolvePagePermission(to.path)
  if (!required) return

  if (!can(required)) {
    return navigateTo('/no_permission')
  }
})
