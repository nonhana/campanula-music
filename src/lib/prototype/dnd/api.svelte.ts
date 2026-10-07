// PROTOTYPE：假的网易云接口。只记日志、等一会儿、按原型面板的设置成功或失败；不发任何网络请求。
// 接口名和参数照 hana-music-api：song_order_update / playlist_tracks / playlist_order_update，
// 封面三步：nos_token_alloc（服务器）→ 浏览器直传 nosup-hz1.127.net → playlist_cover_update（服务器）。
import { settings, uploadBytesPerSecond } from './settings.svelte'

export interface ApiCall {
  id: number
  at: number
  name: string
  detail: string
  /** 请求体大约多大（字节） */
  bytes: number
  status: 'pending' | 'ok' | 'fail' | 'aborted'
  ms?: number
}

export const api = $state({ log: [] as ApiCall[], count: 0 })

let seq = 0

/** 网易云的歌曲编号是 10 位左右的数字，JSON 里每个大约 11 字节 */
export function idsBytes(n: number): number {
  return n * 11 + 32
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('取消', 'AbortError'))
    }, { once: true })
  })
}

function begin(name: string, detail: string, bytes: number): ApiCall {
  const call: ApiCall = { id: ++seq, at: Date.now(), name, detail, bytes, status: 'pending' }
  api.log = [call, ...api.log].slice(0, 40)
  api.count++
  return api.log[0]
}

function end(call: ApiCall, status: ApiCall['status']) {
  call.status = status
  call.ms = Date.now() - call.at
}

async function request(name: string, detail: string, bytes: number, fail: boolean, signal?: AbortSignal): Promise<void> {
  const call = begin(name, detail, bytes)
  try {
    await wait(settings.latency, signal)
  }
  catch (e) {
    end(call, 'aborted')
    throw e
  }
  if (fail) {
    end(call, 'fail')
    throw new Error('网络不太稳定')
  }
  end(call, 'ok')
}

export const netease = {
  /** 一次提交整张歌单全部歌曲的新顺序 */
  songOrderUpdate(pid: string, trackIds: string[]) {
    return request('song_order_update', `pid=${pid} · trackIds × ${trackIds.length.toLocaleString('en-US')}`, idsBytes(trackIds.length), settings.commitOutcome === 'fail')
  },
  /** 批量加歌、删歌：一次带多首歌的编号 */
  playlistTracks(op: 'add' | 'del', pid: string, ids: string[]) {
    return request('playlist_tracks', `op=${op} · pid=${pid} · ${ids.length} 首`, idsBytes(ids.length), settings.commitOutcome === 'fail')
  },
  /** 红心：原型里当一次请求；批量红心能不能一次提交，交给验证关卡 */
  like(ids: string[]) {
    return request('like（批量）', `${ids.length} 首`, idsBytes(ids.length), settings.commitOutcome === 'fail')
  },
  /** 自建歌单之间的排序：一次提交全部自建歌单的编号 */
  playlistOrderUpdate(ids: string[]) {
    return request('playlist_order_update', `ids × ${ids.length}`, idsBytes(ids.length), settings.commitOutcome === 'fail')
  },
  /** 封面第 1 步：服务器向网易云申请上传凭证（ext 写死 jpg） */
  nosTokenAlloc(signal?: AbortSignal) {
    return request('nos_token_alloc（服务器）', 'ext=jpg', 64, settings.uploadOutcome === 'fail-alloc', signal)
  },
  /** 封面第 2 步：浏览器把 JPEG 直传网易云图片存储，按设置的网速报进度 */
  async nosUpload(bytes: number, onProgress: (ratio: number) => void, signal?: AbortSignal) {
    const call = begin('POST nosup-hz1.127.net（浏览器直传）', 'Content-Type: image/jpeg', bytes)
    const speed = uploadBytesPerSecond[settings.uploadSpeed]
    const total = Math.max(250, (bytes / speed) * 1000)
    const started = performance.now()
    try {
      while (true) {
        await wait(50, signal)
        const ratio = Math.min(1, (performance.now() - started) / total)
        onProgress(ratio)
        if (settings.uploadOutcome === 'fail-upload' && ratio > 0.6) {
          end(call, 'fail')
          throw new Error('上传中断了')
        }
        if (ratio >= 1)
          break
      }
    }
    catch (e) {
      if ((e as Error).name === 'AbortError')
        end(call, 'aborted')
      throw e
    }
    end(call, 'ok')
  },
  /** 封面第 3 步：服务器把上传好的图片设为歌单封面 */
  playlistCoverUpdate(pid: string, signal?: AbortSignal) {
    return request('playlist_cover_update（服务器）', `pid=${pid}`, 96, settings.uploadOutcome === 'fail-set', signal)
  },
  /**
   * 方案 B 的“撤销”：把封面改回原来那张。原来那张图本来就在网易云上，按理只要再调一次 playlist_cover_update 带上旧图片的编号，
   * 不用重新上传；接口支不支持传旧图片编号，交给验证关卡。
   */
  playlistCoverRevert(pid: string) {
    return request('playlist_cover_update（服务器，改回旧图）', `pid=${pid}`, 96, settings.uploadOutcome === 'fail-set')
  },
}
