<script setup lang="ts">
 type PaginationSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  page: number
  pageSize: number
  total: number
  siblingCount?: number
  size?: PaginationSize
  showFirst?: boolean
  showLast?: boolean
  pageSizeOptions?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  siblingCount: 2,
  size: 'sm',
  showFirst: true,
  showLast: true,
  pageSizeOptions: () => [10, 20, 50, 100]
})

const emit = defineEmits<{
  'update:page': [number]
  'update:pageSize': [number]
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const pageSizeItems = computed(() => props.pageSizeOptions.map((n) => ({
  label: String(n),
  value: n
})))
const pageSizeInputId = `admin-table-page-size-${Math.random().toString(36).slice(2)}`

function onPageChange(newPage: number) {
  emit('update:page', newPage)
}

function onPageSizeChange(next: number | string) {
  const pageSize = Number(next)

  if (Number.isFinite(pageSize)) {
    emit('update:pageSize', pageSize)
  }
}
</script>

<template>
  <div
    class="flex items-center justify-between border-t border-gray-200/70 bg-gray-50/60 px-4 py-3 text-xs text-muted dark:border-gray-800 dark:bg-gray-900/40"
  >
    <slot name="summary">
      <span>第 {{ page }} 页 / 共 {{ totalPages }} 页，共 {{ total }} 条</span>
    </slot>

    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <label :for="pageSizeInputId" class="whitespace-nowrap text-[11px] text-muted">每页</label>
        <USelect
          :id="pageSizeInputId"
          :model-value="pageSize"
          :items="pageSizeItems"
          value-key="value"
          name="page_size"
          :size="size"
          class="w-20"
          @update:model-value="onPageSizeChange"
        />
        <span class="whitespace-nowrap text-[11px] text-muted">条</span>
      </div>

      <UPagination
        :page="page"
        :total="total"
        :items-per-page="pageSize"
        :sibling-count="siblingCount"
        :size="size"
        :show-first="showFirst"
        :show-last="showLast"
        @update:page="onPageChange"
      />
    </div>
  </div>
</template>
