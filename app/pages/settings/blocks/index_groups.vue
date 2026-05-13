<script setup lang="ts">
import type { ConfigItem } from '~/types/settings'

defineOptions({ name: 'SettingsGroups' })

const props = defineProps<{
  grouped: [string, ConfigItem[]][]
  savingId: number | null
  canUpdate: boolean
  canDelete: boolean
  canUpload: boolean
}>()

const emit = defineEmits<{
  save: [item: ConfigItem, value: string | boolean]
  remove: [item: ConfigItem]
  batchRemove: [items: ConfigItem[]]
}>()

const { adminFetch } = useAdminFetch()

const activeGroup = ref(props.grouped[0]?.[0] ?? '')
const selectedIds = ref<number[]>([])

/** 聚焦时记录的值，用于 blur 时判断是否有改动，无改动则不保存 */
const valueOnFocus = ref<Record<number, string>>({})

/** 当前正在上传的配置项 id */
const uploadingId = ref<number | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const currentUploadItem = ref<ConfigItem | null>(null)
const activeItems = computed(() => props.grouped.find(([name]) => name === activeGroup.value)?.[1] ?? [])
const selectedSet = computed(() => new Set(selectedIds.value))
const activeItemIds = computed(() => activeItems.value.map(item => item.id))
const selectedActiveItemIds = computed(() => activeItemIds.value.filter(id => selectedSet.value.has(id)))
const isAllActiveSelected = computed(() =>
  activeItemIds.value.length > 0 && selectedActiveItemIds.value.length === activeItemIds.value.length
)
const isSomeActiveSelected = computed(() =>
  selectedActiveItemIds.value.length > 0 && !isAllActiveSelected.value
)

watch(
  () => props.grouped,
  (groups) => {
    if (!groups.some(([name]) => name === activeGroup.value)) {
      activeGroup.value = groups[0]?.[0] ?? ''
    }
    const validIds = new Set(groups.flatMap(([, items]) => items.map(item => item.id)))
    selectedIds.value = selectedIds.value.filter(id => validIds.has(id))
  },
  { deep: true }
)

function editValue(item: ConfigItem): boolean {
  return item.value === '1' || item.value === 'true'
}

function getSerializedValue(item: ConfigItem): string {
  if (item.type === 'bool') return item.value === '1' || item.value === 'true' ? '1' : '0'
  return item.value ?? ''
}

function onFocus(item: ConfigItem) {
  valueOnFocus.value[item.id] = getSerializedValue(item)
}

function onBlur(item: ConfigItem, value: string | boolean) {
  if (!props.canUpdate) return
  const current = item.type === 'bool' ? (value ? '1' : '0') : String(value ?? '')
  if (current === valueOnFocus.value[item.id]) return
  emit('save', item, value)
}

function triggerImageUpload(item: ConfigItem) {
  if (!props.canUpdate || !props.canUpload) return
  currentUploadItem.value = item
  imageInputRef.value?.click()
}

function triggerFileUpload(item: ConfigItem) {
  if (!props.canUpdate || !props.canUpload) return
  currentUploadItem.value = item
  fileInputRef.value?.click()
}

function toggleItem(id: number, checked: boolean) {
  if (checked) {
    selectedIds.value = Array.from(new Set([...selectedIds.value, id]))
    return
  }
  selectedIds.value = selectedIds.value.filter(item => item !== id)
}

function toggleActiveGroup(checked: boolean) {
  if (checked) {
    selectedIds.value = Array.from(new Set([...selectedIds.value, ...activeItemIds.value]))
    return
  }
  selectedIds.value = selectedIds.value.filter(id => !activeItemIds.value.includes(id))
}

function clearSelection() {
  selectedIds.value = []
}

function emitBatchRemove() {
  if (!props.canDelete || selectedIds.value.length === 0) return
  const selected = props.grouped
    .flatMap(([, items]) => items)
    .filter(item => selectedSet.value.has(item.id))

  emit('batchRemove', selected)
  selectedIds.value = []
}

