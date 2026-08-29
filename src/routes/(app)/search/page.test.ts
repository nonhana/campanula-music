import type { NcmSearchPage } from '$lib/types'
import { SearchClientError, searchNcm } from '$lib/ncm/search'
import { addToPlaylistAndPlay } from '$lib/stores'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$lib/ncm/search', () => ({
  searchNcm: vi.fn(),
  SEARCH_ERROR_TEXT: {
    UNAUTHENTICATED: '搜索需要账号许可，绑定已失效，请重新绑定',
    RATE_LIMITED: '请求过于频繁，请稍后再试',
    RESOURCE_UNAVAILABLE: '该资源暂不可用',
    UNKNOWN: '搜索失败，请稍后再试',
  },
  SearchClientError: class SearchClientError extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.name = 'SearchClientError'
      this.code = code
    }
  },
}))

vi.mock('$lib/hooks/useMessage', () => ({
  useMessage: () => ({ callHanaMessage: vi.fn() }),
}))

vi.mock('$lib/stores', async () => {
  const { derived, writable } = await import('svelte/store')
  return {
    // 播放队列与编排（SongSearchItem 共用）
    nowPlaying: writable(null),
    paused: writable(true),
    songLoading: writable(false),
    playlistId: writable(null),
    setNowPlaying: vi.fn(),
    setPaused: vi.fn(),
    setSongLoading: vi.fn(),
    setPlaylistId: vi.fn(),
    resetPlaylist: vi.fn(),
    reset: vi.fn(),
    updatePlaylist: vi.fn(),
    addSongToPlaylist: vi.fn(),
    removeSongFromPlaylist: vi.fn(),
    isSongInPlaylist: () => false,
    addToPlaylistAndPlay: vi.fn(),
    addMessage: vi.fn(),
    // 红心状态桩
    likedIds: derived(writable<Array<{ id: number }>>([]), songs => new Set(songs.map(s => s.id))),
    likedPending: writable(new Set()),
    loadLikedSongs: vi.fn(),
    toggleLike: vi.fn(),
  }
})

const mockedSearch = vi.mocked(searchNcm)
const mockedPlay = vi.mocked(addToPlaylistAndPlay)

const songPage: NcmSearchPage = {
  type: 'song',
  total: 1,
  songs: [
    {
      id: 186016,
      name: '晴天',
      duration: 269000,
      artists: [{ id: 6452, name: '周杰伦' }],
      album: { id: 21349, name: '叶惠美', cover: '' },
    },
  ],
}

/** 构造多页结果中的歌曲条目 */
function makeSong(id: number) {
  return {
    id,
    name: `歌曲-${id}`,
    duration: 200000,
    artists: [{ id: 6452, name: '周杰伦' }],
    album: { id: 21349, name: '叶惠美', cover: '' },
  }
}

const playlistPage: NcmSearchPage = {
  type: 'playlist',
  total: 1,
  playlists: [
    { id: 6792103822, name: '周杰伦精选', cover: 'https://p1.music.126.net/a.jpg', trackCount: 139, playCount: 32251352, creator: 'Buradarrr' },
  ],
}

const artistPage: NcmSearchPage = {
  type: 'artist',
  total: 1,
  artists: [{ id: 6452, name: '周杰伦', avatar: 'https://p3.music.126.net/a.jpg' }],
}

async function typeKeyword(value: string) {
  const input = screen.getByRole('searchbox', { name: '搜索关键词' })
  await fireEvent.input(input, { target: { value } })
}

