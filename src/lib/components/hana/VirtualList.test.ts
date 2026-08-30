import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { createRawSnippet, tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VirtualList from './VirtualList.svelte'

// jsdom 未实现 Element.scrollTo：激活项滚动 effect 在内部滚动模式下会调用
Element.prototype.scrollTo = vi.fn()
interface TestItem {
  id: number
  name: string
}

// 挂载边界上组件泛型 T 被擦除为 unknown：片段按 unknown 参数创建，内部还原条目类型
const renderItem = createRawSnippet<[unknown, number]>((getItem) => {
  const item = getItem() as TestItem
  return { render: () => `<div class="row">${item.name}</div>` }
})

function makeItems(count: number, startId = 1): TestItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: startId + i, name: `条目-${startId + i}` }))
}

// 容器 720px / 条目 72px 恰好整除：gap=0，位置 = index * 72
function renderList(items: TestItem[], extra: { activeItemId?: number, getItemById?: (id: number | string) => TestItem | null, onNearEnd?: () => void } = {}) {
  return render(VirtualList, {
    props: {
      items,
      containerSize: 720,
      itemSize: 72,
      renderItem,
      ...extra,
    },
  })
}

// VirtualListCore 的激活高亮层：组件树内唯一带 bg-primary 的元素
function highlight(container: HTMLElement) {
  const el = container.querySelector('[class*="bg-primary"]')
  if (!el)
    throw new Error('激活高亮层未找到')
  return el as HTMLElement
}

beforeEach(() => {
  // 触底防抖 500ms 与节流均走定时器：统一 fake timers 保证确定性
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('激活项高亮定位（M18）', () => {
  it('挂载当拍即按激活项位置高亮，不等 effect 批次补算映射', async () => {
    const data = makeItems(3)
    const { container } = renderList(data, {
      activeItemId: 2,
      getItemById: id => data.find(item => item.id === id) ?? null,
    })
    await tick()

    // 条目 id=2 位于 index 1 → 72px
    expect(highlight(container).getAttribute('style')).toContain('translateY(72px)')
  })

  it('items 与激活项同批变化时高亮即时落在新位置（不晚一拍）', async () => {
    const initial = makeItems(3)
    const { container, rerender } = renderList(initial, {
      activeItemId: 2,
      getItemById: id => initial.find(item => item.id === id) ?? null,
    })
    await tick()
    expect(highlight(container).getAttribute('style')).toContain('translateY(72px)')

    // 新数组替换 + 激活项切换：位置映射须当拍重算（旧实现经 effect 写 store 会晚一拍）
    const next = makeItems(4)
    await rerender({
      items: next,
      activeItemId: 3,
      getItemById: id => next.find(item => item.id === id) ?? null,
    })
    expect(highlight(container).getAttribute('style')).toContain('translateY(144px)')
  })
})

describe('触底预加载（LOW）', () => {
  function scrollTo(container: HTMLElement, top: number) {
    const scroller = container.querySelector('.overflow-y-auto')
    if (!scroller)
      throw new Error('虚拟列表滚动容器未找到')
    // jsdom 无布局：直接覆写 scrollTop 读值模拟滚动位置
    Object.defineProperty(scroller, 'scrollTop', { value: top, configurable: true, writable: true })
    return fireEvent.scroll(scroller)
  }

  it('items 变化即重置触发状态，500ms 防抖未到也能对新区域继续预加载', async () => {
    const onNearEnd = vi.fn()
    const { container, rerender } = renderList(makeItems(20), { onNearEnd })
    await tick()

    await scrollTo(container, 9999)
    await tick()
    expect(onNearEnd).toHaveBeenCalledTimes(1)

    // 追加下一页（items 变化）→ 触发状态立即重置；此时尚未越过 500ms 防抖
    await rerender({ items: makeItems(40) })
    await vi.advanceTimersByTimeAsync(20)
    await scrollTo(container, 19999)
    await tick()
    expect(onNearEnd).toHaveBeenCalledTimes(2)
  })

  it('卸载时清理 500ms 防抖定时器，销毁后不残留触发（onDestroy）', async () => {
    const onNearEnd = vi.fn()
    const { container, unmount } = renderList(makeItems(20), { onNearEnd })
    await tick()

    await scrollTo(container, 9999)
    await tick()
    expect(onNearEnd).toHaveBeenCalledTimes(1)

    const clearSpy = vi.spyOn(window, 'clearTimeout')
    unmount()
    // 防抖定时器与节流器均在卸载时清理
    expect(clearSpy).toHaveBeenCalled()

    // 定时器已清理：推进超过 500ms 也不再产生任何触发
    await vi.advanceTimersByTimeAsync(600)
    expect(onNearEnd).toHaveBeenCalledTimes(1)
  })
})
