<!--
  歌单标签里的歌单（视觉原型 SearchPanel 的歌单结果）：64px 一行，封面、歌单名，下面一行写创建者、首数、播放次数（和歌单页头部的元信息一样）。
  点一行进歌单页：曲库里有的看本机副本，没有的联网现取（#56）。“显示更多”加进来的（从第 appendedAt 张起）依次飘入。
  行的最右边是收藏开关（CollectButton 的 icon，和行的链接并排，不嵌在里面，和歌曲行的 ••• 一样右边留 4px）；
  自建歌单、我喜欢的音乐没有开关，在链接里标一个“自建”；没登录时两样都没有
-->
<script lang='ts'>
  import type { SearchedPlaylist } from '#lib/api/search.js'
  import { resolve } from '$app/paths'
  import { collectState } from '../library/collect'
  import CollectButton from '../library/CollectButton.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { stagger } from '../shared/motion'
  import { formatCount, formatPlays, langOf } from '../shared/text'
  import Cover from '../ui/Cover.svelte'
  import Tag from '../ui/Tag.svelte'

  interface Props {
    playlists: readonly SearchedPlaylist[]
    phone?: boolean
    /** 上一次“显示更多”之前已经有几张 */
    appendedAt?: number
  }

  const { playlists, phone = false, appendedAt = 0 }: Props = $props()
  const view = getAppView()
  const library = $derived(view.state.library)

  /** 首数、播放次数（是 0 时不写，和歌单页头部一样） */
  function counts(playlist: SearchedPlaylist): string {
    const tracks = `${formatCount(playlist.trackCount)} 首`
    return playlist.playCount > 0 ? `${tracks} · 播放 ${formatPlays(playlist.playCount)}` : tracks
  }
</script>

<ul aria-label='歌单' data-reveal-group>
  {#each playlists as playlist, i (playlist.id)}
    {@const target = { kind: 'playlist', id: playlist.id } as const}
    {@const status = library && collectState(library, target)}
    {@const toggle = status !== null && status !== 'own'}
    <li class={['h-16 flex items-center transition-colors duration-feedback mouse:hover:bg-primary-100', !phone && 'rounded-lg', toggle && 'pr-1']} in:stagger={{ order: i - appendedAt }}>
      <a
        href={resolve('/playlists/[id=neteaseId]', { id: playlist.id })}
        class={['h-full min-w-0 flex flex-1 items-center gap-3', phone ? 'pl-4' : 'rounded-lg pl-2', toggle ? 'pr-2' : phone ? 'pr-4' : 'pr-2']}
      >
        <Cover url={playlist.coverUrl} size={48} class='rounded-lg' />
        <span class='min-w-0 flex-1'>
          <span class={['block truncate text-neutral-900 font-500', phone ? 'text-body' : 'text-label']} lang={langOf(playlist.name)}>{playlist.name}</span>
          <span class='block truncate text-caption text-neutral-600 tabular-nums'>
            <span lang={langOf(playlist.creator)}>{playlist.creator}</span> · {counts(playlist)}
          </span>
        </span>
        {#if status === 'own'}<Tag>自建</Tag>{/if}
      </a>
      {#if toggle}
        <CollectButton {target} name={playlist.name} look='icon' />
      {/if}
    </li>
  {/each}
</ul>
