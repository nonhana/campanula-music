import { resolve } from '$app/paths'

/** 歌手名去歌手页，专辑名去专辑页 */
export type CreditKind = 'artist' | 'album'

/** 一个歌手（Credit）或一张专辑（Song['album']）：网易云没给时编号、名字是 null，传到云盘的歌歌手编号是 0 */
export interface CreditTarget {
  readonly id: number | null
  readonly name: string | null
}

/** 能点开的一个名字（#84） */
export interface CreditLink {
  readonly name: string
  readonly href: string
}

/**
 * 歌手名、专辑名能不能点（DESIGN.md Song Row · 歌手名、专辑名）：编号大于 0（地址只认正整数）、有名字的才是链接；
 * 指向现在这一页的（here 是现在地址的路径）写纯文字，例如专辑页里每行的专辑、歌手页里这位歌手自己。多选、没登录时由调用方整行写纯文字
 */
export const creditLink = (kind: CreditKind, target: CreditTarget, here: string): CreditLink | null => {
  if (target.id === null || target.id <= 0 || !target.name)
    return null
  const href = kind === 'artist'
    ? resolve('/artists/[id=neteaseId]', { id: target.id })
    : resolve('/albums/[id=neteaseId]', { id: target.id })
  return href === here
    ? null
    : { name: target.name, href }
}
