<script setup lang="ts">
defineOptions({ name: 'SettingsInfo' })

defineProps<{
  loading: boolean
  hasItems: boolean
  canCreate: boolean
}>()

const emit = defineEmits<{
  add: []
}>()
</script>

<template>
  <AdminPageHeader
    title="系统设置"
    description="集中维护系统配置项和高频运行参数"
    icon="i-lucide-settings"
  >
    <template #actions>
      <UButton v-if="canCreate" label="新增配置" color="primary" icon="i-lucide-plus" @click="emit('add')" />
    </template>
  </AdminPageHeader>

  <div v-if="loading" class="flex items-center justify-center py-16">
    <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
  </div>
  <UEmpty v-else-if="!hasItems" title="暂无配置" description="点击「新增配置」添加第一条" icon="i-lucide-settings" class="py-16">
    <template v-if="canCreate" #actions>
      <UButton label="新增配置" color="primary" @click="emit('add')" />
    </template>
  </UEmpty>
</template>
