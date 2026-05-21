interface AdminMutationFeedbackOptions<T> {
  loading?: Ref<boolean>
  successTitle?: string | ((result: T) => string)
  successDescription?: string | ((result: T) => string | undefined)
  errorTitle?: string
  errorDescription?: string | ((error: unknown) => string | undefined)
}

interface UseAdminMutationFeedbackReturn {
  getAdminErrorMessage: (error: unknown, fallback?: string) => string
  runAdminMutation: <T>(task: () => Promise<T>, options?: AdminMutationFeedbackOptions<T>) => Promise<T>
}

/**
 * 后台写操作统一反馈入口。
 * 用于收敛 “loading + toast + 错误文案解析” 这类在页面里重复出现的交互代码。
 */
export function useAdminMutationFeedback(): UseAdminMutationFeedbackReturn {
  const toast = useToast()

  /**
   * 将后台接口异常统一转成可直接展示给用户的文案。
   */
  function getAdminErrorMessage(error: unknown, fallback = '请稍后重试'): string {
    return getAdminFetchErrorMessage(error, fallback)
  }

  /**
   * 统一包装后台写操作，负责维护 loading 并输出成功/失败 toast。
   */
  async function runAdminMutation<T>(
    task: () => Promise<T>,
    options: AdminMutationFeedbackOptions<T> = {}
  ): Promise<T> {
    if (options.loading) {
      options.loading.value = true
    }

    try {
      const result = await task()
      if (options.successTitle) {
        toast.add({
          title: typeof options.successTitle === 'function'
            ? options.successTitle(result)
            : options.successTitle,
          description: typeof options.successDescription === 'function'
            ? options.successDescription(result)
            : options.successDescription,
          color: 'success',
          icon: 'i-lucide-check'
        })
      }
      return result
    } catch (error) {
      if (options.errorTitle) {
        toast.add({
          title: options.errorTitle,
          description: typeof options.errorDescription === 'function'
            ? options.errorDescription(error)
            : options.errorDescription || getAdminErrorMessage(error),
          color: 'error'
        })
      }
      throw error
    } finally {
      if (options.loading) {
        options.loading.value = false
      }
    }
  }

  return {
    getAdminErrorMessage,
    runAdminMutation
  }
}
