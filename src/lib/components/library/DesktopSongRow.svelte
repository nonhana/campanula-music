<!--
  桌面歌曲行（56px）：序号、封面和歌名歌手、专辑、状态（红心）、时长。现在只展示，点歌播放、更多菜单由之后的票加。
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import { Heart } from '@lucide/svelte'
  import Cover from './Cover.svelte'
  import { artistLine, formatDuration, langOf } from './view'

  interface Props {
    song: Song
    /** 序号，从 1 开始 */
    n: number
    hearted: boolean
  }

  const { song, n, hearted }: Props = $props()
</script>

<div class='grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px] h-full items-center gap-4 rounded-lg pl-2 pr-3 mouse:hover:bg-neutral-50'>
  <span class='text-center text-caption text-neutral-500 tabular-nums'>{n}</span>
  <span class='min-w-0 flex items-center gap-3'>
    <Cover url={song.album.coverUrl} size={40} class='rounded-md' />
    <span class='min-w-0 flex-1'>
      <span class='block truncate text-label text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</span>
      <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
    </span>
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
