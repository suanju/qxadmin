/**
 * 日志工具：
 * 保持业务侧使用 consola tag logger 的方式不变，
 * 并确保在日志级别过滤时也能补写到文件。
 */

import { consola } from 'consola'
import type { H3Event } from 'h3'
import { writeTaggedLogToFile } from './logger_file_reporter'

const LOG_METHOD_LEVEL_MAP = {
  debug: 0,
  info: 1,
  success: 1,
  start: 1,
  ready: 1,
  log: 1,
  warn: 2,
  error: 3,
  fatal: 4
} as const

type LogMethodName = keyof typeof LOG_METHOD_LEVEL_MAP
type LogMethod = (...args: unknown[]) => unknown
type TaggedLogger = ReturnType<typeof consola.withTag> & {
  level?: number
} & Partial<Record<LogMethodName, LogMethod>>

/**
 * 获取指定 logger 当前生效的日志级别。
 * 优先使用实例级配置，不存在时退回 consola 全局级别。
 */
function getLoggerLevel(logger: TaggedLogger): number {
  if (typeof logger.level === 'number') {
    return logger.level
  }
  if (typeof consola.level === 'number') {
    return consola.level
  }
  return 1
}

/**
 * 判断一条日志在当前级别下是否会被 consola 过滤。
 * 如果终端不会输出该日志，则需要手动补写到文件，保证日志不丢失。
 */
function shouldMirrorToFile(logger: TaggedLogger, methodLevel: number): boolean {
  const activeLevel = getLoggerLevel(logger)

  // 项目里 silent 映射为 -1，此时 consola 不会输出到终端。
  if (activeLevel < 0) {
    return true
  }

  // consola 仅在 methodLevel >= activeLevel 时输出。
  // 这里只在“会被过滤”时补写文件，避免与 reporter 重复落盘。
  return methodLevel < activeLevel
}

/**
 * 包装指定日志方法，在必要时额外镜像写入文件。
 * 这样业务侧依旧沿用原有 consola API，同时兼顾文件日志完整性。
 */
function wrapLoggerMethod(logger: TaggedLogger, tag: string, method: LogMethodName): void {
  const originalMethod = logger[method]
  if (typeof originalMethod !== 'function') {
    return
  }

  const boundOriginal = originalMethod.bind(logger)
  logger[method] = (...args: unknown[]) => {
    const methodLevel = LOG_METHOD_LEVEL_MAP[method] ?? 1
    if (shouldMirrorToFile(logger, methodLevel)) {
      writeTaggedLogToFile({
        tag,
        level: methodLevel,
        args,
        date: new Date()
      })
    }

    return boundOriginal(...args)
  }
}

/**
 * 创建带固定标签的 consola logger，并为各日志方法注入文件镜像能力。
 */
function createTaggedLogger(tag: string): TaggedLogger {
  const logger = consola.withTag(tag) as TaggedLogger

  for (const method of Object.keys(LOG_METHOD_LEVEL_MAP) as LogMethodName[]) {
    wrapLoggerMethod(logger, tag, method)
  }

  return logger
}

// service 层辅助方法使用的日志级别。
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 保持这些导出名称稳定，避免影响现有业务调用。
export const apiLogger = createTaggedLogger('API')
export const thirdPartyApiLogger = createTaggedLogger('ThirdPartyAPI')
export const dbLogger = createTaggedLogger('DB')
export const serviceLogger = createTaggedLogger('Service')
export const callbackLogger = createTaggedLogger('Callback')

/**
 * 从请求对象中提取通用日志上下文。
 * 返回值适合直接拼接到 API 入参日志和响应日志中。
 */
export function getRequestContext(event?: H3Event): Record<string, unknown> {
  if (!event) return {}

  const url = getRequestURL(event)?.toString() || ''
  const method = event.method || ''
  const clientIp = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    ?? getHeader(event, 'x-real-ip')
    ?? ''
  const userAgent = getHeader(event, 'user-agent') || ''

  return {
    url,
    method,
    clientIp,
    userAgent,
    timestamp: new Date().toISOString()
  }
}

/**
 * 记录 API 请求入口日志。
 * 会附带 URL、请求方法、客户端信息以及可选的参数、查询和请求体快照。
 */
export function logApiRequest(
  event: H3Event,
  data?: {
    params?: Record<string, unknown>
    body?: unknown
    query?: Record<string, unknown>
  }
) {
  const context = getRequestContext(event)
  apiLogger.info('API Request', {
    ...context,
    ...data
  })
}

