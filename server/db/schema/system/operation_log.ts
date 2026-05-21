import { mysqlTable, int, varchar, text, json, tinyint } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../../constants'

/** 后台操作日志：记录管理员在后台的关键操作以及变更明细 */
export const adminOperationLog = mysqlTable(`${tablePrefix}admin_operation_log`, {
  id: int('id').primaryKey().autoincrement(),
  trace_id: varchar('trace_id', { length: 64 }).notNull().default(''),
  operator_type: varchar('operator_type', { length: 30 }).notNull().default('admin'),
  operator_id: varchar('operator_id', { length: 64 }).notNull().default(''),
  operator_name: varchar('operator_name', { length: 100 }).notNull().default(''),
  event_type: varchar('event_type', { length: 64 }).notNull().default(''),
  event_category: varchar('event_category', { length: 30 }).notNull().default(''),
  target_type: varchar('target_type', { length: 50 }).notNull().default(''),
  target_id: varchar('target_id', { length: 64 }).notNull().default(''),
  target_name: varchar('target_name', { length: 255 }).notNull().default(''),
  detail: text('detail'),
  request_method: varchar('request_method', { length: 10 }).notNull().default(''),
  request_path: varchar('request_path', { length: 255 }).notNull().default(''),
  request_query: json('request_query'),
  request_body: json('request_body'),
  before_data: json('before_data'),
  after_data: json('after_data'),
  change_items: json('change_items'),
  result: tinyint('result').notNull().default(1),
  status_code: int('status_code').notNull().default(200),
  duration_ms: int('duration_ms').notNull().default(0),
  error_message: varchar('error_message', { length: 500 }).notNull().default(''),
  ip: varchar('ip', { length: 45 }).notNull().default(''),
  user_agent: varchar('user_agent', { length: 255 }).notNull().default(''),
  created_at: int('created_at').notNull().default(0)
})

export type AdminOperationLog = typeof adminOperationLog.$inferSelect
export type NewAdminOperationLog = typeof adminOperationLog.$inferInsert
