<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  description?: string
  icon?: string
  badge?: string
  bodyClass?: string
}>(), {
  title: '',
  description: '',
  icon: '',
  badge: '',
  bodyClass: 'p-4 sm:p-5'
})
</script>

<template>
  <section class="admin-data-panel">
    <div v-if="title || $slots.header || $slots.actions" class="admin-data-panel-header">
      <slot name="header">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-base font-semibold text-highlighted">
            <span v-if="icon" class="admin-data-panel-icon">
              <UIcon :name="icon" class="size-4" />
            </span>
            {{ title }}
          </h2>
          <p v-if="description" class="mt-1 text-xs text-muted">
            {{ description }}
          </p>
        </div>
      </slot>

      <div v-if="badge || $slots.actions" class="flex flex-wrap items-center justify-end gap-2">
        <span v-if="badge" class="admin-data-panel-badge">{{ badge }}</span>
        <slot name="actions" />
      </div>
    </div>

    <div :class="props.bodyClass">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.admin-data-panel {
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 0.5rem;
  background: #fff;
  box-shadow:
    0 1px 0 color-mix(in srgb, white 66%, transparent) inset,
    0 14px 30px color-mix(in srgb, black 5%, transparent),
    0 34px 70px color-mix(in srgb, black 4%, transparent);
}

.admin-data-panel::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(135deg, color-mix(in srgb, white 46%, transparent), transparent 35%);
  content: "";
}

.admin-data-panel > * {
  position: relative;
  z-index: 1;
}

.admin-data-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 64%, transparent);
  padding: 1rem 1.25rem 0.875rem;
}

.admin-data-panel-icon {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--ui-primary) 8%, white);
  color: var(--ui-primary);
}

.admin-data-panel-badge {
  border-radius: 999px;
  background: color-mix(in srgb, var(--background-color) 72%, var(--ui-border));
  padding: 0.25rem 0.625rem;
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.dark .admin-data-panel {
  background: var(--background-color-elevated);
  box-shadow:
    0 1px 0 color-mix(in srgb, white 8%, transparent) inset,
    0 18px 44px color-mix(in srgb, black 24%, transparent);
}

.dark .admin-data-panel::before {
  background: linear-gradient(135deg, color-mix(in srgb, white 8%, transparent), transparent 32%);
}

.dark .admin-data-panel-icon {
  background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
}

@media (max-width: 640px) {
  .admin-data-panel-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
