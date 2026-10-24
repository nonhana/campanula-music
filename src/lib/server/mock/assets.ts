// mock 的外部资源本地化：封面、头像、播放地址、图片直传都指向开发服务器自己，不向网易云或其他外网发请求（#58 验收）。
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

const COVER_PREFIX = '/mock-assets/cover'
export const AUDIO_PREFIX = '/mock-assets/audio'
export const UPLOAD_PREFIX = '/mock-assets/uploads'
export const UPLOAD_PATH = '/api/mock/upload'

const EXTERNAL_HOST = /(?:^|\.)(?:music\.126\.net|127\.net|netease\.com|163\.com)$/i

const isExternal = (value: string): boolean => {
  if (!/^https?:\/\//i.test(value))
    return false
  try {
    return EXTERNAL_HOST.test(new URL(value).hostname)
  }
  catch {
    return false
  }
}

/** 封面、头像这类图片：同一条地址每次都给同一个本地图 */
const coverPath = (url: string): string => {
  const key = createHash('sha1').update(url).digest('hex').slice(0, 16)
  return `${COVER_PREFIX}/${key}.svg`
}

/** 把返回体里指向网易云的外网地址换成开发服务器的地址；只认已知域名，别的原样保留（真出现就是 mock 没本地化，测试会查） */
export const localize = <T>(value: T): T => walk(value) as T

const walk = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return isExternal(value)
      ? coverPath(value)
      : value
  }
  if (Array.isArray(value))
    return value.map(walk)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      walk(item),
    ]))
  }
  return value
}

const PALETTE = [
  ['#dcefe2', '#7fb89a'],
  ['#f5e6d3', '#d4a373'],
  ['#dfe7f5', '#8aa4c8'],
  ['#f2dde4', '#c48a9d'],
  ['#e8e2f2', '#9b8ac4'],
  ['#e3efe8', '#6fae93'],
] as const

/** 一张确定的本地封面：同一条地址每次颜色和图案一样，不带任何外网引用 */
export const coverSvg = (key: string): string => {
  const sum = [...key].reduce((total, char) => total + char.charCodeAt(0), 0)
  const [from, to] = PALETTE[sum % PALETTE.length]
  // 三套抽象图案，按地址的摘要选一套：比画一个音符更像一张封面，也不会出现奇怪的白色方块
  const art = [
    '<circle cx="150" cy="150" r="110" fill="#ffffff" fill-opacity="0.18"/><circle cx="270" cy="260" r="90" fill="#ffffff" fill-opacity="0.12"/>',
    '<path d="M-20 300 C80 200 160 220 240 300 S400 380 460 260" stroke="#ffffff" stroke-opacity="0.22" stroke-width="36" fill="none"/><circle cx="300" cy="110" r="70" fill="#ffffff" fill-opacity="0.12"/>',
    '<rect x="-40" y="120" width="480" height="60" fill="#ffffff" fill-opacity="0.14" transform="rotate(-18 200 200)"/><rect x="-40" y="230" width="480" height="30" fill="#ffffff" fill-opacity="0.10" transform="rotate(-18 200 200)"/>',
  ][sum % 3]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/>${art}</svg>`
}

const audioCache = new Map<number, Buffer>()

/** 一段 2 秒、440Hz 的本地 WAV：播放条、进度、自动下一首都能真的动起来，不依赖外网 */
export const audioWav = (songId: number): Buffer => {
  const cached = audioCache.get(songId)
  if (cached)
    return cached
  const sampleRate = 8000
  const seconds = 2
  const samples = sampleRate * seconds
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  const frequency = 440 + (songId % 7) * 30
  for (let index = 0; index < samples; index += 1) {
    const envelope = Math.min(1, index / 80) * Math.min(1, (samples - index) / 80)
    buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * index / sampleRate) * 0.18 * envelope * 32767), 44 + index * 2)
  }
  audioCache.set(songId, buffer)
  return buffer
}

/** 浏览器直传的封面，按 imgId 存在内存里；mock 重启就没了，和整份状态一样 */
const uploads = new Map<string, { type: string, bytes: Buffer }>()

export const saveUpload = (imgId: string, type: string, bytes: Buffer): void => {
  uploads.set(imgId, { type, bytes })
}

export const uploadOf = (imgId: string): { type: string, bytes: Buffer } | undefined => uploads.get(imgId)

export const clearUploads = (): void => {
  uploads.clear()
}
