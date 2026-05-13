/**
 * 日志配置插件
 * 配置 consola 日志级别，并注册写文件的 reporter。
 */

import { consola } from 'consola'
import {
  cleanupExpiredLogFiles,
  createFileReporter,
  getLogRuntimeOptions
} from '#server/utils/log/logger_file_reporter'

export default defineNitroPlugin(() => {
  // LOG_LEVEL: debug, info, warn, error, silent
  const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

  const levelMap: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: -1
  }

  const level = levelMap[logLevel.toLowerCase()] ?? 1
  consola.level = level

  // 开发环境默认 debug，可通过 LOG_LEVEL 覆盖。
  if (process.env.NODE_ENV === 'development') {
    consola.level = 0
  }

  // 仅注册一次文件 reporter，避免热更新重复注册造成重复写日志。
  const globalFlags = globalThis as Record<string, unknown>
  const reporterFlag = '__qxadmin_file_reporter_registered__'
  if (!globalFlags[reporterFlag]) {
    const fileReporter = createFileReporter()
    consola.addReporter(fileReporter)
    globalFlags[reporterFlag] = true
  }

  const cleanupFlag = '__qxadmin_log_cleanup_done__'
  if (!globalFlags[cleanupFlag]) {
    const cleanupResult = cleanupExpiredLogFiles()
    globalFlags[cleanupFlag] = true
    if (!cleanupResult.skipped && cleanupResult.removed > 0) {
      consola.info('历史日志清理完成', { removed: cleanupResult.removed })
    }
  }

  const logOptions = getLogRuntimeOptions()

  consola.info('日志系统已初始化', {
    level: logLevel,
    numericLevel: level,
    environment: process.env.NODE_ENV || 'development',
    logDir: logOptions.baseLogDir,
    maxFileSizeBytes: logOptions.maxFileSizeBytes,
    retentionDays: logOptions.retentionDays
  })
})
