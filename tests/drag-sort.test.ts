import type { DragSortEdges, DragSortResult, DragSortSession, DragSortState, GridTrack, RowTrack } from '#lib/components/shared/drag-sort.js'
import type { PointerSample } from '#lib/components/shared/press.js'
import { describe, expect, it } from 'vitest'
import { createDragSortSession, gridTrack, movedBefore, rowTrack } from '#lib/components/shared/drag-sort.js'

// 第二个测试接入点“拖动手势核心”（Spec #11 Testing Decisions，delivery.md 第 2 步）：
// 不碰页面、不碰 Svelte 的纯逻辑。三个拖动排序器（手机歌单行、桌面歌单网格、多选拖歌）共用这一份按下协议、
// 边缘滚动、目标位置、预览顺序、放下提交、作废撤回和 Alt + ↑ / ↓；这里喂 PointerSample，断言听众看到的结果：
// 拿起的是哪几项、空位在第几个、列表显示什么顺序、提交了什么、作废时提交没有。

interface Setup {
  ids?: readonly number[]
  /** 按下的这一项是哪几项一起挪 */
  groupOf?: (id: number) => readonly number[]
  edges?: DragSortEdges
  pointerType?: string
  /** 开始拖时量不出来（元素不在了） */
  missing?: boolean
  /** 还在落位 / 展开 */
  busy?: boolean
  keyboard?: boolean
  scrollable?: boolean
  /** 松手提交时调用方抛错（例如顺序已经过期）：看拖动态会不会卡住 */
  throws?: boolean
}

function setup({ ids = [10, 20, 30, 40, 50], groupOf = id => [id], edges = { top: 0, bottom: 800 }, pointerType = 'touch', missing = false, busy = false, keyboard = true, scrollable = true, throws = false }: Setup = {}) {
  const commits: (readonly number[])[] = []
  const results: DragSortResult[] = []
  /** 列表上沿（视口）：100，行距 64，行高 56，手指按在行顶下 0px */
  const scene: RowTrack = { grabY: 0, listTop: 100, pitch: 64, height: 56, minTop: 8, maxTop: 744 }
  const session = createDragSortSession<RowTrack>({
    ids: () => ids,
    groupOf,
    begin: () => (missing ? null : scene),
    targetAt: (s, at, slots) => rowTrack(s, at.y, slots).target,
    edges: () => edges,
    busy: () => busy,
    scrollable: () => scrollable,
    keyboard,
    commit: (order) => {
      commits.push(order)
      if (throws)
        throw new Error('提交被拒绝')
      return true
    },
    onEnd: result => results.push(result),
  })
  const grip = session.grip(ids[Math.min(1, ids.length - 1)]!)

  let time = 0
  const sample = (x: number, y: number, buttons: number, extra: Partial<PointerSample> = {}): PointerSample => ({
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button: 0,
    buttons,
    x,
    y,
    time,
    ...extra,
  })
  const pointer = {
    down(x: number, y: number, extra?: Partial<PointerSample>) {
      return grip.press(sample(x, y, 1, extra))
    },
    move(x: number, y: number, ms = 16, extra?: Partial<PointerSample>) {
      time += ms
      grip.move(sample(x, y, 1, extra))
    },
    up(x: number, y: number, ms = 16, extra?: Partial<PointerSample>) {
      time += ms
      grip.release(sample(x, y, 0, extra))
    },
    cancel(pointerId?: number) {
      grip.abandon(pointerId)
    },
  }
  return { session, grip, pointer, commits, results, scene }
}

function dragging(session: DragSortSession): DragSortState {
  const state = session.state
  expect(state).not.toBeNull()
  return state!
}

