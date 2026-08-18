import type { NcmSong } from '$lib/types'
import { NcmClientError } from '$lib/ncm/client'
import { fetchLikedSongs, LIKE_ERROR_TEXT, likeSong } from '$lib/ncm/likes'
import { derived, get, writable } from 'svelte/store'
import { addMessage } from './messageStore'

/**
 * 红心编排：我喜欢的音乐是红心状态与收藏页共用的单一数据源。
 *
 * loadLikedSongs 拉取红心歌曲列表（已成功加载过则跳过，force 强制刷新，
 * 在途请求共享同一 Promise 防并发风暴）；toggleLike 乐观写回网易云账号，
 * 失败只对当前歌曲回滚（不覆盖并发在途的其他歌曲乐观更新）并呈现领域错误文案。
 * 只经 $lib/ncm/likes 访问服务端门面代理，测试注入假 provider 响应即替换该模块。
 */

/** 我喜欢的音乐歌曲列表（按红心时间倒序） */
export const likedSongs = writable<NcmSong[]>([])
/** 红心歌曲列表是否已成功加载（驱动 loadLikedSongs 跳过重复请求） */
export const likedLoaded = writable(false)
/** 已红心歌曲 id 集合（派生，供各红心按钮查询状态） */
export const likedIds = derived(likedSongs, songs => new Set(songs.map(song => song.id)))
/** 正在写回红心状态的歌曲 id 集合（防重复点击） */
export const likedPending = writable<Set<number>>(new Set())
/** 红心歌曲列表是否加载中 */
export const likedLoading = writable(false)
/** 红心歌曲列表加载失败的可展示错误；成功后清空 */
export const likedError = writable<string | null>(null)

/** 在途的加载请求：并发调用共享同一请求，避免每个红心按钮挂载都触发一次拉取 */
let inflight: Promise<void> | null = null

/** 领域错误 → 可展示文案（错误消息优先，缺失时回落按码文案） */
function presentLikedError(err: unknown): string {
  return err instanceof NcmClientError
    ? (err.message || LIKE_ERROR_TEXT[err.code])
    : LIKE_ERROR_TEXT.UNKNOWN
}

async function doLoad(): Promise<void> {
  likedLoading.set(true)
  likedError.set(null)
  try {
    const songs = await fetchLikedSongs()
    // 服务端快照为准，但保留本地在途写回的新增（快照可能早于写回生效）；
    // 在途取消红心只可能发生在已加载之后，不会与此处竞争
    const pending = get(likedPending)
    const fetchedIds = new Set(songs.map(song => song.id))
    const localPending = get(likedSongs).filter(song => pending.has(song.id) && !fetchedIds.has(song.id))
    likedSongs.set([...localPending, ...songs])
    likedLoaded.set(true)
  }
  catch (err) {
    console.error('加载红心歌曲列表失败:', err)
    likedError.set(presentLikedError(err))
  }
  finally {
    likedLoading.set(false)
  }
}

/** 拉取红心歌曲列表；已成功加载过则跳过（force 强制刷新），失败留 likedError 供重试 */
export function loadLikedSongs(force = false): Promise<void> {
  if (get(likedLoaded) && !force)
    return Promise.resolve()
  if (inflight)
    return inflight
  inflight = doLoad().finally(() => {
    inflight = null
  })
  return inflight
}

/** 红心 / 取消红心：乐观写回账号，失败回滚并提示；进行中的歌曲忽略重复点击 */
export async function toggleLike(song: NcmSong): Promise<void> {
  const pending = get(likedPending)
  if (pending.has(song.id))
    return

  const liked = get(likedIds).has(song.id)
  const next = !liked
  const previousIndex = get(likedSongs).findIndex(item => item.id === song.id)

  // 乐观更新本地状态，让红心按钮即时反馈
  likedPending.set(new Set(pending).add(song.id))
  likedSongs.update(current => next
    ? [song, ...current.filter(item => item.id !== song.id)]
    : current.filter(item => item.id !== song.id))

  try {
    await likeSong(song.id, next)
    addMessage({ message: next ? `已红心「${song.name}」` : `已取消红心「${song.name}」`, type: 'success' })
  }
  catch (err) {
    console.error('红心写回失败:', err)
    // 只对当前歌曲做回滚：整表快照会清掉并发在途的其他歌曲乐观更新
    likedSongs.update((current) => {
      if (next) {
        return current.filter(item => item.id !== song.id)
      }
      if (current.some(item => item.id === song.id))
        return current
      const restored = [...current]
      restored.splice(previousIndex >= 0 ? previousIndex : restored.length, 0, song)
      return restored
    })
    addMessage({ message: presentLikedError(err), type: 'error' })
  }
  finally {
    likedPending.update((current) => {
      const rest = new Set(current)
      rest.delete(song.id)
      return rest
    })
  }
}
