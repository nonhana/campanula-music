import type { DialogRequest } from './dialog-layer.svelte'
import { DialogLayer } from './dialog-layer.svelte'

// 退出登录的确认（#57）：设置页账号卡上的退出键、桌面头像菜单里的“退出登录”都先打开它。
// 画出来的是 LogoutConfirm.svelte；手机上底部弹层压的浅路由是 page.state.logoutSheet
export const logoutConfirm = new DialogLayer<DialogRequest>('logoutSheet')
