import type { NcmSong } from '$lib/types'
import type { Mock } from 'vitest'
import type { PageProps } from './$types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchLikedPage, fetchLikedSongs } from '$lib/ncm/likes'
import { likedIds, likedLoaded, loadLikedSongs, setNowPlaying, updatePlaylist } from '$lib/stores'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from './+page'
import Page from './+page.svelte'

vi.mock('$lib/ncm/likes', () => ({
  fetchLikedPage: vi.fn(),
  fetchLikedSongs: vi.fn(),
  LIKE_ERROR_TEXT: {
    UNAUTHENTICATED: '查看我喜欢的音乐需要账号许可：请先绑定网易云账号',
    RATE_LIMITED: '请求过于频繁，请稍后再试',
    RESOURCE_UNAVAILABLE: '该资源暂不可用',
    INVALID_PARAMS: '请求参数不合法，请检查后重试',
    UNKNOWN: '获取我喜欢的音乐失败，请稍后再试',
  },
  LIKED_PAGE_SIZE: 100,
}))

vi.mock('$lib/hooks/useMessage', () => ({
  useMessage: () => ({ callHanaMessage: vi.fn() }),
}))

vi.mock('$lib/stores', async () => {
  const { writable } = await import('svelte/store')
  return {
    // 红心状态与编排（ids-only：likedIds 即全站红心按钮的单一数据源）
    likedIds: writable<Set<number>>(new Set()),
    likedLoaded: writable(false),
    likedPending: writable(new Set()),
    likedLoading: writable(false),
    likedError: writable<string | null>(null),
    loadLikedSongs: vi.fn(),
    toggleLike: vi.fn(),
    // 播放队列与编排（SongList / SongPlaylistItem 共用）
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
  }
})

const mockedPage = vi.mocked(fetchLikedPage)
const mockedAll = vi.mocked(fetchLikedSongs)
const mockedSetNowPlaying = vi.mocked(setNowPlaying)
const mockedUpdate = vi.mocked(updatePlaylist)
const mockedLoadLiked = vi.mocked(loadLikedSongs)

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

/** load 事件桩：load 只消费 fetch */
function makeLoadEvent(fetchStub: Mock = vi.fn()) {
  return ({ fetch: fetchStub as typeof fetch }) as Parameters<typeof load>[0]
}

/** 渲染入参：PageProps 要求 data 与 params 成对（收藏页无路由参数） */
function renderPage(data: PageProps['data']) {
  return render(Page, { data, params: {} })
}
beforeEach(() => {
  mockedPage.mockReset()
  mockedAll.mockReset()
  mockedSetNowPlaying.mockReset()
  mockedUpdate.mockReset()
  mockedLoadLiked.mockReset()
  likedIds.set(new Set())
  likedLoaded.set(false)
})

afterEach(() => {
  cleanup()
})

describe('load 首屏供数', () => {
  it('直访路径：取第一页与红心总数并随 data 返回，event.fetch 注入客户端', async () => {
    mockedPage.mockResolvedValue({ songs: firstPage, total: 2 })
    const fetchMock = vi.fn()

    const result = await load(makeLoadEvent(fetchMock))

    expect(result).toEqual({ firstPage, total: 2, error: null })
    expect(mockedPage).toHaveBeenCalledWith({ limit: 100, offset: 0 }, fetchMock)
  })

  it('门面报错：按码携带页面文案，firstPage 置空', async () => {
    mockedPage.mockRejectedValue(new NcmClientError('RATE_LIMITED', ''))

    const result = await load(makeLoadEvent())

    expect(result).toEqual({ firstPage: [], total: 0, error: '请求过于频繁，请稍后再试' })
  })

  it('非领域错误（如网络异常）：兜底 UNKNOWN 文案', async () => {
    mockedPage.mockRejectedValue(new TypeError('网络中断'))

    const result = await load(makeLoadEvent())

    expect(result).toEqual({ firstPage: [], total: 0, error: '获取我喜欢的音乐失败，请稍后再试' })
  })
})

