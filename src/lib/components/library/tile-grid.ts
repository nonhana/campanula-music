export type TileKind = 'playlist' | 'album' | 'artist';
export type TileGridLayout = 'grid' | 'shelf' | 'overview';

export interface TileGridLook {
  list: string;
  width: string;
  bones: number;
  round: boolean;
}

// 歌单页头的大封面也先铺这一张小图（左栏多半已加载过），别只按行高调
export const ROW_COVER_SIZE = 40;

const PHONE_COLUMNS: Record<TileKind, string> = {
  playlist: 'grid-cols-2',
  album: 'grid-cols-2',
  artist: 'grid-cols-3',
};

const GRID_COLUMNS: Record<TileKind, string> = {
  playlist: 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))]',
  album: 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))]',
  artist: 'grid-cols-[repeat(auto-fill,minmax(128px,1fr))]',
};

const SHELF_WIDTH: Record<TileKind, { phone: string; desktop: string }> = {
  playlist: { phone: 'w-[140px]', desktop: 'w-[168px]' },
  album: { phone: 'w-[140px]', desktop: 'w-[168px]' },
  artist: { phone: 'w-[104px]', desktop: 'w-[120px]' },
};

const SHELF_GAP: Record<TileKind, { phone: string; desktop: string }> = {
  playlist: { phone: 'gap-3', desktop: 'gap-5' },
  album: { phone: 'gap-3', desktop: 'gap-5' },
  artist: { phone: 'gap-3', desktop: 'gap-6' },
};

const ROUND: Record<TileKind, boolean> = {
  playlist: false,
  album: false,
  artist: true,
};

const BONES: Record<
  TileKind,
  {
    grid: { phone: number; desktop: number };
    shelf: { phone: number; desktop: number };
  }
> = {
  playlist: {
    grid: { phone: 4, desktop: 6 },
    shelf: { phone: 3, desktop: 7 },
  },
  album: {
    grid: { phone: 4, desktop: 6 },
    shelf: { phone: 3, desktop: 7 },
  },
  artist: {
    grid: { phone: 6, desktop: 6 },
    shelf: { phone: 4, desktop: 9 },
  },
};

export const tileGridLook = (
  kind: TileKind,
  layout: TileGridLayout,
  phone: boolean,
): TileGridLook => {
  const mode = phone ? 'phone' : 'desktop';
  switch (layout) {
    case 'overview':
      return {
        list: 'grid-cols-4 gap-x-5 lg:grid-cols-5 xl:grid-cols-6',
        width: '',
        bones: 6,
        round: false,
      };
    case 'shelf':
      return {
        list: SHELF_GAP[kind][mode],
        width: SHELF_WIDTH[kind][mode],
        bones: BONES[kind].shelf[mode],
        round: ROUND[kind],
      };
    case 'grid':
      return {
        list: phone
          ? `${PHONE_COLUMNS[kind]} gap-x-3 gap-y-5`
          : `${GRID_COLUMNS[kind]} gap-x-5 gap-y-6`,
        width: '',
        bones: BONES[kind].grid[mode],
        round: ROUND[kind],
      };
    default: {
      const unhandled: never = layout;
      throw new Error(`不认识的格子排法：${unhandled}`);
    }
  }
};

export const tileListClass = (
  look: TileGridLook,
  layout: TileGridLayout,
  phone: boolean,
  inset: boolean,
): string[] => {
  if (layout === 'shelf') {
    return [
      'flex overflow-hidden pb-3 pt-1',
      look.list,
      phone ? 'px-4' : 'px-2 -mx-2',
    ];
  }
  return ['grid', look.list, phone ? 'px-4 pt-4' : inset ? 'p-3' : ''];
};

export const tileCellClass = (
  look: TileGridLook,
  layout: TileGridLayout,
  index: number,
): (string | false)[] => {
  if (layout === 'shelf') return ['min-w-0 flex-none', look.width];
  if (layout === 'overview')
    return [
      'min-w-0',
      index === 4 && 'hidden lg:block',
      index === 5 && 'hidden xl:block',
    ];
  return ['min-w-0'];
};

// UnoCSS 开发时不扫 .ts 里的字符串，界面会悄悄丢格宽：新增 kind / layout 时同步这份 safelist
const everyLookClass = (): string[] => {
  const kinds: readonly TileKind[] = ['playlist', 'album', 'artist'];
  const layouts: readonly TileGridLayout[] = ['grid', 'shelf', 'overview'];
  const classes = kinds.flatMap((kind) =>
    layouts.flatMap((layout) =>
      [false, true].flatMap((phone) => {
        const look = tileGridLook(kind, layout, phone);
        return [
          look.list,
          look.width,
          ...Array.from({ length: 6 }, (_, index) =>
            tileCellClass(look, layout, index),
          ).flat(),
          ...tileListClass(look, layout, phone, true),
          ...tileListClass(look, layout, phone, false),
        ];
      }),
    ),
  );
  return [
    ...new Set(
      classes
        .filter((value): value is string => typeof value === 'string')
        .flatMap((value) => value.split(/\s+/))
        .filter(Boolean),
    ),
  ];
};

export const TILE_GRID_SAFELIST: readonly string[] = everyLookClass();
