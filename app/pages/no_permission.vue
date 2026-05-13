<script setup lang="ts">
definePageMeta({ layout: 'default' })

const router = useRouter()
const { navItems, can } = useAdminAuth()
const availableNavItems = computed(() => navItems.value.slice(0, 6))
const canViewAdminAccounts = computed(() => can('admin_accounts.read'))

function goAvailablePage() {
  const first = navItems.value[0]
  router.push(first?.to || '/dashboard')
}

useHead({ title: '无权限' })
</script>

<template>
  <div class="relative min-h-[calc(100vh-8rem)] overflow-hidden p-6 md:p-8">
    <div class="pointer-events-none absolute inset-0 opacity-70">
      <div class="absolute -left-32 -top-24 size-72 rounded-full bg-warning/10 blur-3xl" />
      <div class="absolute -bottom-32 -right-16 size-80 rounded-full bg-primary/10 blur-3xl" />
    </div>

    <div class="relative mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl items-center">
      <div class="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_24rem]">
        <section class="rounded-[28px] border border-default/60 bg-elevated/95 p-8 shadow-xl backdrop-blur">
          <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
            <UIcon name="i-lucide-lock-keyhole" class="size-3.5" />
            访问受限
          </div>

          <div class="flex flex-col gap-5 md:flex-row md:items-start">
            <div class="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-warning/10 ring-1 ring-warning/20">
              <UIcon name="i-lucide-shield-alert" class="size-9 text-warning" />
            </div>

            <div class="min-w-0 flex-1">
              <h1 class="text-3xl font-semibold tracking-tight text-highlighted">当前页面未授权</h1>
              <p class="mt-3 max-w-2xl text-sm leading-7 text-muted">
                当前登录账号没有访问这个后台模块的权限。通常是角色尚未分配、角色未启用，或该账号不在当前模块的授权范围内。
              </p>

              <div class="mt-6 flex flex-wrap gap-3">
                <UButton color="primary" icon="i-lucide-arrow-left" @click="goAvailablePage">
                  返回可访问页面
                </UButton>
                <UButton v-if="canViewAdminAccounts" color="neutral" variant="subtle" icon="i-lucide-users" to="/admin_accounts">
                  前往管理员账户
                </UButton>
              </div>
            </div>
          </div>
        </section>

        <aside class="rounded-[28px] border border-default/60 bg-default/90 p-6 shadow-lg backdrop-blur">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-highlighted">你当前可访问的模块</div>
              <p class="mt-1 text-xs leading-5 text-muted">可先返回这些页面继续处理业务。</p>
            </div>
            <UBadge color="neutral" variant="subtle">{{ navItems.length }} 项</UBadge>
          </div>

          <div class="mt-5 space-y-3">
            <NuxtLink
              v-for="item in availableNavItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-2xl border border-default/60 bg-muted/20 px-4 py-3 transition-colors hover:border-primary/35 hover:bg-primary/5"
            >
              <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UIcon :name="item.icon" class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-highlighted">{{ item.label }}</div>
                <div class="text-xs text-muted">{{ item.to }}</div>
              </div>
              <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
            </NuxtLink>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
