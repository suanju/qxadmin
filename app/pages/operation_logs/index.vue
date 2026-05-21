<script setup lang="tsx">
import type { TableColumn } from '@nuxt/ui'
import { UBadge, UButton, UIcon } from '#components'
import {
  ADMIN_TABLE_UI,
  createAdminActionColumnMeta,
  createAdminActionColumnPinning,
  renderAdminPinnedActionHeader
} from '~/composables/admin/use_table'

definePageMeta({ layout: 'default' })

interface OperationLogListItem {
  id: number
  operator_type: string
  operator_id: string
  operator_name: string
  event_type: string
  event_category: string
  target_type: string
  target_id: string
  target_name: string
  detail: string | null
  result: number
  status_code: number
  duration_ms: number
  request_method: string
  request_path: string
  ip: string
  ip_location?: string
  ip_province?: string
  ip_city?: string
  error_message: string
  created_at: number
}

interface OperationLogDetail extends OperationLogListItem {
  trace_id: string
  request_query: unknown
  request_body: unknown
  before_data: unknown
  after_data: unknown
  change_items: unknown
  user_agent: string
}

interface AuditChangeItem {
  field: string
  before: unknown
  after: unknown
}

interface OperationLogsResponse {
  list: OperationLogListItem[]
  total: number
  page: number
  pageSize: number
}

const EVENT_CATEGORY_ALL = '__all_event_category__'
const RESULT_ALL = '__all_result__'

const EVENT_CATEGORY_OPTIONS = [
  { value: EVENT_CATEGORY_ALL, label: '全部分类' },
  { value: 'create', label: '新增' },
  { value: 'update', label: '修改' },
  { value: 'delete', label: '删除' },
  { value: 'login', label: '登录' },
  { value: 'batch_update', label: '批量处理' },
  { value: 'action', label: '其他操作' }
]

const RESULT_OPTIONS = [
  { value: RESULT_ALL, label: '全部结果' },
  { value: '1', label: '成功' },
  { value: '0', label: '失败' }
]

const EVENT_CATEGORY_LABEL: Record<string, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  login: '登录',
  batch_update: '批量处理',
  action: '其他操作'
}

const { adminFetch } = useAdminFetch()
const toast = useToast()

