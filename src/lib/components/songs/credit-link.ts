import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

export type CreditKind = 'artist' | 'album';

// 网易云没给时 id、name 是 null；云盘的歌 id 是 0
export interface CreditTarget {
  readonly id: number | null;
  readonly name: string | null;
}

export interface CreditLink {
  readonly name: string;
  readonly href: ResolvedPathname;
}

export const creditLink = (
  kind: CreditKind,
  target: CreditTarget,
  here: string,
): CreditLink | null => {
  if (target.id === null || target.id <= 0 || !target.name) return null;
  const href =
    kind === 'artist'
      ? resolve('/artists/[id=neteaseId]', { id: target.id })
      : resolve('/albums/[id=neteaseId]', { id: target.id });
  return href === here ? null : { name: target.name, href };
};
