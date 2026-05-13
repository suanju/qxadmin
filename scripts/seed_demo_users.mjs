import { config as loadEnv } from 'dotenv'
import mysql from 'mysql2/promise'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH || '.env.development', quiet: true })

function requiredEnv(key) {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function tablePrefix() {
  return (process.env.TABLE_PREFIX || 'ta_').replace(/_?$/, '_')
}

function table(name) {
  return `\`${tablePrefix()}${name}\``
}

const demoUsers = [
  ['alice', 'Alice Chen', 'alice@example.com', '13800010001', '运营中心', '运营专员', 1, 'seed', '负责内容审核'],
  ['bruce', 'Bruce Lin', 'bruce@example.com', '13800010002', '客服中心', '客服主管', 1, 'seed', '跟进用户反馈'],
  ['cindy', 'Cindy Wang', 'cindy@example.com', '13800010003', '财务部', '财务观察员', 0, 'seed', '演示禁用状态'],
  ['david', 'David Zhao', 'david@example.com', '13800010004', '技术部', '系统观察员', 1, 'seed', '用于表格展示'],
  ['emily', 'Emily Wu', 'emily@example.com', '13800010005', '市场部', '市场助理', 1, 'seed', '演示批量操作'],
  ['frank', 'Frank He', 'frank@example.com', '13800010006', '运营中心', '运营主管', 1, 'seed', '演示筛选搜索'],
  ['grace', 'Grace Liu', 'grace@example.com', '13800010007', '客服中心', '客服专员', 0, 'seed', '演示状态筛选'],
  ['henry', 'Henry Sun', 'henry@example.com', '13800010008', '技术部', '测试用户', 1, 'seed', '演示编辑弹窗']
]

async function createSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_demo_user')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`username\` varchar(50) NOT NULL,
      \`nickname\` varchar(100) NOT NULL DEFAULT '',
      \`email\` varchar(120) NOT NULL DEFAULT '',
      \`mobile\` varchar(30) NOT NULL DEFAULT '',
      \`department\` varchar(100) NOT NULL DEFAULT '',
      \`role_name\` varchar(100) NOT NULL DEFAULT '普通用户',
      \`status\` tinyint NOT NULL DEFAULT 1,
      \`source\` varchar(50) NOT NULL DEFAULT 'manual',
      \`remark\` varchar(255) NOT NULL DEFAULT '',
      \`last_active_at\` int NOT NULL DEFAULT 0,
      \`created_by\` int NOT NULL DEFAULT 0,
      \`updated_by\` int NOT NULL DEFAULT 0,
      \`created_at\` int NOT NULL DEFAULT 0,
      \`updated_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${tablePrefix()}admin_demo_user_uk_username\` (\`username\`),
      KEY \`${tablePrefix()}admin_demo_user_idx_status\` (\`status\`),
      KEY \`${tablePrefix()}admin_demo_user_idx_created\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function main() {
  const connection = await mysql.createConnection({
    host: requiredEnv('MYSQL_HOST'),
    port: Number(requiredEnv('MYSQL_PORT')),
    user: requiredEnv('MYSQL_USER'),
    password: process.env.MYSQL_PASSWORD ?? '',
    database: requiredEnv('MYSQL_DATABASE')
  })

  try {
    await createSchema(connection)
    const now = Math.floor(Date.now() / 1000)
    let inserted = 0

    for (const [username, nickname, email, mobile, department, roleName, status, source, remark] of demoUsers) {
      const [result] = await connection.query(
        `INSERT IGNORE INTO ${table('admin_demo_user')}
          (\`username\`, \`nickname\`, \`email\`, \`mobile\`, \`department\`, \`role_name\`, \`status\`, \`source\`, \`remark\`, \`last_active_at\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, nickname, email, mobile, department, roleName, status, source, remark, now - inserted * 3600, now, now]
      )
      inserted += result.affectedRows
    }

    console.log(`Demo users seed completed. inserted=${inserted}`)
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