const list = ref<OperationLogListItem[]>([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const searchQuery = ref('')
const eventType = ref('')
const eventCategory = ref(EVENT_CATEGORY_ALL)
const targetType = ref('')
const operator = ref('')
const result = ref(RESULT_ALL)
const dateStart = ref('')
const dateEnd = ref('')
const pauseFilterWatch = ref(false)
const tableColumnPinning = ref(createAdminActionColumnPinning())
const tableUi = {
  ...ADMIN_TABLE_UI,
  base: 'min-w-305 w-full'
}

const detailModal = ref<{
  open: boolean
  loading: boolean
  data: OperationLogDetail | null
}>({
  open: false,
  loading: false,
  data: null
})

const filteredList = computed(() => list.value)
const activeFilterCount = computed(() => {
  const values = [
    searchQuery.value,
    eventType.value,
    normalizeSelectFilterValue(eventCategory.value, EVENT_CATEGORY_ALL),
    targetType.value,
    operator.value,
    normalizeSelectFilterValue(result.value, RESULT_ALL),
    dateStart.value,
    dateEnd.value
  ]

  return values.filter((item) => String(item || '').trim()).length
})

function formatTime(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function normalizeSelectFilterValue(value: string, allValue: string): string {
  const normalized = value.trim()
  return normalized === allValue ? '' : normalized
}

function buildQuery(params: { limit: number; offset: number }): Record<string, string | number> {
  const query: Record<string, string | number> = {
    limit: params.limit,
    offset: params.offset
  }

  const keyword = searchQuery.value.trim()
  if (keyword) query.keyword = keyword

  const vEventType = eventType.value.trim()
  if (vEventType) query.eventType = vEventType

  const vEventCategory = normalizeSelectFilterValue(eventCategory.value, EVENT_CATEGORY_ALL)
  if (vEventCategory) query.eventCategory = vEventCategory

  const vTargetType = targetType.value.trim()
  if (vTargetType) query.targetType = vTargetType

  const vOperator = operator.value.trim()
  if (vOperator) query.operator = vOperator

  const vResult = normalizeSelectFilterValue(result.value, RESULT_ALL)
  if (vResult) query.result = vResult

  if (dateStart.value) query.dateStart = dateStart.value
  if (dateEnd.value) query.dateEnd = dateEnd.value

  return query
}

async function fetchList() {
  loading.value = true
  try {
    const offset = (page.value - 1) * pageSize.value
    const query = buildQuery({ limit: pageSize.value, offset })
    const response = await adminFetch<OperationLogsResponse>('/api/admin/operation_logs', { query })
    list.value = response.list
    total.value = response.total
  } finally {
    loading.value = false
  }
}

function onPageChange(newPage: number) {
  page.value = newPage
  fetchList()
}

function resetFilters() {
  pauseFilterWatch.value = true
  searchQuery.value = ''
  eventType.value = ''
  eventCategory.value = EVENT_CATEGORY_ALL
  targetType.value = ''
  operator.value = ''
  result.value = RESULT_ALL
  dateStart.value = ''
  dateEnd.value = ''
  nextTick(() => {
    pauseFilterWatch.value = false
    page.value = 1
    fetchList()
  })
}

function resultColor(v: number): 'success' | 'error' | 'warning' | 'neutral' {
  return v === 1 ? 'success' : 'error'
}

function resultLabel(v: number): string {
  return v === 1 ? '成功' : '失败'
}

function eventCategoryLabel(v: string | null | undefined): string {
  const key = String(v || 'action')
  return EVENT_CATEGORY_LABEL[key] || key
}

function eventCategoryColor(v: string | null | undefined): 'success' | 'error' | 'warning' | 'neutral' | 'primary' | 'secondary' {
  const key = String(v || 'action')
  if (key === 'create') return 'success'
  if (key === 'update') return 'secondary'
  if (key === 'delete') return 'error'
  if (key === 'login') return 'primary'
  if (key === 'batch_update') return 'neutral'
  return 'neutral'
}

function requestMethodColor(method: string | null | undefined): 'success' | 'error' | 'warning' | 'neutral' | 'primary' | 'secondary' {
  const key = String(method || '').toUpperCase()
  if (key === 'POST') return 'primary'
  if (key === 'PUT' || key === 'PATCH') return 'secondary'
  if (key === 'DELETE') return 'error'
  if (key === 'GET') return 'neutral'
  return 'warning'
}

function getIpLocationText(item: OperationLogListItem): string {
  const location = String(item.ip_location || '').trim()
  if (location) return location
  const province = String(item.ip_province || '').trim()
  const city = String(item.ip_city || '').trim()
  const fallback = [province, city].filter(Boolean).join(' ')
  return fallback || '—'
}

function shortText(value: string | null | undefined, max = 42): string {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  return s.length > max ? `${s.slice(0, max)}...` : s
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'

  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return '—'
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        return JSON.stringify(JSON.parse(s), null, 2)
      } catch {
        return s
      }
    }
    return s
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return Boolean(value.trim())
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return true
}

function toInlineText(value: unknown, max = 160): string {
  if (!hasMeaningfulValue(value)) return '—'
  if (typeof value === 'string') return shortText(value, max)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  try {
    return shortText(JSON.stringify(value), max)
  } catch {
    return shortText(String(value), max)
  }
}

function parseMaybeJson<T>(value: unknown): T | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  return value as T
}

function normalizeChangeItems(value: unknown): AuditChangeItem[] {
  const parsed = parseMaybeJson<AuditChangeItem[] | { field?: string; before?: unknown; after?: unknown }[]>(value)
  if (!Array.isArray(parsed)) return []

  return parsed
    .map(item => ({
      field: String(item?.field || '').trim(),
      before: item?.before,
      after: item?.after
    }))
    .filter(item => item.field)
}

const detailChangeItems = computed<AuditChangeItem[]>(() => normalizeChangeItems(detailModal.value.data?.change_items))
const detailHasRawChangePayload = computed(() => hasMeaningfulValue(detailModal.value.data?.change_items))

