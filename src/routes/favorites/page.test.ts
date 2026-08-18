import type { NcmSong } from '$lib/types'
import { addToPlaylistAndPlay, likedError, likedLoading, likedSongs, loadLikedSongs } from '$lib/stores'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$lib/ncm/search', () => ({
  toSongItem: (song: unknown) => song,
}))

vi.mock('$lib/stores', async () => {
  const { derived, writable } = await import('svelte/store')
  const likedSongs = writable<NcmSong[]>([])
  return {
    addToPlaylistAndPlay: vi.fn(),
    likedSongs,
    likedIds: derived(likedSongs, songs => new Set(songs.map(s => s.id))),
    likedPending: writable(new Set()),
    likedLoading: writable(false),
    likedError: writable<string | null>(null),
    loadLikedSongs: vi.fn(),
    toggleLike: vi.fn(),
  }
})

const mockedPlay = vi.mocked(addToPlaylistAndPlay)
const mockedLoad = vi.mocked(loadLikedSongs)

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
  mockedPlay.mockReset()
  mockedLoad.mockReset()
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

  it('展示全部红心歌曲并可进入播放链路', async () => {
    likedSongs.set(songs)
    render(Page)

    await waitFor(() => expect(screen.getByText('晴天')).toBeTruthy())
    expect(screen.getByText('七里香')).toBeTruthy()
    expect(screen.getByText(/2 首红心歌曲/)).toBeTruthy()
    expect(screen.getByText('周杰伦 · 叶惠美')).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: /晴天/ }))

    expect(mockedPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 186016, name: '晴天' }))
  })

  it('每个歌曲行带红心按钮（已红心态）', () => {
    likedSongs.set(songs)
    render(Page)

    const hearts = screen.getAllByRole('button', { name: '取消红心' })
    expect(hearts).toHaveLength(2)
    expect(hearts.every(button => button.getAttribute('aria-pressed') === 'true')).toBe(true)
  })

  it('没有红心歌曲时呈现空态', () => {
    render(Page)

    expect(screen.getByText('还没有红心歌曲，去播放器或歌曲列表点一下红心吧')).toBeTruthy()
  })

  it('加载失败（未绑定）呈现引导文案', () => {
    likedError.set('查看我喜欢的音乐需要账号许可：请先绑定网易云账号')
    render(Page)

    expect(screen.getByRole('alert').textContent).toContain('查看我喜欢的音乐需要账号许可：请先绑定网易云账号')
  })
})
