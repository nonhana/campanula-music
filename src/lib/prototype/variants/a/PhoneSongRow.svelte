<!--
  PROTOTYPE：手机歌曲行（Auxio 式，56px，无分隔线）。轻点播放；••• 打开底部弹层。
  窄窗口里用鼠标时，右键打开同一份菜单（浮层），不要求长按。正在播放的那行是“晨光行”。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import type { MenuContext } from './state.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import { Ellipsis } from '@lucide/svelte'
  import DownloadMark from './DownloadMark.svelte'
  import MorningWash from './MorningWash.svelte'
  import NowChip from './NowChip.svelte'
  import SongBadges from './SongBadges.svelte'
  import { ui } from './state.svelte'

  interface Props {
    song: Song
    now: boolean
    onplay: () => void
    /** 已下载页传 downloads：菜单里是“删除下载” */
    context?: MenuContext
  }

  const { song, now, onplay, context = 'library' }: Props = $props()
  const off = $derived(!player.playable(song))
</script>

<div
  class={['prow relative h-full', off && 'is-off']}
  role='presentation'
  oncontextmenu={e => ui.openMenuAt(song, e, { context, onplay })}
>
  {#if now}<MorningWash start={70} onGround />{/if}
  <div class='relative grid h-full grid-cols-[48px_minmax(0,1fr)_44px] items-center gap-3.5 pl-4 pr-1'>
    <span class='relative size-12'>
      <Cover cover={song.cover} class='size-12 rounded-lg' />
      {#if now}<NowChip />{/if}
    </span>
    <button
      class='play-target min-w-0 text-left'
      disabled={off}
      aria-current={now ? 'true' : undefined}
      onclick={onplay}
    >
      <span class='flex min-w-0 items-center gap-1.5'>
        <span class={['truncate text-[15px] leading-5 font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={song.lang}>{song.title}</span>
        <SongBadges {song} />
      </span>
      <span class='mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] leading-[18px] text-neutral-600'>
        {#if song.download}<span class='flex-none'><DownloadMark {song} variant='inline' /></span>{/if}
        <span class='truncate' lang={song.lang}>{artistLine(song)}</span>
      </span>
    </button>
    <button
      class='more relative z-1 grid size-11 place-items-center rounded-full text-neutral-600 active:bg-primary-100'
      aria-label='更多操作：{song.title}'
      aria-haspopup='menu'
      onclick={e => ui.openMenuFrom(song, e.currentTarget, { context, onplay })}
    >
      <Ellipsis size={20} aria-hidden='true' />
    </button>
  </div>
</div>

<style>
  .play-target::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .play-target:not(:disabled):active::after {
    background: rgb(17 24 39 / 0.04);
  }

  .is-off > :global(.grid) {
    opacity: 0.45;
  }
</style>
