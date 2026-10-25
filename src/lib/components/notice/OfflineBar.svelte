<!--
  断网提示条（#42，Spec #11“客户端：App 外壳（PWA）”）：网络断开时一直贴在顶行下面，说明现在还能做什么。
  蜜桃属于“这台设备”（DESIGN.md Colors），不是可以关掉的通知条：联网后自己消失。
-->
<script lang='ts' module>
  /** 高度只有这一处：两个桌面外框拿它让内容、侧栏和吸顶的行往下让 */
  export const OFFLINE_BAR_HEIGHT = 36
</script>

<script lang='ts'>
  import { WifiOff } from '@lucide/svelte'

  const { phone = false }: { phone?: boolean } = $props()
</script>

<div class={[
  'bg-secondary-100 text-secondary-900',
  phone
    ? 'flex items-center gap-2 px-4 text-caption'
    : 'flex items-center gap-2.5 px-6 text-label',
]} style:height={`${OFFLINE_BAR_HEIGHT}px`} role='status'>
  <WifiOff size={phone
    ? 14
    : 16} class='flex-none text-secondary-800' aria-hidden='true' />
  <span class='min-w-0 flex-1 truncate'>网络已断开，只能播放已下载的歌</span>
</div>
