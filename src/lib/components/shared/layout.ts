import { MediaQuery } from 'svelte/reactivity'

/** 768px 及以上桌面布局，窄于 768px 手机布局，不做平板专属布局（DESIGN.md Layout）；悬停、右键菜单还是底部弹层按输入方式切换，样式里用 mouse: 变体 */
export const desktopLayout = new MediaQuery('min-width: 768px')
