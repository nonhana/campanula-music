<!--
  PROTOTYPE：离线提示条。离线时只剩这台设备上的歌能播，所以用代表“本机/下载”的蜜桃色，而不是报错的红色。
-->
<script lang='ts'>
  import { downloadedSongs } from '$lib/prototype/catalog'
  import { formatCount } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { ChevronRight, WifiOff } from '@lucide/svelte'

  interface Props {
    class?: string
  }

  const { class: klass = '' }: Props = $props()
</script>

{#if nav.offline}
  <div class={['flex min-h-11 items-center gap-2.5 rounded-xl bg-secondary-50 pl-3.5 pr-1.5 text-[13px] leading-5', klass]} role='status'>
    <WifiOff size={16} class='flex-none text-secondary-900' aria-hidden='true' />
    <p class='min-w-0 flex-1 py-2'>
      <span class='font-500 text-secondary-900'>网络已断开</span>
      <span class='text-neutral-700'> · 只能播放已下载的歌</span>
    </p>
    {#if nav.screen !== 'downloads'}
      <button class='link flex h-8 flex-none items-center gap-0.5 rounded-lg pl-2.5 pr-1.5 font-500 text-secondary-900' onclick={() => nav.openDownloads()}>
        已下载 {formatCount(downloadedSongs.length)} 首
        <ChevronRight size={15} aria-hidden='true' />
      </button>
    {/if}
  </div>
{/if}

<style>
  .link:active {
    background: #ffeee2;
  }

  @media (hover: hover) and (pointer: fine) {
    .link:hover {
      background: #ffeee2;
    }
  }
</style>
