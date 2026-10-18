<!--
  歌单标签里的歌单（视觉原型 SearchPanel 的歌单结果）：64px 一行，封面、歌单名，下面一行写创建者、首数、播放次数（和歌单页头部的元信息一样）。
  点一行进歌单页：曲库里有的看本机副本，没有的联网现取（#56）。“显示更多”加进来的（从第 appendedAt 张起）依次飘入
-->
<script lang='ts'>
  import type { SearchedPlaylist } from '#lib/api/search.js'
  import { resolve } from '$app/paths'
  import Cover from '../library/Cover.svelte'
  import { formatCount, formatPlays, langOf } from '../library/view'
  import { stagger } from '../motion'

  interface Props {
    playlists: readonly SearchedPlaylist[]
    phone?: boolean
    /** 上一次“显示更多”之前已经有几张 */
    appendedAt?: number
  }

  const { playlists, phone = false, appendedAt = 0 }: Props = $props()

  /** 首数、播放次数（是 0 时不写，和歌单页头部一样） */
  function counts(playlist: SearchedPlaylist): string {
    const tracks = `${formatCount(playlist.trackCount)} 首`
    return playlist.playCount > 0 ? `${tracks} · 播放 ${formatPlays(playlist.playCount)}` : tracks
  }
</script>

<ul aria-label='歌单' data-reveal-group>
  {#each playlists as playlist, i (playlist.id)}
    <li in:stagger={{ order: i - appendedAt }}>
      <a
        href={resolve('/playlists/[id]', { id: String(playlist.id) })}
        class={['h-16 flex items-center gap-3 transition-colors duration-feedback mouse:hover:bg-primary-100', phone ? 'px-4' : 'rounded-lg px-2']}
      >
        <Cover url={playlist.coverUrl} size={48} class='rounded-lg' />
        <span class='min-w-0 flex-1'>
          <span class={['block truncate text-neutral-900 font-500', phone ? 'text-body' : 'text-label']} lang={langOf(playlist.name)}>{playlist.name}</span>
          <span class='block truncate text-caption text-neutral-600 tabular-nums'>
            <span lang={langOf(playlist.creator)}>{playlist.creator}</span> · {counts(playlist)}
          </span>
        </span>
      </a>
    </li>
  {/each}
</ul>
