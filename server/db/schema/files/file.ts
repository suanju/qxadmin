import { index, int, mysqlTable, text, tinyint, unique, varchar } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../../constants'

/** 后台文件分组：用于把上传资源按业务或用途归类 */
export const adminFileGroup = mysqlTable(
  `${tablePrefix}admin_file_group`,
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    description: varchar('description', { length: 255 }).notNull().default(''),
    sort: int('sort').notNull().default(0),
    status: tinyint('status').notNull().default(1),
    created_by: int('created_by').notNull().default(0),
    updated_by: int('updated_by').notNull().default(0),
    created_at: int('created_at').notNull().default(0),
    updated_at: int('updated_at').notNull().default(0)
  },
  (t) => [
    unique(`${tablePrefix}admin_file_group_uk_code`).on(t.code),
    index(`${tablePrefix}admin_file_group_idx_status_sort`).on(t.status, t.sort)
  ]
)

/** 后台文件记录：保存上传文件元数据、存储驱动与上传人 */
export const adminFile = mysqlTable(
  `${tablePrefix}admin_file`,
  {
    id: int('id').primaryKey().autoincrement(),
    group_id: int('group_id').notNull().default(0),
    storage_driver: varchar('storage_driver', { length: 30 }).notNull().default('local'),
    original_name: varchar('original_name', { length: 255 }).notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    ext: varchar('ext', { length: 30 }).notNull().default(''),
    mime: varchar('mime', { length: 100 }).notNull().default(''),
    size: int('size').notNull().default(0),
    hash: varchar('hash', { length: 64 }).notNull().default(''),
    path: varchar('path', { length: 500 }).notNull(),
    public_url: varchar('public_url', { length: 500 }).notNull(),
    kind: varchar('kind', { length: 30 }).notNull().default('file'),
    status: tinyint('status').notNull().default(1),
    uploader_id: int('uploader_id').notNull().default(0),
    uploader_name: varchar('uploader_name', { length: 100 }).notNull().default(''),
    meta_json: text('meta_json'),
    created_at: int('created_at').notNull().default(0),
    updated_at: int('updated_at').notNull().default(0)
  },
  (t) => [
    index(`${tablePrefix}admin_file_idx_group`).on(t.group_id),
    index(`${tablePrefix}admin_file_idx_kind`).on(t.kind),
    index(`${tablePrefix}admin_file_idx_hash`).on(t.hash),
    index(`${tablePrefix}admin_file_idx_uploader`).on(t.uploader_id),
    index(`${tablePrefix}admin_file_idx_status_created`).on(t.status, t.created_at)
  ]
)

export type AdminFileGroup = typeof adminFileGroup.$inferSelect
export type NewAdminFileGroup = typeof adminFileGroup.$inferInsert
export type AdminFile = typeof adminFile.$inferSelect
export type NewAdminFile = typeof adminFile.$inferInsert
