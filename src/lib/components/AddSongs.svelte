<!--
  添加歌曲（#35 补充）：从自建歌单页的“添加歌曲”（头部操作行、空状态）打开。
  一打开聚焦搜索框：停手 300ms 才问网易云，只取单曲第一页；没搜时列我喜欢的音乐（还没同步完就说明一下）。
  每行是勾选框、封面、歌名、歌手；已经在当前歌单里的标“已在歌单里”、不能勾；重复勾只算一次（Map 按编号）。
  一次请求把勾选的全部加进去（App 的 addSongsToPlaylist），先改本地、立即生效，失败回滚并在提示条说明。
  桌面是居中弹窗，手机是底部弹层（和 #33 的编辑歌单一致），返回手势先收起它。
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { RequestFailure } from '#lib/app/api.js'
  import type { ChangeFailure } from '#lib/app/library.js'
  import type { AddSongsRequest } from './add-songs.svelte'
  import { page } from '$app/state'
  import { Check, SearchX, X } from '@lucide/svelte'
  import { SvelteMap } from 'svelte/reactivity'
  import { addSongsDialog } from './add-songs.svelte'
  import { getAppView } from './app-context.svelte'
  import { failureText } from './failure'
  import Cover from './library/Cover.svelte'
  import { changeFailureText } from './library/notice'
  import SkeletonRows from './library/SkeletonRows.svelte'
  import { artistLine, formatCount, langOf, playlistName } from './library/view'
  import VirtualList from './library/VirtualList.svelte'
  import { dialog, fade } from './motion'
  import { DURATIONS } from './motion-tokens'
  import { createDrawer } from './player/drawer.svelte'
  import Button from './ui/Button.svelte'
  import IconButton from './ui/IconButton.svelte'
  import Scrollbar from './ui/Scrollbar.svelte'
  import SearchField from './ui/SearchField.svelte'
  import StateBlock from './ui/StateBlock.svelte'

  /** 停手这么久（毫秒）才问网易云：和搜索框的建议一样，接着打字时不每个字问一次 */
  const SEARCH_DELAY = 300
  /** 选择器一行多高（px） */
  const ROW = 56
  /** 搜索结果的几种样子 */
  type SearchView
    = | { status: 'idle' }
      | { status: 'loading' }
      | { status: 'shown', songs: readonly Song[] }
      | { status: 'failed', failure: RequestFailure }

  const view = getAppView()
  const request = $derived(addSongsDialog.request)
  const library = $derived(view.state.library)
  const playlist = $derived(request ? library?.songsOf(request.playlistId)?.playlist ?? null : null)
  const liked = $derived(library?.liked ?? null)
  /** 这张歌单的全部曲目编号：已经在里面、不能勾（歌曲信息还没取全时也认得出） */
  const existing = $derived(new Set(library?.songsOf(request?.playlistId ?? -1)?.trackIds ?? []))

  let query = $state('')
  let search = $state<SearchView>({ status: 'idle' })
  const selected = new SvelteMap<number, Song>()
  let submitting = $state(false)
  /** 这一次没加进去的原因：显示在弹层里，不用关掉才看得到提示条 */
  let failure = $state<ChangeFailure | { kind: 'missing' } | null>(null)
  let searchInput = $state<HTMLInputElement>()
  let scroller = $state<HTMLElement>()
  let timer: ReturnType<typeof setTimeout> | undefined
  /** 每换一个词、重试一次就加一：回来的不是这一轮的不要 */
  let attempt = 0

  const term = $derived(query.trim())
  const songs = $derived(term ? (search.status === 'shown' ? search.songs : []) : liked?.songs ?? [])
  const chosen = $derived([...selected.values()])

  // 打开（或者换了一张歌单）：清掉上一回的状态
  $effect(() => {
    const id = request?.playlistId
    if (id === undefined)
      return
    query = ''
    search = { status: 'idle' }
    selected.clear()
    submitting = false
    failure = null
  })

  // 手机弹层要等浅路由和抽屉挂上才有搜索框：它出现时再聚焦，桌面也一样
  $effect(() => {
    if (request && searchInput)
      searchInput.focus({ preventScroll: true })
  })

  // 停手 300ms 才搜；接着打字时上一次的回来也不要
  $effect(() => {
    const keyword = query.trim()
    attempt += 1
    const mine = attempt
    if (timer)
      clearTimeout(timer)
    if (!keyword) {
      search = { status: 'idle' }
      return
    }
    search = { status: 'loading' }
    timer = setTimeout(async () => {
      const result = await view.app.searchSongs(keyword)
      if (mine !== attempt)
        return
      search = result.ok ? { status: 'shown', songs: result.value } : { status: 'failed', failure: result.failure }
    }, SEARCH_DELAY)
    return () => {
      if (timer)
        clearTimeout(timer)
    }
  })

  async function retry(): Promise<void> {
    const keyword = query.trim()
    if (!keyword)
      return
    attempt += 1
    const mine = attempt
    search = { status: 'loading' }
    const result = await view.app.searchSongs(keyword)
    if (mine !== attempt)
      return
    search = result.ok ? { status: 'shown', songs: result.value } : { status: 'failed', failure: result.failure }
  }

  function inPlaylist(song: Song): boolean {
    return existing.has(song.id)
  }

  function toggle(song: Song): void {
    if (inPlaylist(song) || submitting)
      return
    if (selected.has(song.id))
      selected.delete(song.id)
    else
      selected.set(song.id, song)
  }

  async function submit(): Promise<void> {
    if (!request || submitting || chosen.length === 0)
      return
    submitting = true
    failure = null
    const outcome = await view.app.addSongsToPlaylist(request.playlistId, chosen)
    submitting = false
    if (outcome?.ok) {
      selected.clear()
      addSongsDialog.close()
    }
    else if (outcome) {
      failure = outcome.failure
    }
  }

  function close(): void {
    if (!submitting)
      addSongsDialog.close()
  }

  const drawer = createDrawer(() => window.innerHeight - 24)
  const sheetOpen = $derived(request !== null && addSongsDialog.sheet && page.state.addSongsSheet === true)
  /** 正在加入时拖下去：弹回原位，不能关掉（和 PlaylistEditor 的新建中一样） */
  function settleBack(): void {
    if (submitting)
      drawer.settle(true)
    else
      close()
  }
  const gripHandle = drawer.grip({ from: 'open', commit: settleBack, tap: settleBack })
  const gripTitle = drawer.grip({ from: 'open', commit: settleBack })
  $effect(() => drawer.settle(sheetOpen))

  let acknowledged: AddSongsRequest | null = null
  $effect(() => {
    if (!request || !addSongsDialog.sheet)
      return
    if (page.state.addSongsSheet)
      acknowledged = request
    else if (acknowledged === request)
      addSongsDialog.dismiss(request)
  })

  // 换页（浏览器返回、链接）时关上，别让弹窗盖在新页面上
  $effect(() => {
    void page.url.pathname
    return () => {
      if (addSongsDialog.request)
        addSongsDialog.dismiss(addSongsDialog.request)
    }
  })

  // 窗口捕获阶段：焦点不在弹层里（例如刚打开、读屏移动）也能 Esc 关上；
  // 先于 SignedInFrame 的窗口监听把 Esc 用掉，不会先退出背后的多选
  $effect(() => {
    if (!request)
      return
    const onkeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape')
        return
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onkeydown, true)
    return () => window.removeEventListener('keydown', onkeydown, true)
  })
