import { randomInt, randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { getClientIp } from '#server/utils/request/client_ip'

const CAPTCHA_TTL_MS = 5 * 60 * 1000
const CAPTCHA_LENGTH = 4
const CAPTCHA_MAX_FAILURES = 5
const CAPTCHA_STORE_LIMIT = 500
const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

type CaptchaRecord = {
  code: string
  ip: string
  expiresAt: number
  failureCount: number
}

const captchaStore = new Map<string, CaptchaRecord>()

function randomBetween(min: number, max: number) {
  return randomInt(min, max + 1)
}

function pickChar() {
  return CAPTCHA_CHARS[randomInt(0, CAPTCHA_CHARS.length)]
}

function createCaptchaCode() {
  return Array.from({ length: CAPTCHA_LENGTH }, pickChar).join('')
}

function cleanupCaptchaStore(now = Date.now()) {
  for (const [captchaId, record] of captchaStore.entries()) {
    if (record.expiresAt <= now) {
      captchaStore.delete(captchaId)
    }
  }

  const overflow = captchaStore.size - CAPTCHA_STORE_LIMIT
  if (overflow <= 0) return

  let removed = 0
  for (const captchaId of captchaStore.keys()) {
    captchaStore.delete(captchaId)
    removed += 1
    if (removed >= overflow) break
  }
}

function randomColor(min = 48, max = 180) {
  const r = randomBetween(min, max)
  const g = randomBetween(min, max)
  const b = randomBetween(min, max)
  return `rgb(${r}, ${g}, ${b})`
}

function buildNoiseLines(width: number, height: number) {
  return Array.from({ length: 6 }, () => {
    const x1 = randomBetween(0, width)
    const y1 = randomBetween(0, height)
    const x2 = randomBetween(0, width)
    const y2 = randomBetween(0, height)
    const strokeWidth = (Math.random() * 1.5 + 0.6).toFixed(2)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${randomColor(120, 210)}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.85" />`
  }).join('')
}

function buildNoiseDots(width: number, height: number) {
  return Array.from({ length: 14 }, () => {
    const cx = randomBetween(4, width - 4)
    const cy = randomBetween(4, height - 4)
    const radius = (Math.random() * 1.7 + 0.8).toFixed(2)
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${randomColor(90, 220)}" opacity="0.75" />`
  }).join('')
}

function buildText(code: string, width: number, height: number) {
  const startX = 20
  const gap = (width - startX * 2) / code.length

  return code
    .split('')
    .map((char, index) => {
      const x = startX + gap * index + randomBetween(-2, 5)
      const y = height / 2 + randomBetween(6, 13)
      const rotate = randomBetween(-24, 24)
      const fontSize = randomBetween(24, 30)
      return `<text x="${x}" y="${y}" fill="${randomColor(25, 130)}" font-size="${fontSize}" font-family="'Segoe UI', 'PingFang SC', sans-serif" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${char}</text>`
    })
    .join('')
}

function buildCaptchaSvg(code: string) {
  const width = 132
  const height = 48
  const gradientId = `captcha-gradient-${randomUUID()}`

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="登录验证码">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#dbeafe" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="14" fill="url(#${gradientId})" />
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="13" fill="none" stroke="rgba(59, 130, 246, 0.18)" />
  ${buildNoiseLines(width, height)}
  ${buildNoiseDots(width, height)}
  ${buildText(code, width, height)}
</svg>`.trim()
}

function buildCaptchaImageDataUrl(code: string) {
  const svg = buildCaptchaSvg(code)
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function normalizeCaptchaCode(value?: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function issueLoginCaptcha(event: H3Event) {
  cleanupCaptchaStore()

  const captchaId = randomUUID()
  const code = createCaptchaCode()
  const now = Date.now()

  captchaStore.set(captchaId, {
    code,
    ip: getClientIp(event) || 'unknown',
    expiresAt: now + CAPTCHA_TTL_MS,
    failureCount: 0
  })

  return {
    captchaId,
    imageDataUrl: buildCaptchaImageDataUrl(code),
    expiresInSec: Math.floor(CAPTCHA_TTL_MS / 1000)
  }
}

export function verifyLoginCaptcha(
  event: H3Event,
  payload: {
    captchaId?: string
    captchaCode?: string
  }
) {
  const captchaId = String(payload.captchaId || '').trim()
  const captchaCode = normalizeCaptchaCode(payload.captchaCode)

  if (!captchaId) {
    return { ok: false as const, message: '验证码已失效，请刷新后重试' }
  }

  if (!captchaCode) {
    return { ok: false as const, message: '请输入图片验证码' }
  }

  cleanupCaptchaStore()

  const record = captchaStore.get(captchaId)
  if (!record) {
    return { ok: false as const, message: '验证码不存在或已过期，请刷新后重试' }
  }

  if (record.expiresAt <= Date.now()) {
    captchaStore.delete(captchaId)
    return { ok: false as const, message: '验证码已过期，请刷新后重试' }
  }

  const currentIp = getClientIp(event) || 'unknown'
  if (record.ip && currentIp && record.ip !== currentIp) {
    captchaStore.delete(captchaId)
    return { ok: false as const, message: '验证码校验环境已变化，请重新获取验证码' }
  }

  if (record.code !== captchaCode) {
    record.failureCount += 1

    if (record.failureCount >= CAPTCHA_MAX_FAILURES) {
      captchaStore.delete(captchaId)
      return { ok: false as const, message: '验证码错误次数过多，请刷新后重试' }
    }

    captchaStore.set(captchaId, record)
    return {
      ok: false as const,
      message: `验证码错误，还可再试 ${CAPTCHA_MAX_FAILURES - record.failureCount} 次`
    }
  }

  captchaStore.delete(captchaId)
  return { ok: true as const }
}
