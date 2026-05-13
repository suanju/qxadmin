import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { config as loadEnv } from 'dotenv'
import mysql from 'mysql2/promise'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH || '.env.development', quiet: true })

const projectRoot = process.cwd()
const modulesRoot = join(projectRoot, 'server', 'rbac', 'modules')
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--check')
const restoreSystem = process.argv.includes('--restore-system')
const allowedTypes = new Set(['catalog', 'menu', 'page', 'button', 'api'])
const allowedMatchTypes = new Set(['', 'exact', 'prefix', 'pattern', 'regex'])

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

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

function toFlag(value, fallback = 0) {
  if (value === undefined) return fallback
  return value === true || value === 1 ? 1 : 0
}

function normalizePermission(raw, sourceFile) {
  const item = { ...raw }
  if (!allowedTypes.has(item.type)) {
    throw new Error(`${sourceFile}: invalid permission type: ${item.type}`)
  }
  if (!item.code || !/^[A-Za-z0-9_.:-]+$/.test(item.code)) {
    throw new Error(`${sourceFile}: invalid permission code: ${item.code}`)
  }
  if (!item.name) {
    throw new Error(`${sourceFile}: permission name required for ${item.code}`)
  }
  const apiMatchType = item.apiMatchType || ''
  if (!allowedMatchTypes.has(apiMatchType)) {
    throw new Error(`${sourceFile}: invalid apiMatchType for ${item.code}: ${apiMatchType}`)
  }
  if (item.type === 'api' && (!item.apiMethod || !item.apiPath || !apiMatchType)) {
    throw new Error(`${sourceFile}: api permission requires apiMethod/apiPath/apiMatchType: ${item.code}`)
  }

  return {
    parentCode: item.parentCode || '',
    type: item.type,
    code: item.code,
    name: item.name,
    description: item.description || '',
    module: item.module || '',
    route_path: item.routePath || '',
    api_method: item.apiMethod || '',
    api_path: item.apiPath || '',
    api_match_type: apiMatchType,
    component_key: item.componentKey || '',
    active_menu: item.activeMenu || '',
    keepalive: toFlag(item.keepalive),
    icon: item.icon || '',
    sort: Number(item.sort || 0),
    status: item.status === 0 ? 0 : 1,
    visible: item.visible === 0 ? 0 : 1,
    is_system: toFlag(item.isSystem),
    is_high_risk: toFlag(item.isHighRisk),
    data_scope_supported: toFlag(item.dataScopeSupported),
    meta_json: item.meta ? JSON.stringify(item.meta) : null
  }
}

function loadDeclarations() {
  const items = []
  const seen = new Map()
  for (const fileName of readdirSync(modulesRoot).filter((name) => name.endsWith('.json')).sort()) {
    const fullPath = join(modulesRoot, fileName)
    const doc = JSON.parse(readFileSync(fullPath, 'utf8'))
    const permissions = Array.isArray(doc.permissions) ? doc.permissions : []
    for (const raw of permissions) {
      const normalized = normalizePermission(
        { module: doc.module, ...raw },
        fileName
      )
      if (seen.has(normalized.code)) {
        throw new Error(`Duplicate permission code ${normalized.code}: ${seen.get(normalized.code)} and ${fileName}`)
      }
      seen.set(normalized.code, fileName)
      items.push(normalized)
    }
  }

  const codes = new Set(items.map((item) => item.code))
  for (const item of items) {
    if (item.parentCode && !codes.has(item.parentCode)) {
      throw new Error(`Unknown parentCode ${item.parentCode} for ${item.code}`)
    }
  }

  return items
}

async function ensureSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_permission')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`parent_id\` int NOT NULL DEFAULT 0,
      \`type\` varchar(20) NOT NULL DEFAULT 'button',
      \`code\` varchar(100) NOT NULL,
      \`name\` varchar(100) NOT NULL,
      \`description\` varchar(255) NOT NULL DEFAULT '',
      \`module\` varchar(50) NOT NULL DEFAULT '',
      \`route_path\` varchar(255) NOT NULL DEFAULT '',
      \`api_method\` varchar(10) NOT NULL DEFAULT '',
      \`api_path\` varchar(255) NOT NULL DEFAULT '',
      \`api_match_type\` varchar(20) NOT NULL DEFAULT '',
      \`component_key\` varchar(255) NOT NULL DEFAULT '',
      \`active_menu\` varchar(255) NOT NULL DEFAULT '',
      \`keepalive\` tinyint NOT NULL DEFAULT 0,
      \`icon\` varchar(100) NOT NULL DEFAULT '',
      \`sort\` int NOT NULL DEFAULT 0,
      \`status\` tinyint NOT NULL DEFAULT 1,
      \`visible\` tinyint NOT NULL DEFAULT 1,
      \`is_system\` tinyint NOT NULL DEFAULT 0,
      \`is_high_risk\` tinyint NOT NULL DEFAULT 0,
      \`data_scope_supported\` tinyint NOT NULL DEFAULT 0,
      \`meta_json\` text,
      \`created_by\` int NOT NULL DEFAULT 0,
      \`updated_by\` int NOT NULL DEFAULT 0,
      \`created_at\` int NOT NULL DEFAULT 0,
      \`updated_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${tablePrefix()}admin_permission_uk_code\` (\`code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${table('admin_permission_sync_log')} (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`source\` varchar(30) NOT NULL DEFAULT 'scanner',
      \`action\` varchar(30) NOT NULL DEFAULT '',
      \`permission_code\` varchar(100) NOT NULL DEFAULT '',
      \`before_data\` text,
      \`after_data\` text,
      \`message\` varchar(500) NOT NULL DEFAULT '',
      \`created_at\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [columns] = await connection.query(`SHOW COLUMNS FROM ${table('admin_role_permission')} LIKE 'permission_id'`)
  if (columns.length === 0) {
    await connection.query(`ALTER TABLE ${table('admin_role_permission')} ADD COLUMN \`permission_id\` int NOT NULL DEFAULT 0 AFTER \`role_id\``)
  }

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
      UNIQUE KEY \`${tablePrefix()}admin_file_group_uk_code\` (\`code\`)
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

async function logSync(connection, action, code, beforeData, afterData, message = '') {
  await connection.execute(
    `INSERT INTO ${table('admin_permission_sync_log')}
      (\`source\`, \`action\`, \`permission_code\`, \`before_data\`, \`after_data\`, \`message\`, \`created_at\`)
     VALUES ('seed', ?, ?, ?, ?, ?, ?)`,
    [
      action,
      code,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      message,
      nowSec()
    ]
  )
}

