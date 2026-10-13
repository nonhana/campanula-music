<!--
  手机歌曲行（Auxio 式，56px，无分隔线，DESIGN.md Song Row）：封面、歌名、歌手。轻点整行就播放。
  正在播放的那行是晨光行：封面中间压一枚白色小圆片，里面是三根小竖条。无版权的整行降到 45%、不能点，徽标写明原因
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import MorningWash from '../player/MorningWash.svelte'
  import NowChip from '../player/NowChip.svelte'
  import Cover from './Cover.svelte'
  import PlayTarget from './PlayTarget.svelte'
  import SongBadge from './SongBadge.svelte'
  import { artistLine, langOf } from './view'

  interface Props {
    song: Song
    /** 正在播放这首 */
    now: boolean
    onplay: () => void
  }

  const { song, now, onplay }: Props = $props()
  const off = $derived(song.availability === 'noCopyright')
</script>

<div class='relative h-full'>
  {#if now}<MorningWash start={70} onGround />{/if}
  <div class={['relative grid grid-cols-[48px_minmax(0,1fr)] h-full items-center gap-3.5 pl-4 pr-4', off && 'opacity-45']}>
    <span class='relative size-12'>
      <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
      {#if now}<NowChip />{/if}
    </span>
    <PlayTarget class='min-w-0' disabled={off} {now} {onplay}>
      <span class='min-w-0 flex items-center gap-1.5'>
        <span class={['truncate text-body font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(song.name)}>{song.name}</span>
        <SongBadge availability={song.availability} />
      </span>
      <span class='mt-0.5 block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
    </PlayTarget>
  </div>
</div>
