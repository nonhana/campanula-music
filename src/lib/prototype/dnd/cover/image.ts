// PROTOTYPE：封面图片的读取、检查、裁剪、导出 JPEG。全部在浏览器里做，不经过服务器（ADR-0004）。
// 原型先固定的数值（网易云的真实上限没有核实，写进结论交给验证关卡）：
//   - 选图上限 20 MB；超过就不读，提示换一张。
//   - 导出 800×800 的 JPEG，质量 0.88；导出后超过 1 MB 就降质量重压（最低 0.6）。
//   - 短边小于 300px 的图片照样能用，但提示“可能会糊”。

export const MAX_INPUT_BYTES = 20 * 1024 * 1024
export const OUTPUT_SIZE = 800
export const OUTPUT_MAX_BYTES = 1024 * 1024
export const MIN_SIDE = 300

/** 原型面板里的测试文件 */
export type TestFileKind = 'landscape' | 'portrait' | 'huge' | 'too-big' | 'text' | 'heic' | 'tiny'

export type CoverError =
  | { kind: 'not-image', name: string }
  | { kind: 'too-big', name: string, bytes: number }
  | { kind: 'heic', name: string }
  | { kind: 'decode', name: string }

export interface Picked {
  file: File
  /** 工作用的位图：按 EXIF 摆正，长边最多 3200px（裁剪、导出都用它） */
  bitmap: ImageBitmap
  /** 工作位图的预览图地址（长边最多 1600px） */
  url: string
  width: number
  height: number
  origWidth: number
  origHeight: number
  small: boolean
  /** 读取 + 解码用了多久 */
  ms: number
}

const WORK_MAX = 3200
const PREVIEW_MAX = 1600

/** 正方形取景框在原图上的位置（原图像素） */
export interface Crop {
  x: number
  y: number
  size: number
}

const HEIC = /\.(?:heic|heif)$/i

function looksHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || HEIC.test(file.name)
}

/** 检查并解码选中的文件；不能用时返回原因 */
export async function readImage(file: File): Promise<{ ok: true, picked: Picked } | { ok: false, error: CoverError }> {
  const name = file.name
  const heic = looksHeic(file)
  if (!heic && file.type && !file.type.startsWith('image/'))
    return { ok: false, error: { kind: 'not-image', name } }
  if (file.size > MAX_INPUT_BYTES)
    return { ok: false, error: { kind: 'too-big', name, bytes: file.size } }
  try {
    const t0 = performance.now()
    // imageOrientation: 'from-image' 让手机竖拍的照片按 EXIF 摆正
    let bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const origWidth = bitmap.width
    const origHeight = bitmap.height
    const max = Math.max(origWidth, origHeight)
    if (max > WORK_MAX) {
      const k = WORK_MAX / max
      const smaller = await createImageBitmap(bitmap, { resizeWidth: Math.round(origWidth * k), resizeHeight: Math.round(origHeight * k), resizeQuality: 'high' })
      bitmap.close()
      bitmap = smaller
    }
    const url = await previewUrl(bitmap)
    return {
      ok: true,
      picked: {
        file,
        bitmap,
        url,
        width: bitmap.width,
        height: bitmap.height,
        origWidth,
        origHeight,
        small: Math.min(origWidth, origHeight) < MIN_SIDE,
        ms: Math.round(performance.now() - t0),
      },
    }
  }
  catch {
    if (heic)
      return { ok: false, error: { kind: 'heic', name } }
    if (!file.type)
      return { ok: false, error: { kind: 'not-image', name } }
    return { ok: false, error: { kind: 'decode', name } }
  }
}

/** 预览图：长边最多 1600px 的 JPEG（超大照片直接塞进 <img> 会让手机卡一下） */
async function previewUrl(bitmap: ImageBitmap): Promise<string> {
  const k = Math.min(1, PREVIEW_MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * k)
  canvas.height = Math.round(bitmap.height * k)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await toBlob(canvas, 0.85)
  return URL.createObjectURL(blob)
}

/** 居中取最大的正方形（方案 B 的起点，也是其他方案的初始取景） */
export function centerCrop(w: number, h: number): Crop {
  const size = Math.min(w, h)
  return { x: (w - size) / 2, y: (h - size) / 2, size }
}

export function clampCrop(c: Crop, w: number, h: number): Crop {
  const size = Math.min(Math.max(c.size, Math.min(w, h) / 6), Math.min(w, h))
  return {
    size,
    x: Math.min(Math.max(c.x, 0), w - size),
    y: Math.min(Math.max(c.y, 0), h - size),
  }
}

/** 按取景框裁成 800×800，导出 JPEG；太大就降质量重压 */
export async function exportJpeg(bitmap: ImageBitmap, crop: Crop): Promise<{ blob: Blob, quality: number }> {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')!
  // JPEG 没有透明：先铺一层白，透明的 PNG 不会变成黑底
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  let quality = 0.88
  let blob = await toBlob(canvas, quality)
  while (blob.size > OUTPUT_MAX_BYTES && quality > 0.6) {
    quality = Math.round((quality - 0.08) * 100) / 100
    blob = await toBlob(canvas, quality)
  }
  return { blob, quality }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('导出失败'))), 'image/jpeg', quality))
}

export function errorText(e: CoverError): { title: string, body: string } {
  switch (e.kind) {
    case 'not-image':
      return { title: '这个文件不是图片', body: `「${e.name}」打不开。请选一张 JPG、PNG 或 WebP 图片。` }
    case 'too-big':
      return { title: '图片太大了', body: `「${e.name}」有 ${(e.bytes / 1024 / 1024).toFixed(1)} MB，超过了 20 MB。换一张小一点的，或者先截个图再选。` }
    case 'heic':
      return { title: '这张 HEIC 照片打不开', body: `浏览器不能读「${e.name}」这种格式。在相册里先把它存成 JPG，或者截个图再选。` }
    case 'decode':
      return { title: '这张图片读不出来', body: `「${e.name}」可能已经损坏。换一张试试。` }
  }
}