/**
 * 记录 API 响应结果日志。
 * 根据是否携带错误对象自动区分普通响应和异常响应的日志级别。
 */
export function logApiResponse(
  event: H3Event,
  data: {
    status?: number
    message?: string
    duration?: number
    error?: unknown
  }
) {
  const context = getRequestContext(event)
  if (data.error) {
    apiLogger.error('API Response Error', {
      ...context,
      ...data
    })
  } else {
    apiLogger.info('API Response', {
      ...context,
      ...data
    })
  }
}

export interface ThirdPartyApiLogData {
  service: string
  url: string
  method: string
  requestHeaders?: Record<string, string>
  requestBody?: unknown
  requestParams?: Record<string, string>
  responseStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: unknown
  duration?: number
  error?: unknown
  traceId?: string
}

/**
 * 记录第三方接口请求日志。
 * 会对敏感请求头和请求体字段做脱敏，避免密钥类信息写入日志文件。
 */
export function logThirdPartyApiRequest(data: ThirdPartyApiLogData) {
  const logData: Record<string, unknown> = {
    service: data.service,
    url: data.url,
    method: data.method,
    timestamp: new Date().toISOString()
  }

  if (data.requestHeaders) {
    const sanitizedHeaders = { ...data.requestHeaders }
    if (sanitizedHeaders.Authorization) {
      sanitizedHeaders.Authorization = '***'
    }
    if (sanitizedHeaders.authorization) {
      sanitizedHeaders.authorization = '***'
    }
    logData.requestHeaders = sanitizedHeaders
  }

  if (data.requestBody) {
    logData.requestBody = sanitizeSensitiveData(data.requestBody)
  }

  if (data.requestParams) {
    logData.requestParams = sanitizeSensitiveData(data.requestParams)
  }

  thirdPartyApiLogger.info(`[${data.service}] Request`, logData)
}

/**
 * 记录第三方接口响应日志。
 * 成功和失败会分别落到不同级别，并附带耗时、traceId 和脱敏后的响应内容。
 */
export function logThirdPartyApiResponse(data: ThirdPartyApiLogData) {
  const logData: Record<string, unknown> = {
    service: data.service,
    url: data.url,
    method: data.method,
    timestamp: new Date().toISOString()
  }

  if (data.responseStatus) {
    logData.responseStatus = data.responseStatus
  }

  if (data.responseHeaders) {
    logData.responseHeaders = data.responseHeaders
  }

  if (data.responseBody) {
    logData.responseBody = sanitizeSensitiveData(data.responseBody)
  }

  if (data.duration !== undefined) {
    logData.duration = `${data.duration}ms`
  }

  if (data.traceId) {
    logData.traceId = data.traceId
  }

  if (data.error) {
    logData.error = data.error instanceof Error
      ? {
          name: data.error.name,
          message: data.error.message,
          stack: data.error.stack
        }
      : data.error
    thirdPartyApiLogger.error(`[${data.service}] Response Error`, logData)
  } else {
    thirdPartyApiLogger.info(`[${data.service}] Response Success`, logData)
  }
}

/**
 * 递归脱敏日志对象中的敏感字段。
 * 适用于第三方请求参数、响应体以及任意嵌套结构。
 */
function sanitizeSensitiveData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeSensitiveData(item))
  }

  const sensitiveKeys = [
    'password',
    'token',
    'access_token',
    'api_key',
    'secret',
    'key',
    'private_key',
    'authorization'
  ]

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '***'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeSensitiveData(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * 记录数据库层操作日志。
 * 默认使用 debug 级别，便于在排查 SQL 相关问题时按需开启。
 */
export function logDbOperation(
  operation: string,
  data?: Record<string, unknown>
) {
  dbLogger.debug(`DB ${operation}`, data)
}

/**
 * 记录 service 层统一风格日志。
 * 通过传入的 `LogLevel` 决定最终写入的 consola 方法，减少业务代码分支判断。
 */
export function logService(
  level: LogLevel,
  service: string,
  message: string,
  data?: Record<string, unknown>
) {
  const logData = {
    service,
    message,
    ...data,
    timestamp: new Date().toISOString()
  }

  switch (level) {
    case LogLevel.DEBUG:
      serviceLogger.debug(`[${service}] ${message}`, logData)
      break
    case LogLevel.INFO:
      serviceLogger.info(`[${service}] ${message}`, logData)
      break
    case LogLevel.WARN:
      serviceLogger.warn(`[${service}] ${message}`, logData)
      break
    case LogLevel.ERROR:
      serviceLogger.error(`[${service}] ${message}`, logData)
      break
  }
}
