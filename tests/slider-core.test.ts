import { describe, expect, it } from 'vitest'

import type { PointerSample } from '#lib/components/shared/press.js'
import { createSliderCore } from '#lib/components/shared/slider-core.js'

// 第二个测试接入点“拖动手势核心”的线性那一半（进度条、自绘滚动条）：只认主指针的主键，第二根手指不重新开始、松开不提交，按住断了作废；值始终夹在 0 到 1。

const setup = ({ beginValue = (sample: PointerSample) => sample.x / 100 }: { beginValue?: (sample: PointerSample) => number | null } = {}) => {
  const commits: number[] = []
  const values: (number | null)[] = []
  let cancels = 0
  const core = createSliderCore({
    begin: beginValue,
    track: sample => sample.x / 100,
    commit: value => commits.push(value),
    cancel: () => (cancels += 1),
    onValue: value => values.push(value),
  })
  let time = 0
  const sample = (x: number, buttons: number, extra: Partial<PointerSample> = {}): PointerSample => ({
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons,
    x,
    y: 0,
    time,
    ...extra,
  })
  const pointer = {
    down(x: number, extra?: Partial<PointerSample>) {
      return core.press(sample(x, 1, extra))
    },
    move(x: number, extra?: Partial<PointerSample>) {
      time += 16
      core.move(sample(x, 1, extra))
    },
    up(x: number, extra?: Partial<PointerSample>) {
      time += 16
      core.release(sample(x, 0, extra))
    },
    abandon(pointerId?: number) {
      core.abandon(pointerId)
    },
  }
  return {
    core,
    pointer,
    commits,
    values,
    cancels: () => cancels,
  }
}

describe('只认主指针的主键', () => {
  it('第二根手指不会重新开始，松开也不会提交；第一根手指松手才提交', () => {
    const { pointer, commits, values } = setup()
    expect(pointer.down(40)).toBe(true)
    expect(values).toEqual([0.4])

    expect(pointer.down(90, { pointerId: 2, isPrimary: false })).toBe(false)
    pointer.move(90, { pointerId: 2, isPrimary: false })
    pointer.up(90, { pointerId: 2, isPrimary: false })
    expect(values).toEqual([0.4])

    pointer.move(70)
    pointer.up(70)
    expect(values).toEqual([0.4, 0.7, null])
    expect(commits).toEqual([0.7])
  })

  it('右键按下、非主指针都不算', () => {
    const { pointer, values } = setup()
    expect(pointer.down(40, { button: 2 })).toBe(false)
    expect(pointer.down(40, { isPrimary: false })).toBe(false)
    expect(values).toEqual([])
  })

  it('上一次按住没收到松开就再按下：先作废旧的，再从新位置开始', () => {
    const { pointer, commits, values, cancels } = setup()
    pointer.down(40)
    pointer.down(70)
    expect(values).toEqual([0.4, null, 0.7])
    expect(cancels()).toBe(1)
    pointer.up(80)
    expect(commits).toEqual([0.7])
    expect(values.at(-1)).toBeNull()
  })

  it('按下时 begin 说不接（例如点在滑块前后的空白处）：不开始拖', () => {
    const { pointer, values, cancels } = setup({
      beginValue: () => null,
    })
    expect(pointer.down(40)).toBe(false)
    pointer.move(50)
    pointer.up(60)
    expect(values).toEqual([])
    expect(cancels()).toBe(0)
  })
})

describe('按住断了就作废', () => {
  it('右键菜单、切走窗口、指针被收回：作废，不提交', () => {
    const { pointer, commits, values, cancels } = setup()
    pointer.down(40)
    pointer.move(70)
    pointer.abandon()
    expect(values).toEqual([0.4, 0.7, null])
    expect(commits).toEqual([])
    expect(cancels()).toBe(1)
  })

  it('移动时发现主键已经松开：作废，不提交', () => {
    const { pointer, commits, cancels } = setup()
    pointer.down(40)
    pointer.move(60, { buttons: 0 })
    expect(commits).toEqual([])
    expect(cancels()).toBe(1)
  })

  it('别的指针被收回不影响这次按住', () => {
    const { pointer, commits } = setup()
    pointer.down(40)
    pointer.abandon(2)
    pointer.move(60)
    pointer.up(60)
    expect(commits).toEqual([0.6])
  })
})

describe('值', () => {
  it('夹在 0 到 1：拖出元素两头也不会超出去', () => {
    const { pointer, commits, values } = setup()
    pointer.down(-20)
    pointer.move(160)
    pointer.up(160)
    expect(values).toEqual([0, 1, null])
    expect(commits).toEqual([1])
  })
})