function toOperationLogDetail(row: OperationLogListItem): OperationLogDetail {
  return {
    ...row,
    trace_id: '',
    request_query: null,
    request_body: null,
    before_data: null,
    after_data: null,
    change_items: null,
    user_agent: ''
  }
}

async function openDetail(row: OperationLogListItem) {
  detailModal.value.open = true
  detailModal.value.loading = true
  detailModal.value.data = toOperationLogDetail(row)
  try {
    const data = await adminFetch<OperationLogDetail>(`/api/admin/operation_logs/${row.id}`)
    detailModal.value.data = {
      ...toOperationLogDetail(row),
      ...data
    }
  } catch (error: unknown) {
    detailModal.value.open = false
    toast.add({
      title: '加载日志详情失败',
      description: getAdminFetchErrorMessage(error),
      color: 'error'
    })
  } finally {
    detailModal.value.loading = false
  }
}

watch(pageSize, () => {
  page.value = 1
  fetchList()
})

watch([eventCategory, result, dateStart, dateEnd], () => {
  if (pauseFilterWatch.value) return
  page.value = 1
  fetchList()
})

let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch([eventType, targetType, operator], () => {
  if (pauseFilterWatch.value) return
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
  filterDebounceTimer = setTimeout(() => {
    page.value = 1
    fetchList()
  }, 300)
})

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (pauseFilterWatch.value) return
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    page.value = 1
    fetchList()
  }, 300)
})

const columns: TableColumn<OperationLogListItem>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    size: 80,
    meta: { class: { th: 'text-left', td: 'text-left font-mono text-xs' } }
  },
  {
    accessorKey: 'created_at',
    header: '时间',
    size: 180,
    meta: { class: { th: 'text-left', td: 'text-left text-xs text-muted' } },
    cell: ({ row }) => formatTime(row.original.created_at)
  },
  {
    accessorKey: 'operator_name',
    header: '操作人',
    size: 140,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <div class="flex flex-col">
        <span class="font-medium">{row.original.operator_name || row.original.operator_type || 'admin'}</span>
        <span class="font-mono text-[11px] text-muted">{row.original.operator_id || '—'}</span>
      </div>
    )
  },
  {
    accessorKey: 'event_type',
    header: '事件',
    size: 180,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) => (
      <div class="flex flex-col items-center gap-1 text-center">
        <span class="font-mono text-xs">{row.original.event_type || '—'}</span>
        <UBadge color={eventCategoryColor(row.original.event_category)} size="sm">
          {eventCategoryLabel(row.original.event_category)}
        </UBadge>
      </div>
    )
  },
  {
    accessorKey: 'target_type',
    header: '目标资源',
    size: 260,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => {
      const targetText = `${row.original.target_type || '—'}#${row.original.target_id || '—'}`
      const targetName = row.original.target_name || '—'

      return (
        <div class="flex w-64 max-w-64 min-w-0 flex-col gap-1 overflow-hidden">
          <span class="block truncate font-mono text-xs" title={targetText}>{targetText}</span>
          <span class="block truncate text-xs text-muted" title={targetName}>{targetName}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'request_path',
    header: '请求',
    size: 260,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <div class="flex max-w-64 flex-col gap-1">
        <span class="font-mono text-xs">{row.original.request_method || '—'}</span>
        <span class="truncate text-xs text-muted" title={row.original.request_path || ''}>{row.original.request_path || '—'}</span>
      </div>
    )
  },
  {
    accessorKey: 'ip',
    header: 'IP',
    size: 140,
    meta: { class: { th: 'text-left', td: 'text-left font-mono text-xs' } },
    cell: ({ row }) => row.original.ip || '—'
  },
  {
    accessorKey: 'ip_location',
    header: 'IP归属地',
    size: 160,
    meta: { class: { th: 'text-left', td: 'text-left text-xs text-muted' } },
    cell: ({ row }) => getIpLocationText(row.original)
  },
  {
    accessorKey: 'result',
    header: '结果',
    size: 160,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) => (
      <div class="flex flex-col items-center gap-1">
        <UBadge color={resultColor(row.original.result)} size="sm">
          {resultLabel(row.original.result)}
        </UBadge>
        <span class="text-[11px] text-muted">HTTP {row.original.status_code} / {row.original.duration_ms}ms</span>
      </div>
    )
  },
  {
    accessorKey: 'detail',
    header: '说明',
    size: 280,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <span class="block max-w-72 truncate text-xs text-muted" title={row.original.detail || ''}>
        {shortText(row.original.detail, 80)}
      </span>
    )
  },
  {
    id: 'actions',
    header: ({ column }) => renderAdminPinnedActionHeader(column),
    size: 96,
    meta: createAdminActionColumnMeta('min-w-22'),
    cell: ({ row }) => (
      <UButton
        color="primary"
        variant="subtle"
        size="xs"
        icon="i-lucide-eye"
        onClick={() => openDetail(row.original)}
      >
        详情
      </UButton>
    )
  }
]

