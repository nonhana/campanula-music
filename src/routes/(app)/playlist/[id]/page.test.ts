import type { NcmPlaylistDetail, NcmSong } from '$lib/types'
import type { Mock } from 'vitest'
import type { PageProps } from './$types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchPlaylistDetail, fetchPlaylistTracks } from '$lib/ncm/playlists'
import { resetPlaylist, setNowPlaying, setPlaylistId, updatePlaylist } from '$lib/stores'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from './+page'
import Page from './+page.svelte'

vi.mock('$app/state', () => ({
  page: {
    params: { id: '6792103822' },
    url: new URL('http://localhost/playlist/6792103822'),
  },
}))

vi.mock('$lib/ncm/playlists', () => ({
  fetchPlaylistDetail: vi.fn(),
  fetchPlaylistTracks: vi.fn(),
  PLAYLIST_PAGE_SIZE: 100,
  PLAYLIST_QUEUE_CHUNK: 1000,
  PLAYLIST_ERROR_TEXT: {
    UNAUTHENTICATED: '查看歌单需要账号许可：请先绑定网易云账号',
    RATE_LIMITED: '请求过于频繁，请稍后再试',
    RESOURCE_UNAVAILABLE: '该资源暂不可用',
    UNKNOWN: '获取歌单失败，请稍后再试',
  },
}))

vi.mock('$lib/hooks/useMessage', () => ({
  useMessage: () => ({ callHanaMessage: vi.fn() }),
}))

vi.mock('$lib/stores', async () => {
  const { derived, writable } = await import('svelte/store')
  return {
    // 播放队列与编排（Detail / SongList / SongPlaylistItem 共用）
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
    // 红心按钮依赖的红心状态（空喜欢列表 + 无操作桩）
    likedIds: derived(writable<Array<{ id: number }>>([]), songs => new Set(songs.map(s => s.id))),
    likedPending: writable(new Set()),
    loadLikedSongs: vi.fn(),
    toggleLike: vi.fn(),
    addMessage: vi.fn(),
  }
})

const mockedFetch = vi.mocked(fetchPlaylistDetail)
const mockedTracks = vi.mocked(fetchPlaylistTracks)
const mockedUpdate = vi.mocked(updatePlaylist)
const mockedSetNowPlaying = vi.mocked(setNowPlaying)
const mockedResetPlaylist = vi.mocked(resetPlaylist)
const mockedSetPlaylistId = vi.mocked(setPlaylistId)

const detail: NcmPlaylistDetail = {
  id: 6792103822,
  name: '周杰伦精选',
  cover: 'https://p1.music.126.net/abc.jpg',
  creator: 'Buradarrr',
  description: '经典曲目',
  trackCount: 2,
  playCount: 32251352,
}

/** 按 100 首一页构造 NcmSong 分页：名称按序号编址，便于断言窗口内的行 */
function makePage(start: number, count: number): NcmSong[] {
  return Array.from({ length: count }, (_, i) => ({
    id: start + i,
    name: `歌曲-${start + i}`,
    duration: 200000,
    artists: [{ id: 6452, name: '周杰伦' }],
    album: { id: 0, name: '', cover: '' },
  }))
}

const firstPage: NcmSong[] = [
  {
    id: 186016,
    name: '晴天',
    duration: 269000,
    artists: [{ id: 6452, name: '周杰伦' }],
    album: { id: 21349, name: '叶惠美', cover: '' },
  },
  {
    id: 347230,
    name: '七里香',
    duration: 300000,
    artists: [{ id: 6452, name: '周杰伦' }],
    album: { id: 21350, name: '七里香', cover: '' },
  },
]

/** load 成功供数的 data 形状（直访路径首屏） */
const loadedData = { detail, firstPage, error: null }

/** load 事件桩：load 只消费 fetch 与 params */
function makeLoadEvent(fetchStub: Mock = vi.fn(), id = '6792103822') {
  return ({ fetch: fetchStub as typeof fetch, params: { id } }) as Parameters<typeof load>[0]
}

/** 渲染入参：PageProps 要求 data 与 params 成对 */
function renderPage(data: PageProps['data']) {
  return render(Page, { data, params: { id: '6792103822' } })
}