async function upsertPermissions(connection, items) {
  const idByCode = new Map()
  const sorted = [...items].sort((a, b) => {
    if (!a.parentCode && b.parentCode) return -1
    if (a.parentCode && !b.parentCode) return 1
    return a.sort - b.sort
  })

  for (const item of sorted) {
    const parentId = item.parentCode ? idByCode.get(item.parentCode) : 0
    if (item.parentCode && !parentId) {
      throw new Error(`Parent ${item.parentCode} has not been inserted before ${item.code}`)
    }

    const payload = {
      ...item,
      parent_id: parentId || 0
    }
    delete payload.parentCode

    const [rows] = await connection.execute(
      `SELECT * FROM ${table('admin_permission')} WHERE \`code\` = ? LIMIT 1`,
      [item.code]
    )
    const existing = rows[0]

    if (!existing) {
      await connection.execute(
        `INSERT INTO ${table('admin_permission')}
          (\`parent_id\`, \`type\`, \`code\`, \`name\`, \`description\`, \`module\`, \`route_path\`,
           \`api_method\`, \`api_path\`, \`api_match_type\`, \`component_key\`, \`active_menu\`,
           \`keepalive\`, \`icon\`, \`sort\`, \`status\`, \`visible\`, \`is_system\`, \`is_high_risk\`,
           \`data_scope_supported\`, \`meta_json\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.parent_id,
          payload.type,
          payload.code,
          payload.name,
          payload.description,
          payload.module,
          payload.route_path,
          payload.api_method,
          payload.api_path,
          payload.api_match_type,
          payload.component_key,
          payload.active_menu,
          payload.keepalive,
          payload.icon,
          payload.sort,
          payload.status,
          payload.visible,
          payload.is_system,
          payload.is_high_risk,
          payload.data_scope_supported,
          payload.meta_json,
          nowSec(),
          nowSec()
        ]
      )
      await logSync(connection, 'create', item.code, null, payload)
    } else {
      await connection.execute(
        `UPDATE ${table('admin_permission')}
         SET \`parent_id\` = ?, \`type\` = ?, \`name\` = ?, \`description\` = ?, \`module\` = ?,
             \`route_path\` = ?, \`api_method\` = ?, \`api_path\` = ?, \`api_match_type\` = ?,
             \`component_key\` = ?, \`active_menu\` = ?, \`keepalive\` = ?, \`icon\` = ?,
             \`sort\` = ?, \`status\` = ?, \`visible\` = ?, \`is_system\` = ?, \`is_high_risk\` = ?,
             \`data_scope_supported\` = ?, \`meta_json\` = ?, \`updated_at\` = ?
         WHERE \`code\` = ?`,
        [
          payload.parent_id,
          payload.type,
          payload.name,
          payload.description,
          payload.module,
          payload.route_path,
          payload.api_method,
          payload.api_path,
          payload.api_match_type,
          payload.component_key,
          payload.active_menu,
          payload.keepalive,
          payload.icon,
          payload.sort,
          payload.status,
          payload.visible,
          payload.is_system,
          payload.is_high_risk,
          payload.data_scope_supported,
          payload.meta_json,
          nowSec(),
          item.code
        ]
      )
      await logSync(connection, 'update', item.code, existing, payload)
    }

    const [nextRows] = await connection.execute(
      `SELECT \`id\` FROM ${table('admin_permission')} WHERE \`code\` = ? LIMIT 1`,
      [item.code]
    )
    idByCode.set(item.code, nextRows[0].id)
  }

  await connection.query(`
    UPDATE ${table('admin_role_permission')} rp
    INNER JOIN ${table('admin_permission')} p ON p.code = rp.permission_code
    SET rp.permission_id = p.id
    WHERE rp.permission_id = 0
  `)

  if (restoreSystem) {
    const codes = sorted.map((item) => item.code)
    if (codes.length > 0) {
      await connection.query(
        `UPDATE ${table('admin_permission')} SET \`status\` = 1, \`is_system\` = 1 WHERE \`code\` IN (?)`,
        [codes]
      )
    }
  }
}

async function main() {
  const declarations = loadDeclarations()
  console.log(`RBAC declarations: ${declarations.length}`)
  if (dryRun) {
    console.log('Dry run passed.')
    return
  }

  const connection = await mysql.createConnection({
    host: requiredEnv('MYSQL_HOST'),
    port: Number(requiredEnv('MYSQL_PORT')),
    user: requiredEnv('MYSQL_USER'),
    password: process.env.MYSQL_PASSWORD ?? '',
    database: requiredEnv('MYSQL_DATABASE')
  })
  try {
    await ensureSchema(connection)
    await upsertPermissions(connection, declarations)
    console.log('RBAC dynamic permissions synced.')
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
