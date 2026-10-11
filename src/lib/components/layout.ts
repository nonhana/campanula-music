import { MediaQuery } from 'svelte/reactivity'

/**
 * 768px 及以上用桌面布局，窄于 768px 用手机布局，不做平板专属布局（DESIGN.md Layout）。
 * 操作细节（悬停、右键菜单还是底部弹层）按输入方式切换，不看这个：样式里用 mouse: 变体（uno.config.ts）
 */
export const desktopLayout = new MediaQuery('min-width: 768px')
