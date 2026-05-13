import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>
let _db: Db | null = null

const requiredEnv = (key: string): string => {
  const v = process.env[key]
  if (v === undefined || v === '') {
    throw new Error(`缺少环境变量: ${key}，请在对应环境的 .env.* 或系统环境中配置 MySQL 连接信息`)
  }
  return v
}

export function useDb(): Db {
  if (_db) return _db
  const host = requiredEnv('MYSQL_HOST')
  const port = Number(requiredEnv('MYSQL_PORT'))
  const user = requiredEnv('MYSQL_USER')
  const password = requiredEnv('MYSQL_PASSWORD')
  const database = requiredEnv('MYSQL_DATABASE')
  if (Number.isNaN(port) || port <= 0) {
    throw new Error('环境变量 MYSQL_PORT 必须是有效端口号')
  }
  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })
  _db = drizzle<typeof schema>(pool, { schema, mode: 'default' })
  return _db
}
