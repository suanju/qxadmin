interface AdminPagedListQueryContext {
  page: number
  pageSize: number
  offset: number
}

interface UseAdminPagedListOptions<TResponse, TItem> {
  key: string
  path: string
  initialPage?: number
  initialPageSize?: number
  watchSources?: ReadonlyArray<object>
  buildQuery: (context: AdminPagedListQueryContext) => Record<string, unknown>
  getItems: (response: TResponse | null) => TItem[]
  getTotal: (response: TResponse | null) => number
}

interface UseAdminPagedListReturn<TResponse, TItem> {
  data: Ref<TResponse | null>
  items: Ref<TItem[]>
  total: Ref<number>
  page: Ref<number>
  pageSize: Ref<number>
  pending: Ref<boolean>
  error: Ref<unknown>
  status: Ref<string>
  refresh: () => Promise<void>
  onPageChange: (nextPage: number) => void
}

/**
 * 后台列表页统一的分页加载入口。
 * 负责把 `page / pageSize / loading / refresh` 这类重复逻辑收敛到 composable，
 * 页面层只保留筛选状态、列定义和业务交互。
 */
export function useAdminPagedList<TResponse, TItem>(
  options: UseAdminPagedListOptions<TResponse, TItem>
): UseAdminPagedListReturn<TResponse, TItem> {
  const { adminFetch } = useAdminFetch()
  const page = ref(options.initialPage ?? 1)
  const pageSize = ref(options.initialPageSize ?? 20)
  const items = ref<TItem[]>([])
  const total = ref(0)

  const query = computed(() => {
    const currentPage = Math.max(1, page.value)
    const currentPageSize = Math.max(1, pageSize.value)
    return options.buildQuery({
      page: currentPage,
      pageSize: currentPageSize,
      offset: (currentPage - 1) * currentPageSize
    })
  })

  const { data, pending, refresh, error, status } = useAsyncData(
    options.key,
    async () => {
      return await adminFetch<TResponse>(options.path, {
        query: query.value
      })
    },
    {
      watch: [page, pageSize, ...(options.watchSources ?? [])]
    }
  )

  watch(
    data,
    (value) => {
      items.value = options.getItems(value ?? null)
      total.value = Number(options.getTotal(value ?? null) || 0)
    },
    { immediate: true }
  )

  watch(pageSize, () => {
    if (page.value !== 1) {
      page.value = 1
    }
  })

  function onPageChange(nextPage: number) {
    page.value = nextPage
  }

  return {
    data,
    items,
    total,
    page,
    pageSize,
    pending,
    error,
    status,
    refresh,
    onPageChange
  }
}
