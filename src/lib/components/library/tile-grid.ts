// 格子网格的目录（DESIGN.md Layout）：按种类和排法给出格宽、列数、骨架数量、圆形头像。
// 状态机（加载 / 失败 / 空 / 内容）在 TileGrid，架子本身在 Shelf；调用方只说“哪一类、怎么排”。

export type TileKind = 'playlist' | 'album' | 'artist'
/** grid：铺满的封面网格；shelf：横向架子；overview：搜索综合里歌单那一排（4 / 5 / 6 张） */
export type TileGridLayout = 'grid' | 'shelf' | 'overview'

export interface TileGridLook {
  /** 网格的列和间距（架子只取 gap） */
  list: string
  /** 架子上的格宽；网格里跟着列宽 */
  width: string
  /** 加载时的骨架数量 */
  bones: number
  /** 圆形头像（歌手） */
  round: boolean
}

/** 手机上的列数：歌单、专辑两列，歌手三列（DESIGN.md Layout） */
const PHONE_COLUMNS: Record<TileKind, string> = {
  playlist: 'grid-cols-2',
  album: 'grid-cols-2',
  artist: 'grid-cols-3',
}

/** 桌面网格的格宽：歌单、专辑 176px，歌手 128px（#75 把 176 / 168 的漂移收到这里） */
const GRID_COLUMNS: Record<TileKind, string> = {
  playlist: 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))]',
  album: 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))]',
  artist: 'grid-cols-[repeat(auto-fill,minmax(128px,1fr))]',
}

/** 横向架子的格宽：专辑 168px、歌手 120px（DESIGN.md）；手机搜索结果里歌单 140、歌手 104、专辑 140 */
const SHELF_WIDTH: Record<TileKind, { phone: string, desktop: string }> = {
  playlist: { phone: 'w-[140px]', desktop: 'w-[168px]' },
  album: { phone: 'w-[140px]', desktop: 'w-[168px]' },
  artist: { phone: 'w-[104px]', desktop: 'w-[120px]' },
}

/** 横向架子的间距：桌面歌单 / 专辑 20px、歌手 24px；手机都是 12px */
const SHELF_GAP: Record<TileKind, { phone: string, desktop: string }> = {
  playlist: { phone: 'gap-3', desktop: 'gap-5' },
  album: { phone: 'gap-3', desktop: 'gap-5' },
  artist: { phone: 'gap-3', desktop: 'gap-6' },
}

const ROUND: Record<TileKind, boolean> = { playlist: false, album: false, artist: true }

/** 骨架数量：桌面网格 6；手机歌单 / 专辑 4、歌手 6；架子桌面 7 / 9，手机 3 / 4（DESIGN.md） */
const BONES: Record<TileKind, { grid: { phone: number, desktop: number }, shelf: { phone: number, desktop: number } }> = {
  playlist: { grid: { phone: 4, desktop: 6 }, shelf: { phone: 3, desktop: 7 } },
  album: { grid: { phone: 4, desktop: 6 }, shelf: { phone: 3, desktop: 7 } },
  artist: { grid: { phone: 6, desktop: 6 }, shelf: { phone: 4, desktop: 9 } },
}

export function tileGridLook(kind: TileKind, layout: TileGridLayout, phone: boolean): TileGridLook {
  const mode = phone ? 'phone' : 'desktop'
  switch (layout) {
    case 'overview':
      return {
        list: 'grid-cols-4 gap-x-5 lg:grid-cols-5 xl:grid-cols-6',
        width: '',
        bones: 6,
        round: false,
      }
    case 'shelf':
      return {
        list: SHELF_GAP[kind][mode],
        width: SHELF_WIDTH[kind][mode],
        bones: BONES[kind].shelf[mode],
        round: ROUND[kind],
      }
    case 'grid':
      return {
        list: phone ? `${PHONE_COLUMNS[kind]} gap-x-3 gap-y-5` : `${GRID_COLUMNS[kind]} gap-x-5 gap-y-6`,
        width: '',
        bones: BONES[kind].grid[mode],
        round: ROUND[kind],
      }
    default: {
      const unhandled: never = layout
      throw new Error(`不认识的格子排法：${unhandled}`)
    }
  }
}

/** 骨架和内容用同一套排法：形状一致的骨架（DESIGN.md Do's） */
export function tileListClass(look: TileGridLook, layout: TileGridLayout, phone: boolean, inset: boolean): string[] {
  if (layout === 'shelf')
    return ['flex overflow-hidden pb-3 pt-1', look.list, phone ? 'px-4' : 'px-2 -mx-2']
  return ['grid', look.list, phone ? 'px-4 pt-4' : inset ? 'p-3' : '']
}

/** 每一格：网格里跟着列宽，架子上固定宽，搜索综合里放不下的藏起来（不进 Tab 顺序） */
export function tileCellClass(look: TileGridLook, layout: TileGridLayout, index: number): (string | false)[] {
  if (layout === 'shelf')
    return ['min-w-0 flex-none', look.width]
  if (layout === 'overview')
    return ['min-w-0', index === 4 && 'hidden lg:block', index === 5 && 'hidden xl:block']
  return ['min-w-0']
}

/**
 * 目录里拼出来的 class 要让 UnoCSS 也看得见：开发时它只扫 .svelte 的模块，不扫 .ts 里的字符串
 * （构建时的全局扫描会扫，但开发服务器不生成这些规则，界面会悄悄没有格宽和间距）。
 * uno.config.ts 把这一份放进 safelist；class 名仍然只有这里一个出处。
 * 新增 kind / layout 时同步这里的数组。
 */
function everyLookClass(): string[] {
  const kinds: readonly TileKind[] = ['playlist', 'album', 'artist']
  const layouts: readonly TileGridLayout[] = ['grid', 'shelf', 'overview']
  const classes = kinds.flatMap(kind => layouts.flatMap(layout => [false, true].flatMap((phone) => {
    const look = tileGridLook(kind, layout, phone)
    return [
      look.list,
      look.width,
      ...Array.from({ length: 6 }, (_, index) => tileCellClass(look, layout, index)).flat(),
      ...tileListClass(look, layout, phone, true),
      ...tileListClass(look, layout, phone, false),
    ]
  })))
  return [...new Set(classes.filter((value): value is string => typeof value === 'string').flatMap(value => value.split(/\s+/)).filter(Boolean))]
}

export const TILE_GRID_SAFELIST: readonly string[] = everyLookClass()
