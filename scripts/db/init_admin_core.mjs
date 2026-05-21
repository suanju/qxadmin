import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { config as loadEnv } from 'dotenv'
import mysql from 'mysql2/promise'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH || '.env.development', quiet: true })

const scrypt = promisify(scryptCallback)
const modulesRoot = join(process.cwd(), 'server', 'rbac', 'modules')

const SYSTEM_ROLES = [
  {
    code: 'super_admin',
    name: '超级管理员',
    description: '拥有全部后台权限，负责账号、角色与高风险配置',
    sort: 10,
    permissions: 'all'
  },
  {
    code: 'system_admin',
    name: '系统管理员',
    description: '负责系统设置、管理员账户、角色授权与资源上传',
    sort: 20,
    permissions: [
      'dashboard.read',
      'settings.read',
      'settings.create',
      'settings.update',
      'settings.delete',
      'operation_logs.read',
      'files.read',
      'files.manage',
      'upload.create',
      'admin_accounts.read',
      'admin_accounts.manage'
    ]
  },
  {
    code: 'auditor',
    name: '审计员',
    description: '只读查看后台概览、系统设置和操作日志',
    sort: 30,
    permissions: [
      'dashboard.read',
      'settings.read',
      'operation_logs.read',
      'files.read',
      'admin_accounts.read'
    ]
  }
]

function loadAssignablePermissionCodes() {
  const codes = []
  for (const fileName of readdirSync(modulesRoot).filter((name) => name.endsWith('.json')).sort()) {
    const doc = JSON.parse(readFileSync(join(modulesRoot, fileName), 'utf8'))
    const permissions = Array.isArray(doc.permissions) ? doc.permissions : []
    for (const item of permissions) {
      if (['menu', 'page', 'button'].includes(item.type) && item.code) {
        codes.push(String(item.code))
      }
    }
  }
  return Array.from(new Set(codes))
}

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

function normalizeIdentifier(value, key) {
  const normalized = String(value || '').trim()
  if (!/^[A-Za-z0-9_]+$/.test(normalized)) {
    throw new Error(`${key} 只能包含字母、数字和下划线`)
  }
  return normalized
}

async function hashAdminPassword(password) {
  const salt = randomBytes(16).toString('base64url')
  const n = 16384
  const r = 8
  const p = 1
  const derived = await scrypt(String(password), salt, 64, { N: n, r, p })
  return `scrypt$N=${n},r=${r},p=${p}$${salt}$${Buffer.from(derived).toString('base64url')}`
}

