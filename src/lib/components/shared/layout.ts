import { MediaQuery } from 'svelte/reactivity'

import { OFFLINE_BAR_HEIGHT } from '../notice/OfflineBar.svelte'

/** 768px 及以上桌面布局，窄于 768px 手机布局，不做平板专属布局（DESIGN.md Layout）；悬停、右键菜单还是底部弹层按输入方式切换，样式里用 mouse: 变体 */
export const desktopLayout = new MediaQuery('min-width: 768px')

/** 桌面右侧浮动面板（下载面板、播放队列面板）的上沿：顶栏 64px（断网时下面还有提示条）再空 16px */
export const desktopPanelTop = (online: boolean): number => 64 + (online ? 0 : OFFLINE_BAR_HEIGHT) + 16
