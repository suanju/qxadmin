import { index, int, mysqlTable, text, tinyint, unique, varchar } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../../constants'

/** 后台动态权限目录表：承载目录、菜单、页面、按钮与 API matcher */
export const adminPermission = mysqlTable(
  `${tablePrefix}admin_permission`,
  {
    id: int('id').primaryKey().autoincrement(),
    parent_id: int('parent_id').notNull().default(0),
    type: varchar('type', { length: 20 }).notNull().default('button'),
    code: varchar('code', { length: 100 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }).notNull().default(''),
    module: varchar('module', { length: 50 }).notNull().default(''),
    route_path: varchar('route_path', { length: 255 }).notNull().default(''),
    api_method: varchar('api_method', { length: 10 }).notNull().default(''),
    api_path: varchar('api_path', { length: 255 }).notNull().default(''),
    api_match_type: varchar('api_match_type', { length: 20 }).notNull().default(''),
    component_key: varchar('component_key', { length: 255 }).notNull().default(''),
    active_menu: varchar('active_menu', { length: 255 }).notNull().default(''),
    keepalive: tinyint('keepalive').notNull().default(0),
    icon: varchar('icon', { length: 100 }).notNull().default(''),
    sort: int('sort').notNull().default(0),
    status: tinyint('status').notNull().default(1),
    visible: tinyint('visible').notNull().default(1),
    is_system: tinyint('is_system').notNull().default(0),
    is_high_risk: tinyint('is_high_risk').notNull().default(0),
    data_scope_supported: tinyint('data_scope_supported').notNull().default(0),
    meta_json: text('meta_json'),
    created_by: int('created_by').notNull().default(0),
    updated_by: int('updated_by').notNull().default(0),
    created_at: int('created_at').notNull().default(0),
    updated_at: int('updated_at').notNull().default(0)
  },
  (t) => [
    unique(`${tablePrefix}admin_permission_uk_code`).on(t.code),
    index(`${tablePrefix}admin_permission_idx_parent`).on(t.parent_id),
    index(`${tablePrefix}admin_permission_idx_module`).on(t.module),
    index(`${tablePrefix}admin_permission_idx_type`).on(t.type),
    index(`${tablePrefix}admin_permission_idx_api`).on(t.api_method, t.api_path),
    index(`${tablePrefix}admin_permission_idx_status_sort`).on(t.status, t.sort)
  ]
)

/** 后台权限同步日志：记录 rbac:sync 对权限目录的创建、更新、冲突和禁用 */
export const adminPermissionSyncLog = mysqlTable(
  `${tablePrefix}admin_permission_sync_log`,
  {
    id: int('id').primaryKey().autoincrement(),
    source: varchar('source', { length: 30 }).notNull().default('scanner'),
    action: varchar('action', { length: 30 }).notNull().default(''),
    permission_code: varchar('permission_code', { length: 100 }).notNull().default(''),
    before_data: text('before_data'),
    after_data: text('after_data'),
    message: varchar('message', { length: 500 }).notNull().default(''),
    created_at: int('created_at').notNull().default(0)
  },
  (t) => [
    index(`${tablePrefix}admin_permission_sync_log_idx_code`).on(t.permission_code),
    index(`${tablePrefix}admin_permission_sync_log_idx_action`).on(t.action)
  ]
)

/** 角色数据范围预留表：后续用于本人、部门、部门及以下、自定义数据权限 */
export const adminRoleDataScope = mysqlTable(
  `${tablePrefix}admin_role_data_scope`,
  {
    id: int('id').primaryKey().autoincrement(),
    role_id: int('role_id').notNull(),
    scope_type: varchar('scope_type', { length: 30 }).notNull().default('all'),
    department_ids_json: text('department_ids_json'),
    created_at: int('created_at').notNull().default(0),
    updated_at: int('updated_at').notNull().default(0)
  },
  (t) => [
    unique(`${tablePrefix}admin_role_data_scope_uk_role`).on(t.role_id),
    index(`${tablePrefix}admin_role_data_scope_idx_scope`).on(t.scope_type)
  ]
)

export type AdminPermission = typeof adminPermission.$inferSelect
export type NewAdminPermission = typeof adminPermission.$inferInsert
export type AdminPermissionSyncLog = typeof adminPermissionSyncLog.$inferSelect
export type NewAdminPermissionSyncLog = typeof adminPermissionSyncLog.$inferInsert
export type AdminRoleDataScope = typeof adminRoleDataScope.$inferSelect
export type NewAdminRoleDataScope = typeof adminRoleDataScope.$inferInsert
