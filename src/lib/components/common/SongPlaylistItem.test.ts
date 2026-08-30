import type * as Stores from '$lib/stores'
import type { SongItem } from '$lib/types'
import { addToPlaylistAndPlay, nowPlaying, paused, setNowPlaying } from '$lib/stores'
import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { get } from 'svelte/store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SongPlaylistItem from './SongPlaylistItem.svelte'

// 播放编排与红心拉取会发起真实网络请求，行键盘行为只关注触发路径，全部桩掉
vi.mock('$lib/stores', async (importOriginal) => {
  const actual = await importOriginal() as unknown as typeof Stores
  return {
    ...actual,
    addToPlaylistAndPlay: vi.fn(),
    setNowPlaying: vi.fn(async () => {}),
    loadLikedSongs: vi.fn(async () => {}),
  }
})

const song: SongItem = {
  id: 186016,
  name: '晴天',
  cover: '',
  alias: [],
  artists: [{ id: 6452, name: '周杰伦' }],
  album: { id: 21349, name: '叶惠美', cover: '' },
  duration: 269000,
  sourceId: '186016',
}

function renderRow() {
  const { container } = render(SongPlaylistItem, { props: { song } })
  return container.firstElementChild as HTMLElement
}

afterEach(() => {
  cleanup()
  nowPlaying.set(null)
  paused.set(true)
  vi.clearAllMocks()
})

describe('歌曲行键盘激活（M25）', () => {
  it('空格键触发播放：未在播放列表的歌曲走入队并播放', async () => {
    const row = renderRow()

    await fireEvent.keyDown(row, { code: 'Space', key: ' ' })
    await tick()

    expect(vi.mocked(addToPlaylistAndPlay)).toHaveBeenCalledWith(song)
  })

  it('回车键触发播放：与空格同路径', async () => {
    const row = renderRow()

    await fireEvent.keyDown(row, { code: 'Enter', key: 'Enter' })
    await tick()

    expect(vi.mocked(addToPlaylistAndPlay)).toHaveBeenCalledWith(song)
  })

  it('其他按键不触发播放', async () => {
    const row = renderRow()

    await fireEvent.keyDown(row, { code: 'KeyA', key: 'a' })
    await tick()

    expect(addToPlaylistAndPlay).not.toHaveBeenCalled()
    expect(setNowPlaying).not.toHaveBeenCalled()
  })

  it('激活行的 Space 翻转暂停态（播放 ↔ 暂停）', async () => {
    nowPlaying.set(song)
    paused.set(true)
    const row = renderRow()
    await tick()

    await fireEvent.keyDown(row, { code: 'Space', key: ' ' })
    await tick()
    expect(get(paused)).toBe(false)

    await fireEvent.keyDown(row, { code: 'Space', key: ' ' })
    await tick()
    expect(get(paused)).toBe(true)
  })
})
