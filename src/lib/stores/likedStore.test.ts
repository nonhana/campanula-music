import type { NcmSong } from '$lib/types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchLikedSongIds, LIKE_ERROR_TEXT, likeSong } from '$lib/ncm/likes'
import { get } from 'svelte/store'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { likedError, likedIds, likedLoaded, likedLoading, likedPending, loadLikedSongs, toggleLike } from './likedStore'
import { addMessage } from './messageStore'

vi.mock('$lib/ncm/likes', () => ({
  fetchLikedSongIds: vi.fn(),
  likeSong: vi.fn(),
  LIKE_ERROR_TEXT: {
    UNAUTHENTICATED: '红心需要账号许可：请先绑定网易云账号',
    RATE_LIMITED: '请求过于频繁，请稍后再试',
    RESOURCE_UNAVAILABLE: '该歌曲暂不可用',
    UNKNOWN: '红心操作失败，请稍后再试',
  },
}))

vi.mock('./messageStore', () => ({
  addMessage: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchLikedSongIds)
const mockedLike = vi.mocked(likeSong)
const mockedMessage = vi.mocked(addMessage)

function song(id: number, name = `歌曲${id}`): NcmSong {
  return {
    id,
    name,
    artists: [{ id: 1, name: '歌手A' }],
    album: { id: 2, name: '专辑B', cover: `https://p1.music.126.net/${id}.jpg` },
    duration: 180000,
  }
}

beforeEach(() => {
  mockedFetch.mockReset()
  mockedLike.mockReset()
  mockedMessage.mockReset()
  likedIds.set(new Set())
  likedPending.set(new Set())
  likedLoading.set(false)
  likedLoaded.set(false)
  likedError.set(null)
})

describe('loadLikedSongs', () => {
  it('拉取红心 id 列表并填充状态', async () => {
    mockedFetch.mockResolvedValue([2, 1])

    await loadLikedSongs()

    expect(get(likedIds)).toEqual(new Set([2, 1]))
    expect(get(likedLoaded)).toBe(true)
    expect(get(likedLoading)).toBe(false)
    expect(get(likedError)).toBeNull()
  })

  it('已加载过则跳过重复请求', async () => {
    mockedFetch.mockResolvedValue([1])

    await loadLikedSongs()
    await loadLikedSongs()

    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('并发调用共享同一在途请求（红心按钮批量挂载不产生请求风暴）', async () => {
    mockedFetch.mockResolvedValue([1])

    await Promise.all([loadLikedSongs(), loadLikedSongs(), loadLikedSongs()])

    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(get(likedIds)).toEqual(new Set([1]))
  })

  it('加载完成前在途红心的歌曲不被服务端快照覆盖', async () => {
    const { promise: fetchPromise, resolve: resolveFetch } = Promise.withResolvers<number[]>()
    const { promise: likePromise, resolve: resolveLike } = Promise.withResolvers<void>()
    mockedFetch.mockReturnValueOnce(fetchPromise)
    mockedLike.mockReturnValueOnce(likePromise)

    const loading = loadLikedSongs()
    // 快照在途时用户先红心了一首新歌（写回尚未完成）
    const toggling = toggleLike(song(99))
    resolveFetch([1])
    await loading
    // 在途新增被合并保留，不被过期快照覆盖
    expect(get(likedIds)).toEqual(new Set([99, 1]))

    resolveLike()
    await toggling
    expect(get(likedIds)).toEqual(new Set([99, 1]))
  })

  it('force 强制重新拉取', async () => {
    mockedFetch.mockResolvedValueOnce([1]).mockResolvedValueOnce([1, 2])

    await loadLikedSongs()
    await loadLikedSongs(true)

    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(get(likedIds)).toEqual(new Set([1, 2]))
  })

  it('失败（未绑定）留下可展示错误，且再次加载会重试', async () => {
    mockedFetch.mockRejectedValueOnce(new NcmClientError('UNAUTHENTICATED', '查看我喜欢的音乐需要账号许可：请先绑定网易云账号'))
      .mockResolvedValueOnce([1])

    await loadLikedSongs()
    expect(get(likedError)).toBe('查看我喜欢的音乐需要账号许可：请先绑定网易云账号')
    expect(get(likedIds)).toEqual(new Set())

    await loadLikedSongs()
    expect(get(likedError)).toBeNull()
    expect(get(likedIds)).toEqual(new Set([1]))
  })
})

describe('toggleLike', () => {
  it('未红心 → 乐观加入并写回 true', async () => {
    mockedLike.mockResolvedValue()

    await toggleLike(song(1))

    expect(get(likedIds)).toEqual(new Set([1]))
    expect(mockedLike).toHaveBeenCalledWith(1, true)
    expect(mockedMessage).toHaveBeenCalledWith({ message: '已红心「歌曲1」', type: 'success' })
    expect(get(likedPending)).toEqual(new Set())
  })

  it('已红心 → 乐观移除并写回 false', async () => {
    likedIds.set(new Set([2, 1]))
    mockedLike.mockResolvedValue()

    await toggleLike(song(2))

    expect(get(likedIds)).toEqual(new Set([1]))
    expect(mockedLike).toHaveBeenCalledWith(2, false)
    expect(mockedMessage).toHaveBeenCalledWith({ message: '已取消红心「歌曲2」', type: 'success' })
  })

  it('写回失败回滚到原状并呈现错误文案', async () => {
    likedIds.set(new Set([2]))
    mockedLike.mockRejectedValue(new NcmClientError('RATE_LIMITED', '请求过于频繁，请稍后再试'))

    await toggleLike(song(2))

    expect(get(likedIds)).toEqual(new Set([2]))
    expect(mockedMessage).toHaveBeenCalledWith({ message: '请求过于频繁，请稍后再试', type: 'error' })
    expect(get(likedPending)).toEqual(new Set())
  })

  it('红心失败回滚后不残留新歌曲', async () => {
    mockedLike.mockRejectedValue(new Error('boom'))

    await toggleLike(song(1))

    expect(get(likedIds)).toEqual(new Set())
    expect(mockedMessage).toHaveBeenCalledWith({ message: LIKE_ERROR_TEXT.UNKNOWN, type: 'error' })
  })

  it('写回进行中重复点击被忽略（防重复请求）', async () => {
    const { promise: likePromise, resolve: resolveLike } = Promise.withResolvers<void>()
    mockedLike.mockReturnValueOnce(likePromise)

    const first = toggleLike(song(1))
    // 进行中：pending 防重
    const second = toggleLike(song(1))

    resolveLike()
    await Promise.all([first, second])

    expect(mockedLike).toHaveBeenCalledTimes(1)
    expect(get(likedPending)).toEqual(new Set())
  })

  it('并发两首不同歌曲一成一败：失败歌曲回滚不波及成功歌曲', async () => {
    mockedLike.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce()

    await Promise.all([toggleLike(song(1)), toggleLike(song(2))])

    // 歌曲 2 红心成功保留，歌曲 1 失败回滚
    expect(get(likedIds)).toEqual(new Set([2]))
    expect(mockedMessage).toHaveBeenCalledWith({ message: '已红心「歌曲2」', type: 'success' })
    expect(mockedMessage).toHaveBeenCalledWith({ message: LIKE_ERROR_TEXT.UNKNOWN, type: 'error' })
  })
})
