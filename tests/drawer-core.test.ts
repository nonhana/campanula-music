import type { DrawerPose, GripSource } from '#lib/components/player/drawer-core.js'
import type { PointerSample } from '#lib/components/press.js'
import { describe, expect, it } from 'vitest'
import { createDrawerCore } from '#lib/components/player/drawer-core.js'

// 第二个测试接入点“拖动手势核心”（Spec #11 Testing Decisions）的抽屉那一半，另一半是封面转盘（wheel-core.test.ts）。
// 喂按下、移动、松开、点击、按住断了、浅路由开关，看抽屉跟手到哪、停在哪一头、改不改浅路由、算不算点按。
// 位置 0 是整个拉开，1 是收在下面看不见；往下拖 y 变大

interface Setup {
  /** 从哪一头拖：把手是拉开着往下拖（open），播放条是收着往上拖（closed） */
  from?: GripSource['from']
  /** 抽屉自己的高度（px） */
  size?: number
  /** 浅路由一开始说开着没有 */
  open?: boolean
  pointerType?: string
}

function setup({ from = 'open', size = 800, open = from === 'open', pointerType = 'mouse' }: Setup = {}) {
  /** 抽屉现在画在哪：停下时动画马上到位；测试里可以改成“动画还在半路” */
  let drawn = open ? 0 : 1
  const said: string[] = []
  const core = createDrawerCore({
    size: () => size,
    drawnAt: () => drawn,
    onPose: (pose: DrawerPose) => {
      drawn = pose.dragging ? pose.position : pose.end
    },
  })
  core.settle(open)
  const grip = core.grip({ from, commit: () => said.push('commit'), tap: () => said.push('tap') })

  let time = 0
  const sample = (y: number, buttons: number, extra: Partial<PointerSample> = {}): PointerSample => ({
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button: 0,
    buttons,
    x: 200,
    y,
    time,
    ...extra,
  })
  /** 一根指针：每个动作之后时间往前走 ms */
  const pointer = {
    down(y: number, extra?: Partial<PointerSample>) {
      grip.press(sample(y, 1, extra))
    },
    move(y: number, ms = 16, extra?: Partial<PointerSample>) {
      time += ms
      grip.move(sample(y, 1, extra))
    },
    up(y: number, ms = 16) {
      time += ms
      grip.release(sample(y, 0))
    },
    /** 松开之后浏览器跟着发的 click（鼠标、手指的 detail 是 1） */
    click(detail = 1) {
      grip.click(detail)
    },
    wait(ms: number) {
      time += ms
    },
  }
  return {
    core,
    grip,
    pointer,
    said,
    /** 动画还在半路：抽屉现在画在 position */
    setDrawn(position: number) {
      drawn = position
    },
  }
}

describe('跟手和点按', () => {
  it('按住拖动时抽屉跟着走：位置是从按下的地方拖过的距离占抽屉高度的比例；没挪够起拖距离就松开的是点按', () => {
    const { core, pointer, said } = setup({ size: 800 })

    pointer.down(100)
    pointer.move(101)
    expect(core.pose).toEqual({ dragging: false, end: 0 })
    pointer.up(101)
    pointer.click()
    expect(said).toEqual(['tap'])

    said.length = 0
    pointer.down(100)
    pointer.move(140)
    expect(core.pose).toEqual({ dragging: true, position: 0.05 })
    pointer.move(180)
    expect(core.pose).toEqual({ dragging: true, position: 0.1 })
    pointer.up(180, 400)
    pointer.click()
    expect(said).toEqual([])
  })
})

describe('松手时去哪一头', () => {
  it('慢慢拖过自身高度的 1/4 就收起（改浅路由）；差一点没到就弹回去', () => {
    const { core, pointer, said } = setup({ size: 800 })

    pointer.down(0)
    for (let y = 20; y <= 190; y += 10)
      pointer.move(y, 100)
    pointer.up(190, 100)
    expect(core.pose).toEqual({ dragging: false, end: 0 })
    expect(said).toEqual([])

    pointer.down(0)
    for (let y = 20; y <= 200; y += 10)
      pointer.move(y, 100)
    pointer.up(200, 100)
    expect(core.pose).toEqual({ dragging: false, end: 1 })
    expect(said).toEqual(['commit'])
  })

  it('一甩：整段拖动的速度超过 0.4px/ms，拖得再短也算；刚好 0.4 不算', () => {
    const fast = setup({ size: 800 })
    fast.pointer.down(0)
    fast.pointer.move(30, 50)
    fast.pointer.up(60, 50)
    expect(fast.said).toEqual(['commit'])

    const exact = setup({ size: 800 })
    exact.pointer.down(0)
    exact.pointer.move(20, 50)
    exact.pointer.up(40, 50)
    expect(exact.said).toEqual([])
    expect(exact.core.pose).toEqual({ dragging: false, end: 0 })
  })

  it('松手时比按下的地方还往回了（往拉开那边）：怎么快都不算', () => {
    const { core, pointer, said } = setup({ size: 800 })
    pointer.down(300)
    pointer.move(500, 100)
    pointer.up(290, 20)
    expect(said).toEqual([])
    expect(core.pose).toEqual({ dragging: false, end: 0 })
  })

  it('从收着的一头往上拉（播放条）：拉过 1/4 就拉开', () => {
    const { core, pointer, said } = setup({ from: 'closed', size: 800 })
    pointer.down(780)
    for (let y = 760; y >= 560; y -= 20)
      pointer.move(y, 100)
    expect(core.pose).toEqual({ dragging: true, position: 0.725 })
    pointer.up(560, 100)
    expect(core.pose).toEqual({ dragging: false, end: 0 })
    expect(said).toEqual(['commit'])
  })
})