describe('按下协议：鼠标 5px、触屏立即、只认主指针', () => {
  it('鼠标按下没挪够 5px 就被打断（右键、切走窗口），再用触屏按下仍能正常拖完', () => {
    const { session, pointer, commits, results } = setup({ pointerType: 'mouse' })

    // 鼠标按下了，但没挪够 5px：这次按住被打断
    expect(pointer.down(200, 150)).toBe(true)
    pointer.move(200, 153)
    expect(session.state).toBeNull()
    pointer.cancel()
    expect(session.state).toBeNull()

    // 再用手指按住同一行：立即开始拖，一直拖到最下面并松手
    expect(pointer.down(200, 150, { pointerType: 'touch', pointerId: 2 })).toBe(true)
    expect(dragging(session).grabbed).toBe(20)
    pointer.move(200, 150 + 64 * 4, 16, { pointerType: 'touch', pointerId: 2 })
    pointer.up(200, 150 + 64 * 4, 16, { pointerType: 'touch', pointerId: 2 })

    expect(session.state).toBeNull()
    expect(commits).toEqual([[10, 30, 40, 50, 20]])
    expect(results).toEqual([{ moved: true, order: [10, 30, 40, 50, 20], target: 4, cancelled: false, grabbed: 20 }])
  })

  it('触屏按下立即开始；鼠标要挪过 5px 才算，没挪够就松开的是点按', () => {
    const touch = setup({ pointerType: 'touch' })
    expect(touch.pointer.down(200, 150)).toBe(true)
    expect(touch.session.state).not.toBeNull()
    touch.pointer.up(200, 150)
    expect(touch.session.state).toBeNull()
    expect(touch.commits).toEqual([])
    expect(touch.results).toEqual([{ moved: false, order: [10, 20, 30, 40, 50], target: 1, cancelled: false, grabbed: 20 }])

    const mouse = setup({ pointerType: 'mouse' })
    expect(mouse.pointer.down(200, 150)).toBe(true)
    mouse.pointer.move(200, 154)
    expect(mouse.session.state).toBeNull()
    mouse.pointer.move(200, 156)
    expect(mouse.session.state).not.toBeNull()
    mouse.pointer.up(200, 156)
    expect(mouse.commits).toEqual([])
    expect(mouse.results[0]?.moved).toBe(false)
  })

  it('第二根手指的按下、松开都不插手；第一根手指松手才算完', () => {
    const { session, pointer, commits } = setup({ pointerType: 'touch' })
    expect(pointer.down(200, 150)).toBe(true)
    expect(dragging(session).grabbed).toBe(20)

    // 第二根手指按在别的行上：这次按下不算，正在拖的不受影响
    expect(pointer.down(200, 300, { isPrimary: false, pointerId: 2 })).toBe(false)
    expect(dragging(session).grabbed).toBe(20)
    // 第二根手指松开：不管
    pointer.up(200, 300, 16, { pointerId: 2, isPrimary: false })
    expect(session.state).not.toBeNull()
    // 第一根手指接着拖完
    pointer.move(200, 150 + 64)
    pointer.up(200, 150 + 64)
    expect(session.state).toBeNull()
    expect(commits).toEqual([[10, 30, 20, 40, 50]])
  })

  it('非主指针、右键按下都不算', () => {
    const { session, pointer } = setup({ pointerType: 'mouse' })
    expect(pointer.down(200, 150, { isPrimary: false })).toBe(false)
    expect(pointer.down(200, 150, { button: 2 })).toBe(false)
    expect(session.state).toBeNull()
  })

  it('上一次按住还没结束时又按下：先把旧的清干净，新的接着开始', () => {
    const { session, grip, commits } = setup({ pointerType: 'mouse' })
    // 鼠标按下还没挪够 5px
    expect(grip.press({ pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, x: 200, y: 150, time: 0 })).toBe(true)
    // 同一根手指没有 up，又按了一次（例如丢了 pointerup）：旧的 pending 不能留到这次
    expect(grip.press({ pointerId: 2, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, x: 200, y: 150, time: 20 })).toBe(true)
    expect(dragging(session).grabbed).toBe(20)
    grip.move({ pointerId: 2, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, x: 200, y: 214, time: 40 })
    grip.release({ pointerId: 2, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0, x: 200, y: 214, time: 60 })
    expect(commits).toEqual([[10, 30, 20, 40, 50]])
  })

  it('开始拖时量不出几何（元素不在了）：这次按下不算', () => {
    const { session, pointer } = setup({ pointerType: 'touch', missing: true })
    expect(pointer.down(200, 150)).toBe(false)
    expect(session.state).toBeNull()
  })

  it('还在落位 / 展开时不接新的按下', () => {
    const { session, pointer } = setup({ pointerType: 'touch', busy: true })
    expect(pointer.down(200, 150)).toBe(false)
    expect(session.state).toBeNull()
  })
})

