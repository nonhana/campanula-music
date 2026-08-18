<script lang='ts'>
  import type { NcmSong } from '$lib/types'
  import { toSongItem } from '$lib/ncm/search'
  import { addToPlaylistAndPlay } from '$lib/stores'
  import { durationFormatter } from '$lib/utils'
  import { Music } from 'lucide-svelte'
  import LikeButton from './LikeButton.svelte'

  /** 歌曲行：播放（点击即播）+ 时长 + 红心；搜索/歌单详情/我喜欢的音乐共用同一外形 */
  const { song }: { song: NcmSong } = $props()
</script>

<li class='group flex items-center rounded-lg transition-colors hover:bg-app-surface-hover'>
  <button
    type='button'
    onclick={() => addToPlaylistAndPlay(toSongItem(song))}
    class='min-w-0 flex flex-1 items-center gap-3 px-3 py-2 text-left'
  >
    <span class='size-10 flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-700'>
      <Music class='size-5' />
    </span>
    <span class='min-w-0 flex-1'>
      <span class='block truncate text-sm text-app-text font-medium'>{song.name}</span>
      <span class='mt-0.5 block truncate text-xs text-app-text-muted'>
        {song.artists.map(artist => artist.name).join(' / ')}{song.album.name ? ` · ${song.album.name}` : ''}
      </span>
    </span>
    <span class='shrink-0 text-xs text-app-text-muted'>{durationFormatter(song.duration)}</span>
  </button>
  <LikeButton song={song} class='mr-2' />
</li>
