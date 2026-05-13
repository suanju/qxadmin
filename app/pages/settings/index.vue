<script setup lang="ts">
import SettingsInfo from './blocks/index_info.vue'
import SettingsGroups from './blocks/index_groups.vue'
import SettingsFormModal from './blocks/index_form_modal.vue'
import SettingsVerifyGuard from './blocks/index_verify_guard.vue'
import type { ConfigItem, ConfigFormModel, ConfigTypeOption } from '~/types/settings'

definePageMeta({ layout: 'default' })

const { adminFetch } = useAdminFetch()
const { runAdminMutation } = useAdminMutationFeedback()
const { can } = useAdminAuth()

const CONFIG_TYPES: ConfigTypeOption[] = [
  { value: 'string', label: '字符串' },
  { value: 'text', label: '多行文本' },
  { value: 'int', label: '整数' },
  { value: 'bool', label: '布尔' },
  { value: 'array', label: '数组(JSON)' },
  { value: 'datetime', label: '日期时间' },
  { value: 'date', label: '日期' },
  { value: 'file', label: '文件路径' },
  { value: 'image', label: '图片' }
]

const list = ref<ConfigItem[]>([])
const loading = ref(true)
const modalOpen = ref(false)
const form = ref<ConfigFormModel>({
  name: '',
  group: '',
  title: '',
  tip: '',
  type: 'string',
  value: ''
})
const submitLoading = ref(false)
const savingId = ref<number | null>(null)
const deleteTarget = ref<ConfigItem | null>(null)
const batchDeleteTargets = ref<ConfigItem[]>([])
const deleteLoading = ref(false)
const canCreateSetting = computed(() => can('settings.create'))
const canUpdateSetting = computed(() => can('settings.update'))
const canDeleteSetting = computed(() => can('settings.delete'))
const canUploadFile = computed(() => can('upload.create'))

// 二次密码验证相关
const verifyRequired = ref(true)
const verifyPassword = ref<string | null>(null)
const verified = ref(false)

