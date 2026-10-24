import type { WheelDirection, WheelPose } from '#lib/components/player/wheel-core.js'
import type { PointerSample } from '#lib/components/shared/press.js'
import { describe, expect, it } from 'vitest'
import { createWheelCore } from '#lib/components/player/wheel-core.js'

// 第二个测试接入点“拖动手势核心”（Spec #11 Testing Decisions）的转盘那一半：手机播放页左右拖封面切歌（DESIGN.md Cover Wheel）。
// 喂按下、移动、松开、点击、按住断了，看转盘跟手转了几格、松手切不切歌、往哪切、算不算点按。
// 往右拖 x 变大，转盘顺时针转（转了正的格数），松手切到上一首；往左拖切到下一首

interface Setup {
  /** 手指横着挪多少 px 转盘转一格 */
  notch?: number
  /** 两边有没有别的歌可换（播放队列里只有一首时都没有） */
  others?: boolean
  pointerType?: string
}

function setup({ notch = 200, others = true, pointerType = 'touch' }: Setup = {}) {
  const said: string[] = []
  const core = createWheelCore({
    notch: () => notch,
    has: () => others,
    commit: (direction: WheelDirection) => said.push(direction),
    tap: () => said.push('tap'),
    onPose: (_pose: WheelPose) => {},
  })

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
  /** 一根指针：每个动作之后时间往前走 ms */
  const pointer = {
    down(x: number, y = 300, extra?: Partial<PointerSample>) {
      core.press(sample(x, y, 1, extra))
    },
    move(x: number, ms = 16, y = 300, extra?: Partial<PointerSample>) {
      time += ms
      core.move(sample(x, y, 1, extra))
    },
    up(x: number, ms = 16, y = 300) {
      time += ms
      core.release(sample(x, y, 0))
    },
    /** 松开之后浏览器跟着发的 click（手指、鼠标的 detail 是 1） */
    click(detail = 1) {
      core.click(detail)
    },
  }
  return { core, pointer, said }
}

describe('跟手和点按', () => {
  it('横着拖时转盘跟着转：转了几格是从按下的地方拖过的距离占一格的比例；横着没挪够 6px 就松开的是点按', () => {
    const { core, pointer, said } = setup({ notch: 200 })

    pointer.down(100)
    pointer.move(105)
    expect(core.pose).toEqual({ dragging: false })
    pointer.up(105)
    pointer.click()
    expect(said).toEqual(['tap'])

    said.length = 0
    pointer.down(100)
    pointer.move(106)
    expect(core.pose).toEqual({ dragging: true, turned: 0.03 })
    pointer.move(50)
    expect(core.pose).toEqual({ dragging: true, turned: -0.25 })
    pointer.move(140)
    expect(core.pose).toEqual({ dragging: true, turned: 0.2 })
    pointer.up(100, 400)
    pointer.click()
    expect(said).toEqual([])
    expect(core.pose).toEqual({ dragging: false })
  })
})

describe('松手时切不切歌', () => {
  it('慢慢往左拖过一格的 1/4 切到下一首、往右切到上一首；差一点没到就转回原位，不切歌', () => {
    const short = setup({ notch: 200 })
    short.pointer.down(300)
    for (let x = 290; x >= 251; x -= 1)
      short.pointer.move(x, 100)
    short.pointer.up(251, 100)
    expect(short.core.pose).toEqual({ dragging: false })
    expect(short.said).toEqual([])

    const left = setup({ notch: 200 })
    left.pointer.down(300)
    for (let x = 290; x >= 250; x -= 10)
      left.pointer.move(x, 100)
    left.pointer.up(250, 100)
    expect(left.core.pose).toEqual({ dragging: false })
    expect(left.said).toEqual(['next'])

    const right = setup({ notch: 200 })
    right.pointer.down(300)
    for (let x = 310; x <= 350; x += 10)
      right.pointer.move(x, 100)
    right.pointer.up(350, 100)
    expect(right.said).toEqual(['previous'])
  })

  it('拖过去又拖回来：按松手时在按下的哪一边、离多远算', () => {
    const { pointer, said } = setup({ notch: 200 })
    pointer.down(300)
    pointer.move(150, 200)
    pointer.move(360, 200)
    pointer.up(360, 200)
    expect(said).toEqual(['previous'])
  })

  it('一甩：整段拖动的速度超过每秒 1000px，拖得再短也切歌；刚好每秒 1000px 不算', () => {
    const fast = setup({ notch: 200 })
    fast.pointer.down(300)
    fast.pointer.move(290, 10)
    fast.pointer.up(270, 10)
    expect(fast.said).toEqual(['next'])

    const exact = setup({ notch: 200 })
    exact.pointer.down(300)
    exact.pointer.move(290, 20)
    exact.pointer.up(260, 20)
    expect(exact.said).toEqual([])
    expect(exact.core.pose).toEqual({ dragging: false })
  })

  it('播放队列里只有一首：照样拖得动，但拖过 1/4、一甩松手都转回原位，不切歌', () => {
    const { core, pointer, said } = setup({ notch: 200, others: false })
    pointer.down(300)
    pointer.move(200, 100)
    expect(core.pose).toEqual({ dragging: true, turned: -0.5 })
    pointer.up(200, 100)
    expect(core.pose).toEqual({ dragging: false })

    pointer.down(300)
    pointer.move(280, 10)
    pointer.up(250, 10)
    expect(said).toEqual([])
  })
})

