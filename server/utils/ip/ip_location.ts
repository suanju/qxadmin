import { IPv4, IPv6, loadVectorIndexFromFile, newWithVectorIndex } from 'ip2region.js'
import type { Searcher } from 'ip2region.js'
import path from 'node:path'

export interface IpLocationResolved {
  ip_location?: string
  ip_country?: string
  ip_province?: string
  ip_city?: string
  ip_isp?: string
  ip_region_raw?: string
}

let v4VectorIndex: Buffer | null = null
let v6VectorIndex: Buffer | null = null
let v4Searcher: Searcher | null = null
let v6Searcher: Searcher | null = null

/**
 * 判断 IP 是否属于本地、回环或内网地址。
 * 这类地址通常没有公网地理信息，直接跳过归属地解析可以减少无意义查询。
 */
function isPrivateIp(ip: string): boolean {
  const value = ip.trim().toLowerCase()
  if (!value) return true
  if (value === 'localhost') return true
  if (value.startsWith('127.')) return true
  if (value === '::1') return true
  if (value.startsWith('10.')) return true
  if (value.startsWith('192.168.')) return true

  const match172 = value.match(/^172\.(\d+)\./)
  if (match172) {
    const segment = Number(match172[1])
    if (segment >= 16 && segment <= 31) return true
  }

  if (value.startsWith('fc') || value.startsWith('fd')) return true
  if (value.startsWith('fe80:')) return true
  return false
}

/**
 * 计算 ip2region 数据文件的绝对路径。
 * 根据 IP 协议版本返回对应的 IPv4 或 IPv6 `.xdb` 文件位置。
 */
function getXdbPath(version: 'v4' | 'v6'): string {
  return path.resolve(process.cwd(), 'public', 'ip2region', version === 'v4' ? 'ip2region_v4.xdb' : 'ip2region_v6.xdb')
}

/**
 * 按需初始化并复用 ip2region 搜索器实例。
 * 通过缓存向量索引和 searcher，避免每次解析 IP 都重复加载大文件。
 */
function ensureSearcher(isV6: boolean): Searcher {
  if (isV6) {
    if (!v6VectorIndex) {
      v6VectorIndex = loadVectorIndexFromFile(getXdbPath('v6'))
    }
    if (!v6Searcher) {
      v6Searcher = newWithVectorIndex(IPv6, getXdbPath('v6'), v6VectorIndex)
    }
    return v6Searcher
  }

  if (!v4VectorIndex) {
    v4VectorIndex = loadVectorIndexFromFile(getXdbPath('v4'))
  }
  if (!v4Searcher) {
    v4Searcher = newWithVectorIndex(IPv4, getXdbPath('v4'), v4VectorIndex)
  }
  return v4Searcher
}

/**
 * 规范化归属地片段值。
 * 将空字符串和 ip2region 中表示“未知”的 `0` 统一转换为空值。
 */
function normalizeRegionPart(value: string | undefined): string {
  const normalized = (value ?? '').trim()
  if (!normalized || normalized === '0') return ''
  return normalized
}

/**
 * 拼接人类可读的归属地文案。
 * 会自动忽略空片段，最终形成类似“国家 省份 城市 运营商”的展示文本。
 */
function buildLocationText(country: string, province: string, city: string, isp: string): string {
  return [country, province, city, isp].map((item) => item.trim()).filter(Boolean).join(' ')
}

/**
 * 解析 IP 对应的国家、省份、城市和运营商信息。
 * 对私网地址、空地址或解析失败场景统一返回空对象，避免调用方额外兜底。
 */
export async function resolveIpLocation(ipRaw: unknown): Promise<IpLocationResolved> {
  const ip = String(ipRaw ?? '').trim()
  if (!ip || isPrivateIp(ip)) return {}

  const isV6 = ip.includes(':')
  try {
    const searcher = ensureSearcher(isV6)
    const region = String((await Promise.resolve(searcher.search(ip))) ?? '')
    if (!region) return {}

    const [country0, province0, city0, isp0] = region.split('|')
    const country = normalizeRegionPart(country0)
    const province = normalizeRegionPart(province0)
    const city = normalizeRegionPart(city0)
    const isp = normalizeRegionPart(isp0)

    return {
      ip_location: buildLocationText(country, province, city, isp),
      ip_country: country,
      ip_province: province,
      ip_city: city,
      ip_isp: isp,
      ip_region_raw: region
    }
  } catch {
    return {}
  }
}
