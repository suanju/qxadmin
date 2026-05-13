<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  placeholder?: string
  name?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isComposing = ref(false)
const pendingValue = ref('')

interface FocusableInputComponent {
  focus?: () => void
  $el?: HTMLElement
}

const inputRef = ref<FocusableInputComponent | null>(null)

defineExpose({
  focus: () => {
    const r = inputRef.value
    if (!r) return
    if (typeof r.focus === 'function') return r.focus()
    const input = r.$el?.querySelector('input')
    input?.focus()
  }
})

const onInput = (value: string) => {
  pendingValue.value = value
  if (isComposing.value) return
  emit('update:modelValue', value)
}

const onCompositionStart = () => {
  isComposing.value = true
}

const onCompositionEnd = () => {
  isComposing.value = false
  emit('update:modelValue', pendingValue.value)
}

const clear = () => {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="flex items-center gap-2">
    <UInput
      ref="inputRef"
      :model-value="modelValue"
      :placeholder="placeholder || '搜索...'"
      :name="name || 'table_search'"
      :aria-label="placeholder || '搜索...'"
      class="w-64"
      size="sm"
      @update:model-value="onInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    >
      <template #leading>
        <UIcon name="i-lucide-search" class="size-4 text-muted" />
      </template>
      <template v-if="modelValue" #trailing>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          aria-label="清除搜索"
          @click.prevent="clear"
        />
      </template>
    </UInput>
  </div>
</template>
