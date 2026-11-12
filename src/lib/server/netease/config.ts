import { NETEASE_REAL_IP } from '$app/env/private';
import type { ModuleCallConfig } from 'hana-music-api';

export const configFor = (
  deviceId: string,
  credentials: Record<string, string> | null = null,
): ModuleCallConfig => ({
  cookie: credentials ?? undefined,
  state: { deviceId },
  realIP: NETEASE_REAL_IP || undefined,
});
