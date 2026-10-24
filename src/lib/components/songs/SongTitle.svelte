<!--
  歌曲的标题块（DESIGN.md Song Row）：歌名 + 徽标（无版权 / 未下载 / 试听）一行，歌手一行；手机、首页歌曲格在歌手前面还有下载标记。
  桌面歌曲行、手机歌曲行、首页歌曲格、播放队列共用这一份；正在播放的那首歌名变成森林墨。
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { SongLook } from './song-look'
  import { artistLine, langOf } from '../shared/text'
  import DownloadMark from './DownloadMark.svelte'
  import SongBadge from './SongBadge.svelte'

  interface Props {
    song: Song
    /** 正在播放这首 */
    now: boolean
    /** 这一行的状态：徽标、下载标记 */
    look: SongLook
    /** 桌面行、首页歌曲格、播放队列用 label，手机行用 body */
    size?: 'label' | 'body'
    /** 在歌手前面显示下载标记（手机行、首页歌曲格） */
    mark?: boolean
    /** 歌名和歌手贴得紧一点（手机行、首页歌曲格） */
    tight?: boolean
  }

  const { song, now, look, size = 'label', mark = false, tight = false }: Props = $props()
  const artist = $derived(artistLine(song))
</script>

<span class={['min-w-0 flex items-center', tight ? 'gap-1.5' : 'gap-2']}>
  <span
    class={['truncate font-500 transition-colors duration-state', size === 'body' ? 'text-body' : 'text-label', now ? 'text-primary-950' : 'text-neutral-900']}
    lang={langOf(song.name)}
  >{song.name}</span>
  <SongBadge kind={look.badge} />
</span>
{#if mark}
  <span class={['flex items-center gap-1.5 text-caption text-neutral-600', size === 'body' && 'mt-0.5']}>
    {#if look.mark}<DownloadMark mark={look.mark} variant='inline' />{/if}
    <span class='min-w-0 truncate' lang={langOf(artist)}>{artist}</span>
  </span>
{:else}
  <span class='block truncate text-caption text-neutral-600' lang={langOf(artist)}>{artist}</span>
{/if}
