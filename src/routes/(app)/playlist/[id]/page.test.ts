import type { NcmPlaylistDetail } from '$lib/types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchPlaylistDetail } from '$lib/ncm/playlists'
import { resetPlaylist, setNowPlaying, setPlaylistId, updatePlaylist } from '$lib/stores'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$lib/ncm/playlists', () => ({
  fetchPlaylistDetail: vi.fn(),
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
  songs: [
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
  ],
}

beforeEach(() => {
  mockedFetch.mockReset()
  mockedUpdate.mockReset()
  mockedSetNowPlaying.mockReset()
  mockedResetPlaylist.mockReset()
  mockedSetPlaylistId.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('歌单详情页', () => {
  it('渲染富视图头信息并列出全部歌曲', async () => {
    mockedFetch.mockResolvedValue(detail)
    render(Page)

    await waitFor(() => expect(screen.getByText('周杰伦精选')).toBeTruthy())

    expect(screen.getByText('2 首歌曲')).toBeTruthy()
    expect(screen.getByText('经典曲目')).toBeTruthy()
    expect(screen.getAllByText('播放全部').length).toBeGreaterThan(0)
    expect(screen.getAllByText('晴天').length).toBeGreaterThan(0)
    expect(screen.getAllByText('七里香').length).toBeGreaterThan(0)
  })

  it('点击播放全部将整张歌单替换进播放队列', async () => {
    mockedFetch.mockResolvedValue(detail)
    render(Page)

    await waitFor(() => expect(screen.getAllByText('播放全部').length).toBeGreaterThan(0))
    await fireEvent.click(screen.getAllByText('播放全部')[0]!)

    expect(mockedUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ id: 186016, name: '晴天', sourceId: '186016' }),
      expect.objectContaining({ id: 347230, name: '七里香', sourceId: '347230' }),
    ])
  })

  it('双击歌曲行进入播放链路', async () => {
    mockedFetch.mockResolvedValue(detail)
    render(Page)

    await waitFor(() => expect(screen.getAllByText('晴天').length).toBeGreaterThan(0))

    const row = screen.getAllByText('晴天')[0]!.closest('[role="button"]')!
    await fireEvent.doubleClick(row)

    expect(mockedSetNowPlaying).toHaveBeenCalledWith(expect.objectContaining({ id: 186016, name: '晴天' }))
  })

  it('歌单内搜索即时过滤列表', async () => {
    mockedFetch.mockResolvedValue(detail)
    render(Page)

    await waitFor(() => expect(screen.getAllByText('七里香').length).toBeGreaterThan(0))

    const input = screen.getAllByPlaceholderText('搜索此歌单中的歌曲…')[0]!
    await fireEvent.input(input, { target: { value: '晴天' } })

    await waitFor(() => expect(screen.queryByText('七里香')).toBeNull())
    expect(screen.getAllByText('晴天').length).toBeGreaterThan(0)
  })

  it('无歌曲时呈现空态', async () => {
    mockedFetch.mockResolvedValue({ ...detail, songs: [] })
    render(Page)

    await waitFor(() => expect(screen.getByText('这个歌单还没有歌曲')).toBeTruthy())
  })

  it('被限流呈现限流文案', async () => {
    mockedFetch.mockRejectedValue(new NcmClientError('RATE_LIMITED', '请求过于频繁，请稍后再试'))
    render(Page)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('请求过于频繁，请稍后再试')
    })
  })

  it('绑定失效呈现引导文案', async () => {
    mockedFetch.mockRejectedValue(new NcmClientError('UNAUTHENTICATED', '查看歌单需要账号许可：请先绑定网易云账号'))
    render(Page)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('查看歌单需要账号许可：请先绑定网易云账号')
    })
  })
})
