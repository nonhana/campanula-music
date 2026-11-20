import { describe, expect, it } from 'vitest';

import {
  ROW_COVER_SIZE,
  TILE_GRID_SAFELIST,
  tileCellClass,
  tileGridLook,
  tileListClass,
} from '#lib/components/library/tile-grid.ts';

describe('tile-grid', () => {
  it('按布局、类型与端形态计算网格参数、列表类与单元格类', () => {
    expect(ROW_COVER_SIZE).toBe(40);

    const overview = tileGridLook('playlist', 'overview', false);
    expect(overview.bones).toBe(6);
    expect(overview.round).toBe(false);
    expect(tileCellClass(overview, 'overview', 0)).toEqual([
      'min-w-0',
      false,
      false,
    ]);
    expect(tileCellClass(overview, 'overview', 4)).toContain('hidden lg:block');
    expect(tileCellClass(overview, 'overview', 5)).toContain('hidden xl:block');

    const shelf = tileGridLook('artist', 'shelf', true);
    expect(shelf.round).toBe(true);
    expect(shelf.width).toBe('w-[104px]');
    expect(tileListClass(shelf, 'shelf', true, false)).toContain('px-4');
    expect(tileListClass(shelf, 'shelf', false, false)).toContain('px-2 -mx-2');
    expect(tileCellClass(shelf, 'shelf', 0)).toEqual([
      'min-w-0 flex-none',
      'w-[104px]',
    ]);

    const grid = tileGridLook('album', 'grid', false);
    expect(tileListClass(grid, 'grid', false, true)).toContain('p-3');
    expect(tileListClass(grid, 'grid', false, false)).toContain('');
    expect(tileListClass(grid, 'grid', true, false)).toContain('px-4 pt-4');
    expect(tileCellClass(grid, 'grid', 0)).toEqual(['min-w-0']);
  });

  it('safelist 收录全部布局类名，未知排法抛错', () => {
    expect(TILE_GRID_SAFELIST).toContain('grid-cols-2');
    expect(TILE_GRID_SAFELIST).toContain('w-[168px]');
    expect(() => tileGridLook('playlist', 'unknown' as never, false)).toThrow(
      '不认识的格子排法',
    );
  });
});
