import { describe, expect, it } from 'vitest'
import { createInitialAppState } from '../src/lib/app-state'

describe('app 基础状态', () => {
  it('未登录时没有当前账号', () => {
    const state = createInitialAppState()
    expect(state.currentAccount).toBeNull()
  })

  it('未登录时曲库为空', () => {
    const state = createInitialAppState()
    expect(state.library.likedSongs).toEqual([])
    expect(state.library.playlists).toEqual([])
    expect(state.library.albums).toEqual([])
    expect(state.library.artists).toEqual([])
  })

  it('未登录时播放队列为空', () => {
    const state = createInitialAppState()
    expect(state.playQueue).toEqual([])
    expect(state.currentIndex).toBe(-1)
  })

  it('未登录时下载列表为空', () => {
    const state = createInitialAppState()
    expect(state.downloads).toEqual([])
  })
})
