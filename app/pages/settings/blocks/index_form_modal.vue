<script setup lang="ts">
import type { ConfigFormModel, ConfigTypeOption } from '~/types/settings'

defineOptions({ name: 'SettingsFormModal' })

const props = defineProps<{
  open: boolean
  form: ConfigFormModel
  configTypes: ConfigTypeOption[]
  submitLoading: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: []
  cancel: []
}>()
</script>

<template>
  <UModal
    :open="open"
    title="新增配置"
    :ui="{ footer: 'justify-end gap-2' }"
    @update:open="emit('update:open', $event)"
  >
    <template #default>
      <span class="sr-only" />
    </template>
    <template #body>
      <form class="space-y-4" @submit.prevent="emit('submit')">
        <UFormField label="变量名 (name)" name="name" required>
          <UInput
            :model-value="form.name"
            placeholder="英文或拼音，如 site_name"
            class="w-full font-mono"
            @update:model-value="(v: string) => (form.name = v)"
          />
        </UFormField>
        <UFormField label="分组 (group)" name="group">
          <UInput
            :model-value="form.group"
            placeholder="如：基础、通知"
            class="w-full"
            @update:model-value="(v: string) => (form.group = v)"
          />
        </UFormField>
        <UFormField label="变量标题 (title)" name="title">
          <UInput
            :model-value="form.title"
            placeholder="显示名称"
            class="w-full"
            @update:model-value="(v: string) => (form.title = v)"
          />
        </UFormField>
        <UFormField label="变量描述 (tip)" name="tip">
          <UInput
            :model-value="form.tip"
            placeholder="简短说明"
            class="w-full"
            @update:model-value="(v: string) => (form.tip = v)"
          />
        </UFormField>
        <UFormField label="类型 (type)" name="type">
          <USelect
            v-model="form.type"
            :items="configTypes"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField v-if="form.type" label="默认值 (可选)" name="value">
          <UInput
            :model-value="form.value"
            :type="form.type === 'int' ? 'number' : 'text'"
            placeholder="可选"
            class="w-full"
            @update:model-value="(v: string) => (form.value = v)"
          />
        </UFormField>
      </form>
    </template>
    <template #footer="{ close }">
      <UButton
        label="取消"
        color="neutral"
        variant="subtle"
        @click="close(); emit('cancel')"
      />
      <UButton
        :label="submitLoading ? '提交中…' : '确定'"
        color="primary"
        :loading="submitLoading"
        @click="emit('submit')"
      />
    </template>
  </UModal>
</template>
