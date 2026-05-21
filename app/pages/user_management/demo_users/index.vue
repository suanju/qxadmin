<script setup lang="tsx">
import type { TableColumn } from '@nuxt/ui'
import { UBadge, UButton, UCheckbox } from '#components'
import {
  ADMIN_TABLE_UI,
  createAdminActionColumnMeta,
  createAdminActionColumnPinning,
  renderAdminPinnedActionHeader
} from '~/composables/admin/use_table'

definePageMeta({ layout: 'default' })

interface DemoUser {
  id: number
  username: string
  nickname: string
  email: string
  mobile: string
  department: string
  role_name: string
  status: number
  source: string
  remark: string
  last_active_at: number
  created_at: number
  updated_at: number
}

interface DemoUserListResponse {
  list: DemoUser[]
  total: number
  page: number
  pageSize: number
}

interface DemoUserForm {
  username: string
  nickname: string
  email: string
  mobile: string
  department: string
  roleName: string
  status: number
  source: string
  remark: string
}

const STATUS_ALL = 'all'
const STATUS_OPTIONS = [
  { label: '全部状态', value: STATUS_ALL },
  { label: '启用', value: '1' },
  { label: '禁用', value: '0' }
]
const USER_STATUS_ITEMS = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 }
]
const SOURCE_ITEMS = [
  { label: '手动录入', value: 'manual' },
  { label: '种子数据', value: 'seed' },
  { label: '导入数据', value: 'import' }
]

const { adminFetch } = useAdminFetch()
const { runAdminMutation } = useAdminMutationFeedback()
const { can } = useAdminAuth()
const toast = useToast()

