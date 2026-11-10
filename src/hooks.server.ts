import type { Handle, ServerInit } from '@sveltejs/kit/hooks';

import {
  cookieSecretConfigured,
  MIN_SECRET_LENGTH,
} from '#lib/server/credentials.js';
import { errorResponse } from '#lib/server/respond.js';

const MISSING_SECRET = `没有配置环境变量 COOKIE_SECRET（至少 ${MIN_SECRET_LENGTH} 个字符），Campanula 没法保存听众的登录。生成方法：openssl rand -base64 32`;

export const init: ServerInit = () => {
  if (!cookieSecretConfigured()) console.error(MISSING_SECRET);
};

export const handle: Handle = ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/') && !cookieSecretConfigured())
    return errorResponse({ kind: 'cookieSecretMissing' });
  return resolve(event);
};