async function onImageSelected(event: Event) {
  const item = currentUploadItem.value
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  currentUploadItem.value = null
  if (!item || !file || !props.canUpdate || !props.canUpload) return
  uploadingId.value = item.id
  try {
    const form = new FormData()
    form.append('file', file, file.name)
    const res = await adminFetch<{ path: string }>('/api/admin/upload', {
      method: 'POST',
      body: form,
      query: { kind: 'image' }
    })
    emit('save', item, res.path)
  } catch (error: unknown) {
    useToast().add({
      title: getAdminFetchErrorMessage(error, '图片上传失败'),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    uploadingId.value = null
  }
}

async function onFileSelected(event: Event) {
  const item = currentUploadItem.value
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  currentUploadItem.value = null
  if (!item || !file || !props.canUpdate || !props.canUpload) return
  uploadingId.value = item.id
  try {
    const form = new FormData()
    form.append('file', file, file.name)
    const res = await adminFetch<{ path: string }>('/api/admin/upload', {
      method: 'POST',
      body: form,
      query: { kind: 'file' }
    })
    emit('save', item, res.path)
  } catch (error: unknown) {
    useToast().add({
      title: getAdminFetchErrorMessage(error, '文件上传失败'),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    uploadingId.value = null
  }
}

/** 当前值是否为可预览的图片路径（相对路径或同源 URL） */
function isPreviewableImagePath(value: string | null): boolean {
  if (!value?.trim()) return false
  return /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i.test(value) || value.startsWith('/uploads/')
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
    <!-- 全局隐藏的上传用 input，避免在 v-for 中重复 -->
    <input
      ref="imageInputRef"
      type="file"
      name="config_image_upload"
      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
      class="hidden"
      @change="onImageSelected"
    >
    <input ref="fileInputRef" type="file" name="config_file_upload" class="hidden" @change="onFileSelected">
    <UCard class="h-fit overflow-hidden" :ui="{ body: 'p-0' }">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-folder-tree" class="size-5 text-primary" />
            配置分组
          </div>
          <UBadge color="neutral" variant="subtle">{{ grouped.length }}</UBadge>
        </div>
      </template>
      <div class="divide-y divide-default/60">
        <button
          v-for="[groupName, items] in grouped"
          :key="groupName"
          type="button"
          class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/45"
          :class="activeGroup === groupName ? 'bg-primary/6 text-primary' : 'text-default'"
          @click="activeGroup = groupName"
        >
          <span class="min-w-0 truncate text-sm font-medium">{{ groupName }}</span>
          <UBadge :color="activeGroup === groupName ? 'primary' : 'neutral'" variant="subtle" size="sm">
            {{ items.length }}
          </UBadge>
        </button>
      </div>
    </UCard>

    <UCard class="overflow-hidden" :ui="{ body: 'p-0' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2 font-medium">
            <UIcon name="i-lucide-settings-2" class="size-5 text-primary" />
            <span class="truncate">{{ activeGroup || '配置项' }}</span>
            <UBadge color="neutral" variant="subtle">{{ activeItems.length }} 项</UBadge>
          </div>
          <UCheckbox
            :model-value="isAllActiveSelected ? true : isSomeActiveSelected ? 'indeterminate' : false"
            label="选择当前分组"
            @update:model-value="(v: boolean | 'indeterminate') => toggleActiveGroup(v === true)"
          />
        </div>
      </template>

      <AdminTableBulkBar
        :selected-count="selectedIds.length"
        :total="activeItems.length"
        @clear="clearSelection"
      >
        <UButton
          v-if="canDelete"
          size="sm"
          color="error"
          variant="subtle"
          icon="i-lucide-trash-2"
          @click="emitBatchRemove"
        >
          批量删除
        </UButton>
      </AdminTableBulkBar>

      <div class="divide-y divide-default">
        <div v-for="item in activeItems" :key="item.id"
          class="grid grid-cols-1 gap-x-8 gap-y-3 px-4 py-4 md:grid-cols-[2rem_16rem_1fr_auto] md:items-center"
          :class="{ 'md:items-start': item.type === 'text' || item.type === 'array' || item.type === 'image' }">
          <div>
            <UCheckbox
              :model-value="selectedSet.has(item.id)"
              :aria-label="`选择配置 ${item.name}`"
              @update:model-value="(v: boolean | 'indeterminate') => toggleItem(item.id, v === true)"
            />
          </div>
          <!-- 标签区：标题与变量名(name) 强制同一行，tip 在下方 -->
          <div class="min-w-0">
            <div class="flex flex-nowrap items-baseline gap-2 overflow-hidden">
              <span class="min-w-0 truncate text-sm font-medium text-default" :title="item.title || item.name">
                {{ item.title || item.name }}
              </span>
              <code class="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[12px] text-muted"
                :title="'变量名: ' + item.name">
          {{ item.name }}
        </code>
            </div>
            <p v-if="item.tip" class="mt-0.5 text-xs text-muted">
              {{ item.tip }}
            </p>
          </div>

          <!-- 输入区 -->
          <div class="min-w-0">
            <!-- string -->
            <UInput v-if="item.type === 'string'" :model-value="item.value ?? ''" :name="item.name"
              :aria-label="item.title || item.name" class="w-full max-w-md"
              :disabled="!canUpdate"
              @update:model-value="(v: string) => (item.value = v)" @focus="onFocus(item)"
              @blur="onBlur(item, item.value ?? '')" />
            <!-- text -->
            <UTextarea v-else-if="item.type === 'text'" :model-value="item.value ?? ''" :name="item.name"
              :aria-label="item.title || item.name" :rows="3" class="w-full max-w-md" :disabled="!canUpdate"
              @update:model-value="(v: string) => (item.value = v)" @focus="onFocus(item)"
              @blur="onBlur(item, item.value ?? '')" />
            <!-- int -->
            <UInput v-else-if="item.type === 'int'" type="number" :model-value="item.value ?? ''" :name="item.name"
              :aria-label="item.title || item.name" class="w-32"
              :disabled="!canUpdate"
              @update:model-value="(v: string) => (item.value = v)" @focus="onFocus(item)"
              @blur="onBlur(item, item.value ?? '')" />
            <!-- bool -->
            <div v-else-if="item.type === 'bool'" class="flex items-center gap-2">
              <USwitch :model-value="editValue(item)" :disabled="!canUpdate" @update:model-value="(v: boolean) => canUpdate && emit('save', item, v)" />
              <span class="text-sm text-muted">{{ editValue(item) ? '开' : '关' }}</span>
            </div>
            <!-- array -->
            <UTextarea v-else-if="item.type === 'array'" :model-value="item.value ?? ''" :name="item.name"
              :aria-label="item.title || item.name" placeholder='["a","b"] 或 逗号分隔'
              :rows="2" class="w-full max-w-md font-mono text-sm" :disabled="!canUpdate" @update:model-value="(v: string) => (item.value = v)"
              @focus="onFocus(item)" @blur="onBlur(item, item.value ?? '')" />
            <!-- datetime -->
            <UInput v-else-if="item.type === 'datetime'" type="datetime-local"
              :model-value="(item.value ?? '') || undefined" :name="item.name" :aria-label="item.title || item.name"
              class="w-full max-w-xs"
              :disabled="!canUpdate" @update:model-value="(v: string) => canUpdate && emit('save', item, v)" />
            <!-- date -->
            <UInput v-else-if="item.type === 'date'" type="date" :model-value="(item.value ?? '') || undefined"
              :name="item.name" :aria-label="item.title || item.name" class="w-full max-w-xs" :disabled="!canUpdate"
              @update:model-value="(v: string) => canUpdate && emit('save', item, v)" />
            <!-- image：上传 + 预览 -->
            <div v-else-if="item.type === 'image'" class="flex flex-col gap-3">
              <div class="flex flex-wrap items-center gap-2">
                <UButton v-if="canUpdate && canUpload" :loading="uploadingId === item.id" size="sm" color="primary" variant="subtle"
                  icon="i-lucide-upload" :label="uploadingId === item.id ? '上传中…' : '上传图片'"
                  @click="triggerImageUpload(item)" />
                <span v-if="item.value" class="text-xs text-muted font-mono truncate max-w-48" :title="item.value">
                  {{ item.value }}
                </span>
              </div>
              <div v-if="item.value && isPreviewableImagePath(item.value)"
                class="w-fit overflow-hidden rounded-xl border border-default/80 bg-muted/20 p-2 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                <img :src="item.value" :alt="item.title || item.name"
                  class="block max-h-44 max-w-72 rounded-lg object-contain transition duration-200 hover:opacity-95">
              </div>
            </div>
            <!-- file：上传 + 路径/链接预览 -->
            <div v-else-if="item.type === 'file'" class="flex flex-col gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <UButton v-if="canUpdate && canUpload" :loading="uploadingId === item.id" size="sm" color="primary" variant="subtle"
                  icon="i-lucide-upload" :label="uploadingId === item.id ? '上传中…' : '上传文件'"
                  @click="triggerFileUpload(item)" />
                <UInput :model-value="item.value ?? ''" :name="item.name" :aria-label="item.title || item.name"
                  placeholder="文件路径或上传" class="w-full max-w-md font-mono text-sm"
                  :disabled="!canUpdate"
                  @update:model-value="(v: string) => (item.value = v)" @focus="onFocus(item)"
                  @blur="onBlur(item, item.value ?? '')" />
              </div>
              <a v-if="item.value" :href="item.value" target="_blank" rel="noopener noreferrer"
                class="text-sm text-primary hover:underline truncate max-w-md inline-flex items-center gap-1">
                <UIcon name="i-lucide-external-link" class="size-4 shrink-0" />
                {{ item.value }}
              </a>
            </div>
            <!-- 其他类型兜底 -->
            <UInput v-else :model-value="item.value ?? ''" :name="item.name" :aria-label="item.title || item.name"
              placeholder="路径或值" class="w-full max-w-md font-mono"
              :disabled="!canUpdate"
              @update:model-value="(v: string) => (item.value = v)" @focus="onFocus(item)"
              @blur="onBlur(item, item.value ?? '')" />
          </div>

          <!-- 操作区 -->
          <div class="flex shrink-0 items-center gap-2">
            <UButton v-if="savingId === item.id" color="primary" size="sm" loading>
              保存中
            </UButton>
            <UButton v-if="canDelete" color="error" variant="subtle" size="sm" icon="i-lucide-trash-2" aria-label="删除"
              @click="emit('remove', item)" />
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
