<!--
  歌单网格里的一格：封面、歌单名、首数（隐私歌单加一把锁，收藏的歌单写是谁的）。点开是歌单页
-->
<script lang='ts'>
  import type { Playlist } from '$lib/api/library'
  import { resolve } from '$app/paths'
  import { Lock } from '@lucide/svelte'
  import Cover from './Cover.svelte'
  import { FLIGHT_COVER_SIZE, formatCount, langOf, playlistName } from './view'

  interface Props {
    playlist: Playlist
    phone?: boolean
  }

  const { playlist, phone = false }: Props = $props()
  const name = $derived(playlistName(playlist))
  /** 封面代表点开的那一页（Cover 的 flight）；链接上照样直接写 resolve()，lint 认不出 $derived 里的 */
  const page = $derived(resolve('/playlists/[id]', { id: String(playlist.id) }))
</script>

<a href={resolve('/playlists/[id]', { id: String(playlist.id) })} class='group block min-w-0 rounded-lg'>
  <Cover url={playlist.coverUrl} size={FLIGHT_COVER_SIZE} fluid flight={page} class='rounded-lg shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95' />
  <span class={['mt-2.5 block truncate text-neutral-900 font-500', phone ? 'text-body' : 'text-label']} lang={langOf(name)}>{name}</span>
  <span class='mt-0.5 min-w-0 flex items-center gap-1 text-caption text-neutral-600'>
    <span class='flex-none tabular-nums'>{formatCount(playlist.trackCount)} 首</span>
    {#if playlist.private}
      <Lock size={12} class='flex-none' aria-hidden='true' /><span class='sr-only'>隐私歌单</span>
    {/if}
    {#if playlist.kind === 'collected' && playlist.creator}
      <span class='truncate' lang={langOf(playlist.creator)}>· {playlist.creator}</span>
    {/if}
  </span>
</a>