onMounted(fetchList)

useHead({
  title: '操作日志'
})
</script>

<template>
  <div class="min-h-[calc(100vh-8rem)] p-6 md:p-8">
    <AdminPageHeader
      title="操作日志"
      description="按操作人、事件、资源、时间等维度查询后台操作记录"
      icon="i-lucide-clipboard-list"
    >
      <template #actions>
        <UBadge color="neutral" variant="subtle">
          当前 {{ filteredList.length }} 条 / 总计 {{ total }} 条
        </UBadge>
        <UBadge color="primary" variant="soft">
          已启用筛选 {{ activeFilterCount }} 项
        </UBadge>
      </template>
    </AdminPageHeader>

    <UCard class="overflow-hidden shadow-lg ring-1 ring-gray-200/50 dark:ring-gray-700/50">
      <div class="border-b border-default/60 bg-muted/35 px-4 py-4 dark:bg-background/60">
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section class="rounded-2xl border border-default/60 bg-default/90 p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-highlighted">关键词与资源定位</div>
                <p class="mt-1 text-xs text-muted">优先按操作人、资源名、路径和事件编码快速定位。</p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <UFormField label="综合搜索" class="md:col-span-2">
                <UInput
                  v-model="searchQuery"
                  name="keyword"
                  placeholder="搜索操作人 / 事件类型 / 资源名 / 路径 / 错误信息"
                  icon="i-lucide-search"
                  class="w-full"
                >
                  <template v-if="searchQuery" #trailing>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-x"
                      aria-label="清除搜索"
                      @click="searchQuery = ''"
                    />
                  </template>
                </UInput>
              </UFormField>

              <UFormField label="事件类型">
                <UInput
                  v-model="eventType"
                  name="event_type"
                  placeholder="如 config.update"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="资源类型">
                <UInput
                  v-model="targetType"
                  name="target_type"
                  placeholder="如 config / admin_user"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="操作人" class="md:col-span-2">
                <UInput
                  v-model="operator"
                  name="operator"
                  placeholder="输入管理员名称或 ID"
                  class="w-full"
                />
              </UFormField>
            </div>
          </section>

          <section class="rounded-2xl border border-default/60 bg-default/90 p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-highlighted">执行结果与时间范围</div>
                <p class="mt-1 text-xs text-muted">组合分类、结果和日期区间缩小排查范围。</p>
              </div>
              <UButton color="neutral" variant="subtle" size="xs" icon="i-lucide-rotate-ccw" @click="resetFilters">
                重置
              </UButton>
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <UFormField label="事件分类">
                <USelect v-model="eventCategory" name="event_category" :items="EVENT_CATEGORY_OPTIONS" value-key="value" class="w-full" />
              </UFormField>

              <UFormField label="执行结果">
                <USelect v-model="result" name="result" :items="RESULT_OPTIONS" value-key="value" class="w-full" />
              </UFormField>

              <UFormField label="日期范围" class="md:col-span-2">
                <AdminDateRangeInput
                  v-model:date-start="dateStart"
                  v-model:date-end="dateEnd"
                  class="w-full"
                  aria-label="选择操作日志日期范围"
                />
              </UFormField>
            </div>
          </section>
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
      </div>
      <UEmpty v-else-if="!filteredList.length" title="暂无匹配日志" icon="i-lucide-clipboard-list" class="py-20" />
      <div v-else>
        <div class="overflow-x-auto">
          <UTable
            v-model:column-pinning="tableColumnPinning"
            :data="filteredList"
            :columns="columns"
            sticky
            class="w-full"
            :ui="tableUi"
          />
        </div>
        <AdminTablePaginationBar
          :page="page"
          :page-size="pageSize"
          :total="total"
          @update:page="onPageChange"
          @update:pageSize="(v: number) => (pageSize = v)"
        >
          <template #summary>
            <span>
              第 {{ page }} 页 / 共 {{ Math.max(1, Math.ceil(total / pageSize)) }} 页，
              当前页 {{ filteredList.length }} 条 / 总计 {{ total }} 条
            </span>
          </template>
        </AdminTablePaginationBar>
      </div>
    </UCard>

    <UModal
      v-model:open="detailModal.open"
      title="操作日志详情"
      description="用于查看后台操作日志详情和请求上下文。"
      :ui="{ content: 'max-w-6xl', body: 'sm:p-6', footer: 'border-t border-default/60 bg-muted/20' }"
    >
      <template #body>
        <div v-if="detailModal.loading" class="flex items-center justify-center py-20">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
        </div>
        <div v-else-if="detailModal.data" class="space-y-4">
          <div class="grid grid-cols-1 gap-3 xl:grid-cols-5">
            <div class="rounded-2xl border border-default/60 bg-muted/25 p-4">
              <div class="text-xs text-muted">日志 ID</div>
              <div class="mt-2 font-mono text-sm text-highlighted">{{ detailModal.data.id }}</div>
            </div>
            <div class="rounded-2xl border border-default/60 bg-muted/25 p-4">
              <div class="text-xs text-muted">执行结果</div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <UBadge :color="resultColor(detailModal.data.result)" variant="soft" size="sm">
                  {{ resultLabel(detailModal.data.result) }}
                </UBadge>
                <UBadge :color="requestMethodColor(detailModal.data.request_method)" variant="soft" size="sm">
                  {{ detailModal.data.request_method || '—' }}
                </UBadge>
              </div>
              <div class="mt-2 text-xs text-muted">
                HTTP {{ detailModal.data.status_code || '—' }} / {{ detailModal.data.duration_ms || 0 }}ms
              </div>
            </div>
            <div class="rounded-2xl border border-default/60 bg-muted/25 p-4">
              <div class="text-xs text-muted">操作人</div>
              <div class="mt-2 text-sm font-medium text-highlighted">{{ detailModal.data.operator_name || detailModal.data.operator_type }}</div>
              <div class="mt-1 font-mono text-xs text-muted">{{ detailModal.data.operator_id || '—' }}</div>
            </div>
            <div class="rounded-2xl border border-default/60 bg-muted/25 p-4">
              <div class="text-xs text-muted">执行时间</div>
              <div class="mt-2 text-sm text-highlighted">{{ formatTime(detailModal.data.created_at) }}</div>
            </div>
            <div class="rounded-2xl border border-default/60 bg-muted/25 p-4">
              <div class="text-xs text-muted">Trace ID</div>
              <div class="mt-2 break-all font-mono text-[11px] text-highlighted">{{ detailModal.data.trace_id || '—' }}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section class="rounded-2xl border border-default/60 bg-default/90 p-4">
              <div class="mb-3">
                <div class="text-sm font-semibold text-highlighted">操作摘要</div>
                <p class="mt-1 text-xs text-muted">按事件、资源、请求与说明整理，便于快速判断本次操作的业务语义。</p>
              </div>

              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                  <div class="text-xs text-muted">事件</div>
                  <div class="mt-2 font-mono text-sm">{{ detailModal.data.event_type }}</div>
                  <div class="mt-2">
                    <UBadge :color="eventCategoryColor(detailModal.data.event_category)" variant="soft" size="sm">
                      {{ eventCategoryLabel(detailModal.data.event_category) }}
                    </UBadge>
                  </div>
                </div>

                <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                  <div class="text-xs text-muted">目标资源</div>
                  <div class="mt-2 font-mono text-sm">{{ detailModal.data.target_type }}#{{ detailModal.data.target_id || '—' }}</div>
                  <div class="mt-2 break-all text-xs text-muted">{{ detailModal.data.target_name || '—' }}</div>
                </div>

                <div class="rounded-xl border border-default/60 bg-muted/20 p-3 md:col-span-2">
                  <div class="text-xs text-muted">请求路径</div>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <UBadge :color="requestMethodColor(detailModal.data.request_method)" variant="soft" size="sm">
                      {{ detailModal.data.request_method || '—' }}
                    </UBadge>
                    <span class="break-all font-mono text-xs">
                      {{ detailModal.data.request_path || '—' }}
                    </span>
                  </div>
                  <div class="mt-2 text-xs text-muted">
                    结果：{{ detailModal.data.result === 1 ? '成功' : '失败' }}
                    / HTTP {{ detailModal.data.status_code }}
                    / {{ detailModal.data.duration_ms }}ms
                  </div>
                </div>

                <div class="rounded-xl border border-default/60 bg-muted/20 p-3 md:col-span-2">
                  <div class="text-xs text-muted">操作说明</div>
                  <div class="mt-2 text-sm text-highlighted">
                    {{ detailModal.data.detail || '未记录额外说明，建议结合下方请求上下文排查。' }}
                  </div>
                </div>
              </div>
            </section>

            <section class="rounded-2xl border border-default/60 bg-default/90 p-4">
              <div class="mb-3">
                <div class="text-sm font-semibold text-highlighted">执行环境与诊断</div>
                <p class="mt-1 text-xs text-muted">保留访问来源、终端特征和异常信息，方便客服与开发快速交叉排障。</p>
              </div>

              <div class="space-y-3">
                <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                  <div class="text-xs text-muted">来源 IP</div>
                  <div class="mt-2 font-mono text-sm">{{ detailModal.data.ip || '—' }}</div>
                  <div class="mt-2 text-xs text-muted">归属地：{{ getIpLocationText(detailModal.data) }}</div>
                </div>

                <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                  <div class="text-xs text-muted">User Agent</div>
                  <div class="mt-2 break-all text-xs text-muted">{{ detailModal.data.user_agent || '—' }}</div>
                </div>

                <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                  <div class="text-xs text-muted">上下文覆盖情况</div>
                  <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div class="rounded-lg border border-default/50 bg-default/80 px-3 py-2">
                      Query：{{ hasMeaningfulValue(detailModal.data.request_query) ? '已记录' : '无' }}
                    </div>
                    <div class="rounded-lg border border-default/50 bg-default/80 px-3 py-2">
                      Body：{{ hasMeaningfulValue(detailModal.data.request_body) ? '已记录' : '无' }}
                    </div>
                    <div class="rounded-lg border border-default/50 bg-default/80 px-3 py-2">
                      Before：{{ hasMeaningfulValue(detailModal.data.before_data) ? '已记录' : '无' }}
                    </div>
                    <div class="rounded-lg border border-default/50 bg-default/80 px-3 py-2">
                      After：{{ hasMeaningfulValue(detailModal.data.after_data) ? '已记录' : '无' }}
                    </div>
                  </div>
                </div>

                <div v-if="detailModal.data.error_message" class="rounded-xl border border-error/20 bg-error/10 p-3">
                  <div class="text-xs text-error">错误信息</div>
                  <div class="mt-2 break-all text-xs text-error">{{ detailModal.data.error_message }}</div>
                </div>
              </div>
            </section>
          </div>

          <section class="rounded-2xl border border-default/60 bg-default/90 p-4">
            <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-highlighted">字段变更清单</div>
                <p class="mt-1 text-xs text-muted">优先展示结构化字段差异，方便确认本次操作具体改动了哪些内容。</p>
              </div>
              <UBadge color="secondary" variant="soft">
                {{ detailChangeItems.length }} 项变更
              </UBadge>
            </div>

            <div v-if="detailChangeItems.length" class="space-y-3">
              <div
                v-for="item in detailChangeItems"
                :key="item.field"
                class="rounded-xl border border-default/60 bg-muted/20 p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="font-mono text-xs text-highlighted">{{ item.field }}</div>
                  <span class="text-[11px] text-muted">字段级差异</span>
                </div>
                <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div class="rounded-xl border border-default/50 bg-default/80 p-3">
                    <div class="mb-2 text-[11px] text-muted">变更前</div>
                    <pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{{ formatJson(item.before) }}</pre>
                  </div>
                  <div class="rounded-xl border border-default/50 bg-default/80 p-3">
                    <div class="mb-2 text-[11px] text-muted">变更后</div>
                    <pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{{ formatJson(item.after) }}</pre>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="rounded-xl border border-dashed border-default/60 bg-muted/15 p-4 text-sm text-muted">
              当前日志没有结构化字段差异。常见于登录、查询、重置密码、批量动作或仅记录请求结果的场景。
            </div>
          </section>

          <section class="rounded-2xl border border-default/60 bg-default/90 p-4">
            <div class="mb-3">
              <div class="text-sm font-semibold text-highlighted">请求与对象快照</div>
              <p class="mt-1 text-xs text-muted">保留原始请求参数与对象快照，作为上方摘要和字段差异的底层依据。</p>
            </div>
            <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                <div class="mb-2 text-xs text-muted">请求参数 Query</div>
                <pre class="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-default/80 p-3 text-xs">{{ formatJson(detailModal.data.request_query) }}</pre>
              </div>
              <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                <div class="mb-2 text-xs text-muted">请求体 Body</div>
                <pre class="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-default/80 p-3 text-xs">{{ formatJson(detailModal.data.request_body) }}</pre>
              </div>
              <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                <div class="mb-2 text-xs text-muted">变更前 Before</div>
                <pre class="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-default/80 p-3 text-xs">{{ formatJson(detailModal.data.before_data) }}</pre>
              </div>
              <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                <div class="mb-2 text-xs text-muted">变更后 After</div>
                <pre class="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-default/80 p-3 text-xs">{{ formatJson(detailModal.data.after_data) }}</pre>
              </div>
            </div>
          </section>

          <section v-if="detailHasRawChangePayload && !detailChangeItems.length" class="rounded-2xl border border-default/60 bg-default/90 p-4">
            <div class="mb-2 text-sm font-semibold text-highlighted">原始字段变更载荷</div>
            <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-muted/25 p-3 text-xs">{{ formatJson(detailModal.data.change_items) }}</pre>
          </section>

          <section class="rounded-2xl border border-default/60 bg-default/90 p-4">
            <div class="mb-3 text-sm font-semibold text-highlighted">快速审计摘要</div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                <div class="text-[11px] text-muted">事件分类</div>
                <div class="mt-2">
                  <UBadge :color="eventCategoryColor(detailModal.data.event_category)" variant="soft" size="sm">
                    {{ eventCategoryLabel(detailModal.data.event_category) }}
                  </UBadge>
                </div>
              </div>
              <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                <div class="text-[11px] text-muted">资源摘要</div>
                <div class="mt-2 font-mono text-xs text-highlighted">
                  {{ detailModal.data.target_type || '—' }}#{{ detailModal.data.target_id || '—' }}
                </div>
              </div>
              <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                <div class="text-[11px] text-muted">错误摘要</div>
                <div class="mt-2 text-xs">
                  {{ toInlineText(detailModal.data.error_message, 100) }}
                </div>
              </div>
              <div class="rounded-xl border border-default/60 bg-muted/20 p-3">
                <div class="text-[11px] text-muted">补充说明</div>
                <div class="mt-2 text-xs">
                  {{ toInlineText(detailModal.data.detail, 100) }}
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
      <template #footer="{ close }">
        <UButton label="关闭" color="neutral" variant="subtle" @click="close()" />
      </template>
    </UModal>
  </div>
</template>
