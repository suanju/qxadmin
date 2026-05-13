import type { H3Event } from 'h3'

/**
 * 从原始 IP 字符串中移除端口信息。
 * 兼容 IPv4:port、`[IPv6]:port` 以及纯 IPv6 地址等多种来源格式。
 */
function stripPort(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (value.startsWith('[') && value.includes(']')) {
    return value.slice(1, value.indexOf(']'))
  }
  const colonCount = (value.match(/:/g) || []).length
  if (colonCount === 1 && value.includes('.')) {
    return value.slice(0, value.lastIndexOf(':'))
  }
  return value
}

/**
 * 按代理头优先级提取客户端真实 IP。
 * 会优先读取 `x-forwarded-for`，其次 `x-real-ip`，最后回退到底层 socket 地址。
 */
export function getClientIp(event: H3Event): string {
  const forwarded = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() || ''
  const realIp = getHeader(event, 'x-real-ip') || ''
  const remoteAddress = event.node?.req?.socket?.remoteAddress as string | undefined
  return stripPort(forwarded || realIp || remoteAddress || '')
}
