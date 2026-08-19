import type { NcmPlaylistDetail } from '$lib/types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchPlaylistDetail } from '$lib/ncm/playlists'
import { addToPlaylistAndPlay } from '$lib/stores'
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

vi.mock('$lib/stores', async () => {
  const { derived, writable } = await import('svelte/store')
  return {
    addToPlaylistAndPlay: vi.fn(),
    // 红心按钮依赖的红心状态（空喜欢列表 + 无操作桩）
    likedIds: derived(writable<Array<{ id: number }>>([]), songs => new Set(songs.map(s => s.id))),
    likedPending: writable(new Set()),
    loadLikedSongs: vi.fn(),
    toggleLike: vi.fn(),
  }
})

const mockedFetch = vi.mocked(fetchPlaylistDetail)
const mockedPlay = vi.mocked(addToPlaylistAndPlay)

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
  mockedPlay.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('歌单详情页', () => {
  it('加载歌单头信息并列出全部歌曲', async () => {
    mockedFetch.mockResolvedValue(detail)
    render(Page)

    await waitFor(() => expect(screen.getByText('周杰伦精选')).toBeTruthy())

    expect(screen.getByText(/Buradarrr/)).toBeTruthy()
    expect(screen.getByText(/2 首/)).toBeTruthy()
    expect(screen.getByText('晴天')).toBeTruthy()
    expect(screen.getByText('七里香')).toBeTruthy()
    expect(screen.getByText('周杰伦 · 叶惠美')).toBeTruthy()
  })

  it('渲染歌单封面图', async () => {
    mockedFetch.mockResolvedValue(detail)
    render(Page)

    await waitFor(() => expect(screen.getByText('周杰伦精选')).toBeTruthy())

    const img = screen.getByAltText('')
    expect((img as HTMLImageElement).src).toBe('https://p1.music.126.net/abc.jpg')
  })

  it('点击歌曲行进入播放链路', async () => {
    mockedFetch.mockResolvedValue(detail)
    render(Page)

    await waitFor(() => expect(screen.getByText('晴天')).toBeTruthy())

    await fireEvent.click(screen.getByRole('button', { name: /晴天/ }))

    expect(mockedPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 186016, name: '晴天', sourceId: '186016' }))
  })

  it('无歌曲时呈现空态', async () => {
    mockedFetch.mockResolvedValue({ ...detail, songs: [] })
    render(Page)

    await waitFor(() => expect(screen.getByText('这个歌单还没有歌曲')).toBeTruthy())
  })

  it('无描述时不渲染描述行', async () => {
    mockedFetch.mockResolvedValue({ ...detail, description: null })
    render(Page)

    await waitFor(() => expect(screen.getByText('周杰伦精选')).toBeTruthy())
    expect(screen.queryByText(/经典曲目/)).toBeNull()
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
