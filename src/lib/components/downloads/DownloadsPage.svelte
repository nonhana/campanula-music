<!--
  “已下载”页（#38，原型 DesktopDownloads / PhoneDownloads，Spec #11 用户故事 117）：这台设备上下载完的全部歌，一个长列表加搜索，不分歌单，最近下载完的在前。
  登录、没登录都是这一页：没登录时从登录页进来（外框是 SignedOutFrame），提示登录后可以红心、加入歌单。
  桌面：200px 的拼贴封面头部（前四首的封面），标题、首数（没登录时加那句提示），播放全部和右边的搜索框；下面是白色面板里带表头的歌曲行。
  手机：88px 的拼贴和标题一行，播放全部，下面单独一行搜索框，歌曲行直接放在晨光底上。
  点一首（搜索结果里点也一样）就用整个已下载替换播放队列，播放来源是“已下载”。行的“更多”菜单里有删除下载。
  列表本身（骨架、空 / 搜不到、表头“找到几首”、虚拟化、行高）在 songs/SongList；头部的首数和列表对得上（DESIGN.md Do's）。
  返回这一页时，搜索词和滚动位置都回到原来的样子（snapshot）
-->
<script lang='ts'>
  import type { SongListView } from '../songs/view'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { CircleArrowDown, Info } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { desktopLayout } from '../layout'
  import { pageHeading } from '../shell/back-title.svelte'
  import PlayAllButton from '../songs/PlayAllButton.svelte'
  import SongList from '../songs/SongList.svelte'
  import { formatCount } from '../text'
  import Cover from '../ui/Cover.svelte'
  import SearchField from '../ui/SearchField.svelte'

  /** 搜索词：页面存着，返回这一页时恢复 */
  let { query = $bindable() }: { query: string } = $props()

  const SOURCE = { kind: 'downloads' } as const

  const view = getAppView()
  const all = $derived(view.state.downloads.songs)
  const signedIn = $derived(view.state.session.status === 'signedIn')
  const term = $derived(query.trim())
  const songs = $derived(all && term ? view.app.searchDownloads(term) : all)
  /** 拼贴的封面：前四首（不同的封面） */
  const covers = $derived([...new Set((all ?? []).map(song => song.album.coverUrl))].slice(0, 4))

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
        action: { label: signedIn ? '去曲库' : '登录', run: () => void goto(resolve('/')) },
      }
    }
    return { kind: 'songs', songs: songs ?? [] }
  })

  /** 本机下载还没读出来时不写“找到 0 首”：基线的表头在这种情况下写“标题” */
  const search = $derived(term && all ? { term } : null)
</script>

{#snippet collage(size: number)}
  <div class='relative flex-none' style:width='{size}px' style:height='{size}px'>
    {#if covers.length === 0}
      <span class='rounded-2xl grid size-full place-items-center bg-secondary-50 text-secondary-800' aria-hidden='true'>
        <CircleArrowDown size={size > 100 ? 56 : 34} strokeWidth={1.5} />
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

{#if desktopLayout.current}
  <header class='flex gap-7 pt-2'>
    {@render collage(200)}
    <div class='min-w-0 flex flex-1 flex-col'>
      <h1 class='text-headline text-neutral-900 font-600'>已下载</h1>
      <p class='mt-2 text-label text-neutral-600 tabular-nums'>{all === null ? '　' : `${formatCount(all.length)} 首`}</p>
      {#if !signedIn}
        <div class='mt-2'>{@render signedOutNote(false)}</div>
      {/if}
      <div class='mt-auto flex items-center gap-2 pt-4'>
        <PlayAllButton songs={all} source={SOURCE} />
        {#if all && all.length > 0}
          <SearchField label='在已下载里搜索' bind:value={query} class='ml-auto w-[280px]' />
        {/if}
      </div>
    </div>
  </header>
  <div class='mt-6'>
    <SongList list={listView} source={SOURCE} loadingLabel='正在读出这台设备上的下载' {search} skeleton={10} headerHidden={false} label='已下载的歌曲' />
  </div>
{:else}
  <header class='px-4 pt-2'>
    <div class='flex items-center gap-4'>
      {@render collage(88)}
      <div class='min-w-0'>
        <h1 class='text-headline-sm text-neutral-900 font-600' {@attach pageHeading('已下载')}>已下载</h1>
        <p class='mt-0.5 text-caption text-neutral-600 tabular-nums'>{all === null ? '　' : `${formatCount(all.length)} 首`}</p>
      </div>
    </div>
    {#if !signedIn}
      <div class='mt-4'>{@render signedOutNote(true)}</div>
    {/if}
    <div class='mt-4 flex items-center gap-2'>
      <PlayAllButton songs={all} source={SOURCE} />
    </div>
    {#if all && all.length > 0}
      <SearchField label='在已下载里搜索' bind:value={query} class='mt-4' />
    {/if}
  </header>
  <SongList list={listView} source={SOURCE} phone loadingLabel='正在读出这台设备上的下载' {search} skeleton={8} headerHidden={false} label='已下载的歌曲' />
{/if}