describe('拉过头', () => {
  it('往拉开那边拖过头时有阻尼：拖过 v px 只走 8·(ln(v+1)−2) px（Vaul 的 dampenValue），头几 px 不动', () => {
    const { core, pointer } = setup({ size: 800 })
    pointer.down(500)
    pointer.move(495)
    expect(core.pose).toEqual({ dragging: true, position: 0 })
    pointer.move(400)
    expect(core.pose.dragging && core.pose.position).toBeCloseTo(-20.92096 / 800, 6)
    // 拖过两千 px（比一整屏还远）也只走四十几 px；再远的由适配层截在抽屉底下垫的那一截以内
    pointer.move(-1500)
    expect(core.pose.dragging && core.pose.position).toBeCloseTo(-44.81 / 800, 4)
    expect(core.pose.dragging && core.pose.position * 800).toBeCloseTo(-44.81, 2)
  })

  it('往收起那边拖过头：停在完全收起，不会再往下', () => {
    const { core, pointer } = setup({ size: 800 })
    pointer.down(0)
    pointer.move(1200)
    expect(core.pose).toEqual({ dragging: true, position: 1 })
  })

  it('从播放条往上拉，拉过完全拉开也是同样的阻尼', () => {
    const { core, pointer } = setup({ from: 'closed', size: 800 })
    pointer.down(800)
    pointer.move(-100)
    expect(core.pose.dragging && core.pose.position).toBeCloseTo(-20.92096 / 800, 6)
  })
})

describe('哪些按下才算开始拖', () => {
  it('触屏要挪过 10px 才开始拖（9px 还不算），鼠标 2px', () => {
    const touch = setup({ pointerType: 'touch' })
    touch.pointer.down(100)
    touch.pointer.move(109)
    expect(touch.core.pose.dragging).toBe(false)
    touch.pointer.move(110)
    expect(touch.core.pose).toEqual({ dragging: true, position: 0.0125 })

    const mouse = setup({ pointerType: 'mouse' })
    mouse.pointer.down(100)
    mouse.pointer.move(101)
    expect(mouse.core.pose.dragging).toBe(false)
    mouse.pointer.move(102)
    expect(mouse.core.pose.dragging).toBe(true)
  })

  it('先往横里挪的不是拖抽屉：之后再竖着挪也不跟，松开后的 click 也不算点按', () => {
    const { core, pointer, said } = setup({ pointerType: 'touch' })
    pointer.down(100)
    pointer.move(104, 16, { x: 230 })
    pointer.move(300, 16, { x: 230 })
    expect(core.pose).toEqual({ dragging: false, end: 0 })
    pointer.up(300)
    pointer.click()
    expect(said).toEqual([])
  })

  it('第二根手指、鼠标右键按下都不开始拖', () => {
    const { core, grip, said } = setup()
    const at = (y: number, extra: Partial<PointerSample>): PointerSample => ({ pointerId: 2, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, x: 0, y, time: 0, ...extra })
    grip.press(at(100, { isPrimary: false }))
    grip.move(at(400, { isPrimary: false }))
    expect(core.pose.dragging).toBe(false)
    grip.press(at(100, { pointerId: 3, pointerType: 'mouse', button: 2, buttons: 2 }))
    grip.move(at(400, { pointerId: 3, pointerType: 'mouse', button: -1, buttons: 2 }))
    expect(core.pose.dragging).toBe(false)
    expect(said).toEqual([])
  })
})