const list = ref<DemoUser[]>([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')
const statusFilter = ref(STATUS_ALL)
const selectedIds = ref<number[]>([])
const formModalOpen = ref(false)
const submitLoading = ref(false)
const batchLoading = ref(false)
const deleteLoading = ref(false)
const editingId = ref<number | null>(null)
const deleteTarget = ref<DemoUser | null>(null)
const tableColumnPinning = ref(createAdminActionColumnPinning())
const tableUi = {
  ...ADMIN_TABLE_UI,
  base: 'min-w-310 w-full'
}

const form = reactive<DemoUserForm>({
  username: '',
  nickname: '',
  email: '',
  mobile: '',
  department: '',
  roleName: '普通用户',
  status: 1,
  source: 'manual',
  remark: ''
})

const canManage = computed(() => can('demo_users.manage'))
const currentPageIds = computed(() => list.value.map(item => item.id))
const selectedSet = computed(() => new Set(selectedIds.value))
const selectedCurrentPageIds = computed(() => currentPageIds.value.filter(id => selectedSet.value.has(id)))
const isAllCurrentPageSelected = computed(() =>
  currentPageIds.value.length > 0 && selectedCurrentPageIds.value.length === currentPageIds.value.length
)
const isSomeCurrentPageSelected = computed(() =>
  selectedCurrentPageIds.value.length > 0 && !isAllCurrentPageSelected.value
)
const activeFilterCount = computed(() =>
  [keyword.value.trim(), statusFilter.value === STATUS_ALL ? '' : statusFilter.value].filter(Boolean).length
)

function formatTime(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function statusLabel(status: number): string {
  return status === 1 ? '启用' : '禁用'
}

function resetForm(): void {
  editingId.value = null
  form.username = ''
  form.nickname = ''
  form.email = ''
  form.mobile = ''
  form.department = ''
  form.roleName = '普通用户'
  form.status = 1
  form.source = 'manual'
  form.remark = ''
}

function buildQuery(): Record<string, string | number> {
  const query: Record<string, string | number> = {
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value
  }
  const q = keyword.value.trim()
  if (q) query.keyword = q
  if (statusFilter.value !== STATUS_ALL) query.status = statusFilter.value
  return query
}

async function fetchList(): Promise<void> {
  loading.value = true
  try {
    const response = await adminFetch<DemoUserListResponse>('/api/admin/demo_users', {
      query: buildQuery()
    })
    list.value = response.list
    total.value = response.total
    selectedIds.value = selectedIds.value.filter(id => response.list.some(row => row.id === id))
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  if (!canManage.value) return
  resetForm()
  formModalOpen.value = true
}

function openEdit(row: DemoUser): void {
  if (!canManage.value) return
  editingId.value = row.id
  form.username = row.username
  form.nickname = row.nickname
  form.email = row.email
  form.mobile = row.mobile
  form.department = row.department
  form.roleName = row.role_name
  form.status = row.status
  form.source = row.source || 'manual'
  form.remark = row.remark
  formModalOpen.value = true
}

function resetFilters(): void {
  keyword.value = ''
  statusFilter.value = STATUS_ALL
  page.value = 1
  fetchList()
}

function toggleRow(id: number, checked: boolean): void {
  if (checked) {
    selectedIds.value = Array.from(new Set([...selectedIds.value, id]))
    return
  }
  selectedIds.value = selectedIds.value.filter(item => item !== id)
}

function toggleCurrentPage(checked: boolean): void {
  if (checked) {
    selectedIds.value = Array.from(new Set([...selectedIds.value, ...currentPageIds.value]))
    return
  }
  selectedIds.value = selectedIds.value.filter(id => !currentPageIds.value.includes(id))
}

function clearSelection(): void {
  selectedIds.value = []
}

async function submitForm(): Promise<void> {
  if (!canManage.value) return
  const body = {
    username: form.username.trim(),
    nickname: form.nickname.trim(),
    email: form.email.trim(),
    mobile: form.mobile.trim(),
    department: form.department.trim(),
    roleName: form.roleName.trim(),
    status: form.status,
    source: form.source,
    remark: form.remark.trim()
  }

  await runAdminMutation(
    async () => {
      if (editingId.value) {
        return adminFetch(`/api/admin/demo_users/${editingId.value}`, {
          method: 'PUT',
          body
        })
      }

      return adminFetch('/api/admin/demo_users', {
        method: 'POST',
        body
      })
    },
    {
      loading: submitLoading,
      successTitle: editingId.value ? '用户已更新' : '用户已创建',
      errorTitle: editingId.value ? '更新用户失败' : '创建用户失败'
    }
  )

  formModalOpen.value = false
  await fetchList()
}

function openDelete(row: DemoUser): void {
  if (!canManage.value) return
  deleteTarget.value = row
}

async function confirmDelete(): Promise<void> {
  const row = deleteTarget.value
  if (!row || !canManage.value) return
  await runAdminMutation(
    async () => adminFetch(`/api/admin/demo_users/${row.id}`, { method: 'DELETE' }),
    {
      loading: deleteLoading,
      successTitle: '用户已删除',
      errorTitle: '删除用户失败'
    }
  )
  deleteTarget.value = null
  await fetchList()
}

async function runBatch(action: 'enable' | 'disable' | 'delete'): Promise<void> {
  if (!canManage.value || selectedIds.value.length === 0) return
  const actionText = action === 'enable' ? '启用' : action === 'disable' ? '禁用' : '删除'

  await runAdminMutation(
    async () => adminFetch('/api/admin/demo_users/batch', {
      method: 'POST',
      body: {
        action,
        ids: selectedIds.value
      }
    }),
    {
      loading: batchLoading,
      successTitle: `批量${actionText}成功`,
      errorTitle: `批量${actionText}失败`
    }
  )

  selectedIds.value = []
  await fetchList()
}

function onPageChange(nextPage: number): void {
  page.value = nextPage
  fetchList()
}

watch(pageSize, () => {
  page.value = 1
  fetchList()
})

watch(statusFilter, () => {
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

const columns: TableColumn<DemoUser>[] = [
  {
    id: 'select',
    size: 48,
    header: () => (
      <UCheckbox
        modelValue={isAllCurrentPageSelected.value ? true : isSomeCurrentPageSelected.value ? 'indeterminate' : false}
        aria-label="选择当前页"
        onUpdate:modelValue={(value: boolean | 'indeterminate') => toggleCurrentPage(value === true)}
      />
    ),
    meta: { class: { th: 'w-12 text-center', td: 'w-12 text-center' } },
    cell: ({ row }) => (
      <UCheckbox
        modelValue={selectedSet.value.has(row.original.id)}
        aria-label={`选择用户 ${row.original.username}`}
        onUpdate:modelValue={(value: boolean | 'indeterminate') => toggleRow(row.original.id, value === true)}
      />
    )
  },
  {
    accessorKey: 'username',
    header: '用户',
    size: 240,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <div class="flex min-w-52 flex-col gap-1">
        <span class="font-medium text-highlighted">{row.original.nickname || row.original.username}</span>
        <span class="font-mono text-[11px] text-muted">{row.original.username} #{row.original.id}</span>
      </div>
    )
  },
  {
    accessorKey: 'contact',
    header: '联系方式',
    size: 260,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <div class="flex min-w-56 flex-col gap-1">
        <span class="text-sm">{row.original.mobile || '—'}</span>
        <span class="truncate text-xs text-muted" title={row.original.email}>{row.original.email || '—'}</span>
      </div>
    )
  },
  {
    accessorKey: 'department',
    header: '组织角色',
    size: 220,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <div class="flex min-w-48 flex-col gap-1">
        <span>{row.original.department || '—'}</span>
        <UBadge color="neutral" variant="subtle" size="sm" class="w-fit">
          {row.original.role_name || '普通用户'}
        </UBadge>
      </div>
    )
  },
  {
    accessorKey: 'status',
    header: '状态',
    size: 96,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) => (
      <UBadge color={row.original.status === 1 ? 'success' : 'error'} variant="soft" size="sm">
        {statusLabel(row.original.status)}
      </UBadge>
    )
  },
  {
    accessorKey: 'last_active_at',
    header: '最近活跃',
    size: 180,
    meta: { class: { th: 'text-left', td: 'text-left text-xs text-muted' } },
    cell: ({ row }) => formatTime(row.original.last_active_at)
  },
  {
    accessorKey: 'source',
    header: '来源',
    size: 112,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) => (
      <UBadge color={row.original.source === 'seed' ? 'secondary' : 'primary'} variant="subtle" size="sm">
        {row.original.source || 'manual'}
      </UBadge>
    )
  },
  {
    accessorKey: 'remark',
    header: '备注',
    size: 260,
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => (
      <span class="block max-w-72 truncate text-xs text-muted" title={row.original.remark}>
        {row.original.remark || '—'}
      </span>
    )
  },
  {
    id: 'actions',
    header: ({ column }) => renderAdminPinnedActionHeader(column),
    size: 132,
    meta: createAdminActionColumnMeta('min-w-28'),
    cell: ({ row }) => (
      <div class="flex justify-center gap-2">
        <UButton
          color="primary"
          variant="subtle"
          size="xs"
          icon="i-lucide-pencil"
          disabled={!canManage.value}
          onClick={() => openEdit(row.original)}
        >
          编辑
        </UButton>
        <UButton
          color="error"
          variant="subtle"
          size="xs"
          icon="i-lucide-trash-2"
          disabled={!canManage.value}
          onClick={() => openDelete(row.original)}
        >
          删除
        </UButton>
      </div>
    )
  }
]

onMounted(fetchList)

useHead({ title: '用户列表示例' })
</script>

<template>
  <div class="min-h-[calc(100vh-8rem)] p-6 md:p-8">
    <AdminPageHeader
      title="用户列表示例"
      description="用于验证统一表格、多选批量操作、表单弹窗和列表工具栏样式"
      icon="i-lucide-table-2"
    >
      <template #actions>
        <UBadge color="neutral" variant="subtle">
          当前 {{ list.length }} 条 / 总计 {{ total }} 条
        </UBadge>
        <UBadge color="primary" variant="soft">
          已启用筛选 {{ activeFilterCount }} 项
        </UBadge>
        <UButton
          v-if="canManage"
          color="primary"
          icon="i-lucide-plus"
          @click="openCreate"
        >
          新增用户
        </UButton>
      </template>
    </AdminPageHeader>

    <UCard class="overflow-hidden shadow-lg ring-1 ring-gray-200/50 dark:ring-gray-700/50">
      <div class="border-b border-default/60 bg-muted/35 px-4 py-4 dark:bg-background/60">
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto_auto] lg:items-end">
          <UFormField label="关键词">
            <UInput
              v-model="keyword"
              name="keyword"
              placeholder="搜索用户名 / 昵称 / 手机 / 邮箱 / 部门 / 角色"
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

          <UFormField label="状态">
            <USelect
              v-model="statusFilter"
              name="status"
              :items="STATUS_OPTIONS"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UButton color="neutral" variant="subtle" icon="i-lucide-rotate-ccw" @click="resetFilters">
            重置
          </UButton>
          <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" @click="fetchList">
            刷新
          </UButton>
        </div>
      </div>

      <AdminTableBulkBar
        :selected-count="selectedIds.length"
        :total="list.length"
        @clear="clearSelection"
      >
        <UButton
          v-if="canManage"
          size="sm"
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          :loading="batchLoading"
          @click="runBatch('enable')"
        >
          批量启用
        </UButton>
        <UButton
          v-if="canManage"
          size="sm"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-pause"
          :loading="batchLoading"
          @click="runBatch('disable')"
        >
          批量禁用
        </UButton>
        <UButton
          v-if="canManage"
          size="sm"
          color="error"
          variant="subtle"
          icon="i-lucide-trash-2"
          :loading="batchLoading"
          @click="runBatch('delete')"
        >
          批量删除
        </UButton>
      </AdminTableBulkBar>

      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
      </div>
      <UEmpty
        v-else-if="!list.length"
        title="暂无用户"
        icon="i-lucide-users"
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

    <UModal
      v-model:open="formModalOpen"
      :title="editingId ? '编辑用户' : '新增用户'"
      description="用于展示统一后台表单弹窗布局。"
      :ui="{ content: 'max-w-4xl', body: 'sm:p-6', footer: 'border-t border-default/60 bg-muted/20' }"
    >
      <template #body>
        <form class="space-y-5" @submit.prevent="submitForm">
          <section class="rounded-lg border border-default/60 bg-default/90 p-4">
            <div class="mb-4 flex items-center gap-2">
              <UIcon name="i-lucide-user-round" class="size-4 text-primary" />
              <div>
                <div class="text-sm font-semibold text-highlighted">基础信息</div>
                <p class="text-xs text-muted">表单使用两列栅格，移动端自动收敛为单列。</p>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UFormField label="用户名" required>
                <UInput v-model="form.username" name="username" placeholder="如 alice" class="w-full" />
              </UFormField>
              <UFormField label="昵称">
                <UInput v-model="form.nickname" name="nickname" placeholder="列表展示名称" class="w-full" />
              </UFormField>
              <UFormField label="手机">
                <UInput v-model="form.mobile" name="mobile" placeholder="13800000000" class="w-full" />
              </UFormField>
              <UFormField label="邮箱">
                <UInput v-model="form.email" name="email" placeholder="user@example.com" class="w-full" />
              </UFormField>
            </div>
          </section>

          <section class="rounded-lg border border-default/60 bg-muted/20 p-4">
            <div class="mb-4 flex items-center gap-2">
              <UIcon name="i-lucide-building-2" class="size-4 text-primary" />
              <div>
                <div class="text-sm font-semibold text-highlighted">组织与状态</div>
                <p class="text-xs text-muted">选择类和状态类字段统一放在同一分组内。</p>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UFormField label="部门">
                <UInput v-model="form.department" name="department" placeholder="如 运营中心" class="w-full" />
              </UFormField>
              <UFormField label="角色">
                <UInput v-model="form.roleName" name="role_name" placeholder="如 运营专员" class="w-full" />
              </UFormField>
              <UFormField label="状态">
                <USelect v-model="form.status" name="user_status" :items="USER_STATUS_ITEMS" value-key="value" class="w-full" />
              </UFormField>
              <UFormField label="来源">
                <USelect v-model="form.source" name="source" :items="SOURCE_ITEMS" value-key="value" class="w-full" />
              </UFormField>
              <UFormField label="备注" class="md:col-span-2">
                <UTextarea
                  v-model="form.remark"
                  name="remark"
                  :rows="4"
                  placeholder="说明该用户的测试用途、来源或备注"
                  class="w-full"
                />
              </UFormField>
            </div>
          </section>
        </form>
      </template>
      <template #footer="{ close }">
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="subtle" :disabled="submitLoading" @click="close()">取消</UButton>
          <UButton color="primary" :loading="submitLoading" @click="submitForm">保存</UButton>
        </div>
      </template>
    </UModal>

    <AdminConfirmModal
      :open="!!deleteTarget"
      title="确认删除用户"
      :loading="deleteLoading"
      confirm-label="确定删除"
      confirm-color="error"
      @update:open="(value: boolean) => { if (!value && !deleteLoading) deleteTarget = null }"
      @confirm="confirmDelete"
    >
      <p class="text-sm leading-6 text-default">
        确定要删除用户“<strong>{{ deleteTarget?.nickname || deleteTarget?.username }}</strong>”吗？该页面为展示用列表，删除后可重新运行种子脚本恢复示例数据。
      </p>
    </AdminConfirmModal>
  </div>
</template>