describe('目标位置、预览顺序、放下提交、作废撤回', () => {
  it('按指针位置算空位，预览顺序跟着变；松手提交这个顺序', () => {
    const { session, pointer, commits } = setup({ pointerType: 'touch' })
    pointer.down(200, 150)
    expect(dragging(session).preview).toEqual([10, 20, 30, 40, 50])

    pointer.move(200, 150 + 64)
    expect(dragging(session).target).toBe(2)
    expect(dragging(session).preview).toEqual([10, 30, 20, 40, 50])

    pointer.move(200, 150 + 64 * 4)
    expect(dragging(session).target).toBe(4)
    expect(dragging(session).preview).toEqual([10, 30, 40, 50, 20])

    pointer.up(200, 150 + 64 * 4)
    expect(commits).toEqual([[10, 30, 40, 50, 20]])
    expect(session.state).toBeNull()
  })

  it('松手时顺序没变就不提交；Esc / 按住断了作废，也不提交', () => {
    const same = setup({ pointerType: 'touch' })
    same.pointer.down(200, 150)
    same.pointer.up(200, 150)
    expect(same.commits).toEqual([])

    const cancelled = setup({ pointerType: 'touch' })
    cancelled.pointer.down(200, 150)
    cancelled.pointer.move(200, 150 + 64)
    cancelled.session.cancel()
    expect(cancelled.session.state).toBeNull()
    expect(cancelled.commits).toEqual([])
    expect(cancelled.results[0]).toMatchObject({ moved: false, cancelled: true })

    const broken = setup({ pointerType: 'mouse' })
    broken.pointer.down(200, 150)
    broken.pointer.move(200, 260)
    broken.pointer.cancel()
    expect(broken.session.state).toBeNull()
    expect(broken.commits).toEqual([])
    expect(broken.results[0]?.cancelled).toBe(true)
  })

  it('勾选的几首一起挪，保持原来的先后', () => {
    // 2、4 是一起挪的一组：原来的顺序里它们中间隔着 3
    const { session, commits } = setup({
      ids: [1, 2, 3, 4, 5, 6],
      groupOf: id => (id === 2 ? [2, 4] : [id]),
      pointerType: 'touch',
    })
    const grip = session.grip(2)
    let time = 0
    const at = (y: number) => ({ pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, x: 0, y, time })
    grip.press(at(150))
    // 拿起时就是原来的顺序：2、4 在空位 1
    expect(session.state?.rest).toEqual([1, 3, 5, 6])
    expect(session.state?.preview).toEqual([1, 2, 4, 3, 5, 6])
    expect(session.state?.startTarget).toBe(1)
    // 拖到两首之后：空位 3，一组仍然保持 2、4 的先后
    time += 16
    grip.move(at(150 + 64 * 2))
    expect(session.state?.target).toBe(3)
    expect(session.state?.preview).toEqual([1, 3, 5, 2, 4, 6])
    time += 16
    grip.release({ ...at(150 + 64 * 2), buttons: 0 })
    expect(commits).toEqual([[1, 3, 5, 2, 4, 6]])
  })

  it('非连续的多选：原地松手、拖走再拖回原位都不提交；拖到别的空位才提交', () => {
    const setupGroup = () => setup({
      ids: [1, 2, 3, 4, 5, 6],
      groupOf: id => (id === 2 ? [2, 4] : [id]),
      pointerType: 'touch',
    })

    // 原地松手：preview 一开始就和 ids 不同，但空位没变，不能提交
    const still = setupGroup()
    still.pointer.down(200, 150)
    still.pointer.up(200, 150)
    expect(still.commits).toEqual([])
    expect(still.results[0]).toMatchObject({ moved: false })

    // 拖到另一个空位再拖回原来的空位：也不提交
    const back = setupGroup()
    back.pointer.down(200, 150)
    back.pointer.move(200, 150 + 64 * 2)
    back.pointer.move(200, 150)
    back.pointer.up(200, 150)
    expect(back.commits).toEqual([])
    expect(back.results[0]).toMatchObject({ moved: false })

    // 拖到另一个空位：正常提交，组内先后不变
    const moved = setupGroup()
    moved.pointer.down(200, 150)
    moved.pointer.move(200, 150 + 64 * 2)
    moved.pointer.up(200, 150 + 64 * 2)
    expect(moved.commits).toEqual([[1, 3, 5, 2, 4, 6]])
    expect(moved.results[0]).toMatchObject({ moved: true })
  })

  it('松手提交抛错：拖动态照样收干净、onEnd 照样触发，下一次按下不被挡住', () => {
    const { session, pointer, commits, results } = setup({ pointerType: 'touch', throws: true })
    pointer.down(200, 150)
    pointer.move(200, 150 + 64)

    expect(() => pointer.up(200, 150 + 64)).toThrow('提交被拒绝')

    expect(commits).toEqual([[10, 30, 20, 40, 50]])
    expect(results.at(-1)).toMatchObject({ moved: true, order: [10, 30, 20, 40, 50], cancelled: false })
    expect(session.state).toBeNull()
    // 收干净了：下一次按下还能开始拖
    expect(pointer.down(200, 150)).toBe(true)
    expect(session.state).not.toBeNull()
    pointer.cancel()
  })
})

