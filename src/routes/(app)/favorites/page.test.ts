import type { NcmSong } from '$lib/types'
import { likedError, likedLoading, likedSongs, loadLikedSongs, setNowPlaying, updatePlaylist } from '$lib/stores'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$lib/hooks/useMessage', () => ({
  useMessage: () => ({ callHanaMessage: vi.fn() }),
}))

vi.mock('$lib/stores', async () => {
  const { derived, writable } = await import('svelte/store')
  const likedSongs = writable<NcmSong[]>([])
  return {
    // 红心状态与编排
    likedSongs,
    likedIds: derived(likedSongs, songs => new Set(songs.map(s => s.id))),
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

const mockedLoad = vi.mocked(loadLikedSongs)
const mockedSetNowPlaying = vi.mocked(setNowPlaying)
const mockedUpdate = vi.mocked(updatePlaylist)

const songs: NcmSong[] = [
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

beforeEach(() => {
  mockedLoad.mockReset()
  mockedSetNowPlaying.mockReset()
  mockedUpdate.mockReset()
  likedSongs.set([])
  likedLoading.set(false)
  likedError.set(null)
})

afterEach(() => {
  cleanup()
})

describe('我喜欢的音乐页', () => {
  it('挂载即触发喜欢列表加载', () => {
    render(Page)

    expect(mockedLoad).toHaveBeenCalled()
  })

  it('加载中呈现加载态', () => {
    likedLoading.set(true)
    render(Page)

    expect(screen.getByText('加载中…')).toBeTruthy()
  })

  it('富视图展示全部红心歌曲与计数', async () => {
    likedSongs.set(songs)
    render(Page)

    await waitFor(() => expect(screen.getAllByText('晴天').length).toBeGreaterThan(0))
    expect(screen.getAllByText('七里香').length).toBeGreaterThan(0)
    expect(screen.getByText(/2 首歌曲/)).toBeTruthy()
  })

  it('双击歌曲行将红心全列表替换进播放队列并播放', async () => {
    likedSongs.set(songs)
    render(Page)

    await waitFor(() => expect(screen.getAllByText('晴天').length).toBeGreaterThan(0))

    const row = screen.getAllByText('晴天')[0]!.closest('[role="button"]')!
    await fireEvent.doubleClick(row)

    expect(mockedUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ id: 186016, name: '晴天', sourceId: '186016' }),
      expect.objectContaining({ id: 347230, name: '七里香', sourceId: '347230' }),
    ])
    expect(mockedSetNowPlaying).toHaveBeenCalledWith(expect.objectContaining({ id: 186016, name: '晴天' }))
  })

  it('歌单内搜索即时过滤红心列表', async () => {
    likedSongs.set(songs)
    render(Page)

    await waitFor(() => expect(screen.getAllByText('七里香').length).toBeGreaterThan(0))

    const input = screen.getAllByPlaceholderText('搜索我喜欢的音乐…')[0]!
    await fireEvent.input(input, { target: { value: '晴天' } })

    await waitFor(() => expect(screen.queryByText('七里香')).toBeNull())
    expect(screen.getAllByText('晴天').length).toBeGreaterThan(0)
  })

  it('每个歌曲行带红心按钮（已红心态）', async () => {
    likedSongs.set(songs)
    render(Page)

    await waitFor(() => expect(screen.getAllByRole('button', { name: '取消红心' }).length).toBeGreaterThan(0))

    const hearts = screen.getAllByRole('button', { name: '取消红心' })
    expect(hearts.every(button => button.getAttribute('aria-pressed') === 'true')).toBe(true)
  })

  it('没有红心歌曲时呈现空态', () => {
    render(Page)

    expect(screen.getByText('还没有红心歌曲')).toBeTruthy()
  })

  it('加载失败（未绑定）呈现引导文案', () => {
    likedError.set('查看我喜欢的音乐需要账号许可：请先绑定网易云账号')
    render(Page)

    expect(screen.getByRole('alert').textContent).toContain('查看我喜欢的音乐需要账号许可：请先绑定网易云账号')
  })
})
