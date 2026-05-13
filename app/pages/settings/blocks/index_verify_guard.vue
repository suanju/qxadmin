<script setup lang="ts">
defineOptions({ name: 'SettingsVerifyGuard' })

const props = defineProps<{
  open: boolean
  verifyPassword: string | null
}>()

const emit = defineEmits<{
  verified: []
}>()

const input = ref('')
const loading = ref(false)
const error = ref('')

interface NuxtUiInputRef {
  inputRef?: HTMLInputElement | { focus?: () => void } | null
  focus?: () => void
}

const inputRef = ref<NuxtUiInputRef | null>(null)
let previousBodyOverflow = ''

async function handleSubmit() {
  if (!props.open || loading.value) return
  error.value = ''
  const value = input.value.trim()
  if (!value) {
    error.value = '请输入二次密码'
    return
  }

  loading.value = true
  try {
    if (!props.verifyPassword || value !== props.verifyPassword) {
      error.value = '二次密码不正确，请重试'
      return
    }
    emit('verified')
    input.value = ''
  } finally {
    loading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSubmit()
  }
}

function preventScroll(e: Event) {
  e.preventDefault()
}

function lockBodyScroll(locked: boolean) {
  if (!import.meta.client) return

  if (locked) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = previousBodyOverflow
}

watch(
  () => props.open,
  async (open) => {
    lockBodyScroll(open)

    if (!open) {
      input.value = ''
      error.value = ''
      return
    }

    await nextTick()
    const target = inputRef.value?.inputRef
    if (target instanceof HTMLInputElement) {
      target.focus()
      return
    }
    target?.focus?.()
    inputRef.value?.focus?.()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  lockBodyScroll(false)
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="absolute inset-0 z-[40] overflow-hidden"
      @wheel.prevent="preventScroll"
      @touchmove.prevent="preventScroll"
    >
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div class="sticky top-0 flex h-screen items-center justify-center px-4 py-6">
        <UCard
          class="w-full max-w-sm rounded-2xl border border-primary/20 shadow-xl"
          :ui="{
            body: 'space-y-4',
            header: 'pb-1',
            footer: 'pt-3'
          }"
        >
          <template #header>
            <div class="flex items-center gap-3">
              <div class="flex size-9 items-center justify-center rounded-full bg-primary/10">
                <UIcon name="i-lucide-lock" class="size-5 text-primary" />
              </div>
              <div>
                <h2 class="text-base font-semibold leading-tight">
                  二次密码验证
                </h2>
                <p class="mt-0.5 text-xs text-muted">
                  页面已被安全锁定，请输入二次密码继续操作。
                </p>
              </div>
            </div>
          </template>

          <template #default>
            <form class="space-y-3" @submit.prevent="handleSubmit">
              <UFormField label="二次密码" name="verify_password">
                <UInput
                  ref="inputRef"
                  v-model="input"
                  type="password"
                  name="verify_password"
                  placeholder="请输入配置中的二次密码"
                  autocomplete="off"
                  class="w-full"
                  @keydown="handleKeydown"
                />
              </UFormField>
              <p v-if="error" class="text-xs text-error">
                {{ error }}
              </p>
            </form>
          </template>

          <template #footer>
            <UButton
              color="primary"
              :loading="loading"
              label="验证并继续"
              icon="i-lucide-shield-check"
              class="w-full justify-center"
              @click="handleSubmit"
            />
          </template>
        </UCard>
      </div>
    </div>
  </Transition>
</template>