</script>

{#snippet title(classes: string)}
  <h2 id='add-songs-title' class={classes} {@attach gripTitle}>添加歌曲</h2>
{/snippet}

{#snippet checkbox(song: Song)}
  {@const checked = selected.has(song.id)}
  <span
    class={[
      'grid size-[22px] flex-none place-items-center rounded-md border-[1.5px]',
      checked ? 'border-primary-900 bg-primary-900 text-white' : 'border-neutral-500 bg-white',
    ]}
    aria-hidden='true'
  >
    {#if checked}<Check size={14} strokeWidth={3} />{/if}
  </span>
{/snippet}

{#snippet songRow(song: Song)}
  {@const disabled = inPlaylist(song)}
  <button
    type='button'
    role='checkbox'
    aria-checked={selected.has(song.id)}
    aria-disabled={disabled}
    class='h-full w-full flex items-center gap-3 pl-4 pr-3 text-left outline-none focus-visible:bg-primary-100 enabled:active:bg-primary-50'
    onclick={() => toggle(song)}
  >
    {@render checkbox(song)}
    <Cover url={song.album.coverUrl} size={40} class='rounded-md' />
    <span class='min-w-0 flex-1'>
      <span class='block truncate text-body text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</span>
      <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
    </span>
    {#if disabled}<span class='flex-none text-caption text-neutral-500'>已在歌单里</span>{/if}
  </button>
{/snippet}

{#snippet results()}
  {#if term}
    {#if search.status === 'loading'}
      <SkeletonRows count={6} label='正在搜索歌曲' />
    {:else if search.status === 'failed'}
      <StateBlock
        kind='error'
        title='没能搜索歌曲'
        body={failureText(search.failure)}
        action={{ label: '重试', run: () => void retry() }}
      />
    {:else if search.status === 'shown' && search.songs.length === 0}
      <StateBlock kind='empty' icon={SearchX} title={`没有搜到“${term}”`} body='换一个歌名或歌手名再试。' />
    {:else if search.status === 'shown'}
      <VirtualList items={songs} itemHeight={ROW} getKey={(song: Song) => song.id} scrollParent={scroller}>
        {#snippet row(song: Song)}{@render songRow(song)}{/snippet}
      </VirtualList>
    {/if}
  {:else if liked === null}
    <div class='px-4 pb-2 pt-1 text-caption text-neutral-600' role='status'>我喜欢的音乐还没同步完，同步到了就能从这里挑。</div>
    <SkeletonRows count={6} label='正在加载我喜欢的音乐' />
  {:else if liked.songs.length === 0 && liked.complete}
    <StateBlock kind='empty' icon={SearchX} title='我喜欢的音乐里还没有歌' body='搜一首歌，或者先去网易云音乐里红心几首。' />
  {:else}
    {#if !liked.complete}
      <p class='px-4 pb-2 pt-1 text-caption text-neutral-600' role='status'>我喜欢的音乐还没同步完，先显示已经同步的歌。</p>
    {/if}
    <VirtualList items={songs} itemHeight={ROW} getKey={(song: Song) => song.id} scrollParent={scroller}>
      {#snippet row(song: Song)}{@render songRow(song)}{/snippet}
    </VirtualList>
  {/if}
{/snippet}

{#snippet body()}
  <div class='px-4 pb-3'>
    <SearchField label='搜索歌曲' bind:value={query} bind:input={searchInput} />
    <p class='mt-2 min-h-4 px-1 text-caption text-neutral-600 tabular-nums' role='status'>
      {#if term && search.status === 'shown'}
        找到 {formatCount(search.songs.length)} 首
      {:else if !term && liked}
        我喜欢的音乐 · {formatCount(liked.songs.length)} 首
      {/if}
    </p>
  </div>
  <div bind:this={scroller} class='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
    <Scrollbar />
    {@render results()}
  </div>
  <div class='flex-none border-t border-neutral-100 px-4 py-3'>
    {#if failure}
      <p class='pb-2 text-caption text-error-700' role='alert'>
        {failure.kind === 'missing' ? '这张歌单已经不在了（可能在网易云音乐里删掉了）。' : changeFailureText(failure)}
      </p>
    {/if}
    <div class='flex items-center gap-3'>
      <span class='min-w-0 flex-1 text-caption text-neutral-600 tabular-nums'>已选 {formatCount(chosen.length)} 首</span>
      <Button variant='primary' disabled={chosen.length === 0 || submitting} onclick={() => void submit()}>
        {submitting ? '正在加入…' : '加入歌单'}
      </Button>
    </div>
  </div>
{/snippet}

{#if request && !addSongsDialog.sheet}
  <button type='button' class='fixed inset-0 z-70 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={close} transition:fade={{ duration: DURATIONS.state }}></button>
  <div class='pointer-events-none fixed inset-0 z-71 grid place-items-center p-6'>
    <div
      class='pointer-events-auto max-h-[calc(100dvh-48px)] max-w-[560px] w-full flex flex-col rounded-xl bg-white shadow-float'
      role='dialog'
      aria-modal='true'
      aria-labelledby='add-songs-title'
      tabindex='-1'
      transition:dialog
    >
      <div class='flex flex-none items-center gap-3 pb-2 pl-6 pr-4 pt-5'>
        <div class='min-w-0 flex-1'>
          {@render title('text-title-sm text-neutral-900 font-600')}
          {#if playlist}<p class='truncate text-caption text-neutral-600' lang={langOf(playlistName(playlist))}>加入「{playlistName(playlist)}」</p>{/if}
        </div>
        <IconButton icon={X} label='关闭' disabled={submitting} onclick={close} />
      </div>
      {@render body()}
    </div>
  </div>
{/if}

{#if request && addSongsDialog.sheet && (sheetOpen || drawer.visible)}
  <button type='button' class='fixed inset-0 z-70 bg-neutral-900/30' style:opacity={1 - drawer.position} aria-label='关闭' tabindex='-1' onclick={close}></button>
  <div
    class='fixed inset-x-0 top-6 z-71 flex flex-col rounded-t-sheet bg-white shadow-float'
    {@attach drawer.panel}
    role='dialog'
    tabindex='-1'
    aria-modal='true'
    aria-labelledby='add-songs-title'
    inert={!sheetOpen}
  >
    <div class='grid h-6 flex-none touch-none place-items-center' aria-hidden='true' {@attach gripHandle}>
      <span class='h-1 w-9 rounded-full bg-neutral-300'></span>
    </div>
    <div class='flex flex-none items-center gap-2 px-4 pb-2'>
      {@render title('min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-600')}
      <button type='button' class='h-11 rounded-full px-3 text-body text-neutral-700 active:bg-neutral-100' onclick={close}>取消</button>
    </div>
    {@render body()}
  </div>
{/if}
