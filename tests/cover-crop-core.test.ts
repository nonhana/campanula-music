import { describe, expect, it } from 'vitest'

import type { CropFrame } from '#lib/components/playlist/cover-crop-core.js'
import { centerCrop, createCropView, cropOf, maxZoomOf, nudgeCrop, panCrop, pinchCrop, wheelCrop, zoomBy, zoomTo } from '#lib/components/playlist/cover-crop-core.js'

// 第二个测试接入点“拖动手势核心”的取景框那一半（#34 / #65）：不碰页面、不碰 Svelte。
// 输入是图片尺寸、框的边长和一次手势，输出总是夹紧过的视图和裁剪；断言听众看到的结果：
// 图片拖不出框、以焦点缩放时焦点下面那一块不动、裁剪和视图来回一致、缩放有上下限。

const frame: CropFrame = { width: 1000, height: 500, size: 300 }

describe('起点和来回换算', () => {
  it('居中取最大的正方形；摆成视图再算回来还是同一块', () => {
    const crop = centerCrop(1000, 500)
    expect(crop).toEqual({ x: 250, y: 0, size: 500 })

    const view = createCropView(frame, crop)
    expect(view).toEqual({ zoom: 1, x: -150, y: 0 })
    expect(cropOf(frame, view)).toEqual(crop)
  })

  it('放大后的视图和裁剪互相一致', () => {
    const view = zoomTo(frame, createCropView(frame, centerCrop(1000, 500)), 2, { x: 80, y: 220 })
    const crop = cropOf(frame, view)
    const again = createCropView(frame, crop)
    expect(again.zoom).toBeCloseTo(view.zoom)
    expect(again.x).toBeCloseTo(view.x)
    expect(again.y).toBeCloseTo(view.y)
  })
})

describe('平移被夹紧', () => {
  it('图片不能被拖出框：往右、往上最多贴边，往左、往下最多露出最后一块', () => {
    const start = createCropView(frame, centerCrop(1000, 500))
    expect(panCrop(frame, start, 50, 0).x).toBe(-100)
    expect(panCrop(frame, start, 0, 50).y).toBe(0)
    expect(panCrop(frame, start, -5000, 0).x).toBe(-300)
    expect(panCrop(frame, start, 0, -5000).y).toBe(0)

    const zoomed = zoomTo(frame, start, 2)
    expect(panCrop(frame, zoomed, 0, -5000).y).toBe(300 - 500 * 0.6 * 2)
  })
})

describe('按焦点缩放', () => {
  it('焦点下面的那一块保持不动', () => {
    const start = createCropView(frame, centerCrop(1000, 500))
    const at = { x: 70, y: 210 }
    const scale = 0.6 * start.zoom
    const before = { x: (at.x - start.x) / scale, y: (at.y - start.y) / scale }

    const next = zoomTo(frame, start, 2, at)
    const after = { x: (at.x - next.x) / (0.6 * next.zoom), y: (at.y - next.y) / (0.6 * next.zoom) }
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('缩放有上下限：最大 6 倍（原图小时更少），最小 1 倍', () => {
    expect(maxZoomOf(frame)).toBe(3.125)
    expect(maxZoomOf({ width: 100, height: 100, size: 300 })).toBe(1)
    expect(maxZoomOf({ width: 2000, height: 2000, size: 300 })).toBe(6)
    const start = createCropView(frame, centerCrop(1000, 500))
    expect(zoomTo(frame, start, 99).zoom).toBe(3.125)
    expect(zoomTo(frame, start, 0.1).zoom).toBe(1)
    expect(zoomBy(frame, start, 0.5).zoom).toBe(1)
    expect(zoomTo({ width: 2000, height: 2000, size: 300 }, createCropView({ width: 2000, height: 2000, size: 300 }, centerCrop(2000, 2000)), 99).zoom).toBe(6)
  })

  it('滚轮往上放大、以指针为焦点；往下缩小', () => {
    const start = createCropView(frame, centerCrop(1000, 500))
    const at = { x: 40, y: 250 }
    const up = wheelCrop(frame, start, -100, at)
    expect(up.zoom).toBeGreaterThan(1)
    // 指针下面那一块不动
    const before = { x: (at.x - start.x) / (0.6 * start.zoom), y: (at.y - start.y) / (0.6 * start.zoom) }
    const after = { x: (at.x - up.x) / (0.6 * up.zoom), y: (at.y - up.y) / (0.6 * up.zoom) }
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(wheelCrop(frame, zoomTo(frame, start, 2), 100, at).zoom).toBeLessThan(2)
  })
})

describe('方向键和两指', () => {
  it('方向键平移，+ / - 缩放；不认识的键不算', () => {
    const start = createCropView(frame, centerCrop(1000, 500))
    expect(nudgeCrop(frame, start, 'ArrowLeft', false)?.x).toBe(-140)
    expect(nudgeCrop(frame, start, 'ArrowRight', true)?.x).toBe(-190)
    expect(nudgeCrop(frame, start, 'ArrowDown', false)?.y).toBe(0)
    expect(nudgeCrop(frame, start, '+', false)?.zoom).toBeGreaterThan(1)
    expect(nudgeCrop(frame, start, 'Enter', false)).toBeNull()
  })

  it('两指捏合：以当前中点为焦点，距离变成两倍就放大到两倍', () => {
    const start = createCropView(frame, centerCrop(1000, 500))
    const at = { x: 150, y: 150 }
    const next = pinchCrop(frame, start, start.zoom, 100, 200, at)
    expect(next.zoom).toBe(2)
    // 中点下面的那一块不动
    const scale = 0.6 * start.zoom
    expect((at.x - next.x) / (0.6 * next.zoom)).toBeCloseTo((at.x - start.x) / scale)
  })

  it('两指同距平移：缩放不变、图片不跟着中点走（和基线的增量 zoomAt 一致）', () => {
    const start = createCropView(frame, centerCrop(1000, 500))
    const next = pinchCrop(frame, start, start.zoom, 120, 120, { x: 220, y: 80 })
    expect(next).toEqual(start)
  })

  it('捏合时中点移动、距离也变：内容锚在当前中点（没有夹紧时）', () => {
    const start = createCropView(frame, centerCrop(1000, 500))
    const at = { x: 180, y: 220 }
    const next = pinchCrop(frame, start, start.zoom, 100, 120, at)
    expect(next.zoom).toBeCloseTo(1.2)
    const before = { x: (at.x - start.x) / (0.6 * start.zoom), y: (at.y - start.y) / (0.6 * start.zoom) }
    expect((at.x - next.x) / (0.6 * next.zoom)).toBeCloseTo(before.x)
    expect((at.y - next.y) / (0.6 * next.zoom)).toBeCloseTo(before.y)
  })

  it('贴着边界缩放再平移，来回换算仍然一致', () => {
    const zoomed = zoomTo(frame, createCropView(frame, centerCrop(1000, 500)), 2)
    const edge = panCrop(frame, zoomed, -9999, -9999)
    expect(cropOf(frame, edge)).toEqual(cropOf(frame, createCropView(frame, cropOf(frame, edge))))
  })
})
