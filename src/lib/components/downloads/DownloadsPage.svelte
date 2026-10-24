<!--
  “已下载”页（#38，Spec #11 用户故事 117）：这台设备上下载完的全部歌，一个长列表加搜索，不分歌单，最近下载完的在前；登录与否都能进。
  头部交给 DetailHeader（#75：拼贴图、标题、首数、登录提示、播放全部、搜索都在模块里）；列表本身在 songs/SongList。
  点一首就用整个已下载替换播放队列，播放来源是“已下载”；行的“更多”菜单里有删除下载。搜索词和滚动位置随浏览历史恢复。
-->
<script lang='ts'>
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { CircleArrowDown, Info } from '@lucide/svelte'

  import DetailHeader from '../library/DetailHeader.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import { formatCount } from '../shared/text'
  import PlayAllButton from '../songs/PlayAllButton.svelte'
  import SongList from '../songs/SongList.svelte'
  import type { SongListView } from '../songs/view'
  import Cover from '../ui/Cover.svelte'
  import SearchField from '../ui/SearchField.svelte'

  let { query = $bindable() }: { query: string } = $props()

  const SOURCE = { kind: 'downloads' } as const

  const view = getAppView()
  const all = $derived(view.state.downloads.songs)
  const signedIn = $derived(view.state.session.status === 'signedIn')
  const phone = $derived(!desktopLayout.current)
  const term = $derived(query.trim())
  const songs = $derived(all && term
    ? view.app.searchDownloads(term)
    : all)
  /** 没有封面的歌（#78）不进拼图 */
  const covers = $derived([
    ...new Set((all ?? []).flatMap(song => song.album.coverUrl ?? [])),
  ].slice(0, 4))

  /** 列表状态：还没从本机读出来 / 一首都没有 / 搜到的（搜不到由 SongList 画） */
  const listView = $derived.by((): SongListView => {
    if (all === null)
      return { kind: 'loading' }
    if (all.length === 0) {
      return {
        kind: 'empty',
        icon: CircleArrowDown,
        title: '还没有下载的歌',
        body: `${signedIn ? '' : '登录后，'}在歌曲的“更多”菜单里下载，断网也能听`,
        action: {
          label: signedIn ? '去曲库' : '登录',
          run: () => void goto(resolve('/')),
        },
      }
    }
    return { kind: 'songs', songs: songs ?? [] }
  })

  /** 本机下载还没读出来时不写“找到 0 首”：基线的表头在这种情况下写“标题” */
  const search = $derived(term && all
    ? { term }
    : null)
</script>

{#snippet collage(size: number)}
  <div class='relative flex-none' style:width='{size}px' style:height='{size}px'>
    {#if covers.length === 0}
      <span class='rounded-2xl grid size-full place-items-center bg-secondary-50 text-secondary-800' aria-hidden='true'>
        <CircleArrowDown size={size > 100
          ? 56
          : 34} strokeWidth={1.5} />
      </span>
    {:else if covers.length < 4}
      <Cover url={covers[0]} {size} eager class='rounded-2xl shadow-ambient' />
    {:else}
      <div class='rounded-2xl grid grid-cols-2 size-full overflow-hidden shadow-ambient' aria-hidden='true'>
        {#each covers as url (url)}
          <Cover url={url} size={size / 2} eager />
        {/each}
      </div>
    {/if}
    {#if covers.length > 0 && size > 100}
      <span class='absolute grid size-11 place-items-center rounded-full bg-secondary-100 text-secondary-800 ring-4 ring-primary-50 -bottom-2 -right-2' aria-hidden='true'>
        <CircleArrowDown size={22} />
      </span>
    {/if}
  </div>
{/snippet}

{#snippet signedOutNote(card: boolean)}
  <p class={['flex items-start gap-1.5 text-caption text-neutral-700', card && 'rounded-xl bg-white px-3.5 py-2.5 shadow-ambient']}>
    <Info size={15} class='mt-0.5 flex-none text-neutral-500' aria-hidden='true' />
    <span>登录后可以红心、加入歌单</span>
  </p>
{/snippet}

<DetailHeader title='已下载' phoneLayout='row' trailingPhone>
  {#snippet artwork(size: number)}
    {@render collage(size)}
  {/snippet}
  {#snippet meta()}
    <span class='tabular-nums'>{all === null
      ? '　'
      : `${formatCount(all.length)} 首`}</span>
  {/snippet}
  {#snippet note()}
    {#if !signedIn}{@render signedOutNote(phone)}{/if}
  {/snippet}
  {#snippet actions()}
    <PlayAllButton songs={all} source={SOURCE} />
  {/snippet}
  {#snippet trailing()}
    {#if all && all.length > 0}
      <SearchField label='在已下载里搜索' bind:value={query} class={phone ? '' : 'w-[280px]'} />
    {/if}
  {/snippet}
</DetailHeader>

<div class={phone ? '' : 'mt-6'}>
  <SongList list={listView} source={SOURCE} loadingLabel='正在读出这台设备上的下载' {search} skeleton={phone ? 8 : 10} headerHidden={false} label='已下载的歌曲' {phone} />
</div>
