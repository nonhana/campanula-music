<script lang="ts" module>
  // 高度只此一处，桌面外框都从这里取
  export const OFFLINE_BAR_HEIGHT = 36;
</script>

<script lang="ts">
  import { WifiOff } from '@lucide/svelte';

  const { phone = false }: { phone?: boolean } = $props();
</script>

<div
  class={[
    'bg-secondary-100 text-secondary-900',
    phone
      ? 'flex items-center gap-2 px-4 text-caption'
      : 'flex items-center gap-2.5 px-6 text-label',
  ]}
  style:height={`${OFFLINE_BAR_HEIGHT}px`}
  role="status"
>
  <WifiOff
    size={phone ? 14 : 16}
    class="flex-none text-secondary-800"
    aria-hidden="true"
  />
  <span class="min-w-0 flex-1 truncate">网络已断开，只能播放已下载的歌</span>
</div>
