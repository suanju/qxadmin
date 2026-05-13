import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export const ADMIN_API_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch'])

export const PUBLIC_ADMIN_API_ROUTES = [
  ['GET', /^\/api\/admin\/auth\/captcha$/],
  ['POST', /^\/api\/admin\/auth\/login$/],
  ['POST', /^\/api\/admin\/auth\/logout$/],
  ['GET', /^\/api\/admin\/auth\/me$/],
  ['PUT', /^\/api\/admin\/auth\/password$/],
  ['GET', /^\/api\/admin\/auth\/permissions$/]
]

export function isPublicAdminApiRoute(route) {
  return PUBLIC_ADMIN_API_ROUTES.some(([method, pattern]) =>
    method === route.method && pattern.test(route.samplePath)
  )
}

function walkFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name)
    if (statSync(fullPath).isDirectory()) {
      walkFiles(fullPath, files)
      continue
    }
    if (/\.(get|post|put|delete|patch)\.ts$/.test(name)) {
      files.push(fullPath)
    }
  }
  return files
}

function segmentToRoutePart(segment) {
  if (/^\[\[\.\.\.(.+)\]\]$/.test(segment)) {
    const name = segment.match(/^\[\[\.\.\.(.+)\]\]$/)[1]
    return { pattern: `:${name}*`, sample: 'rest' }
  }
  if (/^\[\.\.\.(.+)\]$/.test(segment)) {
    const name = segment.match(/^\[\.\.\.(.+)\]$/)[1]
    return { pattern: `:${name}*`, sample: 'rest' }
  }
  if (/^\[\[(.+)\]\]$/.test(segment)) {
    const name = segment.match(/^\[\[(.+)\]\]$/)[1]
    return { pattern: `:${name}?`, sample: '1' }
  }
  if (/^\[(.+)\]$/.test(segment)) {
    const name = segment.match(/^\[(.+)\]$/)[1]
    return { pattern: `:${name}`, sample: '1' }
  }
  return { pattern: segment, sample: segment }
}

/**
 * 扫描 Nitro 后台 API 文件路由，输出数据库 matcher 可使用的 route pattern。
 */
export function scanAdminApiRoutes(projectRoot = process.cwd()) {
  const adminApiRoot = join(projectRoot, 'server', 'api', 'admin')
  return walkFiles(adminApiRoot)
    .map((file) => {
      const parts = relative(adminApiRoot, file).split(sep)
      const fileName = parts.pop()
      const match = fileName.match(/^(.*)\.(get|post|put|delete|patch)\.ts$/)

      if (!match) {
        throw new Error(`Unsupported admin API filename: ${fileName}`)
      }

      const [, baseName, rawMethod] = match
      const routeParts = [...parts]
      if (baseName !== 'index') routeParts.push(baseName)

      const mapped = routeParts.map(segmentToRoutePart)
      const patternPath = `/api/admin/${mapped.map((item) => item.pattern).filter(Boolean).join('/')}`.replace(/\/+$/, '')
      const samplePath = `/api/admin/${mapped.map((item) => item.sample).filter(Boolean).join('/')}`.replace(/\/+$/, '')

      return {
        file,
        relativeFile: relative(projectRoot, file),
        method: rawMethod.toUpperCase(),
        path: patternPath || '/api/admin',
        samplePath: samplePath || '/api/admin'
      }
    })
    .sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`))
}
