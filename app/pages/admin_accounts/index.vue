<script setup lang="ts">
import type { TreeItemSelectEvent } from 'reka-ui'

definePageMeta({ layout: 'default' })

interface AdminRole {
  id: number
  code: string
  name: string
  description: string
  status: number
  is_system: number
  sort: number
  permissions: string[]
}

interface AdminUser {
  id: number
  username: string
  display_name: string
  status: number
  is_super_admin: number
  token_version: number
  last_login_at: number
  last_login_ip: string
  created_at: number
  roles: Array<{ role_id: number; code: string; name: string }>
}

interface UserListResponse {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
}

interface PermissionGroup {
  key: string
  name: string
  menuKey: string
  menuName: string
  permissions: Array<{ code: string; name: string; highRisk?: boolean }>
}

interface PermissionTreeNode {
  key: string
  label: string
  type: 'group' | 'permission'
  code?: string
  highRisk?: boolean
  permissionCount?: number
  children?: PermissionTreeNode[]
  defaultExpanded?: boolean
}

const { adminFetch } = useAdminFetch()
const toast = useToast()
const { can } = useAdminAuth()

const users = ref<AdminUser[]>([])
const roles = ref<AdminRole[]>([])
const permissionGroups = ref<PermissionGroup[]>([])
const loading = ref(false)
const roleLoading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')
const statusFilter = ref('all')
const activeTab = ref('users')

const userModal = ref(false)
const passwordModal = ref(false)
const roleModal = ref(false)
const submitLoading = ref(false)
const deleteLoading = ref(false)
const editingUserId = ref<number | null>(null)
const editingRoleId = ref<number | null>(null)
const deleteTarget = ref<AdminUser | null>(null)
const deleteRoleTarget = ref<AdminRole | null>(null)

const userForm = reactive({
  username: '',
  displayName: '',
  password: '',
  status: 1,
  isSuperAdmin: false,
  roleIds: [] as number[]
})

const passwordForm = reactive({
  userId: 0,
  username: '',
  password: ''
})

const roleForm = reactive({
  code: '',
  name: '',
  description: '',
  status: 1,
  sort: 100,
  permissions: [] as string[]
})

const activeTabItems = [
  { label: '管理员', value: 'users', icon: 'i-lucide-users' },
  { label: '角色权限', value: 'roles', icon: 'i-lucide-shield-check' }
]

const adminStatusItems = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 }
]

const roleStatusItems = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 }
]

const canManage = computed(() => can('admin_accounts.manage'))

function collectPermissionLeafNodes(items: PermissionTreeNode[]): PermissionTreeNode[] {
  return items.flatMap((item) => {
    if (item.children?.length) {
      return collectPermissionLeafNodes(item.children)
    }

    return item.type === 'permission' ? [item] : []
  })
}

function buildSelectedPermissionTreeItems(items: PermissionTreeNode[], selectedCodes: Set<string>): PermissionTreeNode[] {
  return items.flatMap((item) => {
    const childSelections = item.children?.length ? buildSelectedPermissionTreeItems(item.children, selectedCodes) : []

    if (item.type === 'permission') {
      return item.code && selectedCodes.has(item.code) ? [item] : []
    }

    const leafNodes = item.children?.length ? collectPermissionLeafNodes(item.children) : []
    const isFullySelected = leafNodes.length > 0 && leafNodes.every((leaf) => leaf.code && selectedCodes.has(leaf.code))

    return isFullySelected ? [item, ...childSelections] : childSelections
  })
}