describe('我喜欢的音乐页', () => {
  it('渲染头部计数并列出第一页歌曲', async () => {
    renderPage({ firstPage, total: 4812, error: null })

    await waitFor(() => expect(screen.getAllByText('晴天').length).toBeGreaterThan(0))
    expect(screen.getByText('4812 首歌曲')).toBeTruthy()
    expect(screen.getAllByText('七里香').length).toBeGreaterThan(0)
  })

  it('双击歌曲行将红心全列表替换进播放队列并播放', async () => {
    mockedAll.mockResolvedValue([...firstPage])
    renderPage({ firstPage, total: 2, error: null })

    await waitFor(() => expect(screen.getAllByText('晴天').length).toBeGreaterThan(0))

    const row = screen.getAllByText('晴天')[0]!.closest('[role="button"]')!
    await fireEvent.doubleClick(row)

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ id: 186016, name: '晴天', sourceId: '186016' }),
      expect.objectContaining({ id: 347230, name: '七里香', sourceId: '347230' }),
    ])
    expect(mockedSetNowPlaying).toHaveBeenCalledWith(expect.objectContaining({ id: 186016, name: '晴天' }))
  })

  it('歌单内搜索即时过滤红心列表', async () => {
    renderPage({ firstPage, total: 2, error: null })

    await waitFor(() => expect(screen.getAllByText('七里香').length).toBeGreaterThan(0))

    const input = screen.getAllByPlaceholderText('搜索我喜欢的音乐…')[0]!
    await fireEvent.input(input, { target: { value: '晴天' } })

    await waitFor(() => expect(screen.queryByText('七里香')).toBeNull())
    expect(screen.getAllByText('晴天').length).toBeGreaterThan(0)
  })

  it('每个歌曲行带红心按钮（已红心态）', async () => {
    likedIds.set(new Set(firstPage.map(song => song.id)))
    renderPage({ firstPage, total: 2, error: null })

    await waitFor(() => expect(screen.getAllByRole('button', { name: '取消红心' }).length).toBeGreaterThan(0))

    const hearts = screen.getAllByRole('button', { name: '取消红心' })
    expect(hearts.every(button => button.getAttribute('aria-pressed') === 'true')).toBe(true)
  })

  it('取消红心的歌曲行即时移除（红心状态驱动列表过滤）', async () => {
    likedIds.set(new Set(firstPage.map(song => song.id)))
    likedLoaded.set(true)
    renderPage({ firstPage, total: 2, error: null })

    await waitFor(() => expect(screen.getAllByText('七里香').length).toBeGreaterThan(0))

    likedIds.set(new Set([186016]))

    await waitFor(() => expect(screen.queryByText('七里香')).toBeNull())
    expect(screen.getAllByText('晴天').length).toBeGreaterThan(0)
  })

  it('没有红心歌曲时呈现空态', () => {
    renderPage({ firstPage: [], total: 0, error: null })

    expect(screen.getByText('还没有红心歌曲')).toBeTruthy()
  })

  it('加载失败（未绑定）呈现引导文案', () => {
    renderPage({ firstPage: [], total: 0, error: '查看我喜欢的音乐需要账号许可：请先绑定网易云账号' })

    expect(screen.getByRole('alert').textContent).toContain('查看我喜欢的音乐需要账号许可：请先绑定网易云账号')
  })

  it('首屏 data 只含第一页，触底滚动按请求窗口 offset 增量加载下一页', async () => {
    mockedPage.mockResolvedValue({ songs: makePage(101, 100), total: 250 })
    renderPage({ firstPage: makePage(1, 100), total: 250, error: null })

    await waitFor(() => expect(screen.getByText('歌曲-1')).toBeTruthy())

    // jsdom 无布局，直接覆写 scrollTop 读值模拟滚到列表底部触发 onNearEnd
    const scroller = document.querySelector('[class*="overflow-auto"]')!
    Object.defineProperty(scroller, 'scrollTop', { value: 9999, configurable: true, writable: true })
    await fireEvent.scroll(scroller)

    // 第二页以请求窗口 offset=100 请求（ScrollContainer 的 scrollWatcher 有 100ms 节流）
    await waitFor(() => expect(mockedPage).toHaveBeenCalledTimes(1))
    expect(mockedPage).toHaveBeenCalledWith({ limit: 100, offset: 100 })

    // 追加后窗口移到新加载区域
    await waitFor(() => expect(screen.getByText('歌曲-130')).toBeTruthy())
  })

  it('播放全部在未加载完整红心列表时先全量补全再入队', async () => {
    mockedAll.mockResolvedValue(makePage(1, 250))
    renderPage({ firstPage: makePage(1, 100), total: 250, error: null })

    await waitFor(() => expect(screen.getByText('歌曲-1')).toBeTruthy())

    // 触发补全：滚动触底先加载第二页，再断言播放全部入口——直接以双击入队链路验证补全
    const row = screen.getByText('歌曲-1').closest('[role="button"]')!
    await fireEvent.doubleClick(row)

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedAll).toHaveBeenCalledTimes(1)

    const queue = mockedUpdate.mock.calls[0]![0]
    expect(queue).toHaveLength(250)
    expect(queue[0]).toMatchObject({ id: 1, name: '歌曲-1', sourceId: '1' })
    expect(queue[249]).toMatchObject({ id: 250, name: '歌曲-250', sourceId: '250' })
  })
  it('搜索时未加载完整红心列表先补全，再过滤出未加载区域的曲目', async () => {
    mockedAll.mockResolvedValue(makePage(1, 250))
    renderPage({ firstPage: makePage(1, 100), total: 250, error: null })

    await waitFor(() => expect(screen.getByText('歌曲-1')).toBeTruthy())

    const input = screen.getAllByPlaceholderText('搜索我喜欢的音乐…')[0]!
    await fireEvent.input(input, { target: { value: '歌曲-200' } })

    // 搜索触发整份补全：一次全量拉取
    await waitFor(() => expect(mockedAll).toHaveBeenCalledTimes(1))

    // 补全完成后过滤覆盖全量：位于未加载区域的曲目可搜到
    await waitFor(() => expect(screen.getByText('歌曲-200')).toBeTruthy())
  })
})
