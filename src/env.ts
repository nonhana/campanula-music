import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  COOKIE_SECRET: {
    schema: (input) => input ?? '',
  },
  LOGIN_COOKIE_NAME: {
    schema: (input) => input?.trim() || 'campanula_login',
  },
  NETEASE_REAL_IP: {
    schema: (input) => input ?? '',
  },
});
