/**
 * consola 文件日志 reporter。
 * 日志目录按月份分层：
 * - logs/202603/api-2026-03-18.log
 * - logs/202603/thirdparty-2026-03-18.log
 *
 * 当前支持：
 * - 按标签拆分文件
 * - 按天生成文件
 * - 按月份分目录
 * - 按文件大小自动轮转
 * - 按保留天数清理历史日志
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'

import { basename, extname, join, parse, resolve } from 'node:path'

const LOG_LEVEL_NAMES: Record<number, string> = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'FATAL'
}

const TAG_TO_PREFIX: Record<string, string> = {
  API: 'api',
  ThirdPartyAPI: 'thirdparty',
  DB: 'db',
  Service: 'service',
  Callback: 'callback'
}

const DEFAULT_MAX_FILE_SIZE_MB = 50
const DEFAULT_RETENTION_DAYS = 30
const BYTES_PER_MB = 1024 * 1024
const DAY_MS = 24 * 60 * 60 * 1000

export interface LogRuntimeOptions {
  baseLogDir: string
  maxFileSizeBytes: number
  retentionDays: number
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

/**
 * 获取日志根目录。
 * 支持通过环境变量覆盖默认位置，方便部署时把日志写入指定磁盘。
 */
function getBaseLogDir(): string {
  return process.env.LOG_DIR || join(process.cwd(), 'logs')
}

/**
 * 读取日志运行时配置。
 */
export function getLogRuntimeOptions(): LogRuntimeOptions {
  const maxFileSizeMb = parsePositiveInt(process.env.LOG_MAX_FILE_SIZE_MB, DEFAULT_MAX_FILE_SIZE_MB)
  return {
    baseLogDir: resolve(getBaseLogDir()),
    maxFileSizeBytes: maxFileSizeMb * BYTES_PER_MB,
    retentionDays: parseNonNegativeInt(process.env.LOG_RETENTION_DAYS, DEFAULT_RETENTION_DAYS)
  }
}

/**
 * 将日期格式化为 `YYYYMM` 目录名。
 * 日志按月分目录，方便归档和按时间范围检索。
 */
function formatMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}${month}`
}

/**
 * 根据日期计算日志文件所在目录。
 */
function getLogDirByDate(date: Date): string {
  return join(getLogRuntimeOptions().baseLogDir, formatMonth(date))
}

/**
 * 根据日志标签和日期生成文件名。
 * 不同业务标签会落到不同前缀文件中，避免多类日志混杂在一起。
 */
function getLogFilename(tag: string, date: Date): string {
  const day = date.toISOString().slice(0, 10) // YYYY-MM-DD
  const prefix = (tag && TAG_TO_PREFIX[tag]) || 'app'
  return `${prefix}-${day}.log`
}

/**
 * 将单个日志参数稳定转换为字符串。
 * 对 Error 会展开 name、message 和 stack，便于后续排查问题。
 */
function stringifyArg(value: unknown): string {
  if (typeof value === 'string') return value

  if (value instanceof Error) {
    return JSON.stringify(
      {
        name: value.name,
        message: value.message,
        stack: value.stack
      },
      null,
      0
    )
  }

  try {
    return typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value)
  } catch {
    return String(value)
  }
}

/**
 * 将日志参数数组拼接成最终写盘文本。
 */
function formatArgs(args: unknown[]): string {
  if (!args.length) return ''
  return args.map(a => stringifyArg(a)).join(' ')
}

/**
 * 移除 ANSI 颜色控制字符。
 * 防止终端彩色输出直接进入日志文件后影响阅读和检索。
 */
function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, '')
}

/**
 * 解析可用于写盘的日志时间。
 * 非法日期会自动回退到当前时间，避免生成异常路径或内容。
 */
function resolveDate(input?: Date): Date {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input
  }
  return new Date()
}

/**
 * 将数值日志级别转换为可读文本。
 */
function levelName(level: number): string {
  return LOG_LEVEL_NAMES[level] ?? 'LOG'
}

function formatRotationTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function getUniqueRotatePath(filepath: string, date: Date): string {
  const parsed = parse(filepath)
  const ext = parsed.ext || '.log'
  const timestamp = formatRotationTimestamp(date)
  const base = join(parsed.dir, `${parsed.name}.${timestamp}.${process.pid}`)
  let candidate = `${base}${ext}`
  let index = 1

  while (existsSync(candidate)) {
    candidate = `${base}.${index}${ext}`
    index += 1
  }

  return candidate
}

/**
 * 单个日志文件超过阈值时，先把当前文件重命名为带时间戳的历史文件。
 */
function rotateFileIfNeeded(filepath: string, nextLine: string, maxFileSizeBytes: number): void {
  if (maxFileSizeBytes <= 0 || !existsSync(filepath)) return

  const currentSize = statSync(filepath).size
  const nextSize = Buffer.byteLength(nextLine, 'utf8')
  if (currentSize + nextSize <= maxFileSizeBytes) return

  renameSync(filepath, getUniqueRotatePath(filepath, new Date()))
}

function isLogLikeFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return ext === '.log' || ext === '.gz'
}

function isCleanupBaseDirSafe(baseLogDir: string): boolean {
  const resolved = resolve(baseLogDir)
  const root = parse(resolved).root

  if (resolved === root) return false
  if (basename(resolved).trim() === '') return false

  return true
}

function cleanupExpiredLogFilesInDir(dir: string, cutoffMs: number): number {
  let removed = 0

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullpath = join(dir, entry.name)

    if (entry.isDirectory()) {
      removed += cleanupExpiredLogFilesInDir(fullpath, cutoffMs)
      try {
        if (readdirSync(fullpath).length === 0) {
          rmSync(fullpath, { recursive: false, force: true })
        }
      } catch {
        // 清理空目录失败不影响主流程。
      }
      continue
    }

    if (!entry.isFile() || !isLogLikeFile(entry.name)) continue

    try {
      const stat = statSync(fullpath)
      if (stat.mtimeMs < cutoffMs) {
        rmSync(fullpath, { force: true })
        removed += 1
      }
    } catch {
      // 单个文件无法读取或删除时跳过，避免影响服务启动。
    }
  }

  return removed
}

/**
 * 按保留天数清理历史日志。
 * `LOG_RETENTION_DAYS=0` 表示不自动清理。
 */
export function cleanupExpiredLogFiles(now = new Date()): { removed: number; skipped: boolean; reason?: string } {
  const options = getLogRuntimeOptions()
  if (options.retentionDays <= 0) {
    return { removed: 0, skipped: true, reason: 'retention disabled' }
  }

  if (!existsSync(options.baseLogDir)) {
    return { removed: 0, skipped: true, reason: 'log directory does not exist' }
  }

  if (!isCleanupBaseDirSafe(options.baseLogDir)) {
    return { removed: 0, skipped: true, reason: 'unsafe log directory' }
  }

  const cutoffMs = now.getTime() - options.retentionDays * DAY_MS
  return {
    removed: cleanupExpiredLogFilesInDir(options.baseLogDir, cutoffMs),
    skipped: false
  }
}

export interface ConsolaLogObject {
  date: Date
  args: unknown[]
  type: string
  level: number
  tag?: string
}

export interface DirectFileLogPayload {
  tag?: string
  level?: number
  args?: unknown[]
  date?: Date
}

/**
 * 将一条标签日志直接追加写入对应文件。
 * 内部会自动创建目录，并在写入失败时把错误打印到标准输出。
 */
export function writeTaggedLogToFile(payload: DirectFileLogPayload): void {
  const date = resolveDate(payload.date)
  const options = getLogRuntimeOptions()
  const tag = payload.tag || ''
  const level = levelName(payload.level ?? 1)
  const msg = stripAnsi(formatArgs(payload.args || []))
  const line = `[${date.toISOString()}] [${level}] ${tag ? `[${tag}] ` : ''}${msg}\n`

  const logDir = getLogDirByDate(date)
  const filename = getLogFilename(tag, date)
  const filepath = join(logDir, filename)

  try {
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
    rotateFileIfNeeded(filepath, line, options.maxFileSizeBytes)
    appendFileSync(filepath, line, 'utf8')
  } catch (error) {
    process.stdout.write(`[logger_file_reporter] write failed: ${error}\n`)
  }
}

/**
 * 创建可挂载到 consola 的文件 reporter。
 * reporter 接收到 consola 日志对象后，会转为项目统一的文件落盘格式。
 */
export function createFileReporter(): { log: (logObj: ConsolaLogObject) => void } {
  return {
    log(logObj: ConsolaLogObject) {
      writeTaggedLogToFile({
        tag: logObj.tag,
        level: logObj.level,
        args: logObj.args,
        date: logObj.date
      })
    }
  }
}
