import type { Handle } from '@sveltejs/kit/hooks'

import { cookieSecretConfigured, MIN_SECRET_LENGTH } from '#lib/server/credentials.js'
import { errorResponse } from '#lib/server/respond.js'

// 站长没配加密 Cookie 的密钥时，接口什么都做不了：一律回 cookieSecretMissing，页面上给站长看配置说明
export const handle: Handle = ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/') && !cookieSecretConfigured()) {
    console.error(`没有配置环境变量 COOKIE_SECRET（至少 ${MIN_SECRET_LENGTH} 个字符），Campanula 没法保存听众的登录。生成方法：openssl rand -base64 32`)
    return errorResponse({ kind: 'cookieSecretMissing' })
  }
  return resolve(event)
}
