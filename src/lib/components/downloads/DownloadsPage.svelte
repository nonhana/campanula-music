<!--
  “已下载”页（#38，Spec #11 用户故事 117）：这台设备上下载完的全部歌，一个长列表加搜索，不分歌单，最近下载完的在前；登录与否都能进。
  头部交给 DetailHeader（#75：拼贴图、标题、首数、登录提示、播放全部都在模块里）；列表本身在 songs/SongList；桌面搜索在页头动作行的右端，手机通栏放在页头下方，几千首排队时也不会沉到最下面。
  头部下面是 DownloadsTasks（#39）：“正在下载”的排队、进度、失败和重试，空间不够时的整队暂停和“继续下载”。
  点一首就用整个已下载替换播放队列，播放来源是“已下载”；行的“更多”菜单里有导出、删除下载。搜索词和滚动位置随浏览历史恢复。
  多选（#79、#82）只有导出和删除，登录与否都能用：入口和别的歌曲列表一样在表头最右（手机在首数那一行），也能 ⌘/Ctrl/Shift 点行、长按行进入；在列表里搜索时勾选和动作仍按全部下载。
  头部操作行最后的“下载管理”•••（#40）里是按歌单删除下载，登录与否都有；没有从歌单下载的歌时这一项不可选。
-->
<script lang='ts'>
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { CircleArrowDown, Info, MoreHorizontal } from '@lucide/svelte'

  import DetailHeader from '../library/DetailHeader.svelte'
  import { selectionActions } from '../library/selection-actions.svelte'
  import { anchorBelow } from '../menu/menu-anchor'
  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import { formatCount } from '../shared/text'
  import PlayAllButton from '../songs/PlayAllButton.svelte'
  import SongList from '../songs/SongList.svelte'
  import type { SongListView } from '../songs/view'
  import Cover from '../ui/Cover.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import SearchField from '../ui/SearchField.svelte'
  import DownloadsTasks from './DownloadsTasks.svelte'

  let { query = $bindable() }: { query: string } = $props()

  const SOURCE = { kind: 'downloads' } as const

  const view = getAppView()
  const { downloadsMenu } = getOverlays()
  const all = $derived(view.state.downloads.songs)
  /** 正在下载那一块每少一首，下面的列表就往上挪一行：让它重新量可见范围 */
  const taskCount = $derived(view.state.downloads.tasks.size)
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

  const actions = selectionActions()
  /** 已下载页能做的事（#79）：导出、删除；浏览器不能选文件夹时目录里就没有导出（ADR-0014）。登录与否都能多选 */
  const select = $derived({
    actions: [
      ...(view.state.exportable
        ? [
          actions.exportDownloads(),
        ]
        : []),
      actions.removeDownloads(),
    ],
    songs: () => all ?? [],
  })

  const openMenu = (event: MouseEvent): void => {
    const button = event.currentTarget as HTMLElement
    if (downloadsMenu.request?.from === button) {
      void downloadsMenu.close()
      return
    }
    downloadsMenu.open({
      from: button,
      anchor: anchorBelow(event),
    })
  }
</script>

{#snippet collage(size: number)}
  <div class='relative flex-none' style:width='{size}px' style:height='{size}px'>
    {#if covers.length === 0}
      <span class='grid size-full place-items-center rounded-xl bg-secondary-50 text-secondary-800' aria-hidden='true'>
        <CircleArrowDown size={size > 100
          ? 56
          : 34} strokeWidth={1.5} />
      </span>
    {:else if covers.length < 4}
      <Cover url={covers[0]} {size} eager class='rounded-xl shadow-ambient' />
    {:else}
      <div class='grid grid-cols-2 size-full overflow-hidden rounded-xl shadow-ambient' aria-hidden='true'>
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

{#snippet headerSearch(compact: boolean)}
  <SearchField
    label='在已下载里搜索'
    bind:value={query}
    placeholder={compact
      ? '搜索'
      : '在已下载里搜索'}
    class='max-w-[280px] min-w-[128px] w-full'
  />
{/snippet}

<DetailHeader title='已下载' phoneLayout='row' search={headerSearch}>
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
    {#if all && all.length > 0}
      <IconButton icon={MoreHorizontal} label='下载管理' title='下载管理' onclick={openMenu} />
    {/if}
  {/snippet}
</DetailHeader>

{#if phone && all && all.length > 0}
  <div class='px-4 pt-3'>
    <SearchField label='在已下载里搜索' bind:value={query} />
  </div>
{/if}

<DownloadsTasks />

<div class={phone ? '' : 'mt-6'}>
  <SongList
    list={listView}
    source={SOURCE}
    loadingLabel='正在读出这台设备上的下载'
    {search}
    skeleton={phone ? 8 : 10}
    headerHidden={false}
    label='已下载的歌曲'
    {phone}
    {select}
    remeasure={taskCount}
  />
</div>