describe('按住断了、拖着时浅路由变了', () => {
  it('拖着时移动发现主键已经松开（松开没传到页面），或者又按下了右键：作废，回到原处，之后的移动、松开都不管，跟着的 click 不算点按', () => {
    for (const buttons of [0, 3]) {
      const { core, pointer, said } = setup()
      pointer.down(100)
      pointer.move(300)
      pointer.move(320, 16, { buttons })
      expect(core.pose).toEqual({ dragging: false, end: 0 })
      pointer.move(600)
      pointer.up(600)
      expect(core.pose).toEqual({ dragging: false, end: 0 })
      pointer.click()
      expect(said).toEqual([])
    }
  })

  it('拖着时被叫停（右键菜单、切走窗口、pointercancel 这类）：回到浅路由说的那一头，不改浅路由', () => {
    const { core, grip, pointer, said } = setup()
    pointer.down(0)
    pointer.move(700)
    grip.abandon()
    expect(core.pose).toEqual({ dragging: false, end: 0 })
    pointer.up(700)
    pointer.click()
    expect(said).toEqual([])
  })

  it('拖着时浅路由关了（按了 Esc、返回）：先接着跟手，松手时没拖够也收起，也不再改一次浅路由', () => {
    const short = setup()
    short.pointer.down(0)
    short.pointer.move(100, 100)
    short.core.settle(false)
    expect(short.core.pose).toEqual({ dragging: true, position: 0.125 })
    short.pointer.up(100, 500)
    expect(short.core.pose).toEqual({ dragging: false, end: 1 })
    expect(short.said).toEqual([])

    const far = setup()
    far.pointer.down(0)
    far.pointer.move(400, 100)
    far.core.settle(false)
    far.pointer.up(400, 100)
    expect(far.core.pose).toEqual({ dragging: false, end: 1 })
    expect(far.said).toEqual([])
  })

  it('上一次拖着没等到松开就又按下了：先作废上一次，抽屉回原处；新的这次照常是点按', () => {
    const { core, pointer, said } = setup()
    pointer.down(0)
    pointer.move(300)
    pointer.down(500)
    expect(core.pose).toEqual({ dragging: false, end: 0 })
    pointer.up(500)
    pointer.click()
    expect(said).toEqual(['tap'])
  })
})

describe('点按', () => {
  it('拖过之后跟着的那次 click 不算点按，但键盘按出来的 click（Enter、空格）一定算', () => {
    const { pointer, said } = setup()
    pointer.down(0)
    pointer.move(100, 100)
    pointer.up(100, 500)
    pointer.click(0)
    expect(said).toEqual(['tap'])
  })

  it('拖过或作废之后，重新按一下、没拖就松开：照样是点按', () => {
    const { grip, pointer, said } = setup()
    pointer.down(0)
    pointer.move(100, 100)
    pointer.up(100, 500)
    pointer.down(0)
    pointer.move(50, 100)
    grip.abandon()

    pointer.down(0)
    pointer.up(0)
    pointer.click()
    expect(said).toEqual(['tap'])
  })

  it('按住没挪开就被叫停（例如按着左键又点了右键）：松开后的 click 不算点按', () => {
    const { grip, pointer, said } = setup()
    pointer.down(0)
    grip.abandon()
    pointer.up(0)
    pointer.click()
    expect(said).toEqual([])
  })
})

describe('动画中抓住', () => {
  it('正在缩回时从播放条抓住：从它现在画到的地方接着拖，往上拉过 1/4 就重新拉开', () => {
    const { core, pointer, said, setDrawn } = setup({ from: 'closed', size: 800, open: true })
    core.settle(false)
    setDrawn(0.5)
    pointer.down(700)
    pointer.move(620, 100)
    expect(core.pose).toEqual({ dragging: true, position: 0.4 })
    pointer.move(500, 100)
    pointer.up(500, 100)
    expect(core.pose).toEqual({ dragging: false, end: 0 })
    expect(said).toEqual(['commit'])
  })

  it('按下之后、挪够起拖距离之前动画还在走：从开始拖的那一刻画到的地方接着拖，不跳回按下时的位置', () => {
    const { core, pointer, setDrawn } = setup({ size: 800 })
    core.settle(false)
    setDrawn(0.3)
    pointer.down(100)
    setDrawn(0.35)
    pointer.move(101)
    setDrawn(0.4)
    pointer.move(180)
    expect(core.pose).toEqual({ dragging: true, position: 0.5 })
  })
})

describe('按住结束了没有', () => {
  it('按住期间别的指针（第二根手指）松开、被取消：这次按住照常进行；按住真正结束（松开、作废、按住断了、往横里挪开）时 holding 变成 false', () => {
    const { core, grip, pointer } = setup()
    const other = { pointerId: 9, pointerType: 'touch', isPrimary: false, button: 0, buttons: 0, x: 0, y: 0, time: 0 }
    expect(grip.holding).toBe(false)
    pointer.down(0)
    expect(grip.holding).toBe(true)
    pointer.move(100)
    grip.release(other)
    grip.abandon(other.pointerId)
    expect(grip.holding).toBe(true)
    pointer.move(150)
    expect(core.pose).toEqual({ dragging: true, position: 0.1875 })
    grip.abandon(1)
    expect(grip.holding).toBe(false)
    expect(core.pose).toEqual({ dragging: false, end: 0 })

    pointer.down(0)
    pointer.up(0)
    expect(grip.holding).toBe(false)

    pointer.down(0)
    pointer.move(100)
    pointer.move(120, 16, { buttons: 0 })
    expect(grip.holding).toBe(false)

    pointer.down(0)
    pointer.move(4, 16, { x: 260 })
    expect(grip.holding).toBe(false)

    pointer.down(0)
    grip.abandon()
    expect(grip.holding).toBe(false)
  })
})