describe('键盘：Alt + ↑ / ↓ 移一位', () => {
  it('不在拖动时移动一格并提交；拖动中、核心关掉键盘时不接', () => {
    const { session, pointer, commits } = setup({ ids: [1, 2, 3, 4] })
    expect(session.moveByKeyboard(3, -1)).toBe(true)
    expect(commits).toEqual([[1, 3, 2, 4]])
    expect(session.moveByKeyboard(1, -1)).toBe(false)
    expect(session.moveByKeyboard(4, 1)).toBe(false)

    pointer.down(200, 150)
    expect(session.moveByKeyboard(2, 1)).toBe(false)
    expect(commits).toEqual([[1, 3, 2, 4]])
    pointer.cancel()

    const off = setup({ ids: [1, 2, 3], keyboard: false })
    expect(off.session.moveByKeyboard(1, 1)).toBe(false)
    expect(off.commits).toEqual([])
  })

  it('movedBefore：返回编号 / null（最后）/ undefined（挪不动）三态', () => {
    const ids = [1, 2, 3, 4]
    expect(movedBefore(ids, 2, -1)).toBe(1)
    expect(movedBefore(ids, 2, 1)).toBe(4)
    expect(movedBefore(ids, 3, 1)).toBeNull()
    expect(movedBefore(ids, 1, -1)).toBeUndefined()
    expect(movedBefore(ids, 5, 1)).toBeUndefined()
  })
})

describe('边缘滚动', () => {
  it('越靠边越快、停在边缘越久越快；滚动多少由核心算（绝对值）', () => {
    const { session, pointer } = setup({ pointerType: 'touch', edges: { top: 0, bottom: 800 } })
    pointer.down(200, 400)
    expect(session.frame(0.016)).toBe(0)

    // 边缘区 72px：760 处深 32/72，第一帧 hold=16ms
    pointer.move(200, 760)
    expect(session.frame(0.016)).toBeCloseTo(5.14, 2)

    // 795 处深 67/72，hold=32ms
    pointer.move(200, 795)
    expect(session.frame(0.016)).toBeCloseTo(23.71, 2)

    // 同一位置再一帧：hold=48ms，加速
    expect(session.frame(0.016)).toBeCloseTo(24.48, 2)

    pointer.cancel()
    expect(session.frame(0.016)).toBe(0)
  })

  it('作废后不再滚；快速定位时可以关掉边缘滚动', () => {
    const broken = setup({ pointerType: 'touch' })
    broken.pointer.down(200, 150)
    broken.pointer.move(200, 795)
    expect(broken.session.frame(0.016)).toBeGreaterThan(0)
    broken.session.cancel()
    expect(broken.session.frame(0.016)).toBe(0)

    const scrub = setup({ pointerType: 'touch', scrollable: false })
    scrub.pointer.down(200, 150)
    scrub.pointer.move(200, 795)
    expect(scrub.session.frame(0.016)).toBe(0)
  })
})

describe('几何：行列表和卡片网格', () => {
  it('行列表：按浮起那一行的中线算空位，拖出列表就停在头尾；0 个空位时只能是 0', () => {
    const track: RowTrack = { grabY: 10, listTop: 100, pitch: 64, height: 56, minTop: 8, maxTop: 744 }
    expect(rowTrack(track, 200, 4)).toEqual({ y: 190, target: 1 })
    expect(rowTrack(track, 0, 4)).toEqual({ y: 8, target: 0 })
    expect(rowTrack(track, 900, 4)).toEqual({ y: 744, target: 4 })
    expect(rowTrack(track, 500, 0)).toEqual({ y: 490, target: 0 })
  })

  it('卡片网格：target 用未夹紧的指针 + 滚动量（文档坐标），ghost 仍夹在视口里', () => {
    const base: GridTrack = {
      gridLeft: 100,
      gridTop: 500,
      scrollX: 0,
      scrollY: 0,
      pitchX: 200,
      pitchY: 220,
      columns: 3,
      grabX: 0,
      grabY: 0,
      minX: 0,
      maxX: 2000,
      minY: 0,
      maxY: 2000,
    }
    // 页面滚到 400：视口里的同一指针在文档里多 400，落点往下一行
    expect(gridTrack(base, 110, 500, 5).target).toBe(0)
    expect(gridTrack({ ...base, scrollY: 400 }, 110, 500, 5).target).toBe(3)
    // 指针比夹紧后的 ghost 更靠下：ghost 停在 maxY，target 继续往下走到最后一格
    expect(gridTrack({ ...base, maxY: 100 }, 110, 1000, 5)).toEqual({ x: 110, y: 100, target: 5 })
    // 只有一列：列永远是 0，按行数
    expect(gridTrack({ ...base, columns: 1, pitchY: 100, scrollY: 400 }, 5000, 610, 5).target).toBe(5)
    // 指针在网格左上外：ghost 和 target 都停在开头
    expect(gridTrack(base, -100, -100, 5)).toEqual({ x: 0, y: 0, target: 0 })
  })
})
