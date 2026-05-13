<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  compact?: boolean
}>(), {
  title: '加载中...',
  description: '',
  compact: false
})
</script>

<template>
  <div :class="['admin-loading-state', compact ? 'is-compact' : '']">
    <span class="admin-loading-ring" aria-hidden="true">
      <span />
    </span>
    <div class="min-w-0 text-center">
      <p class="text-sm font-medium text-highlighted">{{ title }}</p>
      <p v-if="description" class="mt-1 text-xs text-muted">{{ description }}</p>
    </div>
    <div class="admin-loading-lines" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  </div>
</template>

<style scoped>
.admin-loading-state {
  display: flex;
  min-width: min(22rem, 100%);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 72%, transparent);
  border-radius: 0.5rem;
  background: #fff;
  padding: 2rem;
  box-shadow:
    0 1px 0 color-mix(in srgb, white 70%, transparent) inset,
    0 14px 30px color-mix(in srgb, black 4%, transparent);
}

.admin-loading-state.is-compact {
  min-width: 0;
  width: min(18rem, 100%);
  gap: 0.625rem;
  padding: 1.5rem;
}

.admin-loading-ring {
  position: relative;
  display: inline-flex;
  width: 3rem;
  height: 3rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: linear-gradient(180deg, rgb(248 250 252), #fff);
  box-shadow:
    0 0 0 1px rgb(226 232 240) inset,
    0 10px 24px rgb(15 23 42 / 0.06);
}

.admin-loading-ring::before {
  position: absolute;
  inset: 0.45rem;
  border: 2px solid rgb(226 232 240);
  border-top-color: rgb(100 116 139);
  border-radius: inherit;
  animation: admin-loading-spin 820ms linear infinite;
  content: "";
}

.admin-loading-ring span {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: rgb(148 163 184);
  box-shadow: 0 0 0 0.25rem rgb(241 245 249);
}

.admin-loading-lines {
  display: grid;
  width: min(14rem, 100%);
  gap: 0.375rem;
}

.admin-loading-lines span {
  height: 0.375rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(241 245 249);
}

.admin-loading-lines span::after {
  display: block;
  width: 42%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, transparent, rgb(203 213 225), transparent);
  animation: admin-loading-sweep 1.2s ease-in-out infinite;
  content: "";
}

.admin-loading-lines span:nth-child(2) {
  width: 78%;
  margin-inline: auto;
}

.admin-loading-lines span:nth-child(3) {
  width: 54%;
  margin-inline: auto;
}

.dark .admin-loading-state {
  background: var(--background-color-elevated);
  box-shadow:
    0 1px 0 color-mix(in srgb, white 8%, transparent) inset,
    0 18px 44px color-mix(in srgb, black 22%, transparent);
}

.dark .admin-loading-ring {
  background: color-mix(in srgb, var(--background-color-elevated) 88%, white);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--ui-border) 84%, transparent) inset,
    0 12px 28px color-mix(in srgb, black 28%, transparent);
}

.dark .admin-loading-ring::before {
  border-color: color-mix(in srgb, var(--ui-border) 70%, transparent);
  border-top-color: rgb(148 163 184);
}

.dark .admin-loading-ring span {
  background: rgb(148 163 184);
  box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--ui-border) 58%, transparent);
}

.dark .admin-loading-lines span {
  background: color-mix(in srgb, var(--ui-border) 42%, transparent);
}

.dark .admin-loading-lines span::after {
  background: linear-gradient(90deg, transparent, rgb(148 163 184 / 0.72), transparent);
}

@keyframes admin-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes admin-loading-sweep {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(250%);
  }
}
</style>
