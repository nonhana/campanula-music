import type { Attachment } from 'svelte/attachments'

import type { Song } from '#lib/api/library.js'

import { getOverlays } from '../overlay/overlay-context'
import { preloadCover } from '../ui/Cover.svelte'

/** 播放条和播放页绑定到所在骨架的浮层会话；抽屉手势不变 */
export const playerPageActions = () => {
  const { player, queue, playerDrawer } = getOverlays()
  const openPlayerPage = (from: HTMLElement | null = document.activeElement instanceof HTMLElement
? document.activeElement
: null) => {
    void player.open({ from })
  }
  const closePlayerPage = () => {
    void player.closeThrough()
  }
  const openQueueSheet = () => {
    if (player.request) {
      void queue.open({
from: document.querySelector<HTMLElement>('[data-queue-entry]'),
})
}
  }
  const closeQueueSheet = () => {
    void queue.close()
  }
  const gripToOpenPlayerPage = (): Attachment<HTMLElement> => node => playerDrawer.grip({
from: 'closed',
commit: () => openPlayerPage(node),
tap: () => openPlayerPage(node),
})(node)
  return {
openPlayerPage,
closePlayerPage,
openQueueSheet,
closeQueueSheet,
gripToOpenPlayerPage,
}
}

/** NowPlaying 初始化时调用：当前这首一变就后台取好播放页大封面，拉开时直接是大图；播放页露着时不取（换碟自己取，连着切歌不取一路转过去的） */
export const prefetchPageCover = (song: () => Song | null, size: () => number): void => {
  const { playerDrawer } = getOverlays()
  const url = $derived(song()?.album.coverUrl)
  // 抽屉动着时 position 每帧都变，这里只看露没露出来
  const pageShown = $derived(playerDrawer.visible)
  $effect(() => {
    if (url && !pageShown)
      void preloadCover(url, size())
  })
}

/** 这次打开 App 期间都记着（刷新后回到默认） */
export const playerPageChoices: {
  panel: 'lyrics' | 'queue'
  phoneLyrics: boolean
  translation: boolean
  romanization: boolean
} = $state({
panel: 'lyrics',
phoneLyrics: false,
translation: true,
romanization: false,
})
