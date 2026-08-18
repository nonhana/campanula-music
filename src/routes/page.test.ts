import type { NcmUserPlaylists } from '$lib/types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchUserPlaylists } from '$lib/ncm/playlists'
import { cleanup, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$lib/ncm/playlists', () => ({
  fetchUserPlaylists: vi.fn(),
  PLAYLIST_ERROR_TEXT: {
    UNAUTHENTICATED: '查看歌单需要账号许可：请先绑定网易云账号',
    RATE_LIMITED: '请求过于频繁，请稍后再试',
    RESOURCE_UNAVAILABLE: '该资源暂不可用',
    UNKNOWN: '获取歌单失败，请稍后再试',
  },
}))

const mockedFetch = vi.mocked(fetchUserPlaylists)

const groups: NcmUserPlaylists = {
  created: [{ id: 1, name: '我的创建', cover: '', trackCount: 3, playCount: 10, creator: '甲' }],
  collected: [
    { id: 2, name: '收藏的歌单A', cover: 'https://p1.music.126.net/a.jpg', trackCount: 5, playCount: 20, creator: '乙' },
  ],
}

beforeEach(() => {
  mockedFetch.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('我的歌单页', () => {
  it('初始态：标题与「我喜欢的音乐」入口', () => {
    mockedFetch.mockResolvedValue({ created: [], collected: [] })
    render(Page)

    expect(screen.getByRole('heading', { name: '我的歌单' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /我喜欢的音乐/ })).toBeTruthy()
  })

  it('加载中呈现加载态，加载完成后展示创建与收藏两组歌单', async () => {
    let resolveFetch!: (g: NcmUserPlaylists) => void
    mockedFetch.mockReturnValueOnce(new Promise((resolve) => {
      resolveFetch = resolve
    }))
    render(Page)

    await waitFor(() => expect(screen.getByText('加载中…')).toBeTruthy())

    resolveFetch(groups)
    await waitFor(() => expect(screen.getByText('我的创建')).toBeTruthy())

    expect(screen.getByText('创建的歌单')).toBeTruthy()
    expect(screen.getByText('收藏的歌单')).toBeTruthy()
    expect(screen.getByText('收藏的歌单A')).toBeTruthy()
    expect(screen.getByText(/甲/)).toBeTruthy()
  })

  it('每组歌单可进入歌单详情', async () => {
    mockedFetch.mockResolvedValue(groups)
    render(Page)

    await waitFor(() => expect(screen.getByText('我的创建')).toBeTruthy())

    const link = screen.getByRole('link', { name: /我的创建/ })
    expect(link.getAttribute('href')).toBe('/playlist/1')
  })

  it('空组呈现各自的空态文案', async () => {
    mockedFetch.mockResolvedValue({ created: [], collected: [] })
    render(Page)

    await waitFor(() => expect(screen.getByText('还没有创建的歌单')).toBeTruthy())
    expect(screen.getByText('还没有收藏的歌单')).toBeTruthy()
  })

  it('未绑定（UNAUTHENTICATED）呈现绑定引导文案', async () => {
    mockedFetch.mockRejectedValue(new NcmClientError('UNAUTHENTICATED', '查看歌单需要账号许可：请先绑定网易云账号'))
    render(Page)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('查看歌单需要账号许可：请先绑定网易云账号')
    })
  })

  it('被限流呈现限流文案', async () => {
    mockedFetch.mockRejectedValue(new NcmClientError('RATE_LIMITED', '请求过于频繁，请稍后再试'))
    render(Page)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('请求过于频繁，请稍后再试')
    })
  })

  it('异常后「我喜欢的音乐」入口仍在', async () => {
    mockedFetch.mockRejectedValue(new Error('boom'))
    render(Page)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('link', { name: /我喜欢的音乐/ })).toBeTruthy()
  })

  it('加载中不呈现列表与空态', async () => {
    let resolveFetch!: (value: NcmUserPlaylists) => void
    mockedFetch.mockReturnValueOnce(new Promise((resolve) => {
      resolveFetch = resolve
    }))
    render(Page)

    await waitFor(() => expect(screen.getByText('加载中…')).toBeTruthy())

    expect(screen.queryByText('创建的歌单')).toBeNull()
    expect(screen.queryByText('还没有创建的歌单')).toBeNull()
    resolveFetch({ created: [], collected: [] })
    await waitFor(() => expect(screen.getByText('还没有创建的歌单')).toBeTruthy())
  })

  it('渲染歌单封面图', async () => {
    mockedFetch.mockResolvedValue(groups)
    render(Page)

    await waitFor(() => expect(screen.getByText('收藏的歌单A')).toBeTruthy())

    const img = screen.getByAltText('')
    expect((img as HTMLImageElement).src).toBe('https://p1.music.126.net/a.jpg')
  })
})
