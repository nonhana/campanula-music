import type { Level } from './netease'
import { kvSet } from './log'
import { downloadUrl } from './netease'
import { songName } from './songs'

/** 下载好的歌放在 Cache Storage 里，键是 /probe-dl/<歌曲编号>（不是真的路由，只当键用）。 */
export const DOWNLOAD_CACHE = 'probe-downloads'
export const downloadKey = (id: number) => `/probe-dl/${id}`

export const ICONS = [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]

/** 一个后台任务里的一首：Service Worker 收到结果时，按地址找回是哪首歌。 */
export interface BgItem {
  id: number
  url: string
  size: number
  type: string
}

/**
 * 接力下载的计划：一首一个后台任务，前一首完成时由 Service Worker 开下一首。
 * 2026-10-10 桌面 Chrome 实测：Service Worker 里调 backgroundFetch.fetch() 会抛
 * NotAllowedError（“not allowed in service worker environments”），留着这条路是为了在 Android 上再确认一次。
 */
export interface RelayPlan {
  planId: string
  ids: number[]
  level: Level
  /** 当前这一棒是第几首（从 0 开始） */
  index: number
  /** 当前这一棒的后台任务编号 */
  regId: string
}

export const mimeOf = (type: string) => (type === 'flac' ? 'audio/flac' : 'audio/mpeg')

/** 经服务器跳转的下载地址：请求到了服务器才取网易云的地址（见 /api/probe/dl）。要用绝对地址，Service Worker 按它认歌。 */
export const redirectUrl = (origin: string, id: number, level: Level) => new URL(`/api/probe/dl?id=${id}&level=${level}`, origin).href

/** 页面用 logPage、Service Worker 用自己的记法；开后台任务前都要记一笔。 */
export type Note = (kind: string, detail?: unknown) => Promise<void>

/**
 * Chrome 的后台下载权限跟着“自动下载”设置走。2026-10-10 桌面 Chrome 实测：权限是 prompt 时，
 * 第一个任务直接开始，第二个任务的 fetch() 一直不返回（推测在等用户允许“下载多个文件”）。
 * 所以每次开任务前记下当时的权限，真机上对照通知栏和记录看。
 */
async function permission(): Promise<string> {
  try {
    return (await navigator.permissions.query({ name: 'background-fetch' as PermissionName })).state
  }
  catch (error) {
    return `查不了：${error instanceof Error ? error.message : String(error)}`
  }
}

/** 开一个后台任务；先把“地址 → 歌曲”的对应存好，Service Worker 收结果时要用。 */
export async function startBgFetch(manager: BackgroundFetchManager, regId: string, items: BgItem[], title: string, note: Note): Promise<BackgroundFetchRegistration> {
  await kvSet(`bg:${regId}`, items)
  await note('请求开后台任务', { regId, permission: await permission() })
  return manager.fetch(regId, items.map(item => item.url), {
    title,
    icons: ICONS,
    downloadTotal: items.reduce((sum, item) => sum + item.size, 0),
  })
}

/** 接力的一棒：现取这首的下载地址（约 20 分钟过期，不能提前取好），开一个只有这一首的后台任务。 */
export async function startRelayStep(manager: BackgroundFetchManager, plan: RelayPlan, index: number, note: Note): Promise<RelayPlan> {
  const id = plan.ids[index]!
  const url = await downloadUrl(id, plan.level)
  const regId = `${plan.planId}-${index}`
  // 先记下这一棒，再开任务：任务很快完成时，Service Worker 要能认出它是当前这一棒
  const next = { ...plan, index, regId }
  await kvSet('relay', next)
  await startBgFetch(manager, regId, [{ id, url: url.url, size: url.size, type: url.type }], `接力 ${index + 1}/${plan.ids.length}：${songName(id)}`, note)
  return next
}
