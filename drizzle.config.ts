import { resolve } from 'path'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

const nodeEnv = process.env.NODE_ENV || 'development'
const envFile =
  process.env.DOTENV_CONFIG_PATH ||
  (nodeEnv === 'production' ? '.env.production' : '.env.development')

loadEnv({ path: resolve(process.cwd(), envFile) })

function requiredEnv(key: string): string {
  const v = process.env[key]
  if (v === undefined || v === '') {
    throw new Error(`缺少环境变量: ${key}，请在对应环境的 .env.* 或系统环境中配置 MySQL 连接信息`)
  }
  return v
}

const port = Number(requiredEnv('MYSQL_PORT'))
if (Number.isNaN(port) || port <= 0) {
  throw new Error('环境变量 MYSQL_PORT 必须是有效端口号')
}

export default defineConfig({
  schema: './server/db/schema/index.ts',
  out: './server/db/migrations',
  dialect: 'mysql',
  dbCredentials: {
    host: requiredEnv('MYSQL_HOST'),
    port,
    user: requiredEnv('MYSQL_USER'),
    password: requiredEnv('MYSQL_PASSWORD'),
    database: requiredEnv('MYSQL_DATABASE')
  }
})