beforeEach(() => {
  mockedSearch.mockReset()
  mockedPlay.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('搜索页', () => {
  it('初始态：搜索框、三个 tab 与引导文案', () => {
    render(Page)

    expect(screen.getByRole('searchbox', { name: '搜索关键词' })).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { name: '歌曲' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('输入关键词开始搜索')).toBeTruthy()
  })

  it('输入关键词后按歌曲类型实时搜索并渲染富行结果', async () => {
    mockedSearch.mockResolvedValueOnce(songPage)
    render(Page)

    await typeKeyword('晴天')

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({ keywords: '晴天', type: 'song' }),
        expect.anything(),
      )
    })
    await waitFor(() => expect(screen.getByText('晴天')).toBeTruthy())
    expect(screen.getByText('周杰伦')).toBeTruthy()
  })

  it('搜索进行中呈现加载态', async () => {
    const { promise, resolve } = Promise.withResolvers<NcmSearchPage>()
    mockedSearch.mockReturnValueOnce(promise)
    render(Page)

    await typeKeyword('晴天')

    await waitFor(() => expect(screen.getByText('搜索中…')).toBeTruthy())

    resolve(songPage)
    await waitFor(() => expect(screen.getByText('晴天')).toBeTruthy())
  })

  it('歌曲 tab 显示总数，滚动接近末尾自动按 offset 加载更多', async () => {
    const firstPage: NcmSearchPage = {
      type: 'song',
      total: 90,
      songs: Array.from({ length: 12 }, (_, i) => makeSong(i + 1)),
    }
    const secondPage: NcmSearchPage = {
      type: 'song',
      total: 90,
      songs: [makeSong(13), makeSong(14)],
    }
    mockedSearch.mockResolvedValueOnce(firstPage)
    mockedSearch.mockResolvedValueOnce(secondPage)
    render(Page)

    await typeKeyword('周杰伦')
    await waitFor(() => expect(screen.getByText('歌曲-12')).toBeTruthy())
    expect(screen.getByText(/总共找到 90 首歌曲/)).toBeTruthy()

    // jsdom 无布局，直接覆写 scrollTop 读值模拟滚到列表底部触发 onNearEnd
    const scroller = document.querySelector('[class*="overflow-y-auto"]')!
    Object.defineProperty(scroller, 'scrollTop', { value: 9999, configurable: true, writable: true })
    await fireEvent.scroll(scroller)

    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2))
    expect(mockedSearch.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ keywords: '周杰伦', type: 'song', offset: 12 }),
    )
  })

  it('切换到歌单 tab 以歌单类型再次搜索，结果可进入歌单详情', async () => {
    mockedSearch.mockResolvedValueOnce({ ...songPage, songs: [] })
    mockedSearch.mockResolvedValueOnce(playlistPage)
    render(Page)

    await typeKeyword('周杰伦')
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1))

    await fireEvent.click(screen.getByRole('tab', { name: '歌单' }))

    expect(mockedSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: '周杰伦', type: 'playlist' }),
      expect.anything(),
    )
    await waitFor(() => expect(screen.getByText('周杰伦精选')).toBeTruthy())

    const link = screen.getByRole('link', { name: /周杰伦精选/ })
    expect(link.getAttribute('href')).toBe('/playlist/6792103822')
    expect(screen.getByText(/Buradarrr/)).toBeTruthy()
  })

  it('切到歌手 tab 渲染歌手结果', async () => {
    mockedSearch.mockResolvedValueOnce({ ...songPage, songs: [] })
    mockedSearch.mockResolvedValueOnce(artistPage)
    render(Page)

    await typeKeyword('周')
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1))

    await fireEvent.click(screen.getByRole('tab', { name: '歌手' }))

    await waitFor(() => expect(mockedSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: '周', type: 'artist' }),
      expect.anything(),
    ))
    await waitFor(() => expect(screen.getByText('周杰伦')).toBeTruthy())
  })

  it('点击播放按钮进入播放链路', async () => {
    mockedSearch.mockResolvedValueOnce(songPage)
    render(Page)

    await typeKeyword('晴天')
    await waitFor(() => expect(screen.getByText('晴天')).toBeTruthy())

    const row = screen.getAllByText('晴天')[0]!.closest('[role="button"]')!
    const playButton = row.querySelectorAll('button')[0]!
    await fireEvent.click(playButton)

    expect(mockedPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 186016, name: '晴天', sourceId: '186016' }))
  })

  it('搜索失败按错误码呈现文案', async () => {
    mockedSearch.mockRejectedValueOnce(new SearchClientError('RATE_LIMITED', '请求过于频繁'))
    render(Page)

    await typeKeyword('晴天')

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('请求过于频繁，请稍后再试')
    })
  })

  it('搜索无结果时呈现空态', async () => {
    mockedSearch.mockResolvedValueOnce({ ...songPage, songs: [] })
    render(Page)

    await typeKeyword('不存在的歌')

    await waitFor(() => expect(screen.getByText('没有找到相关歌曲')).toBeTruthy())
  })

  it('清空关键词后回到初始引导态', async () => {
    mockedSearch.mockResolvedValueOnce(songPage)
    render(Page)

    await typeKeyword('晴天')
    await waitFor(() => expect(screen.getByText('晴天')).toBeTruthy())

    await fireEvent.click(screen.getByRole('button', { name: '清空关键词' }))

    expect(screen.getByText('输入关键词开始搜索')).toBeTruthy()
    expect(screen.queryByText('晴天')).toBeNull()
  })

  it('清空后再次输入仍可搜索（回归：cancel 后防抖不得失效）', async () => {
    mockedSearch.mockResolvedValueOnce(songPage)
    render(Page)

    await typeKeyword('晴天')
    await waitFor(() => expect(screen.getByText('晴天')).toBeTruthy())

    await fireEvent.click(screen.getByRole('button', { name: '清空关键词' }))
    expect(mockedSearch).toHaveBeenCalledTimes(1)

    await typeKeyword('稻香')
    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledTimes(2)
      expect(mockedSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ keywords: '稻香' }),
        expect.anything(),
      )
    })
  })
})
