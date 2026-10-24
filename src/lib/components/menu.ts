import type { LucideIcon } from '@lucide/svelte'

/** 菜单行的语气：红心了的实心心形（珊瑚色）、下载（蜜桃枝）、删除（出错红，文字也是红的） */
export type MenuTone = 'hearted' | 'download' | 'destructive'

/**
 * 行左边的标记：一个图标；薄荷雾方块里的图标（新建歌单）；歌单封面（我喜欢的音乐角上一颗珊瑚色实心心形）
 */
export type MenuLeading
  = | { readonly kind: 'icon', readonly icon: LucideIcon }
    | { readonly kind: 'tile', readonly icon: LucideIcon }
    | { readonly kind: 'cover', readonly url: string | null, readonly heart?: boolean }

/**
 * 菜单壳画的一行：歌曲菜单、歌单 •••、头像菜单、加入歌单的选择器都用这一份数据。
 * 行怎么画、多高、键盘怎么走由 MenuList 管；这里只说这一行是什么、能不能选、选了做什么（#73）
 */
export interface MenuItem {
  readonly key: string
  readonly label: string
  /** 名字的语言（歌名、歌手、歌单名）；中文不用给 */
  readonly lang?: string
  /** 名字下面一行：首数、不能选的理由 */
  readonly detail?: string
  readonly leading?: MenuLeading
  readonly tone?: MenuTone
  readonly disabled?: boolean
  /** 这一项上面有一条分隔线 */
  readonly separated?: boolean
  /**
   * 选了之后菜单壳是否自动关上（默认关）。转交给另一层的项（加入歌单、新建歌单、编辑歌单）自己关，设成 false，
   * 不然壳会在转交后又去关旧的一层
   */
  readonly closeOnChoose?: boolean
  readonly run: () => void
}

/** 菜单顶上的头：有封面的是歌曲菜单和歌单 •••；文字头是加入歌单（标题 + 首数 / 歌曲） */
export type MenuHeader
  = | {
    readonly kind: 'media'
    readonly coverUrl: string | null
    readonly title: string
    readonly titleLang?: string
    readonly subtitle?: string
    readonly subtitleLang?: string
  }
  | {
    readonly kind: 'text'
    readonly title: string
    /** 跟在标题后面的首数（“· 12 首”），样式比标题轻 */
    readonly note?: string
    readonly subtitle?: string
    readonly subtitleLang?: string
  }
