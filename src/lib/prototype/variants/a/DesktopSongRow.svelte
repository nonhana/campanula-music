<!--
  PROTOTYPE：桌面歌曲行（56px）。单击整行播放；••• 始终可见；右键打开同一份菜单。
  正在播放的那行是“晨光行”：序号换成小竖条，一层浅薄荷光随播放进度从左铺到右。
  不能播的行（无版权；离线时没下载的）降为 45% 不透明度，并用徽标写明原因。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import type { MenuContext } from './state.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatDuration } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import { Ellipsis, Heart, Play } from '@lucide/svelte'
  import DownloadMark from './DownloadMark.svelte'
  import MorningWash from './MorningWash.svelte'
  import NowBars from './NowBars.svelte'
  import SongBadges from './SongBadges.svelte'
  import { ui } from './state.svelte'

  interface Props {
    song: Song
    n: number
    now: boolean
    onplay: () => void
    /** 已下载页传 downloads：菜单里是“删除下载” */
    context?: MenuContext
  }

  const { song, n, now, onplay, context = 'library' }: Props = $props()
  const off = $derived(!player.playable(song))
</script>

<div
  class={['drow relative h-full rounded-xl', off && 'is-off']}
  role='presentation'
  oncontextmenu={e => ui.openMenuAt(song, e, { context, onplay })}
>
  {#if now}<MorningWash start={104} />{/if}
  <div class='relative grid h-full grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] items-center gap-4 pl-2 pr-1'>
    <span class='grid place-items-center text-[13px] text-neutral-500 tnum'>
      {#if now}<NowBars playing={player.playing} />{:else}{n}{/if}
    </span>
    <span class='flex min-w-0 items-center gap-3'>
      <span class='relative size-10 flex-none'>
        <Cover cover={song.cover} class='size-10 rounded-lg' />
        <span class='hint absolute inset-0 grid place-items-center rounded-lg bg-neutral-900/35 text-white opacity-0' aria-hidden='true'>
          <Play size={16} fill='currentColor' />
        </span>
      </span>
      <button
        class='play-target min-w-0 flex-1 text-left'
        disabled={off}
        aria-current={now ? 'true' : undefined}
        onclick={onplay}
      >
        <span class='flex min-w-0 items-center gap-2'>
          <span class={['truncate text-[14px] leading-5 font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={song.lang}>{song.title}</span>
          <SongBadges {song} />
        </span>
        <span class='block truncate text-[13px] leading-5 text-neutral-600' lang={song.lang}>{artistLine(song)}</span>
      </button>
    </span>
    <span class='truncate text-[13px] text-neutral-600' lang={song.lang}>{song.album}</span>
    <span class='flex items-center gap-3'>
      {#if ui.isLiked(song)}
        <Heart size={15} class='flex-none text-accent-600' fill='currentColor' aria-label='已红心' />
      {/if}
      <DownloadMark {song} />
    </span>
    <span class='text-right text-[13px] text-neutral-500 tnum'>{formatDuration(song.duration)}</span>
    <button
      class='more relative z-1 grid size-9 place-items-center rounded-lg text-neutral-600'
      aria-label='更多操作：{song.title}'
      aria-haspopup='menu'
      onclick={e => ui.openMenuFrom(song, e.currentTarget, { context, onplay })}
    >
      <Ellipsis size={18} aria-hidden='true' />
    </button>
  </div>
</div>

<style>
  .play-target::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 12px;
  }

  .play-target:disabled {
    cursor: not-allowed;
  }

  .is-off > :not(:global(.wash)) {
    opacity: 0.45;
  }

  .hint {
    transition: opacity 160ms ease-out;
  }

  @media (hover: hover) and (pointer: fine) {
    .drow:not(.is-off):hover {
      background: #f9fafb;
    }

    .drow:not(.is-off):hover .hint {
      opacity: 1;
    }

    .more:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
