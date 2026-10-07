// PROTOTYPE：原型面板里“用测试文件换封面”的假文件。全部在浏览器里现画，不放进仓库。
import type { TestFileKind } from './image'

/** 一块 256×256 的颗粒：铺满整张图，让导出的 JPEG 有真实照片的大小（纯渐变只有十几 KB，“上传很慢”就体会不到） */
let grain: HTMLCanvasElement | null = null
function grainTile(): HTMLCanvasElement {
  if (grain)
    return grain
  grain = document.createElement('canvas')
  grain.width = 256
  grain.height = 256
  const g = grain.getContext('2d')!
  const img = g.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 40
  }
  g.putImageData(img, 0, 0)
  return grain
}

function paint(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  // 一张有明显主体的图：浅色天空 + 一朵偏离中心的花，方便看出“居中裁剪”切掉了什么
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#cfe9ff')
  g.addColorStop(1, '#fff1e6')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // 颗粒按图的大小缩放：裁成 800×800 以后颗粒的粗细差不多
  const k = Math.max(1, Math.min(w, h) / 800)
  const pattern = ctx.createPattern(grainTile(), 'repeat')!
  pattern.setTransform(new DOMMatrix().scale(k, k))
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
  const s = Math.min(w, h)
  const cx = w * 0.72
  const cy = h * 0.4
  ctx.fillStyle = '#37be8c'
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    const a = (i * Math.PI) / 2 + Math.PI / 4
    ctx.ellipse(cx + Math.cos(a) * s * 0.09, cy + Math.sin(a) * s * 0.09, s * 0.1, s * 0.06, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#ffd3b6'
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgb(17 24 39 / 0.55)'
  ctx.font = `600 ${Math.round(s * 0.06)}px system-ui, sans-serif`
  ctx.fillText(`${w}×${h}`, s * 0.05, h - s * 0.06)
  return c
}

function canvasFile(c: HTMLCanvasElement, name: string, type: string, quality?: number): Promise<File> {
  return new Promise((resolve, reject) => c.toBlob((b) => {
    if (!b)
      return reject(new Error('生成失败'))
    resolve(new File([b], name, { type }))
  }, type, quality))
}

export async function makeTestFile(kind: TestFileKind): Promise<File> {
  switch (kind) {
    case 'landscape':
      return canvasFile(paint(1600, 900), '横图-1600x900.jpg', 'image/jpeg', 0.9)
    case 'portrait':
      return canvasFile(paint(900, 1600), '竖图-900x1600.jpg', 'image/jpeg', 0.9)
    case 'huge':
      return canvasFile(paint(8000, 6000), '超大-8000x6000.jpg', 'image/jpeg', 0.85)
    case 'tiny':
      return canvasFile(paint(200, 200), '很小-200x200.png', 'image/png')
    case 'too-big':
      // 只看大小，不必真的是 25 MB 的图片：浏览器在解码前就会被大小检查拦下
      return new File([new Uint8Array(25 * 1024 * 1024)], '相机原图-25MB.jpg', { type: 'image/jpeg' })
    case 'heic':
      // 真 HEIC 文件头（ftypheic），Chrome 解不开
      return new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99])], 'IMG_2026.HEIC', { type: 'image/heic' })
    case 'text':
      return new File(['这是一份歌单的说明，不是图片。'], '歌单说明.txt', { type: 'text/plain' })
  }
}
