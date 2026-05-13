import { index, int, mysqlTable, tinyint, unique, varchar } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../constants'

/** 后台角色表：保存角色编码、展示名称、状态与系统内置标记 */
export const adminRole = mysqlTable(
  `${tablePrefix}admin_role`,
  {
    id: int('id').primaryKey().autoincrement(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }).notNull().default(''),
    status: tinyint('status').notNull().default(1),
    is_system: tinyint('is_system').notNull().default(0),
    sort: int('sort').notNull().default(0),
    created_by: int('created_by').notNull().default(0),
    updated_by: int('updated_by').notNull().default(0),
    created_at: int('created_at').notNull().default(0),
    updated_at: int('updated_at').notNull().default(0)
  },
  (t) => [
    unique(`${tablePrefix}admin_role_uk_code`).on(t.code),
    index(`${tablePrefix}admin_role_idx_status`).on(t.status),
    index(`${tablePrefix}admin_role_idx_sort`).on(t.sort)
  ]
)

export type AdminRole = typeof adminRole.$inferSelect
export type NewAdminRole = typeof adminRole.$inferInsert
