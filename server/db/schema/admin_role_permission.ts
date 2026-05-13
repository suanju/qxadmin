import { index, int, mysqlTable, unique, varchar } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../constants'

/** 后台角色权限关联表：兼容旧 permission_code，并逐步迁移到动态权限 permission_id */
export const adminRolePermission = mysqlTable(
  `${tablePrefix}admin_role_permission`,
  {
    id: int('id').primaryKey().autoincrement(),
    role_id: int('role_id').notNull(),
    permission_id: int('permission_id').notNull().default(0),
    permission_code: varchar('permission_code', { length: 100 }).notNull(),
    created_at: int('created_at').notNull().default(0)
  },
  (t) => [
    unique(`${tablePrefix}admin_role_permission_uk_role_code`).on(t.role_id, t.permission_code),
    index(`${tablePrefix}admin_role_permission_idx_permission`).on(t.permission_id),
    index(`${tablePrefix}admin_role_permission_idx_code`).on(t.permission_code)
  ]
)

export type AdminRolePermission = typeof adminRolePermission.$inferSelect
export type NewAdminRolePermission = typeof adminRolePermission.$inferInsert
