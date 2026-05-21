import { createGzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, extname, join, parse, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..', '..')
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_RETENTION_DAYS = 30

dotenv.config({ path: join(projectRoot, '.env.production'), quiet: true })
dotenv.config({ path: join(projectRoot, '.env.development'), quiet: true })

function parseArgs(argv) {
  const [command = 'summary', ...rest] = argv
  const options = {
    command,
    dryRun: false,
    dir: process.env.LOG_DIR || join(projectRoot, 'logs'),
    days: Number.parseInt(process.env.LOG_RETENTION_DAYS || `${DEFAULT_RETENTION_DAYS}`, 10),
    archiveDays: Number.parseInt(process.env.LOG_ARCHIVE_AFTER_DAYS || '7', 10),
    deleteSource: false
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--delete-source') {
      options.deleteSource = true
    } else if (arg === '--dir') {
      options.dir = rest[index + 1] || options.dir
      index += 1
    } else if (arg === '--days') {
      options.days = Number.parseInt(rest[index + 1] || '', 10)
      index += 1
    } else if (arg === '--archive-days') {
      options.archiveDays = Number.parseInt(rest[index + 1] || '', 10)
      index += 1
    }
  }

  if (!Number.isFinite(options.days) || options.days < 0) {
    options.days = DEFAULT_RETENTION_DAYS
  }
  if (!Number.isFinite(options.archiveDays) || options.archiveDays < 0) {
    options.archiveDays = 7
  }

  options.dir = resolve(projectRoot, options.dir)
  return options
}

function isSafeLogDir(logDir) {
  const resolved = resolve(logDir)
  const root = parse(resolved).root
  return resolved !== root && resolved.length > root.length
}

function isLogFile(filename) {
  return extname(filename).toLowerCase() === '.log'
}

function isArchiveFile(filename) {
  return filename.toLowerCase().endsWith('.log.gz')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

async function collectFiles(dir) {
  const files = []

  async function walk(currentDir) {
    let entries = []
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }

    for (const entry of entries) {
      const fullpath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullpath)
        continue
      }
      if (!entry.isFile()) continue

      const fileStat = await stat(fullpath)
      files.push({
        path: fullpath,
        name: entry.name,
        size: fileStat.size,
        mtimeMs: fileStat.mtimeMs
      })
    }
  }

  await walk(dir)
  return files
}

async function removeEmptyDirs(dir, baseDir) {
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirs(join(dir, entry.name), baseDir)
    }
  }

  if (resolve(dir) !== resolve(baseDir)) {
    try {
      const nextEntries = await readdir(dir)
      if (nextEntries.length === 0) {
        await rm(dir, { recursive: false, force: true })
      }
    } catch {
      // 忽略空目录清理失败。
    }
  }
}

async function commandSummary(options) {
  const files = await collectFiles(options.dir)
  const logFiles = files.filter(file => isLogFile(file.name))
  const archiveFiles = files.filter(file => isArchiveFile(file.name))
  const otherFiles = files.length - logFiles.length - archiveFiles.length
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  console.log(`Log directory: ${options.dir}`)
  console.log(`Files: ${files.length}`)
  console.log(`Active log files: ${logFiles.length}`)
  console.log(`Archives: ${archiveFiles.length}`)
  console.log(`Other files: ${otherFiles}`)
  console.log(`Total size: ${formatBytes(totalSize)}`)
}

async function commandCleanup(options) {
  if (options.days <= 0) {
    console.log('Cleanup skipped: --days is 0')
    return
  }

  if (!isSafeLogDir(options.dir)) {
    throw new Error(`Unsafe log directory: ${options.dir}`)
  }

  const cutoffMs = Date.now() - options.days * DAY_MS
  const files = await collectFiles(options.dir)
  const targets = files.filter(file => (isLogFile(file.name) || isArchiveFile(file.name)) && file.mtimeMs < cutoffMs)
  const totalSize = targets.reduce((sum, file) => sum + file.size, 0)

  console.log(`${options.dryRun ? 'Would delete' : 'Deleting'} ${targets.length} files older than ${options.days} days (${formatBytes(totalSize)})`)

  if (!options.dryRun) {
    for (const file of targets) {
      await rm(file.path, { force: true })
    }
    await removeEmptyDirs(options.dir, options.dir)
  }
}

async function gzipFile(source, target) {
  await mkdir(dirname(target), { recursive: true })
  await pipeline(createReadStream(source), createGzip({ level: 9 }), createWriteStream(target))
}

async function commandArchive(options) {
  if (!isSafeLogDir(options.dir)) {
    throw new Error(`Unsafe log directory: ${options.dir}`)
  }

  const cutoffMs = Date.now() - options.archiveDays * DAY_MS
  const files = await collectFiles(options.dir)
  const targets = files.filter(file => isLogFile(file.name) && file.mtimeMs < cutoffMs)

  console.log(`${options.dryRun ? 'Would archive' : 'Archiving'} ${targets.length} log files older than ${options.archiveDays} days`)

  for (const file of targets) {
    const target = `${file.path}.gz`
    if (options.dryRun) {
      console.log(`${file.path} -> ${target}`)
      continue
    }

    await gzipFile(file.path, target)
    if (options.deleteSource) {
      await rm(file.path, { force: true })
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.command === 'summary') {
    await commandSummary(options)
  } else if (options.command === 'cleanup') {
    await commandCleanup(options)
  } else if (options.command === 'archive') {
    await commandArchive(options)
  } else {
    console.error('Usage: node scripts/logs/manage.mjs <summary|cleanup|archive> [--dry-run] [--dir logs] [--days 30] [--archive-days 7] [--delete-source]')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
