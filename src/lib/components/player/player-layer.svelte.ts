import { untrack } from 'svelte'

import type { DialogRequest } from '../overlay/overlay-requests'
import type { OverlayLayer } from '../overlay/overlay-stack'
import { getAppView } from '../shared/app-context.svelte'
import type { Drawer } from './drawer.svelte'
import { queueEmpty } from './view'

/** 播放页层：队列非空 × 栈里播放页开着 × 抽屉可见；两个外框共用这一份推导，播放条也看 hasQueue。播放页、队列经浮层栈开合（#64），抽屉位置由 drawer.svelte.ts 管。 */
export interface PlayerLayerState {
  readonly hasQueue: boolean
  /** 浮层栈登记，浅路由记着它 */
  readonly open: boolean
  /** 开着，或者收起时抽屉还没走完 */
  readonly shown: boolean
}

/** 在 createOverlays 里创建一次（外框初始化时）：层请求、抽屉、App 状态只有一份；创建时的组件上下文就是 effect 的主人，跟着外框卸下 */
export const createPlayerLayer = (player: OverlayLayer<DialogRequest, HTMLElement>, drawer: Drawer): PlayerLayerState => {
  const view = getAppView()
  const hasQueue = $derived(!queueEmpty(view.state.player))
  const open = $derived(hasQueue && player.request !== null)
  const shown = $derived(hasQueue && (open || drawer.visible))

  // 层请求说开着就拉开、说关了（收起、返回、清空队列）就缩回去
  $effect(() => drawer.settle(open))
  // 队列清空时播放页没法再开着：让浮层栈也收掉它（历史条目一起退），不留点不动的空层
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
