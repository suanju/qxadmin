<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

interface AdminPageHeaderState {
  activePath: string | null
  ownerId: string | null
}

interface Props {
  title: string
  description?: string
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  description: undefined,
  icon: 'i-lucide-file-text'
})

const route = useRoute()
const { navGroups, navItems } = useAdminAuth()
const headerState = useState<AdminPageHeaderState>('admin-page-header-state', () => ({
  activePath: null,
  ownerId: null
}))
const ownerId = `admin-page-header-${Math.random().toString(36).slice(2)}`
const currentNavItem = computed(() =>
  navItems.value.find(
    (item) => route.path === item.to || route.path.startsWith(`${item.to}/`)
  )
)
const currentNavGroup = computed(() =>
  navGroups.value.find((group) => group.key === currentNavItem.value?.menuKey)
)
const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = []
  const sectionLabel = currentNavItem.value?.menuName?.trim()
  const titleLabel = props.title.trim()

  if (sectionLabel) {
    items.push({
      label: sectionLabel,
      icon: currentNavGroup.value?.icon
    })
  }

  if (!sectionLabel || sectionLabel !== titleLabel) {
    items.push({
      label: titleLabel,
      icon: currentNavItem.value?.icon || props.icon
    })
  }

  return items
})

function activateHeader(path: string) {
  headerState.value = {
    activePath: path,
    ownerId
  }
}

activateHeader(route.fullPath)

watch(
  () => route.fullPath,
  (path) => {
    activateHeader(path)
  }
)

onBeforeUnmount(() => {
  if (headerState.value.ownerId !== ownerId) return

  headerState.value = {
    activePath: null,
    ownerId: null
  }
})
</script>

<template>
  <Teleport to="#admin-page-header-main">
    <div class="min-w-0 flex-1">
      <UBreadcrumb
        :items="breadcrumbItems"
        separator-icon="i-lucide-chevron-right"
        :ui="{
          root: 'min-w-0',
          list: 'flex-wrap gap-1.5',
          item: 'min-w-0',
          link: 'text-sm font-medium text-muted',
          linkLeadingIcon: 'size-4 shrink-0 text-muted',
          linkLabel: 'truncate',
          separator: 'mx-1 text-muted/70'
        }"
      />
    </div>
  </Teleport>

  <Teleport v-if="$slots.actions" to="#admin-page-header-actions">
    <div class="flex flex-wrap items-center gap-2 sm:justify-end">
      <slot name="actions" />
    </div>
  </Teleport>
</template>