const permissionTreeItems = computed<PermissionTreeNode[]>(() => {
  const menuNodes = new Map<string, PermissionTreeNode>()

  for (const group of permissionGroups.value) {
    const groupNode: PermissionTreeNode = {
      key: `group:${group.key}`,
      label: group.name,
      type: 'group',
      permissionCount: group.permissions.length,
      defaultExpanded: true,
      children: group.permissions.map((permission) => ({
        key: `permission:${permission.code}`,
        label: permission.name,
        type: 'permission',
        code: permission.code,
        highRisk: permission.highRisk
      }))
    }

    const existingMenuNode = menuNodes.get(group.menuKey)
    if (existingMenuNode) {
      existingMenuNode.children = [...(existingMenuNode.children ?? []), groupNode]
      existingMenuNode.permissionCount = (existingMenuNode.permissionCount ?? 0) + group.permissions.length
      continue
    }

    menuNodes.set(group.menuKey, {
      key: `menu:${group.menuKey}`,
      label: group.menuName,
      type: 'group',
      permissionCount: group.permissions.length,
      defaultExpanded: true,
      children: [groupNode]
    })
  }

  return Array.from(menuNodes.values())
})

const allPermissionLeafItems = computed(() => collectPermissionLeafNodes(permissionTreeItems.value))
const allPermissionCodes = computed(() => allPermissionLeafItems.value.map(item => item.code as string))
const effectiveRolePermissionCodes = computed(() => roleForm.code === 'super_admin' ? allPermissionCodes.value : roleForm.permissions)
const selectedPermissionCount = computed(() => effectiveRolePermissionCodes.value.length)
const isAllPermissionsSelected = computed(() =>
  allPermissionCodes.value.length > 0 && effectiveRolePermissionCodes.value.length === allPermissionCodes.value.length
)

const selectedPermissionTreeItems = computed<PermissionTreeNode[]>({
  get() {
    return buildSelectedPermissionTreeItems(permissionTreeItems.value, new Set(effectiveRolePermissionCodes.value))
  },
  set(items) {
    if (roleForm.code === 'super_admin') return

    const selectedCodes = new Set(
      items
        .filter((item) => item.type === 'permission' && item.code)
        .map((item) => item.code as string)
    )

    roleForm.permissions = allPermissionCodes.value.filter(code => selectedCodes.has(code))
  }
})

function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function statusLabel(status: number): string {
  return status === 1 ? '启用' : '禁用'
}

function resetUserForm() {
  editingUserId.value = null
  userForm.username = ''
  userForm.displayName = ''
  userForm.password = ''
  userForm.status = 1
  userForm.isSuperAdmin = false
  userForm.roleIds = []
}

function resetRoleForm() {
  editingRoleId.value = null
  roleForm.code = ''
  roleForm.name = ''
  roleForm.description = ''
  roleForm.status = 1
  roleForm.sort = 100
  roleForm.permissions = []
}

function selectAllPermissions() {
  if (roleForm.code === 'super_admin') return
  roleForm.permissions = [...allPermissionCodes.value]
}

function clearPermissions() {
  if (roleForm.code === 'super_admin') return
  roleForm.permissions = []
}

function onPermissionTreeSelect(event: TreeItemSelectEvent<PermissionTreeNode>) {
  if (event.detail.originalEvent.type === 'click') {
    event.preventDefault()
  }
}

async function fetchUsers() {
  loading.value = true
  try {
    const response = await adminFetch<UserListResponse>('/api/admin/admin_users', {
      query: {
        limit: pageSize.value,
        offset: (page.value - 1) * pageSize.value,
        keyword: keyword.value.trim() || undefined,
        status: statusFilter.value === 'all' ? undefined : statusFilter.value
      }
    })
    users.value = response.list
    total.value = response.total
  } finally {
    loading.value = false
  }
}

async function fetchRoles() {
  roleLoading.value = true
  try {
    roles.value = await adminFetch<AdminRole[]>('/api/admin/admin_roles')
  } finally {
    roleLoading.value = false
  }
}

async function fetchPermissions() {
  const response = await adminFetch<{ groups: PermissionGroup[] }>('/api/admin/auth/permissions')
  permissionGroups.value = response.groups
}

function openCreateUser() {
  resetUserForm()
  userModal.value = true
}

function openEditUser(row: AdminUser) {
  editingUserId.value = row.id
  userForm.username = row.username
  userForm.displayName = row.display_name || row.username
  userForm.password = ''
  userForm.status = row.status
  userForm.isSuperAdmin = row.is_super_admin === 1
  userForm.roleIds = row.roles.map((role) => role.role_id)
  userModal.value = true
}

