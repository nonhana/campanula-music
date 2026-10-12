<!-- 手机歌曲行（Auxio 式，56px，无分隔线）：封面、歌名、歌手。现在只展示，点歌播放由之后的票加 -->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import Cover from './Cover.svelte'
  import { artistLine, langOf } from './view'

  const { song }: { song: Song } = $props()
</script>

<div class='grid grid-cols-[48px_minmax(0,1fr)] h-full items-center gap-3.5 pl-4 pr-4'>
  <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
  <span class='min-w-0'>
    <span class='block truncate text-body text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</span>
    <span class='mt-0.5 block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
  </span>
</div>
