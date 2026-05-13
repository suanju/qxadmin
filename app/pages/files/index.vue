<script setup lang="tsx">
import type { TableColumn } from '@nuxt/ui'
import { UBadge, UButton } from '#components'
import {
  ADMIN_TABLE_UI,
  createAdminActionColumnMeta,
  createAdminActionColumnPinning,
  renderAdminPinnedActionHeader
} from '~/composables/use_admin_table'

definePageMeta({ layout: 'default' })

interface AdminFileItem {
  id: number
  original_name: string
  filename: string
  ext: string
  mime: string
  size: number
  hash: string
  path: string
  public_url: string
  kind: string
  status: number
  uploader_id: number
  uploader_name: string
  storage_driver: string
  created_at: number
}

interface AdminFilesResponse {
  list: AdminFileItem[]
  total: number
  page: number
  pageSize: number
}

const KIND_ALL = 'all'
const KIND_OPTIONS = [
  { value: KIND_ALL, label: '全部类型' },
  { value: 'image', label: '图片' },
  { value: 'document', label: '文档' },
  { value: 'archive', label: '压缩包' },
  { value: 'file', label: '其他文件' }
]

const { adminFetch } = useAdminFetch()
const { can } = useAdminAuth()
const toast = useToast()

const list = ref<AdminFileItem[]>([])
const loading = ref(true)
const uploading = ref(false)
const deletingId = ref<number | null>(null)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')
const kind = ref(KIND_ALL)
const fileInputRef = ref<HTMLInputElement | null>(null)
const deleteTarget = ref<AdminFileItem | null>(null)
const tableColumnPinning = ref(createAdminActionColumnPinning())
const tableUi = {
  ...ADMIN_TABLE_UI,
  base: 'min-w-280 w-full'
}

const canUpload = computed(() => can('upload.create'))
const canManage = computed(() => can('files.manage'))
const activeFilterCount = computed(() =>
  [keyword.value.trim(), kind.value === KIND_ALL ? '' : kind.value].filter(Boolean).length
)

function formatTime(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function formatSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

function kindLabel(value: string): string {
  return KIND_OPTIONS.find((item) => item.value === value)?.label || value || '文件'
}

function kindColor(value: string): 'primary' | 'secondary' | 'success' | 'warning' | 'neutral' {
  if (value === 'image') return 'success'
  if (value === 'document') return 'primary'
  if (value === 'archive') return 'warning'
  return 'neutral'
}

function shortText(value: string, max = 42): string {
  const text = String(value || '').trim()
  if (!text) return '—'
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function buildQuery(): Record<string, string | number> {
  const query: Record<string, string | number> = {
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value
  }
  const q = keyword.value.trim()
  if (q) query.keyword = q
  if (kind.value !== KIND_ALL) query.kind = kind.value
  return query
}

async function fetchList(): Promise<void> {
  loading.value = true
  try {
    const response = await adminFetch<AdminFilesResponse>('/api/admin/files', {
      query: buildQuery()
    })
    list.value = response.list
    total.value = response.total
  } finally {
    loading.value = false
  }
}

function resetFilters(): void {
  keyword.value = ''
  kind.value = KIND_ALL
  page.value = 1
  fetchList()
}

function triggerUpload(): void {
  if (!canUpload.value || uploading.value) return
  fileInputRef.value?.click()
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !canUpload.value) return

  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const result = await adminFetch<{ path: string; id: number }>('/api/admin/upload', {
      method: 'POST',
      body
    })
    toast.add({
      title: '上传成功',
      description: result.path,
      color: 'success',
      icon: 'i-lucide-upload'
    })
    page.value = 1
    await fetchList()
  } catch (error) {
    toast.add({
      title: '上传失败',
      description: getAdminFetchErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    uploading.value = false
  }
}

function openDeleteConfirm(row: AdminFileItem): void {
  if (!canManage.value) return
  deleteTarget.value = row
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value
  if (!target || !canManage.value) return

  deletingId.value = target.id
  try {
    await adminFetch(`/api/admin/files/${target.id}`, { method: 'DELETE' })
    toast.add({
      title: '删除成功',
      color: 'success',
      icon: 'i-lucide-trash-2'
    })
    deleteTarget.value = null
    await fetchList()
  } catch (error) {
    toast.add({
      title: '删除失败',
      description: getAdminFetchErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    deletingId.value = null
  }
}

function onPageChange(nextPage: number): void {
  page.value = nextPage
  fetchList()
}

watch(pageSize, () => {
  page.value = 1
  fetchList()
})

watch(kind, () => {
  page.value = 1
  fetchList()
})

let keywordTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    page.value = 1
    fetchList()
  }, 300)
})

