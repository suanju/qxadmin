<script setup lang="ts">
interface Props {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  message: '',
  confirmLabel: '确定',
  cancelLabel: '取消',
  confirmColor: 'error',
  loading: false
})

const emit = defineEmits<{
  'update:open': [boolean]
  confirm: []
}>()

function close() {
  if (!props.loading) {
    emit('update:open', false)
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="message || `${title}确认对话框`"
    :ui="{ footer: 'justify-end gap-2' }"
    @update:open="(value: boolean) => !value && close()"
  >
    <template #body>
      <slot>
        <p class="text-default">{{ message }}</p>
      </slot>
    </template>

    <template #footer>
      <UButton
        :label="cancelLabel"
        color="neutral"
        variant="subtle"
        :disabled="loading"
        @click="close()"
      />
      <UButton
        :label="confirmLabel"
        :color="confirmColor"
        :loading="loading"
        @click="emit('confirm')"
      />
    </template>
  </UModal>
</template>
