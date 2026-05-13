import { and, count, desc, eq, gte, like } from 'drizzle-orm'
import { useDb } from '#server/db'
import { adminOperationLog, adminRole, adminUser, config as configTable } from '#server/db/schema'

export interface AdminDashboardSummaryCard {
  key: string
  label: string
  value: number
  description: string
  trend?: string
}

export interface AdminDashboardActivityItem {
  id: number
  eventType: string
  eventCategory: string
  operatorName: string
  targetName: string
  result: number
  createdAt: number
}

export interface AdminDashboardStats {
  summaryCards: AdminDashboardSummaryCard[]
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
  latestActivities: AdminDashboardActivityItem[]
}

function getTodayStartTs(): number {
  const now = new Date()
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000)
}

function getRecentDaysStartTs(days: number): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Math.max(days - 1, 0))
  return Math.floor(start.getTime() / 1000)
}

function toNumber(value: unknown): number {
  const normalized = Number(value ?? 0)
  return Number.isFinite(normalized) ? normalized : 0
}

/**
 * 返回 admin 内核首页统计，只依赖管理员、角色、配置与审计日志。
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const db = useDb()
  const todayStartTs = getTodayStartTs()
  const recentWindowStartTs = getRecentDaysStartTs(7)

  const [
    activeAdminRow,
    superAdminRow,
    enabledRoleRow,
    totalLogRow,
    failedLogRow,
    todayLoginRow,
    totalConfigRow,
    distinctGroupRow,
    recentConfigChangeRow,
    latestActivityRows
  ] = await Promise.all([
    db.select({ count: count() }).from(adminUser).where(eq(adminUser.status, 1)).then((rows) => rows[0]),
    db.select({ count: count() }).from(adminUser).where(and(eq(adminUser.status, 1), eq(adminUser.is_super_admin, 1))).then((rows) => rows[0]),
    db.select({ count: count() }).from(adminRole).where(eq(adminRole.status, 1)).then((rows) => rows[0]),
    db.select({ count: count() }).from(adminOperationLog).then((rows) => rows[0]),
    db.select({ count: count() }).from(adminOperationLog).where(eq(adminOperationLog.result, 0)).then((rows) => rows[0]),
    db.select({ count: count() }).from(adminOperationLog).where(
      and(
        eq(adminOperationLog.event_category, 'login'),
        gte(adminOperationLog.created_at, todayStartTs)
      )
    ).then((rows) => rows[0]),
    db.select({ count: count() }).from(configTable).then((rows) => rows[0]),
    db.select({ count: count(configTable.group) }).from(configTable).then((rows) => rows[0]),
    db.select({ count: count() }).from(adminOperationLog).where(
      and(
        like(adminOperationLog.event_type, 'config.%'),
        gte(adminOperationLog.created_at, recentWindowStartTs)
      )
    ).then((rows) => rows[0]),
    db.select({
      id: adminOperationLog.id,
      eventType: adminOperationLog.event_type,
      eventCategory: adminOperationLog.event_category,
      operatorName: adminOperationLog.operator_name,
      targetName: adminOperationLog.target_name,
      result: adminOperationLog.result,
      createdAt: adminOperationLog.created_at
    })
      .from(adminOperationLog)
      .orderBy(desc(adminOperationLog.id))
      .limit(8)
  ])

  const activeAdminCount = toNumber(activeAdminRow?.count)
  const superAdminCount = toNumber(superAdminRow?.count)
  const enabledRoleCount = toNumber(enabledRoleRow?.count)
  const totalLogs = toNumber(totalLogRow?.count)
  const failedLogs = toNumber(failedLogRow?.count)
  const todayLoginCount = toNumber(todayLoginRow?.count)
  const totalConfigs = toNumber(totalConfigRow?.count)
  const distinctGroups = toNumber(distinctGroupRow?.count)
  const recentConfigChanges = toNumber(recentConfigChangeRow?.count)

  return {
    summaryCards: [
      {
        key: 'active_admins',
        label: '启用管理员',
        value: activeAdminCount,
        description: '当前状态为启用的后台账号数',
        trend: `其中超级管理员 ${superAdminCount} 个`
      },
      {
        key: 'enabled_roles',
        label: '启用角色',
        value: enabledRoleCount,
        description: '当前可分配的后台角色数',
        trend: '角色模型已收敛为 admin 内核能力'
      },
      {
        key: 'today_logins',
        label: '今日登录',
        value: todayLoginCount,
        description: '按审计日志统计的当日登录次数',
        trend: '用于观察后台活跃度'
      },
      {
        key: 'total_logs',
        label: '审计日志',
        value: totalLogs,
        description: '后台累计记录的操作日志总量',
        trend: `失败记录 ${failedLogs} 条`
      },
      {
        key: 'recent_config_changes',
        label: '近 7 天配置变更',
        value: recentConfigChanges,
        description: '系统配置相关的近期变更次数',
        trend: `配置项总数 ${totalConfigs} 条`
      },
      {
        key: 'config_groups',
        label: '配置分组',
        value: distinctGroups,
        description: '当前配置表中的分组数量',
        trend: '建议继续清理业务残留配置'
      }
    ],
    loginStats: {
      todayLoginCount,
      activeAdminCount,
      superAdminCount
    },
    settingsStats: {
      totalConfigs,
      distinctGroups,
      recentConfigChanges
    },
    auditStats: {
      totalLogs,
      failedLogs
    },
    latestActivities: latestActivityRows
  }
}
