import type { Attachment } from 'svelte/attachments'
import type { Song } from '#lib/api/library.js'
import { preloadCover } from '../library/Cover.svelte'
import { getOverlays } from '../overlay-context'

/** 播放条和播放页初始化时绑定到所在骨架的浮层会话；抽屉手势不变。 */
export function playerPageActions() {
  const { player, queue, playerDrawer } = getOverlays()
  const openPlayerPage = (from: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null) => {
    void player.open({ from })
  }
  const closePlayerPage = () => {
    void player.closeThrough()
  }
  const openQueueSheet = () => {
    if (player.request)
      void queue.open({ from: document.querySelector<HTMLElement>('[data-queue-entry]') })
  }
  const closeQueueSheet = () => {
    void queue.close()
  }
  const gripToOpenPlayerPage = (): Attachment<HTMLElement> => node => playerDrawer.grip({ from: 'closed', commit: () => openPlayerPage(node), tap: () => openPlayerPage(node) })(node)
  return { openPlayerPage, closePlayerPage, openQueueSheet, closeQueueSheet, gripToOpenPlayerPage }
}

/**
 * 正在播放区（NowPlaying，桌面底栏和手机迷你条共用）初始化时调用：当前这首一变，就在后台取好播放页大封面（size）的缩略图，
 * 拉开播放页时封面直接是大图，不从小图上淡入。播放页露着时不取：那时换碟自己取（连着切歌时不取一路转过去的）
 */
export function prefetchPageCover(song: () => Song | null, size: () => number): void {
  const { playerDrawer } = getOverlays()
  const url = $derived(song()?.album.coverUrl)
  // 抽屉动着时 position 每一帧都变，这里只看露没露出来
  const pageShown = $derived(playerDrawer.visible)
  $effect(() => {
    if (url && !pageShown)
      void preloadCover(url, size())
  })
}

/** 播放页上听众的选择，这次打开 App 期间都记着（刷新后回到默认） */
export const playerPageChoices: {
  /** 桌面右栏显示歌词还是播放队列 */
  panel: 'lyrics' | 'queue'
  /** 手机上封面那块换成了歌词 */
  phoneLyrics: boolean
  /** 有翻译、音译时显示出来 */
  translation: boolean
  romanization: boolean
} = $state({ panel: 'lyrics', phoneLyrics: false, translation: true, romanization: false })
