import { defineEnvVars } from '@sveltejs/kit/env'

// 两个变量都不是启动必需的：没配时取空字符串，进程照常起来。
// COOKIE_SECRET 没配好由 hooks.server.ts 给站长显示配置说明（cookieSecretConfigured），不能在启动时直接崩溃
export const variables = defineEnvVars({
  COOKIE_SECRET: {
    schema: input => input ?? '',
  },
  // 登录 Cookie 名。mock 的 dev 脚本把它设成 campanula_login_mock：Cookie 只按 host 隔离，不按端口，
  // 两个名字分开后，同一个浏览器开 5173 和 5174 不会互相顶掉登录态
  LOGIN_COOKIE_NAME: {
    schema: input => input?.trim() || 'campanula_login',
  },
  NETEASE_REAL_IP: {
    schema: input => input ?? '',
  },
})
