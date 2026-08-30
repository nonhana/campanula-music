import type * as Stores from '$lib/stores'
import type { SongItem } from '$lib/types'
import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
import { nowPlaying, paused } from '$lib/stores'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte'
import { tick } from 'svelte'
import { get } from 'svelte/store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Player from './Player.svelte'

// 与 Lyrics.test.ts 同口径：jsdom 未实现 Element.animate/scrollTo，桩掉以免歌词面板挂载即抛错
Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation)
Element.prototype.scrollTo = vi.fn()
// jsdom 的 play() 未实现且返回 undefined，Svelte 的 bind:paused 同步链会在 .catch 处抛错，桩成已兑现 Promise
HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
HTMLMediaElement.prototype.pause = vi.fn()
// LikeButton 挂载即拉取红心列表会发起真实请求，渲染测试内桩掉（红心编排另有专属测试）
vi.mock('$lib/stores', async (importOriginal) => {
  const actual = await importOriginal() as unknown as typeof Stores
  return {
    ...actual,
    loadLikedSongs: vi.fn(async () => {}),
  }
})

const song: SongItem = {
  id: 186016,
  name: '晴天',
  cover: '',
  alias: [],
  artists: [{ id: 6452, name: '周杰伦' }],
  album: { id: 21349, name: '叶惠美', cover: '' },
  duration: 269000,
  sourceId: '186016',
}

afterEach(() => {
  cleanup()
  nowPlaying.set(null)
  paused.set(true)
})

describe('页脚控件可达性（M22）', () => {
  it('上一首/播放/暂停/下一首/模式/播放列表均为带中文可读名的真实按钮，两个 range 均可读', () => {
    render(Player)
    const footer = screen.getByRole('contentinfo')
    const footerScope = within(footer)

    for (const name of [
      '上一首',
      '播放',
      '暂停',
      '下一首',
      '切换为循环播放',
      '切换为单曲循环',
      '切换为顺序播放',
      '切换为随机播放',
      '打开播放列表',
    ]) {
      expect(footerScope.getByRole('button', { name })).toBeTruthy()
    }

    expect(footerScope.getByRole('slider', { name: '播放进度' })).toBeTruthy()
    expect(footerScope.getByRole('slider', { name: '音量' })).toBeTruthy()
  })

  it('歌曲行 Space 触发播放且不泄漏到全局切播（M25）', async () => {
    nowPlaying.set(song)
    paused.set(true)
    render(Player)
    const row = render(SongPlaylistItem, { props: { song } })
    await tick()

    // 行获得焦点后按 Space：行内 handlePlay 将 paused 置 false；
    // 若按键泄漏到 window 的全局切播监听，paused 会被再次翻转回 true
    await fireEvent.keyDown(row.container.firstElementChild as HTMLElement, { code: 'Space', key: ' ' })
    await tick()

    expect(get(paused)).toBe(false)
  })
})