function openResetPassword(row: AdminUser) {
  passwordForm.userId = row.id
  passwordForm.username = row.username
  passwordForm.password = ''
  passwordModal.value = true
}

function openDeleteUser(row: AdminUser) {
  if (!canManage.value || row.is_super_admin === 1) return
  deleteTarget.value = row
}

function openDeleteRole(row: AdminRole) {
  if (!canManage.value || row.code === 'super_admin') return
  deleteRoleTarget.value = row
}

function closeDeleteConfirm() {
  if (!deleteLoading.value) deleteTarget.value = null
}

function closeDeleteRoleConfirm() {
  if (!deleteLoading.value) deleteRoleTarget.value = null
}

async function confirmDeleteUser() {
  const row = deleteTarget.value
  if (!row || row.is_super_admin === 1) return

  deleteLoading.value = true
  try {
    await adminFetch(`/api/admin/admin_users/${row.id}`, { method: 'DELETE' })
    toast.add({ title: '管理员已删除', color: 'success', icon: 'i-lucide-trash-2' })
    deleteTarget.value = null
    await fetchUsers()
  } catch (error) {
    toast.add({ title: '删除管理员失败', description: getAdminFetchErrorMessage(error), color: 'error' })
  } finally {
    deleteLoading.value = false
  }
}

async function confirmDeleteRole() {
  const row = deleteRoleTarget.value
  if (!row || row.code === 'super_admin') return

  deleteLoading.value = true
  try {
    await adminFetch(`/api/admin/admin_roles/${row.id}`, { method: 'DELETE' })
    toast.add({ title: '角色已删除', color: 'success', icon: 'i-lucide-trash-2' })
    deleteRoleTarget.value = null
    await Promise.all([fetchRoles(), fetchUsers()])
  } catch (error) {
    toast.add({ title: '删除角色失败', description: getAdminFetchErrorMessage(error), color: 'error' })
  } finally {
    deleteLoading.value = false
  }
}

function openCreateRole() {
  resetRoleForm()
  roleModal.value = true
}

function openEditRole(row: AdminRole) {
  editingRoleId.value = row.id
  roleForm.code = row.code
  roleForm.name = row.name
  roleForm.description = row.description
  roleForm.status = row.status
  roleForm.sort = row.sort
  roleForm.permissions = [...row.permissions]
  roleModal.value = true
}

async function submitUser() {
  submitLoading.value = true
  try {
    if (editingUserId.value) {
      await adminFetch(`/api/admin/admin_users/${editingUserId.value}`, {
        method: 'PUT',
        body: {
          displayName: userForm.displayName,
          status: userForm.status,
          isSuperAdmin: userForm.isSuperAdmin,
          roleIds: userForm.roleIds
        }
      })
    } else {
      await adminFetch('/api/admin/admin_users', {
        method: 'POST',
        body: {
          username: userForm.username,
          displayName: userForm.displayName,
          password: userForm.password,
          status: userForm.status,
          isSuperAdmin: userForm.isSuperAdmin,
          roleIds: userForm.roleIds
        }
      })
    }
    toast.add({ title: '保存成功', color: 'success', icon: 'i-lucide-check' })
    userModal.value = false
    await fetchUsers()
  } catch (error) {
    toast.add({ title: '保存管理员失败', description: getAdminFetchErrorMessage(error), color: 'error' })
  } finally {
    submitLoading.value = false
  }
}

async function submitPassword() {
  submitLoading.value = true
  try {
    await adminFetch(`/api/admin/admin_users/${passwordForm.userId}/password`, {
      method: 'PUT',
      body: { password: passwordForm.password }
    })
    toast.add({ title: '密码已重置', color: 'success', icon: 'i-lucide-key-round' })
    passwordModal.value = false
    await fetchUsers()
  } catch (error) {
    toast.add({ title: '重置密码失败', description: getAdminFetchErrorMessage(error), color: 'error' })
  } finally {
    submitLoading.value = false
  }
}

