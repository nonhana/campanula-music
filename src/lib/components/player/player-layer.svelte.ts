import { untrack } from 'svelte'

import type { DialogRequest } from '../overlay/overlay-requests'
import type { OverlayLayer } from '../overlay/overlay-stack'
import { getAppView } from '../shared/app-context.svelte'
import type { Drawer } from './drawer.svelte'
import { queueEmpty } from './view'

/**
 * 播放页层：队列非空 × 浮层栈里播放页开着 × 抽屉可见。两个外框（SignedInFrame、SignedOutFrame）共用这一份推导；
 * 播放条要不要出现也看 hasQueue，不再各写一遍。
 * 播放页、播放队列经浮层栈开合（#64）；抽屉的位置、看得见看不着由 drawer.svelte.ts 管。
 */
export interface PlayerLayerState {
  /** 播放队列里有歌：才有播放条、播放页 */
  readonly hasQueue: boolean
  /** 播放页这一层的请求说开着（浮层栈登记，浅路由记着它） */
  readonly open: boolean
  /** 播放页露着：开着，或者收起时抽屉还没走完 */
  readonly shown: boolean
}

/**
 * 在 createOverlays 里创建一次（外框初始化时）：层的请求、抽屉、App 的状态都只有一份。
 * 创建时的组件上下文就是 effect 的主人，跟着外框一起卸下。
 */
export const createPlayerLayer = (player: OverlayLayer<DialogRequest, HTMLElement>, drawer: Drawer): PlayerLayerState => {
  const view = getAppView()
  const hasQueue = $derived(!queueEmpty(view.state.player))
  const open = $derived(hasQueue && player.request !== null)
  const shown = $derived(hasQueue && (open || drawer.visible))

  // 层的请求说开着就拉开、说关了（收起、返回、清空播放队列）就缩回去
  $effect(() => drawer.settle(open))
  // 播放队列清空时播放页没法再开着：让浮层栈把它也收掉（历史条目一起退），不要留一个点不动的空层
  $effect(() => {
    if (!hasQueue && player.request)
      untrack(() => { void player.invalidate() })
  })

  return {
    get hasQueue() {
      return hasQueue
    },
    get open() {
      return open
    },
    get shown() {
      return shown
    },
  }
}
