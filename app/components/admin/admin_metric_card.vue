<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string | number
  helper?: string
  icon?: string
  iconClass?: string
  valueClass?: string
}>(), {
  helper: '',
  icon: '',
  iconClass: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800/70',
  valueClass: 'text-highlighted'
})
</script>

<template>
  <article class="admin-metric-card">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          {{ label }}
        </p>
        <p class="mt-3 truncate text-2xl font-semibold tabular-nums" :class="valueClass">
          {{ value }}
        </p>
        <p v-if="helper" class="mt-2 text-xs text-muted">
          {{ helper }}
        </p>
      </div>
      <span v-if="icon" class="admin-metric-icon" :class="iconClass">
        <UIcon :name="icon" class="size-5" />
      </span>
    </div>
  </article>
</template>

<style scoped>
.admin-metric-card {
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 0.5rem;
  background: #fff;
  padding: 1rem;
  box-shadow:
    0 1px 0 color-mix(in srgb, white 66%, transparent) inset,
    0 14px 30px color-mix(in srgb, black 5%, transparent),
    0 34px 70px color-mix(in srgb, black 4%, transparent);
  transform: translateZ(0);
  transform-style: preserve-3d;
  transition:
    transform 220ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.admin-metric-card::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(135deg, color-mix(in srgb, white 46%, transparent), transparent 35%);
  content: "";
}

.admin-metric-card > * {
  position: relative;
  z-index: 1;
}

.admin-metric-card:hover {
  transform: translateY(-3px) rotateX(1deg);
  border-color: color-mix(in srgb, var(--ui-border) 78%, var(--ui-text-muted));
  box-shadow:
    0 1px 0 color-mix(in srgb, white 72%, transparent) inset,
    0 18px 36px color-mix(in srgb, black 8%, transparent),
    0 42px 88px color-mix(in srgb, black 5%, transparent);
}

.admin-metric-icon {
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 0.5rem;
}

.dark .admin-metric-card {
  background: var(--background-color-elevated);
  box-shadow:
    0 1px 0 color-mix(in srgb, white 8%, transparent) inset,
    0 18px 44px color-mix(in srgb, black 24%, transparent);
}

.dark .admin-metric-card::before {
  background: linear-gradient(135deg, color-mix(in srgb, white 8%, transparent), transparent 32%);
}
</style>