async function submitRole() {
  submitLoading.value = true
  try {
    const payload = {
      code: roleForm.code,
      name: roleForm.name,
      description: roleForm.description,
      status: roleForm.status,
      sort: roleForm.sort,
      permissions: [...effectiveRolePermissionCodes.value]
    }
    if (editingRoleId.value) {
      await adminFetch(`/api/admin/admin_roles/${editingRoleId.value}`, { method: 'PUT', body: payload })
    } else {
      await adminFetch('/api/admin/admin_roles', { method: 'POST', body: payload })
    }
    toast.add({ title: '角色已保存', color: 'success', icon: 'i-lucide-check' })
    roleModal.value = false
    await fetchRoles()
  } catch (error) {
    toast.add({ title: '保存角色失败', description: getAdminFetchErrorMessage(error), color: 'error' })
  } finally {
    submitLoading.value = false
  }
}

watch([pageSize, statusFilter], () => {
  page.value = 1
  fetchUsers()
})

let keywordTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    page.value = 1
    fetchUsers()
  }, 300)
})

onMounted(async () => {
  await Promise.all([fetchUsers(), fetchRoles(), fetchPermissions()])
})

useHead({ title: '管理员账户' })
</script>

<template>
  <div class="min-h-screen p-6 md:p-8">
    <AdminPageHeader
      title="管理员账户"
      description="维护后台分账户、角色和权限授权"
      icon="i-lucide-users"
    >
      <template #actions>
        <UButton
          v-if="canManage"
          icon="i-lucide-user-plus"
          color="primary"
          size="sm"
          @click="openCreateUser"
        >
          新增管理员
        </UButton>
        <UButton
          v-if="canManage"
          icon="i-lucide-shield-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="openCreateRole"
        >
          新增角色
        </UButton>
      </template>
    </AdminPageHeader>

    <UTabs
      v-model="activeTab"
      :items="activeTabItems"
      class="mb-4"
    />

    <UCard v-if="activeTab === 'users'" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-2 border-b border-default/60 bg-muted/40 px-4 py-3">
        <UInput v-model="keyword" name="keyword" icon="i-lucide-search" placeholder="搜索用户名 / 展示名" size="sm" class="w-64" />
        <USelect
          v-model="statusFilter"
          name="status_filter"
          :items="[
            { label: '全部状态', value: 'all' },
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' }
          ]"
          size="sm"
          class="w-36"
        />
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="size-9 animate-spin text-primary" />
      </div>
      <div v-else-if="!users.length" class="py-16">
        <UEmpty title="暂无管理员" icon="i-lucide-users" />
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-245 table-fixed text-sm">
          <colgroup>
            <col class="w-[24%]">
            <col class="w-[24%]">
            <col class="w-[10%]">
            <col class="w-[20%]">
            <col class="w-[22%]">
          </colgroup>
          <thead class="border-b border-default/60 bg-muted/30 text-left text-xs text-muted">
            <tr>
              <th class="px-4 py-3">账号</th>
              <th class="px-4 py-3">角色</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">最近登录</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in users" :key="row.id" class="border-b border-default/40">
              <td class="px-4 py-3 align-top">
                <div class="font-medium">{{ row.display_name || row.username }}</div>
                <div class="font-mono text-xs text-muted">{{ row.username }} #{{ row.id }}</div>
              </td>
              <td class="px-4 py-3 align-top">
                <div class="flex flex-wrap gap-1.5">
                  <UBadge v-if="row.is_super_admin === 1" color="primary" variant="soft">超级管理员</UBadge>
                  <UBadge v-for="role in row.roles" :key="role.role_id" color="neutral" variant="subtle">
                    {{ role.name }}
                  </UBadge>
                </div>
              </td>
              <td class="px-4 py-3 align-top whitespace-nowrap">
                <UBadge :color="row.status === 1 ? 'success' : 'error'" variant="soft">
                  {{ statusLabel(row.status) }}
                </UBadge>
              </td>
              <td class="px-4 py-3 align-top text-xs text-muted">
                <div>{{ formatTime(row.last_login_at) }}</div>
                <div>{{ row.last_login_ip || '-' }}</div>
              </td>
              <td class="px-4 py-3 align-top text-right">
                <div class="flex flex-wrap justify-end gap-2">
                  <UButton size="xs" icon="i-lucide-pencil" variant="subtle" :disabled="!canManage" @click="openEditUser(row)">
                    编辑
                  </UButton>
                  <UButton size="xs" icon="i-lucide-key-round" color="neutral" variant="subtle" :disabled="!canManage" @click="openResetPassword(row)">
                    重置密码
                  </UButton>
                  <UButton
                    size="xs"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="subtle"
                    :disabled="!canManage || row.is_super_admin === 1"
                    :title="row.is_super_admin === 1 ? '超级管理员不可删除' : '删除管理员'"
                    @click="openDeleteUser(row)"
                  >
                    删除
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <AdminTablePaginationBar
          :page="page"
          :page-size="pageSize"
          :total="total"
          @update:page="(value: number) => { page = value; fetchUsers() }"
          @update:pageSize="(value: number) => { pageSize = value }"
        />
      </div>
    </UCard>

    <UCard v-else class="overflow-hidden">
      <div v-if="roleLoading" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="size-9 animate-spin text-primary" />
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-245 table-fixed text-sm">
          <colgroup>
            <col class="w-[22%]">
            <col class="w-[10%]">
            <col class="w-[10%]">
            <col class="w-[42%]">
            <col class="w-[16%]">
          </colgroup>
          <thead class="border-b border-default/60 bg-muted/30 text-left text-xs text-muted">
            <tr>
              <th class="px-4 py-3">角色</th>
              <th class="px-4 py-3">权限数</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">说明</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in roles" :key="row.id" class="border-b border-default/40">
              <td class="px-4 py-3 align-top">
                <div class="font-medium">{{ row.name }}</div>
                <div class="font-mono text-xs text-muted">{{ row.code }}</div>
              </td>
              <td class="px-4 py-3 align-top whitespace-nowrap">{{ row.code === 'super_admin' ? '全部' : row.permissions.length }}</td>
              <td class="px-4 py-3 align-top whitespace-nowrap">
                <UBadge :color="row.status === 1 ? 'success' : 'error'" variant="soft">
                  {{ statusLabel(row.status) }}
                </UBadge>
              </td>
              <td class="px-4 py-3 align-top text-xs leading-6 text-muted">{{ row.description || '-' }}</td>
              <td class="px-4 py-3 align-top text-right">
                <div class="flex flex-wrap justify-end gap-2">
                  <UButton size="xs" icon="i-lucide-pencil" variant="subtle" :disabled="!canManage" @click="openEditRole(row)">
                    编辑授权
                  </UButton>
                  <UButton
                    size="xs"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="subtle"
                    :disabled="!canManage || row.code === 'super_admin'"
                    :title="row.code === 'super_admin' ? '超级管理员角色不可删除' : '删除角色'"
                    @click="openDeleteRole(row)"
                  >
                    删除
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal
      v-model:open="userModal"
      :title="editingUserId ? '编辑管理员' : '新增管理员'"
      description="用于维护管理员账户、角色绑定和登录状态。"
      :ui="{ content: 'max-w-5xl', body: 'sm:p-6', footer: 'border-t border-default/60 bg-muted/20' }"
    >
      <template #body>
        <form class="space-y-5" @submit.prevent="submitUser">
          <div class="rounded-xl border border-default/60 bg-muted/20 px-4 py-3 text-sm text-muted">
            创建后台分账户时，优先分配明确角色。只有确实需要全局控制权时，再开启超级管理员。
          </div>

          <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
            <section class="rounded-2xl border border-default/60 bg-default/80 p-4 shadow-xs">
              <div class="mb-4 flex items-center gap-2">
                <UIcon name="i-lucide-user-round-cog" class="size-4 text-primary" />
                <div>
                  <div class="text-sm font-semibold text-highlighted">账户信息</div>
                  <p class="text-xs text-muted">输入框按单列铺满，便于录入账号、展示名和初始密码。</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UFormField label="用户名" required>
                  <UInput
                    v-model="userForm.username"
                    name="username"
                    :disabled="!!editingUserId"
                    placeholder="如 customer_01"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="展示名" required>
                  <UInput
                    v-model="userForm.displayName"
                    name="display_name"
                    placeholder="用于操作日志和列表展示"
                    class="w-full"
                  />
                </UFormField>

                <UFormField v-if="!editingUserId" label="初始密码" required class="md:col-span-2">
                  <UInput
                    v-model="userForm.password"
                    type="password"
                    name="password"
                    placeholder="至少 8 位，建议字母、数字和符号组合"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </section>

            <section class="rounded-2xl border border-default/60 bg-muted/20 p-4 shadow-xs">
              <div class="mb-4 flex items-center gap-2">
                <UIcon name="i-lucide-shield-check" class="size-4 text-primary" />
                <div>
                  <div class="text-sm font-semibold text-highlighted">账号权限</div>
                  <p class="text-xs text-muted">状态、身份开关集中放在右侧，减少表单跳读。</p>
                </div>
              </div>

              <div class="space-y-4">
                <UFormField label="状态">
                  <USelect v-model="userForm.status" name="status" :items="adminStatusItems" value-key="value" class="w-full" />
                </UFormField>

                <div class="rounded-xl border border-default/60 bg-default/80 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-sm font-medium text-highlighted">超级管理员</div>
                      <p class="mt-1 text-xs leading-5 text-muted">
                        开启后可绕过角色限制，直接拥有完整后台权限。建议仅保留给极少数运维或负责人账号。
                      </p>
                    </div>
                    <UCheckbox v-model="userForm.isSuperAdmin" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section class="rounded-2xl border border-default/60 bg-default/80 p-4 shadow-xs">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-highlighted">角色分配</div>
                <p class="text-xs text-muted">尽量使用角色来收口权限，避免给普通运营账号直接加超级管理员。</p>
              </div>
              <UBadge color="neutral" variant="subtle">{{ userForm.roleIds.length }} 个已选</UBadge>
            </div>

            <UCheckboxGroup
              v-model="userForm.roleIds"
              :items="roles"
              value-key="id"
              label-key="name"
              orientation="vertical"
              :ui="{
                fieldset: 'grid grid-cols-1 gap-3 lg:grid-cols-2',
                item: 'rounded-xl border border-default/60 bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5'
              }"
            >
              <template #label="{ item }">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-highlighted">{{ item.name }}</span>
                  <UBadge v-if="item.is_system === 1" color="primary" variant="soft" size="sm">系统</UBadge>
                  <UBadge v-if="item.status !== 1" color="error" variant="soft" size="sm">已禁用</UBadge>
                </div>
              </template>
              <template #description="{ item }">
                <div class="mt-1 space-y-2">
                  <div class="font-mono text-[11px] text-muted">{{ item.code }}</div>
                  <p class="text-xs leading-5 text-muted">{{ item.description || '未填写角色说明' }}</p>
                </div>
              </template>
            </UCheckboxGroup>
          </section>
        </form>
      </template>
      <template #footer="{ close }">
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="subtle" @click="close()">取消</UButton>
          <UButton color="primary" :loading="submitLoading" @click="submitUser">保存</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="passwordModal"
      title="重置密码"
      description="用于重置管理员登录密码。"
      :ui="{ content: 'max-w-xl', body: 'sm:p-6', footer: 'border-t border-default/60 bg-muted/20' }"
    >
      <template #body>
        <form class="space-y-5" @submit.prevent="submitPassword">
          <div class="rounded-xl border border-default/60 bg-muted/20 p-4">
            <div class="text-xs uppercase tracking-[0.24em] text-muted">目标账号</div>
            <div class="mt-2 text-base font-semibold text-highlighted">{{ passwordForm.username }}</div>
            <p class="mt-2 text-xs leading-5 text-muted">
              重置后旧密码将立即失效。建议使用强密码并通过安全渠道通知管理员本人。
            </p>
          </div>

          <UFormField label="新密码" required>
            <UInput
              v-model="passwordForm.password"
              type="password"
              name="new_password"
              placeholder="至少 8 位，建议包含大小写、数字和符号"
              class="w-full"
            />
          </UFormField>
        </form>
      </template>
      <template #footer="{ close }">
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="subtle" @click="close()">取消</UButton>
          <UButton color="primary" :loading="submitLoading" @click="submitPassword">确认重置</UButton>
        </div>
      </template>
    </UModal>

    <AdminConfirmModal
      :open="!!deleteTarget"
      title="确认删除管理员"
      :loading="deleteLoading"
      confirm-label="确定删除"
      confirm-color="error"
      @update:open="(value: boolean) => { if (!value) closeDeleteConfirm() }"
      @confirm="confirmDeleteUser"
    >
      <p class="text-sm leading-6 text-default">
        确定要删除管理员“<strong>{{ deleteTarget?.display_name || deleteTarget?.username }}</strong>”吗？删除后该账号将无法登录后台，已绑定角色关系也会一并移除。
      </p>
    </AdminConfirmModal>

    <AdminConfirmModal
      :open="!!deleteRoleTarget"
      title="确认删除角色"
      :loading="deleteLoading"
      confirm-label="确定删除"
      confirm-color="error"
      @update:open="(value: boolean) => { if (!value) closeDeleteRoleConfirm() }"
      @confirm="confirmDeleteRole"
    >
      <p class="text-sm leading-6 text-default">
        确定要删除角色“<strong>{{ deleteRoleTarget?.name }}</strong>”吗？删除后该角色的权限授权和管理员绑定关系会一并移除，已绑定管理员需要重新获取权限。
      </p>
    </AdminConfirmModal>

    <UModal
      v-model:open="roleModal"
      :title="editingRoleId ? '编辑角色' : '新增角色'"
      description="用于维护角色信息、默认权限和菜单授权。"
      :ui="{ content: 'max-w-6xl', body: 'sm:p-6', footer: 'border-t border-default/60 bg-muted/20' }"
    >
      <template #body>
        <form class="space-y-5" @submit.prevent="submitRole">
          <div class="rounded-xl border border-default/60 bg-muted/20 px-4 py-3 text-sm text-muted">
            角色优先承载页面权限、接口权限和高风险操作授权。编码创建后会被多个授权关系引用，线上请谨慎修改。
          </div>

          <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
            <section class="rounded-2xl border border-default/60 bg-default/80 p-4 shadow-xs">
              <div class="mb-4 flex items-center gap-2">
                <UIcon name="i-lucide-badge-info" class="size-4 text-primary" />
                <div>
                  <div class="text-sm font-semibold text-highlighted">角色基础信息</div>
                  <p class="text-xs text-muted">关键输入项保持满宽，便于录入角色编码、名称和业务说明。</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UFormField label="角色编码" required>
                  <UInput
                    v-model="roleForm.code"
                    name="role_code"
                    :disabled="!!editingRoleId"
                    placeholder="如 system_admin"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="角色名称" required>
                  <UInput v-model="roleForm.name" name="role_name" placeholder="如 系统管理员" class="w-full" />
                </UFormField>

                <UFormField label="角色说明" class="md:col-span-2">
                  <UTextarea
                    v-model="roleForm.description"
                    name="role_description"
                    :rows="5"
                    placeholder="说明该角色负责的后台模块、页面范围和高风险操作边界"
                    class="min-h-32 w-full"
                  />
                </UFormField>
              </div>
            </section>

            <section class="rounded-2xl border border-default/60 bg-muted/20 p-4 shadow-xs">
              <div class="mb-4 flex items-center gap-2">
                <UIcon name="i-lucide-sliders-horizontal" class="size-4 text-primary" />
                <div>
                  <div class="text-sm font-semibold text-highlighted">状态与展示顺序</div>
                  <p class="text-xs text-muted">把状态、排序和授权提示收在一处，编辑时不需要来回找。</p>
                </div>
              </div>

              <div class="space-y-4">
                <UFormField label="状态">
                  <USelect v-model="roleForm.status" name="role_status" :items="roleStatusItems" value-key="value" class="w-full" />
                </UFormField>

                <UFormField label="排序">
                  <UInput v-model.number="roleForm.sort" name="role_sort" type="number" placeholder="100" class="w-full" />
                </UFormField>

                <div class="rounded-xl border border-default/60 bg-default/80 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-sm font-medium text-highlighted">已选权限</div>
                    <UBadge color="primary" variant="soft">
                      {{ roleForm.code === 'super_admin' ? '全部权限' : `${selectedPermissionCount} 项` }}
                    </UBadge>
                  </div>
                  <p class="mt-2 text-xs leading-5 text-muted">
                    高风险权限会单独标记。超级管理员角色默认拥有全部权限，不建议在业务角色中混入过多高风险授权。
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section class="rounded-2xl border border-default/60 bg-default/80 p-4 shadow-xs">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-highlighted">权限分组</div>
                <p class="text-xs text-muted">按一级菜单和二级子菜单组织权限，树形联动下更方便整组授权或局部勾选。</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="neutral" variant="subtle">{{ permissionGroups.length }} 个分组</UBadge>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="subtle"
                  :disabled="roleForm.code === 'super_admin' || !allPermissionCodes.length || isAllPermissionsSelected"
                  @click="selectAllPermissions"
                >
                  全选
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="roleForm.code === 'super_admin' || !selectedPermissionCount"
                  @click="clearPermissions"
                >
                  清空
                </UButton>
              </div>
            </div>

            <div class="rounded-2xl border border-default/60 bg-muted/10 p-3">
              <UTree
                v-model="selectedPermissionTreeItems"
                :items="permissionTreeItems"
                :get-key="(item) => item.key"
                :as="{ link: 'div' }"
                multiple
                propagate-select
                bubble-select
                selection-behavior="toggle"
                :disabled="roleForm.code === 'super_admin'"
                @select="onPermissionTreeSelect"
                :ui="{
                  root: 'space-y-3',
                  item: 'list-none',
                  itemWithChildren: 'list-none space-y-2',
                  link: 'group flex items-start gap-3 rounded-xl border border-default/60 bg-default/80 px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 data-[selected]:border-primary/50 data-[selected]:bg-primary/6',
                  linkLabel: 'min-w-0 flex-1',
                  listWithChildren: 'ms-4 mt-2 space-y-2 border-s border-default/50 ps-3'
                }"
              >
                <template #item-leading="{ selected, indeterminate, handleSelect }">
                  <UCheckbox
                    :model-value="indeterminate ? 'indeterminate' : selected"
                    :disabled="roleForm.code === 'super_admin'"
                    tabindex="-1"
                    class="mt-0.5"
                    @change="handleSelect"
                    @click.stop
                  />
                </template>

                <template #item-label="{ item }">
                  <span class="min-w-0">
                    <span class="flex flex-wrap items-center gap-2">
                      <span class="text-sm font-medium text-highlighted">{{ item.label }}</span>
                      <UBadge v-if="item.type === 'group'" color="neutral" variant="subtle" size="sm">
                        {{ item.permissionCount }} 项
                      </UBadge>
                      <UBadge v-if="item.highRisk" color="warning" variant="soft" size="sm">高风险</UBadge>
                    </span>

                    <span v-if="item.type === 'group'" class="mt-1 block text-xs leading-5 text-muted">
                      勾选分组会联动子权限；半选状态表示当前仅授权了部分功能点。
                    </span>
                    <span v-else-if="item.code" class="mt-1 block font-mono text-[11px] text-muted">
                      {{ item.code }}
                    </span>
                  </span>
                </template>
              </UTree>
            </div>
          </section>
        </form>
      </template>
      <template #footer="{ close }">
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="subtle" @click="close()">取消</UButton>
          <UButton color="primary" :loading="submitLoading" @click="submitRole">保存</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