beforeEach(() => {
  mockedFetch.mockReset()
  mockedTracks.mockReset()
  mockedUpdate.mockReset()
  mockedSetNowPlaying.mockReset()
  mockedResetPlaylist.mockReset()
  mockedSetPlaylistId.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('load 首屏供数', () => {
  it('直访路径：并行取详情与第一页并随 data 返回，event.fetch 注入客户端', async () => {
    mockedFetch.mockResolvedValue(detail)
    mockedTracks.mockResolvedValue(firstPage)
    const fetchMock = vi.fn()

    const result = await load(makeLoadEvent(fetchMock))

    expect(result).toEqual({ detail, firstPage, error: null })
    expect(mockedFetch).toHaveBeenCalledWith(6792103822, fetchMock)
    expect(mockedTracks).toHaveBeenCalledWith(6792103822, { limit: 100, offset: 0 }, fetchMock)
  })

  it('门面报错：详情置空并按码携带页面文案', async () => {
    mockedFetch.mockRejectedValue(new NcmClientError('RATE_LIMITED', ''))

    const result = await load(makeLoadEvent())

    expect(result).toEqual({ detail: null, firstPage: [], error: '请求过于频繁，请稍后再试' })
  })

  it('非领域错误（如网络异常）：兜底 UNKNOWN 文案', async () => {
    mockedFetch.mockRejectedValue(new TypeError('网络中断'))

    const result = await load(makeLoadEvent())

    expect(result).toEqual({ detail: null, firstPage: [], error: '获取歌单失败，请稍后再试' })
  })
})

describe('歌单详情页', () => {
  it('渲染富视图头信息并列出第一页歌曲', async () => {
    renderPage(loadedData)

    await waitFor(() => expect(screen.getByText('周杰伦精选')).toBeTruthy())

    expect(screen.getByText('2 首歌曲')).toBeTruthy()
    expect(screen.getByText('经典曲目')).toBeTruthy()
    expect(screen.getAllByText('播放全部').length).toBeGreaterThan(0)
    expect(screen.getAllByText('晴天').length).toBeGreaterThan(0)
    expect(screen.getAllByText('七里香').length).toBeGreaterThan(0)
  })

  it('点击播放全部将整张歌单替换进播放队列', async () => {
    renderPage(loadedData)

    await waitFor(() => expect(screen.getAllByText('播放全部').length).toBeGreaterThan(0))
    await fireEvent.click(screen.getAllByText('播放全部')[0]!)

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ id: 186016, name: '晴天', sourceId: '186016' }),
      expect.objectContaining({ id: 347230, name: '七里香', sourceId: '347230' }),
    ]))
  })

  it('双击歌曲行进入播放链路', async () => {
    renderPage(loadedData)

    await waitFor(() => expect(screen.getAllByText('晴天').length).toBeGreaterThan(0))

    const row = screen.getAllByText('晴天')[0]!.closest('[role="button"]')!
    await fireEvent.doubleClick(row)

    await waitFor(() => expect(mockedSetNowPlaying).toHaveBeenCalledWith(expect.objectContaining({ id: 186016, name: '晴天' })))
  })

  it('歌单内搜索即时过滤列表', async () => {
    renderPage(loadedData)

    await waitFor(() => expect(screen.getAllByText('七里香').length).toBeGreaterThan(0))

    const input = screen.getAllByPlaceholderText('搜索此歌单中的歌曲…')[0]!
    await fireEvent.input(input, { target: { value: '晴天' } })

    await waitFor(() => expect(screen.queryByText('七里香')).toBeNull())
    expect(screen.getAllByText('晴天').length).toBeGreaterThan(0)
  })

  it('无歌曲时呈现空态', async () => {
    renderPage({ detail, firstPage: [], error: null })

    await waitFor(() => expect(screen.getByText('这个歌单还没有歌曲')).toBeTruthy())
  })

  it('被限流呈现限流文案', async () => {
    renderPage({ detail: null, firstPage: [], error: '请求过于频繁，请稍后再试' })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('请求过于频繁，请稍后再试')
    })
  })

  it('绑定失效呈现引导文案', async () => {
    renderPage({ detail: null, firstPage: [], error: '查看歌单需要账号许可：请先绑定网易云账号' })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('查看歌单需要账号许可：请先绑定网易云账号')
    })
  })

  it('首屏 data 只含第一页，触底滚动按请求窗口 offset 增量加载下一页', async () => {
    mockedTracks.mockResolvedValueOnce(makePage(101, 100))
    renderPage({ detail: { ...detail, trackCount: 250 }, firstPage: makePage(1, 100), error: null })

    await waitFor(() => expect(screen.getByText('歌曲-1')).toBeTruthy())

    // jsdom 无布局，直接覆写 scrollTop 读值模拟滚到列表底部触发 onNearEnd
    const scroller = document.querySelector('[class*="overflow-auto"]')!
    Object.defineProperty(scroller, 'scrollTop', { value: 9999, configurable: true, writable: true })
    await fireEvent.scroll(scroller)

    // 第二页以请求窗口 offset=100 请求（ScrollContainer 的 scrollWatcher 有 100ms 节流）
    await waitFor(() => expect(mockedTracks).toHaveBeenCalledTimes(1))
    expect(mockedTracks).toHaveBeenCalledWith(6792103822, { limit: 100, offset: 100 })

    // 追加后窗口移到新加载区域
    await waitFor(() => expect(screen.getByText('歌曲-130')).toBeTruthy())
  })

  it('播放全部在未加载完整歌单时先并行补全队列再入队', async () => {
    mockedTracks.mockResolvedValueOnce(makePage(101, 150))
    renderPage({ detail: { ...detail, trackCount: 250 }, firstPage: makePage(1, 100), error: null })

    await waitFor(() => expect(screen.getAllByText('播放全部').length).toBeGreaterThan(0))
    await fireEvent.click(screen.getAllByText('播放全部')[0]!)

    // 剩余 150 首按 1000/页的单次补全请求拉取（请求窗口从首屏 100 起）
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedTracks).toHaveBeenCalledWith(6792103822, { limit: 1000, offset: 100 })

    const queue = mockedUpdate.mock.calls[0]![0]
    expect(queue).toHaveLength(250)
    expect(queue[0]).toMatchObject({ id: 1, name: '歌曲-1', sourceId: '1' })
    expect(queue[249]).toMatchObject({ id: 250, name: '歌曲-250', sourceId: '250' })
  })
})
