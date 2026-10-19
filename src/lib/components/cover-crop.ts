import type { CoverCrop } from '#lib/api/cover.js'

// 封面取景框的几何（#34）：crop 是工作位图上的正方形，单位是那张位图的像素。
// 取景框只管位置和大小；导出、缩放由浏览器能力做（src/lib/app/browser.ts）

/** 居中取最大的正方形（打开裁剪页时的起点） */
export function centerCrop(width: number, height: number): CoverCrop {
  const size = Math.min(width, height)
  return { x: (width - size) / 2, y: (height - size) / 2, size }
}
