<script setup lang="ts">
definePageMeta({ layout: 'default' })

interface DashboardSummaryCard {
  key: string
  label: string
  value: number
  description: string
  trend?: string
}

interface DashboardActivityItem {
  id: number
  eventType: string
  eventCategory: string
  operatorName: string
  targetName: string
  result: number
  createdAt: number
}

interface DashboardStatsResponse {
  summaryCards: DashboardSummaryCard[]
  loginStats: {
    todayLoginCount: number
    activeAdminCount: number
    superAdminCount: number
  }
  settingsStats: {
    totalConfigs: number
    distinctGroups: number
    recentConfigChanges: number
  }
  auditStats: {
    totalLogs: number
    failedLogs: number
  }
  latestActivities: DashboardActivityItem[]
}

const { adminFetch } = useAdminFetch()

const loading = ref(true)
const stats = ref<DashboardStatsResponse | null>(null)

function formatTime(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function resultLabel(result: number): string {
  return result === 1 ? '成功' : '失败'
}

function resultColor(result: number): 'success' | 'error' {
  return result === 1 ? 'success' : 'error'
}

function categoryLabel(category: string): string {
  if (category === 'login') return '登录'
  if (category === 'create') return '新增'
  if (category === 'update') return '修改'
  if (category === 'delete') return '删除'
  return category || '操作'
}

async function fetchDashboard() {
  loading.value = true
  try {
    stats.value = await adminFetch<DashboardStatsResponse>('/api/admin/dashboard/stats')
  } finally {
    loading.value = false
  }
}

onMounted(fetchDashboard)

useHead({
  title: '后台概览'
})
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold text-highlighted">
        Admin Core Dashboard
      </h1>
      <p class="max-w-3xl text-sm leading-6 text-muted">
        当前首页已收敛为后台基础设施概览，只展示管理员、角色、配置和审计相关指标。
      </p>
    </div>

    <div
      v-if="loading"
      class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <USkeleton
        v-for="item in 6"
        :key="item"
        class="h-36 rounded-2xl"
      />
    </div>

    <template v-else-if="stats">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UCard
          v-for="card in stats.summaryCards"
          :key="card.key"
          :ui="{
            root: 'rounded-2xl border border-default/70',
            body: 'space-y-4 p-5'
          }"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm text-muted">
                {{ card.label }}
              </div>
              <div class="mt-2 text-3xl font-semibold text-highlighted">
                {{ card.value }}
              </div>
            </div>
            <div class="rounded-xl bg-primary/8 p-2 text-primary">
              <UIcon name="i-lucide-shield-check" class="size-5" />
            </div>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-toned">
              {{ card.description }}
            </p>
            <p
              v-if="card.trend"
              class="text-xs text-muted"
            >
              {{ card.trend }}
            </p>
          </div>
        </UCard>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <UCard
          :ui="{
            root: 'rounded-2xl border border-default/70',
            body: 'space-y-5 p-5'
          }"
        >
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  最近操作
                </h2>
                <p class="text-sm text-muted">
                  最近 8 条后台审计记录，用于快速判断近期的账号、配置与权限动作。
                </p>
              </div>
            </div>
          </template>

          <div
            v-if="stats.latestActivities.length === 0"
            class="rounded-2xl border border-dashed border-default px-4 py-8 text-center text-sm text-muted"
          >
            暂无操作日志
          </div>

          <div
            v-else
            class="space-y-3"
          >
            <div
              v-for="item in stats.latestActivities"
              :key="item.id"
              class="flex flex-col gap-3 rounded-2xl border border-default/60 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge
                    :color="resultColor(item.result)"
                    variant="soft"
                    size="sm"
                  >
                    {{ resultLabel(item.result) }}
                  </UBadge>
                  <UBadge color="neutral" variant="subtle" size="sm">
                    {{ categoryLabel(item.eventCategory) }}
                  </UBadge>
                  <span class="text-sm font-medium text-highlighted">
                    {{ item.eventType }}
                  </span>
                </div>

                <p class="truncate text-sm text-toned">
                  操作人：{{ item.operatorName || '未知管理员' }}，对象：{{ item.targetName || '未命名对象' }}
                </p>
              </div>

              <div class="text-xs text-muted">
                {{ formatTime(item.createdAt) }}
              </div>
            </div>
          </div>
        </UCard>

        <div class="space-y-4">
          <UCard
            :ui="{
              root: 'rounded-2xl border border-default/70',
              body: 'space-y-4 p-5'
            }"
          >
            <template #header>
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  登录与账号
                </h2>
                <p class="text-sm text-muted">
                  后台账号活跃情况
                </p>
              </div>
            </template>

            <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div class="rounded-2xl bg-muted/40 p-4">
                <div class="text-xs text-muted">
                  今日登录
                </div>
                <div class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ stats.loginStats.todayLoginCount }}
                </div>
              </div>
              <div class="rounded-2xl bg-muted/40 p-4">
                <div class="text-xs text-muted">
                  启用管理员
                </div>
                <div class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ stats.loginStats.activeAdminCount }}
                </div>
              </div>
              <div class="rounded-2xl bg-muted/40 p-4">
                <div class="text-xs text-muted">
                  超级管理员
                </div>
                <div class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ stats.loginStats.superAdminCount }}
                </div>
              </div>
            </div>
          </UCard>

          <UCard
            :ui="{
              root: 'rounded-2xl border border-default/70',
              body: 'space-y-4 p-5'
            }"
          >
            <template #header>
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  配置与审计
                </h2>
                <p class="text-sm text-muted">
                  重点关注配置变化和审计失败
                </p>
              </div>
            </template>

            <div class="space-y-3">
              <div class="flex items-center justify-between rounded-2xl border border-default/60 px-4 py-3">
                <span class="text-sm text-toned">配置项总数</span>
                <span class="text-sm font-semibold text-highlighted">{{ stats.settingsStats.totalConfigs }}</span>
              </div>
              <div class="flex items-center justify-between rounded-2xl border border-default/60 px-4 py-3">
                <span class="text-sm text-toned">配置分组数</span>
                <span class="text-sm font-semibold text-highlighted">{{ stats.settingsStats.distinctGroups }}</span>
              </div>
              <div class="flex items-center justify-between rounded-2xl border border-default/60 px-4 py-3">
                <span class="text-sm text-toned">近 7 天配置变更</span>
                <span class="text-sm font-semibold text-highlighted">{{ stats.settingsStats.recentConfigChanges }}</span>
              </div>
              <div class="flex items-center justify-between rounded-2xl border border-default/60 px-4 py-3">
                <span class="text-sm text-toned">失败日志数</span>
                <span class="text-sm font-semibold text-highlighted">{{ stats.auditStats.failedLogs }}</span>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </div>
</template>
