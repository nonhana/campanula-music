import type { LyricItem, SongItem } from '$lib/types'
import { currentTime, nowPlaying, paused } from '$lib/stores'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Lyrics from './Lyrics.svelte'

// jsdom 未实现 Element.animate（Web Animations），桩掉以让按钮时间文案的 in/out fade 过渡不抛错
Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation)

// jsdom 未实现 Element.scrollTo，桩掉以让自动滚动 effect 正常执行（桩不会产生真实滚动事件）
Element.prototype.scrollTo = vi.fn()

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

function songWith(lyrics: LyricItem[]) {
  return { ...song, lyrics }
}

const lyricsA: LyricItem[] = [
  { time: 1000, text: '第一句', translate: null },
  { time: 5000, text: '第二句', translate: null },
  { time: 9000, text: '第三句', translate: null },
]

// 定位歌词滚动容器（组件内唯一 overflow-auto 元素）
function scrollContainer(container: HTMLElement) {
  const el = container.querySelector('.overflow-auto')
  if (!el)
    throw new Error('歌词滚动容器未找到')
  return el
}

beforeEach(() => {
  // jsdom 无 scrollend 事件：组件的定时器路径（兜底归还/静止防抖）全部走 fake timers
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  nowPlaying.set(null)
  currentTime.set(0)
  paused.set(true)
})

describe('lyrics 面板', () => {
  it('切歌后当前行高亮不残留：新歌尚未唱到第一句时无任何高亮', async () => {
    nowPlaying.set(songWith(lyricsA))
    currentTime.set(6) // 6s 命中第二句（5000ms ≤ 6s < 9000ms）
    render(Lyrics)
    await tick()

    expect(screen.getByText('第二句').closest('.text-black')).toBeTruthy()
    expect(screen.getByText('第一句').closest('.text-black')).toBeNull()

    // 切歌后播放进度（6s）尚未到达新歌第一句（10s）：旧索引/高亮不得残留
    nowPlaying.set(songWith([{ time: 10000, text: '新第一句', translate: null }]))
    await tick()

    expect(screen.queryByText('第二句')).toBeNull()
    expect(screen.getByText('新第一句').closest('.text-black')).toBeNull()
    expect(screen.getByText('新第一句').closest('.text-neutral')).toBeTruthy()
  })

  it('纯音乐（findIndex=-1）：不高亮任何行，占位如实呈现', async () => {
    nowPlaying.set(songWith([]))
    currentTime.set(6)
    render(Lyrics)
    await tick()

    const placeholder = screen.getByText('暂无歌词')
    expect(placeholder.closest('.text-black')).toBeNull()
    expect(placeholder.closest('.text-neutral')).toBeTruthy()
    // 旧歌歌词行不得残留
    expect(screen.queryByText('第一句')).toBeNull()
  })

  it('回到当前歌词按钮：手动滚动后且有当前行时可用', async () => {
    nowPlaying.set(songWith(lyricsA))
    currentTime.set(6)
    paused.set(false)
    const { container } = render(Lyrics)
    await tick()

    const button = screen.getByRole('button')
    // 初始未手动滚动：禁用
    expect(button.hasAttribute('disabled')).toBe(true)

    // jsdom 无 scrollend：等待 1.5s 兜底定时器归还 isAutoScrolling 后，手动滚动才能标记 customScrolling
    await vi.advanceTimersByTimeAsync(1500)
    await fireEvent.scroll(scrollContainer(container))
    await tick()

    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('纯音乐时回到当前歌词按钮始终禁用', async () => {
    nowPlaying.set(songWith([]))
    currentTime.set(6)
    paused.set(false)
    const { container } = render(Lyrics)
    await tick()

    // 等待兜底定时器归还 isAutoScrolling 再手动滚动：其余禁用条件均为假，禁用只能来自 currentLyricIndex=-1
    await vi.advanceTimersByTimeAsync(1500)
    await fireEvent.scroll(scrollContainer(container))
    await tick()

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })
})
