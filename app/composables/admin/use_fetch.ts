/**
 * 用于调用 /api/admin/* 的 fetch，收到 401 时清除 admin_auth 并重定向到登录页
 */
export interface AdminFetchErrorLike {
  statusCode?: number
  data?: {
    message?: string
  }
  message?: string
}

export type AdminFetchOptions = Parameters<typeof $fetch>[1]

export interface UseAdminFetchReturn {
  adminFetch: <T = unknown>(url: string, options?: AdminFetchOptions) => Promise<T>
}

/**
 * 统一提取后台接口错误文案。
 * 让页面与 composable 在 toast / 弹窗提示时复用同一套兜底规则。
 */
export function getAdminFetchErrorMessage(error: unknown, fallback = '请稍后重试'): string {
  const typedError = error as AdminFetchErrorLike
  if (typedError?.statusCode === 403) {
    return typedError?.data?.message || typedError?.message || '当前账号没有权限执行该操作'
  }
  return typedError?.data?.message || typedError?.message || fallback
}

/**
 * 调用后台接口，并在 401 时自动清理登录态并跳转登录页。
 */
export function useAdminFetch(): UseAdminFetchReturn {
  const auth = useCookie('admin_auth')
  const toast = useToast()

  async function adminFetch<T = unknown>(url: string, options?: AdminFetchOptions): Promise<T> {
    try {
      return (await $fetch<T>(url, options)) as T
    } catch (error: unknown) {
      const typedError = error as AdminFetchErrorLike
      if (typedError?.statusCode === 401 && String(url).includes('/api/admin/')) {
        auth.value = null
        await navigateTo('/login')
      }
      if (typedError?.statusCode === 403 && String(url).includes('/api/admin/')) {
        toast.add({
          title: '无权限',
          description: getAdminFetchErrorMessage(error),
          color: 'warning',
          icon: 'i-lucide-shield-alert'
        })
      }
      throw error
    }
  }

  return { adminFetch }
}
