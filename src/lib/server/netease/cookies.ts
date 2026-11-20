import { shapeChanged } from './failure.ts';

interface ParsedCookie {
  key: string;
  value: string;
  expiry: number;
}

const parseSetCookie = (line: string, now: number): ParsedCookie | null => {
  const parts = line.split(';');
  const pair = parts[0]!;
  const eq = pair.indexOf('=');
  if (eq <= 0) return null;
  const key = pair.slice(0, eq).trim();
  if (!key) return null;
  const value = pair.slice(eq + 1).trim();
  let maxAge: number | undefined;
  let expires: number | undefined;
  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i]!.trim();
    const attrEq = part.indexOf('=');
    if (attrEq <= 0) continue;
    const name = part.slice(0, attrEq).trim().toLowerCase();
    const attrValue = part.slice(attrEq + 1).trim();
    if (name === 'max-age' && /^-?\d+$/.test(attrValue)) {
      const seconds = Number(attrValue);
      maxAge = seconds <= 0 ? -Infinity : now + seconds * 1000;
    } else if (name === 'expires') {
      const parsed = Date.parse(attrValue);
      if (Number.isFinite(parsed)) expires = parsed;
    }
  }
  return {
    key,
    value,
    expiry: maxAge ?? expires ?? Infinity,
  };
};

const mergeCookies = (
  base: Record<string, string>,
  lines: readonly string[],
  now: number,
): Record<string, string> => {
  const credentials = { ...base };
  for (const line of lines) {
    const cookie = parseSetCookie(line, now);
    if (!cookie) continue;
    if (cookie.value && cookie.expiry > now)
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
