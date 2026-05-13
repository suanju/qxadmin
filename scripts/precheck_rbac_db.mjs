import { config as loadEnv } from 'dotenv'
import mysql from 'mysql2/promise'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH || '.env.development', quiet: true })

const requiredEnvKeys = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
for (const key of requiredEnvKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const tablePrefix = (process.env.TABLE_PREFIX || 'ta_').replace(/_?$/, '_')
const expectedTables = ['admin_user', 'admin_role', 'admin_user_role', 'admin_role_permission']
  .map((name) => `${tablePrefix}${name}`)

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
})

try {
  const [rows] = await connection.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?) ORDER BY TABLE_NAME',
    [expectedTables]
  )
  const foundTables = new Set(rows.map((row) => row.TABLE_NAME))
  const missingTables = expectedTables.filter((tableName) => !foundTables.has(tableName))

  console.log(`RBAC expected tables: ${expectedTables.length}`)
  console.log(`RBAC existing tables: ${foundTables.size}`)

  if (missingTables.length > 0) {
    for (const tableName of missingTables) {
      console.log(`MISSING ${tableName}`)
    }
    process.exitCode = 1
  } else {
    console.log('RBAC database precheck passed.')
  }
} finally {
  await connection.end()
}
