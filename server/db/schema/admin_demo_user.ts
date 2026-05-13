import { index, int, mysqlTable, tinyint, unique, varchar } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../constants'

/** 示例用户表：用于展示 admin 列表页、统一表单弹窗与批量操作样式 */
export const adminDemoUser = mysqlTable(
  `${tablePrefix}admin_demo_user`,
  {
    id: int('id').primaryKey().autoincrement(),
    username: varchar('username', { length: 50 }).notNull(),
    nickname: varchar('nickname', { length: 100 }).notNull().default(''),
    email: varchar('email', { length: 120 }).notNull().default(''),
    mobile: varchar('mobile', { length: 30 }).notNull().default(''),
    department: varchar('department', { length: 100 }).notNull().default(''),
    role_name: varchar('role_name', { length: 100 }).notNull().default('普通用户'),
    status: tinyint('status').notNull().default(1),
    source: varchar('source', { length: 50 }).notNull().default('manual'),
    remark: varchar('remark', { length: 255 }).notNull().default(''),
    last_active_at: int('last_active_at').notNull().default(0),
    created_by: int('created_by').notNull().default(0),
    updated_by: int('updated_by').notNull().default(0),
    created_at: int('created_at').notNull().default(0),
    updated_at: int('updated_at').notNull().default(0)
  },
  (t) => [
    unique(`${tablePrefix}admin_demo_user_uk_username`).on(t.username),
    index(`${tablePrefix}admin_demo_user_idx_status`).on(t.status),
    index(`${tablePrefix}admin_demo_user_idx_created`).on(t.created_at)
  ]
)

export type AdminDemoUser = typeof adminDemoUser.$inferSelect
export type NewAdminDemoUser = typeof adminDemoUser.$inferInsert
