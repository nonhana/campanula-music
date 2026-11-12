import { Cookie } from 'tough-cookie';

import { shapeChanged } from './failure';

const mergeCookies = (
  base: Record<string, string>,
  lines: readonly string[],
  now: number,
): Record<string, string> => {
  const credentials = { ...base };
  for (const line of lines) {
    const cookie = Cookie.parse(line);
    if (!cookie) continue;
    if (cookie.value && (cookie.expiryTime(new Date(now)) ?? Infinity) > now)
      credentials[cookie.key] = cookie.value;
    else delete credentials[cookie.key];
  }
  return credentials;
};

export const credentialsFrom = (
  module: string,
  setCookies: readonly string[],
  base: Record<string, string> = {},
): Record<string, string> => {
  const credentials = mergeCookies(base, setCookies, Date.now());
  if (!credentials.MUSIC_U || credentials.MUSIC_U === base.MUSIC_U)
    throw shapeChanged(module, '没有下发新的 MUSIC_U');
  return credentials;
};
