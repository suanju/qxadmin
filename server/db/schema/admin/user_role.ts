import { index, int, mysqlTable, unique } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../../constants'

/** 后台管理员与角色关联表 */
export const adminUserRole = mysqlTable(
  `${tablePrefix}admin_user_role`,
  {
    id: int('id').primaryKey().autoincrement(),
    user_id: int('user_id').notNull(),
    role_id: int('role_id').notNull(),
    created_at: int('created_at').notNull().default(0)
  },
  (t) => [
    unique(`${tablePrefix}admin_user_role_uk_user_role`).on(t.user_id, t.role_id),
    index(`${tablePrefix}admin_user_role_idx_role`).on(t.role_id)
  ]
)

export type AdminUserRole = typeof adminUserRole.$inferSelect
export type NewAdminUserRole = typeof adminUserRole.$inferInsert
