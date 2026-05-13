/**
 * 通用 API 日志中间件
 * - 统一记录所有 /api/* 请求的基础信息 + 耗时
 * - 详细的第三方请求/响应日志在各工具函数中单独记录（如 #server/utils/ad）
 */

import type { H3Event } from 'h3'
import { logApiRequest, logApiResponse } from '#server/utils/log'

const API_PREFIX = '/api/'

export default defineEventHandler((event: H3Event) => {
  const url = getRequestURL(event)

  // 只记录 /api/*，避免静态资源等噪音
  if (!url.pathname.startsWith(API_PREFIX)) {
    return
  }

  const startTime = Date.now()

  // 基础请求日志（不包含业务字段）
  logApiRequest(event)

  // 等响应结束后再记录响应和耗时
  const res = event.node.res
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const status = res.statusCode

    logApiResponse(event, {
      status,
      duration
    })
  })
})