const columns: TableColumn<AdminFileItem>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    size: 80,
    meta: { class: { th: 'text-left', td: 'text-left font-mono text-xs' } }
  },
  {
    accessorKey: 'original_name',
    header: '文件',
    size: 360,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <div class="flex min-w-72 max-w-96 flex-col gap-1">
        <a
          href={row.original.public_url || row.original.path}
          target="_blank"
          rel="noopener noreferrer"
          class="truncate font-medium text-primary hover:underline"
          title={row.original.original_name}
        >
          {row.original.original_name}
        </a>
        <span class="truncate font-mono text-[11px] text-muted" title={row.original.path}>
          {row.original.path}
        </span>
      </div>
    )
  },
  {
    accessorKey: 'kind',
    header: '类型',
    size: 132,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) => (
      <div class="flex flex-col items-center gap-1">
        <UBadge color={kindColor(row.original.kind)} variant="soft" size="sm">
          {kindLabel(row.original.kind)}
        </UBadge>
        <span class="text-[11px] text-muted">{row.original.mime || row.original.ext || '—'}</span>
      </div>
    )
  },
  {
    accessorKey: 'size',
    header: '大小',
    size: 112,
    meta: { class: { th: 'text-right', td: 'text-right font-mono text-xs' } },
    cell: ({ row }) => formatSize(row.original.size)
  },
  {
    accessorKey: 'hash',
    header: 'SHA256',
    size: 160,
    meta: { class: { th: 'text-left', td: 'text-left font-mono text-xs' } },
    cell: ({ row }) => (
      <span title={row.original.hash}>{shortText(row.original.hash, 18)}</span>
    )
  },
  {
    accessorKey: 'uploader_name',
    header: '上传人',
    size: 132,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <div class="flex flex-col">
        <span class="text-sm">{row.original.uploader_name || '—'}</span>
        <span class="font-mono text-[11px] text-muted">{row.original.uploader_id || '—'}</span>
      </div>
    )
  },
  {
    accessorKey: 'created_at',
    header: '上传时间',
    size: 180,
    meta: { class: { th: 'text-left', td: 'text-left text-xs text-muted' } },
    cell: ({ row }) => formatTime(row.original.created_at)
  },
  {
    id: 'actions',
    header: ({ column }) => renderAdminPinnedActionHeader(column),
    size: 124,
    meta: createAdminActionColumnMeta('min-w-24'),
    cell: ({ row }) => (
      <div class="flex justify-center gap-2">
        <UButton
          to={row.original.public_url || row.original.path}
          target="_blank"
          color="primary"
          variant="subtle"
          size="xs"
          icon="i-lucide-external-link"
        >
          打开
        </UButton>
        {canManage.value ? (
          <UButton
            color="error"
            variant="subtle"
            size="xs"
            icon="i-lucide-trash-2"
            loading={deletingId.value === row.original.id}
            onClick={() => openDeleteConfirm(row.original)}
          >
            删除
          </UButton>
        ) : null}
      </div>
    )
  }
]

onMounted(fetchList)

useHead({
  title: '文件管理'
})
</script>

<template>
  <div class="min-h-[calc(100vh-8rem)] p-6 md:p-8">
    <input
      ref="fileInputRef"
      type="file"
      name="admin_file_upload"
      class="hidden"
      @change="onFileSelected"
    >

    <AdminPageHeader
      title="文件管理"
      description="检索后台上传文件，查看文件元数据并处理无效资源记录"
      icon="i-lucide-folder-open"
    >
      <template #actions>
        <UBadge color="neutral" variant="subtle">
          当前 {{ list.length }} 条 / 总计 {{ total }} 条
        </UBadge>
        <UBadge color="primary" variant="soft">
          已启用筛选 {{ activeFilterCount }} 项
        </UBadge>
        <UButton
          v-if="canUpload"
          color="primary"
          icon="i-lucide-upload"
          :loading="uploading"
          @click="triggerUpload"
        >
          上传文件
        </UButton>
      </template>
    </AdminPageHeader>

    <UCard class="overflow-hidden shadow-lg ring-1 ring-gray-200/50 dark:ring-gray-700/50">
      <div class="border-b border-default/60 bg-muted/35 px-4 py-4 dark:bg-background/60">
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem_auto] lg:items-end">
          <UFormField label="关键词">
            <UInput
              v-model="keyword"
              name="keyword"
              placeholder="搜索文件名 / 路径 / mime / hash / 上传人"
              icon="i-lucide-search"
              class="w-full"
            >
              <template v-if="keyword" #trailing>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-x"
                  aria-label="清除搜索"
                  @click="keyword = ''"
                />
              </template>
            </UInput>
          </UFormField>

          <UFormField label="文件类型">
            <USelect
              v-model="kind"
              name="kind"
              :items="KIND_OPTIONS"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-rotate-ccw"
            @click="resetFilters"
          >
            重置
          </UButton>
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
      </div>
      <UEmpty
        v-else-if="!list.length"
        title="暂无文件记录"
        icon="i-lucide-folder-open"
        class="py-20"
      />
      <div v-else>
        <div class="overflow-x-auto">
          <UTable
            v-model:column-pinning="tableColumnPinning"
            :data="list"
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
              当前页 {{ list.length }} 条 / 总计 {{ total }} 条
            </span>
          </template>
        </AdminTablePaginationBar>
      </div>
    </UCard>

    <AdminConfirmModal
      :open="!!deleteTarget"
      title="确认删除文件记录"
      :loading="!!deletingId"
      confirm-label="确定删除"
      @update:open="(v: boolean) => { if (!v && !deletingId) deleteTarget = null }"
      @confirm="confirmDelete"
    >
      <p class="text-default">
        确定要删除文件「<strong>{{ deleteTarget?.original_name }}</strong>」的后台记录吗？当前实现会软删除记录，文件物理清理由运维策略处理。
      </p>
    </AdminConfirmModal>
  </div>
</template>
