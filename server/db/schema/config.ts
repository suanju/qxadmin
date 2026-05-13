import { mysqlTable, varchar, int, text, unique } from 'drizzle-orm/mysql-core'
import { tablePrefix } from '../constants'

/** 系统配置表：按 group 分组，type 为 string|text|int|bool|array|datetime|date|file|image */
export const config = mysqlTable(
  `${tablePrefix}config`,
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 30 }).notNull(),
    group: varchar('group', { length: 30 }).notNull().default(''),
    title: varchar('title', { length: 100 }).notNull().default(''),
    tip: varchar('tip', { length: 100 }).notNull().default(''),
    type: varchar('type', { length: 30 }).notNull().default('string'),
    value: text('value')
  },
  (t) => [unique(`${tablePrefix}config_uk_name`).on(t.name)]
)

export type Config = typeof config.$inferSelect
export type NewConfig = typeof config.$inferInsert
