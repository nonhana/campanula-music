import type { CoverCrop } from '#lib/api/cover.js'

import { clamp } from '../shared/clamp'

// 封面取景框的几何核心（#34；Spec #11 第二个测试接入点“拖动手势核心”）：不碰页面、不碰 Svelte 的纯逻辑。取景框是固定正方形，图片在它下面平移、缩放。
// 输入是工作位图的宽高、框的边长和一次手势（平移多少、缩放到几倍、以框里哪点为中心、滚轮 / 方向键），输出总是夹紧过的视图和裁剪（crop 是工作位图上的正方形，单位是那张位图的像素）。
// 规则照原来的 CoverCropper：短边正好铺满框，最多放大到 6 倍（原图短边不到 160px 时不再放大），图片不能被拖出框外；以焦点缩放时焦点下面那一块保持不动。

export interface CropFrame {
  /** 工作位图的宽、高（px） */
  width: number
  height: number
  /** 取景框边长（CSS px） */
  size: number
}

/** 图片在框里的位置：zoom 是相对“短边铺满”的倍数，x / y 是左上角相对框的位移（px） */
export interface CropView {
  zoom: number
  x: number
  y: number
}

/** 框里的一点（CSS px，左上角起算） */
export interface CropPoint { x: number, y: number }

/** 最多放大到 6 倍；原图本来就小（短边不到 160px 的 6 倍）时不再放大 */
export const maxZoomOf = ({ width, height }: CropFrame): number => Math.max(1, Math.min(6, Math.min(width, height) / 160))

const baseScaleOf = ({ width, height, size }: CropFrame): number => size / Math.min(width, height)

/** 居中取最大的正方形（打开裁剪页时的起点） */
export const centerCrop = (width: number, height: number): CoverCrop => {
  const size = Math.min(width, height)
  return { x: (width - size) / 2, y: (height - size) / 2, size }
}

/** 从工作位图上的 crop 摆出视图（打开时、外面换了 crop 时） */
export const createCropView = (frame: CropFrame, crop: CoverCrop): CropView => {
  const base = baseScaleOf(frame)
  const zoom = clamp(crop.size > 0
    ? frame.size / crop.size / base
    : 1, 1, maxZoomOf(frame))
  return clamped(frame, { zoom, x: -crop.x * base * zoom, y: -crop.y * base * zoom })
}

export const cropOf = (frame: CropFrame, view: CropView): CoverCrop => {
  const scale = baseScaleOf(frame) * view.zoom
  return {
    x: clean(-view.x / scale),
    y: clean(-view.y / scale),
    size: frame.size / scale,
  }
}

/** 图片跟着手指走 dx / dy（px）；拖出框就停在边上 */
export const panCrop = (frame: CropFrame, view: CropView, dx: number, dy: number): CropView => clamped(frame, { ...view, x: view.x + dx, y: view.y + dy })

/** 缩放到 zoom 倍，以框里的 at 为中心（默认框的中心：滑块、+ / - 键） */
export const zoomTo = (frame: CropFrame, view: CropView, zoom: number, at: CropPoint = centerOf(frame)): CropView => {
  const next = clamp(zoom, 1, maxZoomOf(frame))
  if (next === view.zoom)
    return view
  const base = baseScaleOf(frame)
  const before = base * view.zoom
  const after = base * next
  // 焦点下面那一块保持不动：x' = at - (at - x) * after / before
  return clamped(frame, {
    zoom: next,
    x: at.x - ((at.x - view.x) * after) / before,
    y: at.y - ((at.y - view.y) * after) / before,
  })
}

/** 放大 / 缩小 factor 倍（+ / - 键、缩放按钮） */
export const zoomBy = (frame: CropFrame, view: CropView, factor: number, at: CropPoint = centerOf(frame)): CropView => zoomTo(frame, view, view.zoom * factor, at)

/** 滚轮：往上滚（deltaY 负）放大；以指针所在的点为焦点 */
export const wheelCrop = (frame: CropFrame, view: CropView, deltaY: number, at: CropPoint): CropView => zoomTo(frame, view, view.zoom * Math.exp(-deltaY / 400), at)

/** 方向键平移、+ / - 缩放；不认识的键返回 null */
export const nudgeCrop = (frame: CropFrame, view: CropView, key: string, shift: boolean): CropView | null => {
  const step = shift ? 40 : 10
  switch (key) {
    case 'ArrowLeft': return panCrop(frame, view, step, 0)
    case 'ArrowRight': return panCrop(frame, view, -step, 0)
    case 'ArrowUp': return panCrop(frame, view, 0, step)
    case 'ArrowDown': return panCrop(frame, view, 0, -step)
    case '+':
    case '=': return zoomBy(frame, view, 1.15)
    case '-': return zoomBy(frame, view, 1 / 1.15)
    default: return null
  }
}

/**
 * 两指捏合：每次移动都用**当前**视图 `view`，缩放到「起始缩放 startZoom × distance / startDistance」，锚点是两根手指**当前**的中点 `at`（和基线的增量 zoomAt 等价：两指同距平移时缩放不变、图片不平移）。中点移动同时距离变化时，先缩放到目标、再以新中点夹紧，图片会跟手一点（不是双指平移）。
 */
export const pinchCrop = (frame: CropFrame, view: CropView, startZoom: number, startDistance: number, distance: number, at: CropPoint): CropView => {
  if (startDistance <= 0)
    return view
  return zoomTo(frame, view, startZoom * (distance / startDistance), at)
}

const centerOf = (frame: CropFrame): CropPoint => ({ x: frame.size / 2, y: frame.size / 2 })

/** 夹紧：缩放有上下限，图片不能离开框（两边最多贴到框边） */
const clamped = (frame: CropFrame, view: CropView): CropView => {
  const zoom = clamp(view.zoom, 1, maxZoomOf(frame))
  const scale = baseScaleOf(frame) * zoom
  return {
    zoom,
    x: Math.min(0, Math.max(frame.size - frame.width * scale, view.x)),
    y: Math.min(0, Math.max(frame.size - frame.height * scale, view.y)),
  }
}

const clean = (value: number): number => value === 0
  ? 0
  : value
