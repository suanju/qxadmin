import { config as loadEnv } from 'dotenv'
import mysql from 'mysql2/promise'

import { isPublicAdminApiRoute, scanAdminApiRoutes } from './lib/admin_api_route_scanner.mjs'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH || '.env.development', quiet: true })

const projectRoot = process.cwd()
const noDb = process.argv.includes('--no-db')

function tablePrefix() {
  return (process.env.TABLE_PREFIX || 'ta_').replace(/_?$/, '_')
}

function table(name) {
  return `\`${tablePrefix()}${name}\``
}

function requiredEnv(key) {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, '') || '/'
}

function patternPathToRegExp(patternPath) {
  const escaped = normalizePath(patternPath)
    .split('/')
    .map((segment) => {
      if (!segment) return ''
      if (/^:.+\*$/.test(segment)) return '.+'
      if (/^:.+\?$/.test(segment)) return '[^/]*'
      if (/^:.+/.test(segment)) return '[^/]+'
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return new RegExp(`^${escaped}$`)
}

function apiPathMatches(apiPath, matchType, routePath, samplePath) {
  const normalizedApiPath = normalizePath(apiPath)
  const normalizedRoutePath = normalizePath(routePath)
  const normalizedSamplePath = normalizePath(samplePath)

  if (matchType === 'exact') return normalizedApiPath === normalizedRoutePath
  if (matchType === 'prefix') {
    return normalizedRoutePath === normalizedApiPath || normalizedRoutePath.startsWith(`${normalizedApiPath}/`)
  }
  if (matchType === 'pattern') return patternPathToRegExp(normalizedApiPath).test(normalizedSamplePath)
  if (matchType === 'regex') return new RegExp(normalizedApiPath).test(normalizedSamplePath)
  return false
}

function dbApiMatchesRoute(api, route) {
  return (api.api_method === '*' || api.api_method === route.method) &&
    apiPathMatches(api.api_path, api.api_match_type, route.path, route.samplePath)
}

async function loadDbApiPermissions() {
  const connection = await mysql.createConnection({
    host: requiredEnv('MYSQL_HOST'),
    port: Number(requiredEnv('MYSQL_PORT')),
    user: requiredEnv('MYSQL_USER'),
    password: process.env.MYSQL_PASSWORD ?? '',
    database: requiredEnv('MYSQL_DATABASE')
  })
  try {
    const [rows] = await connection.query(`
      SELECT code, api_method, api_path, api_match_type, status
      FROM ${table('admin_permission')}
      WHERE type = 'api'
      ORDER BY code
    `)
    return rows.map((row) => ({
      code: row.code,
      api_method: String(row.api_method || '').toUpperCase(),
      api_path: row.api_path || '',
      api_match_type: row.api_match_type || '',
      status: Number(row.status)
    }))
  } finally {
    await connection.end()
  }
}

function verifyDbRoutes(routes, dbApis) {
  const enabledApis = dbApis.filter((api) => api.status === 1)
  const protectedRoutes = routes.filter((route) => !isPublicAdminApiRoute(route))
  const unmatched = protectedRoutes.filter((route) => !enabledApis.some((api) => dbApiMatchesRoute(api, route)))
  const staleApis = enabledApis.filter((api) => !routes.some((route) => dbApiMatchesRoute(api, route)))

  return { protectedRoutes, unmatched, staleApis }
}

async function main() {
  const routes = scanAdminApiRoutes(projectRoot)
  if (noDb) {
    throw new Error('RBAC route verification now requires database matcher data. Remove --no-db and configure MySQL env.')
  }

  const dbResult = verifyDbRoutes(routes, await loadDbApiPermissions())

  console.log(`Admin API route files: ${routes.length}`)
  console.log(`Database protected routes: ${dbResult.protectedRoutes.length}`)
  console.log(`Database unmatched routes: ${dbResult.unmatched.length}`)
  console.log(`Database stale API permissions: ${dbResult.staleApis.length}`)

  for (const route of dbResult.unmatched) {
    console.error(`DB_UNMATCHED ${route.method} ${route.path} file=${route.relativeFile}`)
  }
  for (const api of dbResult.staleApis) {
    console.warn(`DB_STALE_API_PERMISSION ${api.code} ${api.api_method} ${api.api_path} match=${api.api_match_type}`)
  }

  if (dbResult.unmatched.length > 0) {
    process.exitCode = 1
    return
  }

  console.log('RBAC database route permission mapping verification passed.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
