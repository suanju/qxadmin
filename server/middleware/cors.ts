/**
 * CORS 跨域中间件，为 /api/* 接口添加 Access-Control-Allow-* 头。
 * 支持前端跨域请求，并直接响应 OPTIONS 预检请求。
 */

const API_PREFIX = '/api/'

function setCorsHeaders(event: import('h3').H3Event) {
  const origin = getHeader(event, 'origin') || '*'
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Page-Url',
    'Access-Control-Max-Age': '86400'
  })
}

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith(API_PREFIX)) return

  setCorsHeaders(event)

  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.end()
    return
  }
})
