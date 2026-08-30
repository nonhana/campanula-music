import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScrollContainer from './ScrollContainer.svelte'

// jsdom 无布局：内容尺寸恒 0，scrollBarPos 保持初始 'right'
function renderScroller(props: Record<string, unknown> = {}) {
  return render(ScrollContainer, { props: { ...props } })
}

function scroller(container: HTMLElement) {
  const el = container.querySelector('[role="region"]')
  if (!el)
    throw new Error('滚动容器未找到')
  return el as HTMLElement
}

function thumb(container: HTMLElement) {
  const el = container.querySelector('[aria-hidden="true"]')
  if (!el)
    throw new Error('滚动条把手未找到')
  return el as HTMLElement
}

beforeEach(() => {
  // scrollWatcher 节流 100ms 走定时器：fake timers 保证确定性
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('滚动容器可达性（M23）', () => {
  it('容器可 Tab 聚焦且带可读名称，把手降级为 aria-hidden 装饰', () => {
    const { container } = renderScroller({ ariaLabel: '歌曲列表' })

    const region = scroller(container)
    expect(region.getAttribute('tabindex')).toBe('0')
    expect(region.getAttribute('aria-label')).toBe('歌曲列表')

    // 把手不再抢占键盘焦点与读屏语义（键盘滚动走容器本身）
    expect(container.querySelector('[role="button"]')).toBeNull()
    expect(thumb(container).hasAttribute('tabindex')).toBe(false)
  })

  it('未传名称时容器仍可聚焦（aria-label 缺省省略）', () => {
    const { container } = renderScroller()

    const region = scroller(container)
    expect(region.getAttribute('tabindex')).toBe('0')
    expect(region.hasAttribute('aria-label')).toBe(false)
  })
})

describe('拖拽把手（Preserved）', () => {
  it('按下把手在 document 挂 mousemove/mouseup，抬起即移除', async () => {
    const { container } = renderScroller({ ariaLabel: '歌曲列表' })

    const addSpy = vi.spyOn(document, 'addEventListener')
    await fireEvent.mouseDown(thumb(container))
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))

    const removeSpy = vi.spyOn(document, 'removeEventListener')
    await fireEvent.mouseUp(document.body)
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })

  it('拖拽中途卸载：document 监听被 onDestroy 兜底移除', async () => {
    const { container, unmount } = renderScroller({ ariaLabel: '歌曲列表' })

    await fireEvent.mouseDown(thumb(container))
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })
})

describe('scrollWatcher 节流（LOW）', () => {
  function overrideScrollTop(container: HTMLElement, value: number) {
    Object.defineProperty(scroller(container), 'scrollTop', { value, configurable: true, writable: true })
  }

  it('滚动位置经 100ms 节流回调 scrollWatcher，行为不变', async () => {
    const watcher = vi.fn()
    const { container } = renderScroller({ scrollWatcher: watcher })
    await tick()
    overrideScrollTop(container, 9999)
    await fireEvent.scroll(scroller(container))
    // leading 即时回调 + trailing 兜底都落在本窗口内
    await vi.advanceTimersByTimeAsync(150)
    expect(watcher).toHaveBeenCalledWith(9999)
  })

  it('卸载时取消节流器：100ms 内无迟到的 trailing 回调', async () => {
    const watcher = vi.fn()
    const { container, unmount } = renderScroller({ scrollWatcher: watcher })
    await tick()

    // 两次快速滚动：第二次落在节流窗口内，产生待执行的 trailing 调用
    overrideScrollTop(container, 9999)
    await fireEvent.scroll(scroller(container))
    overrideScrollTop(container, 12000)
    await fireEvent.scroll(scroller(container))

    const callsAtUnmount = watcher.mock.calls.length
    unmount()
    await vi.advanceTimersByTimeAsync(300)

    expect(watcher.mock.calls.length).toBe(callsAtUnmount)
  })
})
