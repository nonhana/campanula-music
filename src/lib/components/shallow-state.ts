import { goto } from '$app/navigation'

/**
 * 压一条浅路由浏览记录：网址不变，只带上 page.state。返回手势、浏览器后退都退回上一条。
 * replace：换掉当前这条，不另压一条（从一层浮层换到另一层，返回直接收起后一层）。
 * 空地址就是“当前网址”：不能用 resolve('')，它会解析成站点根。
 */
export function pushShallowState(state: App.PageState, { replace = false } = {}): void {
  void goto('', { shallow: true, replace, state })
}
