<!--
  桌面歌曲行（56px，DESIGN.md Song Row）：序号、封面和歌名歌手、专辑、状态（红心）、时长。单击整行就播放。
  正在播放的那行是晨光行：序号换成三根小竖条。无版权的整行降到 45%、不能点，徽标写明原因。更多菜单由之后的票加
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import { Heart } from '@lucide/svelte'
  import MorningWash from '../player/MorningWash.svelte'
  import NowBars from '../player/NowBars.svelte'
  import Cover from './Cover.svelte'
  import PlayTarget from './PlayTarget.svelte'
  import SongBadge from './SongBadge.svelte'
  import { artistLine, formatDuration, langOf } from './view'

  interface Props {
    song: Song
    /** 序号，从 1 开始 */
    n: number
    hearted: boolean
    /** 正在播放这首 */
    now: boolean
    onplay: () => void
  }

  const { song, n, hearted, now, onplay }: Props = $props()
  const off = $derived(song.availability === 'noCopyright')
</script>

<div class={['relative h-full rounded-lg', !off && 'mouse:hover:bg-neutral-50']}>
  {#if now}<MorningWash start={104} />{/if}
  <div class={['relative grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px] h-full items-center gap-4 pl-2 pr-3', off && 'opacity-45']}>
    <span class='grid place-items-center text-caption text-neutral-500 tabular-nums'>
      {#if now}<NowBars />{:else}{n}{/if}
    </span>
    <span class='min-w-0 flex items-center gap-3'>
      <Cover url={song.album.coverUrl} size={40} class='rounded-md' />
      <PlayTarget class='min-w-0 flex-1' rounded disabled={off} {now} {onplay}>
        <span class='min-w-0 flex items-center gap-2'>
          <span class={['truncate text-label font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(song.name)}>{song.name}</span>
          <SongBadge availability={song.availability} />
        </span>
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
      </PlayTarget>
    </span>
    <span class='truncate text-caption text-neutral-600' lang={langOf(song.album.name ?? '')}>{song.album.name}</span>
    <span class='flex items-center'>
      {#if hearted}
        <Heart size={15} class='flex-none text-accent-600' fill='currentColor' aria-hidden='true' />
        <span class='sr-only'>已红心</span>
      {/if}
    </span>
    <span class='text-right text-caption text-neutral-500 tabular-nums'>{formatDuration(song.duration)}</span>
  </div>
</div>
