import { defineEnvVars } from '@sveltejs/kit/env'

// 两个变量都不是启动必需的：没配时取空字符串，进程照常起来。
// COOKIE_SECRET 没配好由 hooks.server.ts 给站长显示配置说明（cookieSecretConfigured），不能在启动时直接崩溃
export const variables = defineEnvVars({
  COOKIE_SECRET: { schema: input => input ?? '' },
  NETEASE_REAL_IP: { schema: input => input ?? '' },
})