describe('哪些按下才算开始拖', () => {
  it('先竖着挪过 6px 的不接管：之后再横着挪也不跟，松开后的 click 也不算点按；斜着挪、竖的不比横的少也一样', () => {
    const vertical = setup()
    vertical.pointer.down(300, 300)
    vertical.pointer.move(302, 16, 306)
    vertical.pointer.move(150, 16, 306)
    expect(vertical.core.pose).toEqual({ dragging: false })
    vertical.pointer.up(150, 16, 306)
    vertical.pointer.click()
    expect(vertical.said).toEqual([])

    const diagonal = setup()
    diagonal.pointer.down(300, 300)
    diagonal.pointer.move(294, 16, 294)
    expect(diagonal.core.pose).toEqual({ dragging: false })
    diagonal.pointer.move(150, 16, 294)
    expect(diagonal.core.pose).toEqual({ dragging: false })
  })

  it('第二根手指、鼠标右键按下都不开始拖', () => {
    const { core, said } = setup()
    const at = (x: number, extra: Partial<PointerSample>): PointerSample => ({ pointerId: 2, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, x, y: 300, time: 0, ...extra })
    core.press(at(300, { isPrimary: false }))
    core.move(at(100, { isPrimary: false }))
    expect(core.pose).toEqual({ dragging: false })
    core.press(at(300, { pointerId: 3, pointerType: 'mouse', button: 2, buttons: 2 }))
    core.move(at(100, { pointerId: 3, pointerType: 'mouse', button: -1, buttons: 2 }))
    expect(core.pose).toEqual({ dragging: false })
    expect(said).toEqual([])
  })
})

describe('按住断了', () => {
  it('拖着时移动发现主键已经松开（松开没传到页面），或者又按下了右键：作废、转回原位，之后的移动、松开都不管，跟着的 click 不算点按', () => {
    for (const buttons of [0, 3]) {
      const { core, pointer, said } = setup()
      pointer.down(300)
      pointer.move(200)
      pointer.move(190, 16, 300, { buttons })
      expect(core.pose).toEqual({ dragging: false })
      pointer.move(50)
      pointer.up(50)
      expect(core.pose).toEqual({ dragging: false })
      pointer.click()
      expect(said).toEqual([])
    }
  })

  it('拖着时被叫停（右键菜单、切走窗口、页面藏起来）：转回原位，不切歌；pointercancel 只叫停那根指针（系统的返回手势从屏幕边上接走手指也是这样）', () => {
    const { core, pointer, said } = setup()
    pointer.down(300)
    pointer.move(100)
    core.abandon(2)
    expect(core.pose).toEqual({ dragging: true, turned: -1 })
    core.abandon(1)
    expect(core.pose).toEqual({ dragging: false })
    pointer.up(100)
    pointer.click()

    pointer.down(300)
    pointer.move(100)
    core.abandon()
    expect(core.pose).toEqual({ dragging: false })
    pointer.up(100)
    pointer.click()
    expect(said).toEqual([])
  })

  it('上一次拖着没等到松开就又按下了：先作废上一次、转回原位；新的这次照常是点按', () => {
    const { core, pointer, said } = setup()
    pointer.down(300)
    pointer.move(100)
    pointer.down(200)
    expect(core.pose).toEqual({ dragging: false })
    pointer.up(200)
    pointer.click()
    expect(said).toEqual(['tap'])
  })
})

describe('点按', () => {
  it('拖过之后跟着的那次 click 不算点按，但键盘按出来的 click（Enter、空格）一定算', () => {
    const { pointer, said } = setup()
    pointer.down(300)
    pointer.move(280, 100)
    pointer.up(280, 500)
    pointer.click(0)
    expect(said).toEqual(['tap'])
  })
})