async function createSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('config')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`name\` varchar(30) NOT NULL,
      \`group\` varchar(30) NOT NULL DEFAULT '',
      \`title\` varchar(100) NOT NULL DEFAULT '',
      \`tip\` varchar(100) NOT NULL DEFAULT '',
      \`type\` varchar(30) NOT NULL DEFAULT 'string',
      \`value\` text,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${tablePrefix()}config_uk_name\` (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_operation_log')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`trace_id\` varchar(64) NOT NULL DEFAULT '',
      \`operator_type\` varchar(30) NOT NULL DEFAULT 'admin',
      \`operator_id\` varchar(64) NOT NULL DEFAULT '',
      \`operator_name\` varchar(100) NOT NULL DEFAULT '',
      \`event_type\` varchar(64) NOT NULL DEFAULT '',
      \`event_category\` varchar(30) NOT NULL DEFAULT '',
      \`target_type\` varchar(50) NOT NULL DEFAULT '',
      \`target_id\` varchar(64) NOT NULL DEFAULT '',
      \`target_name\` varchar(255) NOT NULL DEFAULT '',
      \`detail\` text,
      \`request_method\` varchar(10) NOT NULL DEFAULT '',
      \`request_path\` varchar(255) NOT NULL DEFAULT '',
      \`request_query\` json DEFAULT NULL,
      \`request_body\` json DEFAULT NULL,
      \`before_data\` json DEFAULT NULL,
      \`after_data\` json DEFAULT NULL,
      \`change_items\` json DEFAULT NULL,
      \`result\` tinyint NOT NULL DEFAULT 1,
      \`status_code\` int NOT NULL DEFAULT 200,
      \`duration_ms\` int NOT NULL DEFAULT 0,
      \`error_message\` varchar(500) NOT NULL DEFAULT '',
      \`ip\` varchar(45) NOT NULL DEFAULT '',
      \`user_agent\` varchar(255) NOT NULL DEFAULT '',
      \`created_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_user')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`username\` varchar(50) NOT NULL,
      \`display_name\` varchar(100) NOT NULL DEFAULT '',
      \`password_hash\` varchar(255) NOT NULL,
      \`status\` tinyint NOT NULL DEFAULT 1,
      \`is_super_admin\` tinyint NOT NULL DEFAULT 0,
      \`token_version\` int NOT NULL DEFAULT 1,
      \`last_login_at\` int NOT NULL DEFAULT 0,
      \`last_login_ip\` varchar(45) NOT NULL DEFAULT '',
      \`password_changed_at\` int NOT NULL DEFAULT 0,
      \`created_by\` int NOT NULL DEFAULT 0,
      \`updated_by\` int NOT NULL DEFAULT 0,
      \`created_at\` int NOT NULL DEFAULT 0,
      \`updated_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${tablePrefix()}admin_user_uk_username\` (\`username\`),
      KEY \`${tablePrefix()}admin_user_idx_status\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_role')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`code\` varchar(50) NOT NULL,
      \`name\` varchar(100) NOT NULL,
      \`description\` varchar(255) NOT NULL DEFAULT '',
      \`status\` tinyint NOT NULL DEFAULT 1,
      \`is_system\` tinyint NOT NULL DEFAULT 0,
      \`sort\` int NOT NULL DEFAULT 0,
      \`created_by\` int NOT NULL DEFAULT 0,
      \`updated_by\` int NOT NULL DEFAULT 0,
      \`created_at\` int NOT NULL DEFAULT 0,
      \`updated_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${tablePrefix()}admin_role_uk_code\` (\`code\`),
      KEY \`${tablePrefix()}admin_role_idx_status\` (\`status\`),
      KEY \`${tablePrefix()}admin_role_idx_sort\` (\`sort\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_user_role')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`user_id\` int NOT NULL,
      \`role_id\` int NOT NULL,
      \`created_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${tablePrefix()}admin_user_role_uk_user_role\` (\`user_id\`, \`role_id\`),
      KEY \`${tablePrefix()}admin_user_role_idx_role\` (\`role_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_role_permission')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`role_id\` int NOT NULL,
      \`permission_id\` int NOT NULL DEFAULT 0,
      \`permission_code\` varchar(100) NOT NULL,
      \`created_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${tablePrefix()}admin_role_permission_uk_role_code\` (\`role_id\`, \`permission_code\`),
      KEY \`${tablePrefix()}admin_role_permission_idx_permission\` (\`permission_id\`),
      KEY \`${tablePrefix()}admin_role_permission_idx_code\` (\`permission_code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_file_group')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`name\` varchar(100) NOT NULL,
      \`code\` varchar(64) NOT NULL,
      \`description\` varchar(255) NOT NULL DEFAULT '',
      \`sort\` int NOT NULL DEFAULT 0,
      \`status\` tinyint NOT NULL DEFAULT 1,
      \`created_by\` int NOT NULL DEFAULT 0,
      \`updated_by\` int NOT NULL DEFAULT 0,
      \`created_at\` int NOT NULL DEFAULT 0,
      \`updated_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${tablePrefix()}admin_file_group_uk_code\` (\`code\`),
      KEY \`${tablePrefix()}admin_file_group_idx_status_sort\` (\`status\`, \`sort\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_file')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`group_id\` int NOT NULL DEFAULT 0,
      \`storage_driver\` varchar(30) NOT NULL DEFAULT 'local',
      \`original_name\` varchar(255) NOT NULL,
      \`filename\` varchar(255) NOT NULL,
      \`ext\` varchar(30) NOT NULL DEFAULT '',
      \`mime\` varchar(100) NOT NULL DEFAULT '',
      \`size\` int NOT NULL DEFAULT 0,
      \`hash\` varchar(64) NOT NULL DEFAULT '',
      \`path\` varchar(500) NOT NULL,
      \`public_url\` varchar(500) NOT NULL,
      \`kind\` varchar(30) NOT NULL DEFAULT 'file',
      \`status\` tinyint NOT NULL DEFAULT 1,
      \`uploader_id\` int NOT NULL DEFAULT 0,
      \`uploader_name\` varchar(100) NOT NULL DEFAULT '',
      \`meta_json\` text,
      \`created_at\` int NOT NULL DEFAULT 0,
      \`updated_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      KEY \`${tablePrefix()}admin_file_idx_group\` (\`group_id\`),
      KEY \`${tablePrefix()}admin_file_idx_kind\` (\`kind\`),
      KEY \`${tablePrefix()}admin_file_idx_hash\` (\`hash\`),
      KEY \`${tablePrefix()}admin_file_idx_uploader\` (\`uploader_id\`),
      KEY \`${tablePrefix()}admin_file_idx_status_created\` (\`status\`, \`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function seedRoles(connection) {
  const now = Math.floor(Date.now() / 1000)
  const assignablePermissionCodes = loadAssignablePermissionCodes()

  for (const role of SYSTEM_ROLES) {
    await connection.execute(
      `INSERT IGNORE INTO ${table('admin_role')}
        (\`code\`, \`name\`, \`description\`, \`status\`, \`is_system\`, \`sort\`, \`created_at\`, \`updated_at\`)
       VALUES (?, ?, ?, 1, 1, ?, ?, ?)`,
      [role.code, role.name, role.description, role.sort, now, now]
    )

    const [[roleRow]] = await connection.execute(
      `SELECT \`id\` FROM ${table('admin_role')} WHERE \`code\` = ? LIMIT 1`,
      [role.code]
    )
    if (!roleRow?.id) continue

    const permissions = role.permissions === 'all' ? assignablePermissionCodes : role.permissions
    for (const permission of permissions) {
      await connection.execute(
        `INSERT IGNORE INTO ${table('admin_role_permission')} (\`role_id\`, \`permission_code\`, \`created_at\`) VALUES (?, ?, ?)`,
        [roleRow.id, permission, now]
      )
    }
  }
}

