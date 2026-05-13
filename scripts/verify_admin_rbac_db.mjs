import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { config as loadEnv } from 'dotenv'
import mysql from 'mysql2/promise'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH || '.env.development', quiet: true })

const projectRoot = process.cwd()
const modulesRoot = join(projectRoot, 'server', 'rbac', 'modules')
const noDb = process.argv.includes('--no-db')
const allowedTypes = new Set(['catalog', 'menu', 'page', 'button', 'api'])
const allowedMatchTypes = new Set(['', 'exact', 'prefix', 'pattern', 'regex'])

function tablePrefix() {
  return (process.env.TABLE_PREFIX || 'ta_').replace(/_?$/, '_')
}

function table(name) {
  return `\`${tablePrefix()}${name}\``
}

function loadDeclarations() {
  const items = []
  for (const fileName of readdirSync(modulesRoot).filter((name) => name.endsWith('.json')).sort()) {
    const doc = JSON.parse(readFileSync(join(modulesRoot, fileName), 'utf8'))
    for (const raw of doc.permissions || []) {
      items.push({ module: doc.module, source: fileName, ...raw })
    }
  }
  return items
}

function verifyDeclarations(items) {
  const errors = []
  const codes = new Set()
  for (const item of items) {
    if (!item.code) errors.push(`${item.source}: missing code`)
    if (codes.has(item.code)) errors.push(`duplicate code: ${item.code}`)
    codes.add(item.code)
    if (!allowedTypes.has(item.type)) errors.push(`${item.code}: invalid type ${item.type}`)
    const apiMatchType = item.apiMatchType || ''
    if (!allowedMatchTypes.has(apiMatchType)) errors.push(`${item.code}: invalid apiMatchType ${apiMatchType}`)
    if (item.type === 'api' && (!item.apiMethod || !item.apiPath || !apiMatchType)) {
      errors.push(`${item.code}: api requires apiMethod/apiPath/apiMatchType`)
    }
    if (item.type === 'api' && !item.code.startsWith('api.')) {
      errors.push(`${item.code}: api permission code must start with api.`)
    }
    if (item.type !== 'api' && item.code.startsWith('api.')) {
      errors.push(`${item.code}: only api permissions can use api.* code`)
    }
  }
  for (const item of items) {
    if (item.parentCode && !codes.has(item.parentCode)) {
      errors.push(`${item.code}: unknown parentCode ${item.parentCode}`)
    }
  }
  return errors
}

function requiredEnv(key) {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

async function verifyDatabase() {
  const connection = await mysql.createConnection({
    host: requiredEnv('MYSQL_HOST'),
    port: Number(requiredEnv('MYSQL_PORT')),
    user: requiredEnv('MYSQL_USER'),
    password: process.env.MYSQL_PASSWORD ?? '',
    database: requiredEnv('MYSQL_DATABASE')
  })
  try {
    const [duplicateCodes] = await connection.query(`
      SELECT code, COUNT(*) AS count FROM ${table('admin_permission')} GROUP BY code HAVING COUNT(*) > 1
    `)
    const [orphans] = await connection.query(`
      SELECT child.code, child.parent_id
      FROM ${table('admin_permission')} child
      LEFT JOIN ${table('admin_permission')} parent ON parent.id = child.parent_id
      WHERE child.parent_id <> 0 AND parent.id IS NULL
    `)
    const [invalidApis] = await connection.query(`
      SELECT code FROM ${table('admin_permission')}
      WHERE type = 'api'
        AND (api_method = '' OR api_path = '' OR api_match_type NOT IN ('exact', 'prefix', 'pattern', 'regex'))
    `)
    return [
      ...duplicateCodes.map((row) => `DB duplicate code: ${row.code}`),
      ...orphans.map((row) => `DB orphan permission: ${row.code} parent_id=${row.parent_id}`),
      ...invalidApis.map((row) => `DB invalid api matcher: ${row.code}`)
    ]
  } finally {
    await connection.end()
  }
}

async function main() {
  const declarationErrors = verifyDeclarations(loadDeclarations())
  const dbErrors = noDb ? [] : await verifyDatabase()
  const errors = [...declarationErrors, ...dbErrors]

  console.log(`RBAC declaration errors: ${declarationErrors.length}`)
  if (!noDb) console.log(`RBAC database errors: ${dbErrors.length}`)

  for (const error of errors) {
    console.error(error)
  }
  if (errors.length > 0) {
    process.exitCode = 1
    return
  }
  console.log('RBAC database verification passed.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
