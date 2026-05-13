import { issueLoginCaptcha } from '#server/lib/auth/captcha'

export default defineEventHandler((event) => {
  setHeader(event, 'cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate')

  return issueLoginCaptcha(event)
})
