import type { ArtistSongOrder } from '#lib/api/library.js'
import { ARTIST_SONG_ORDERS } from '#lib/api/library.js'
import type { ArtistTab } from '#lib/app/library.js'

// 歌手页在界面上怎么写：三个标签、两种排法，以及它们在地址里的样子（?tab=albums、?tab=intro、?order=time，默认的歌曲、热门不写）

export const ARTIST_TABS: readonly { key: ArtistTab, label: string }[] = [
  { key: 'songs', label: '歌曲' },
  { key: 'albums', label: '专辑' },
  { key: 'intro', label: '简介' },
]

export const ARTIST_ORDERS: readonly { key: ArtistSongOrder, label: string }[] = [
  { key: 'hot', label: '热门' },
  { key: 'time', label: '最新' },
]

/** 地址里的 tab：没有、不认识的是歌曲 */
export const artistTabOf = (value: string | null): ArtistTab => ARTIST_TABS.find(tab => tab.key === value)?.key ?? 'songs'

/** 地址里的 order：没有、不认识的是热门 */
export const artistOrderOf = (value: string | null): ArtistSongOrder => ARTIST_SONG_ORDERS.find(order => order === value) ?? 'hot'

/** 停在这个标签、这种排法时地址里的查询串，接在 resolve 的路由 id 后面：resolve(`/artists/[id=neteaseId]${artistSearch(…)}`, { id }) */
export const artistSearch = (tab: ArtistTab, order: ArtistSongOrder): '' | `?${string}` => {
  const query = new URLSearchParams()
  if (tab !== 'songs')
    query.set('tab', tab)
  if (order !== 'hot')
    query.set('order', order)
  return query.size > 0
    ? `?${query.toString()}`
    : ''
}

/** 标签和它管的那一块内容的 id（读屏把标签和内容对上：aria-controls、aria-labelledby） */
export const ARTIST_PANEL_ID = 'artist-panel'
export const artistTabId = (tab: ArtistTab): string => `artist-tab-${tab}`
