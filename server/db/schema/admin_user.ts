import { index, int, mysqlTable, tinyint, unique, varchar } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../constants'

/** 后台管理员账户表：保存分账户登录、禁用、token 版本与最近登录信息 */
export const adminUser = mysqlTable(
  `${tablePrefix}admin_user`,
  {
    id: int('id').primaryKey().autoincrement(),
    username: varchar('username', { length: 50 }).notNull(),
    display_name: varchar('display_name', { length: 100 }).notNull().default(''),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    status: tinyint('status').notNull().default(1),
    is_super_admin: tinyint('is_super_admin').notNull().default(0),
    token_version: int('token_version').notNull().default(1),
    last_login_at: int('last_login_at').notNull().default(0),
    last_login_ip: varchar('last_login_ip', { length: 45 }).notNull().default(''),
    password_changed_at: int('password_changed_at').notNull().default(0),
    created_by: int('created_by').notNull().default(0),
    updated_by: int('updated_by').notNull().default(0),
    created_at: int('created_at').notNull().default(0),
    updated_at: int('updated_at').notNull().default(0)
  },
  (t) => [
    unique(`${tablePrefix}admin_user_uk_username`).on(t.username),
    index(`${tablePrefix}admin_user_idx_status`).on(t.status)
  ]
)

export type AdminUser = typeof adminUser.$inferSelect
export type NewAdminUser = typeof adminUser.$inferInsert
