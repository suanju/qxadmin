<script setup lang="ts">
interface Props {
  selectedCount: number
  total?: number
}

withDefaults(defineProps<Props>(), {
  total: 0
})

const emit = defineEmits<{
  clear: []
}>()
</script>

<template>
  <div
    v-if="selectedCount > 0"
    class="flex flex-wrap items-center justify-between gap-3 border-b border-default/60 bg-primary/5 px-4 py-3 text-sm"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UBadge color="primary" variant="soft">
        已选择 {{ selectedCount }} 项
      </UBadge>
      <span v-if="total > 0" class="text-xs text-muted">当前列表共 {{ total }} 项</span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <slot />
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-x"
        @click="emit('clear')"
      >
        取消选择
      </UButton>
    </div>
  </div>
</template>