async function seedAdmin(connection) {
  const password = process.env.ADMIN_INIT_PASSWORD || ''
  if (!password) {
    console.log('ADMIN_INIT_PASSWORD is empty, skipped default admin user seed.')
    return
  }

  const username = process.env.ADMIN_INIT_USERNAME || 'admin'
  const displayName = process.env.ADMIN_INIT_DISPLAY_NAME || '超级管理员'
  const forceReset = process.env.ADMIN_INIT_FORCE_RESET === 'true'
  const now = Math.floor(Date.now() / 1000)
  const passwordHash = await hashAdminPassword(password)

  const [[existing]] = await connection.execute(
    `SELECT \`id\` FROM ${table('admin_user')} WHERE \`username\` = ? LIMIT 1`,
    [username]
  )

  if (!existing) {
    await connection.execute(
      `INSERT INTO ${table('admin_user')}
        (\`username\`, \`display_name\`, \`password_hash\`, \`status\`, \`is_super_admin\`, \`token_version\`, \`password_changed_at\`, \`created_at\`, \`updated_at\`)
       VALUES (?, ?, ?, 1, 1, 1, ?, ?, ?)`,
      [username, displayName, passwordHash, now, now, now]
    )
  } else if (forceReset) {
    await connection.execute(
      `UPDATE ${table('admin_user')}
       SET \`display_name\` = ?, \`password_hash\` = ?, \`status\` = 1, \`is_super_admin\` = 1,
           \`token_version\` = \`token_version\` + 1, \`password_changed_at\` = ?, \`updated_at\` = ?
       WHERE \`id\` = ?`,
      [displayName, passwordHash, now, now, existing.id]
    )
  }

  const [[admin]] = await connection.execute(
    `SELECT \`id\` FROM ${table('admin_user')} WHERE \`username\` = ? LIMIT 1`,
    [username]
  )
  const [[superRole]] = await connection.execute(
    `SELECT \`id\` FROM ${table('admin_role')} WHERE \`code\` = 'super_admin' LIMIT 1`
  )
  if (admin?.id && superRole?.id) {
    await connection.execute(
      `INSERT IGNORE INTO ${table('admin_user_role')} (\`user_id\`, \`role_id\`, \`created_at\`) VALUES (?, ?, ?)`,
      [admin.id, superRole.id, now]
    )
  }

  console.log(`Default admin user ready: ${username}`)
}

async function main() {
  const host = requiredEnv('MYSQL_HOST')
  const port = Number(requiredEnv('MYSQL_PORT'))
  const user = requiredEnv('MYSQL_USER')
  const password = process.env.MYSQL_PASSWORD ?? ''
  const database = normalizeIdentifier(requiredEnv('MYSQL_DATABASE'), 'MYSQL_DATABASE')

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('MYSQL_PORT must be a valid port number')
  }

  const rootConnection = await mysql.createConnection({ host, port, user, password, multipleStatements: false })
  await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await rootConnection.end()

  const connection = await mysql.createConnection({ host, port, user, password, database, multipleStatements: false })
  try {
    await createSchema(connection)
    await seedRoles(connection)
    await seedAdmin(connection)
    console.log(`Admin core database initialized: ${database}`)
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