const grouped = computed(() => {
  const map = new Map<string, ConfigItem[]>()
  for (const item of list.value) {
    const g = item.group || '默认'
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(item)
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
})

async function fetchList() {
  loading.value = true
  try {
    list.value = await adminFetch<ConfigItem[]>('/api/admin/config')

    const verifyItem = list.value.find((item) => item.name === 'verify_password')
    if (!verifyItem || !verifyItem.value) {
      // 未配置二次密码时，不进行拦截
      verifyRequired.value = false
      verified.value = true
      verifyPassword.value = null
    } else {
      verifyRequired.value = true
      verifyPassword.value = verifyItem.value
    }
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!canCreateSetting.value) return
  form.value = {
    name: '',
    group: '',
    title: '',
    tip: '',
    type: 'string',
    value: ''
  }
  modalOpen.value = true
}

async function submitCreate() {
  if (!canCreateSetting.value) return
  if (!form.value.name.trim()) return

  await runAdminMutation(
    async () => await adminFetch<ConfigItem>('/api/admin/config', {
      method: 'POST' as const,
      body: {
        name: form.value.name.trim(),
        group: form.value.group.trim(),
        title: form.value.title.trim(),
        tip: form.value.tip.trim(),
        type: form.value.type,
        value: form.value.value || undefined
      }
    }),
    {
      loading: submitLoading,
      successTitle: '保存成功',
      errorTitle: '新增配置失败'
    }
  )

  modalOpen.value = false
  await fetchList()
}

async function saveItem(item: ConfigItem, value: string | boolean) {
  if (!canUpdateSetting.value) return
  let payload: string
  if (item.type === 'bool') {
    payload = value ? '1' : '0'
  } else {
    payload = String(value ?? '')
  }
  savingId.value = item.id
  try {
    await runAdminMutation(
      async () => await adminFetch<ConfigItem>(`/api/admin/config/${item.id}`, {
        method: 'PUT' as const,
        body: { value: payload }
      }),
      {
        successTitle: '保存成功',
        errorTitle: '更新配置失败'
      }
    )

    item.value = payload
  } finally {
    savingId.value = null
  }
}

function openDeleteConfirm(item: ConfigItem) {
  if (!canDeleteSetting.value) return
  deleteTarget.value = item
}

function closeDeleteConfirm() {
  if (!deleteLoading.value) deleteTarget.value = null
}

function openBatchDeleteConfirm(items: ConfigItem[]) {
  if (!canDeleteSetting.value || items.length === 0) return
  batchDeleteTargets.value = items
}

function closeBatchDeleteConfirm() {
  if (!deleteLoading.value) batchDeleteTargets.value = []
}

async function confirmRemove() {
  if (!canDeleteSetting.value) return
  const item = deleteTarget.value
  if (!item) return

  await runAdminMutation(
    async () => await adminFetch(`/api/admin/config/${item.id}`, { method: 'DELETE' }),
    {
      loading: deleteLoading,
      successTitle: '删除成功',
      errorTitle: '删除配置失败'
    }
  )

  deleteTarget.value = null
  await fetchList()
}

async function confirmBatchRemove() {
  if (!canDeleteSetting.value || batchDeleteTargets.value.length === 0) return
  const targets = [...batchDeleteTargets.value]

  await runAdminMutation(
    async () => {
      for (const item of targets) {
        await adminFetch(`/api/admin/config/${item.id}`, { method: 'DELETE' })
      }
      return { success: true }
    },
    {
      loading: deleteLoading,
      successTitle: '批量删除成功',
      errorTitle: '批量删除配置失败'
    }
  )

  batchDeleteTargets.value = []
  await fetchList()
}

function handleVerified() {
  verified.value = true
}

onMounted(fetchList)

useHead({
  title: '系统设置'
})
</script>

<template>
  <div class="relative min-h-screen p-6">
    <!-- 主体内容：未通过二次验证时模糊且不可操作 -->
    <div
      :class="[
        'space-y-4 transition-all duration-200',
        verifyRequired && !verified ? 'pointer-events-none select-none blur-sm' : ''
      ]"
    >
      <SettingsInfo
        :loading="loading"
        :has-items="grouped.length > 0"
        :can-create="canCreateSetting"
        @add="openCreate"
      />
      <SettingsGroups
        v-if="!loading && grouped.length > 0"
        :grouped="grouped"
        :saving-id="savingId"
        :can-update="canUpdateSetting"
        :can-delete="canDeleteSetting"
        :can-upload="canUploadFile"
        @save="saveItem"
        @remove="openDeleteConfirm"
        @batch-remove="openBatchDeleteConfirm"
      />
      <!-- 删除二次确认弹窗 -->
      <AdminConfirmModal
        :open="!!deleteTarget"
        title="确认删除"
        :loading="deleteLoading"
        confirm-label="确定删除"
        @update:open="(v: boolean) => v || closeDeleteConfirm()"
        @confirm="confirmRemove"
      >
        <p class="text-default">
          确定要删除配置「<strong>{{ deleteTarget?.title || deleteTarget?.name }}</strong>」（<code
            class="rounded bg-muted/50 px-1 text-sm"
          >{{ deleteTarget?.name }}</code>）吗？此操作不可恢复。
        </p>
      </AdminConfirmModal>
      <SettingsFormModal
        v-model:open="modalOpen"
        :form="form"
        :config-types="CONFIG_TYPES"
        :submit-loading="submitLoading"
        @submit="submitCreate"
      />
    </div>

    <AdminConfirmModal
      :open="batchDeleteTargets.length > 0"
      title="确认批量删除"
      :loading="deleteLoading"
      confirm-label="确定删除"
      @update:open="(v: boolean) => v || closeBatchDeleteConfirm()"
      @confirm="confirmBatchRemove"
    >
      <p class="text-default">
        确定要删除已选择的 {{ batchDeleteTargets.length }} 个配置项吗？此操作不可恢复，且每个配置删除都会进入操作日志。
      </p>
    </AdminConfirmModal>

    <!-- 二次密码验证遮罩 -->
    <SettingsVerifyGuard
      v-if="verifyRequired && !verified"
      :open="verifyRequired && !verified"
      :verify-password="verifyPassword"
      @verified="handleVerified"
    />
  </div>
</template>
