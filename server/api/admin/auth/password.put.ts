import {
  changeCurrentAdminPassword,
  type ChangeCurrentAdminPasswordBody
} from '#server/services/auth/admin_account'

function shouldUseSecureAdminCookie() {
  return process.env.ADMIN_AUTH_COOKIE_SECURE === 'true'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChangeCurrentAdminPasswordBody>(event)
  const result = await changeCurrentAdminPassword(event, body)

  setCookie(event, 'admin_auth', result.token, {
    sameSite: 'lax',
    secure: shouldUseSecureAdminCookie(),
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: false
  })

  return { success: true }
})
