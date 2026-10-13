<!--
  专辑页：桌面是 200px 封面的头部（专辑名、“专辑 · 歌手 · 年份 · 几首”）、下面一段简介、白色面板里带曲序的歌曲行；
  手机是二级页面：返回栏、居中的封面头部、卡片里的简介、带曲序的歌曲行。
  本机副本到了、换了一张专辑时打开它（App 的 openAlbum：这次登录还没拉过就拉，没拉成时再打开就是重试）。
  返回这一页时滚动位置回到原来的样子
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { getAppView } from '$lib/components/app-context.svelte'
  import { failureText } from '$lib/components/failure'
  import { desktopLayout } from '$lib/components/layout'
  import AlbumDescription from '$lib/components/library/AlbumDescription.svelte'
  import Cover from '$lib/components/library/Cover.svelte'
  import SongList from '$lib/components/library/SongList.svelte'
  import { formatCount, langOf, yearOf } from '$lib/components/library/view'
  import { scrollSnapshot } from '$lib/components/snapshot'
  import StateBlock from '$lib/components/ui/StateBlock.svelte'

  const view = getAppView()
  const library = $derived(view.state.library)
  const id = $derived(Number(page.params.id))
  const opened = $derived(library?.albumPage(id) ?? null)
  const content = $derived(opened?.status === 'shown' ? opened.content : null)
  const album = $derived(content?.album ?? null)
  const year = $derived(album && yearOf(album.publishedAt))
  const description = $derived(album?.description?.trim() || null)

  export const snapshot = scrollSnapshot(() => null, () => {})

  const ready = $derived(library !== null)
  /** App 不知道这张专辑：还没打开过，或者存着的专辑页因为不再收藏被同步删掉、这次登录又没拉过 */
  const unknown = $derived(opened === null)
  // 副本到了、换了一张专辑、变成不知道的时候都交给 App：要不要拉由它判断（存着的歌曲数没变就不拉）
  $effect(() => {
    void unknown
    if (ready)
      void view.app.openAlbum(id)
  })

  const EMPTY = { title: '这张专辑暂时没有歌', body: '网易云音乐里这张专辑还没有能显示的歌。' }
</script>

<svelte:head><title>{album?.name ?? '专辑'} · Campanula</title></svelte:head>

{#snippet metaLine(phone: boolean)}
  {#if album && content}
    <p class={['flex flex-wrap items-center gap-x-1.5 text-neutral-600', phone ? 'mt-1.5 justify-center text-caption' : 'mt-2 text-label']}>
      {#if !phone}<span>专辑</span><span aria-hidden='true'>·</span>{/if}
      {#if album.artist.id > 0 && album.artist.name}
        <a
          href={resolve('/artists/[id]', { id: String(album.artist.id) })}
          class={['rounded text-primary-900 font-500 underline-offset-3 mouse:hover:underline', phone && 'min-h-8 inline-flex items-center']}
          lang={langOf(album.artist.name)}
        >{album.artist.name}</a>
      {:else}
        <span lang={langOf(album.artist.name ?? '')}>{album.artist.name ?? '未知歌手'}</span>
      {/if}
      {#if year}<span aria-hidden='true'>·</span><span class='tabular-nums'>{year}</span>{/if}
      <span aria-hidden='true'>·</span><span class='tabular-nums'>{formatCount(content.songs.length)} 首</span>
    </p>
  {/if}
{/snippet}

{#snippet failed()}
  {#if opened?.status === 'failed'}
    <StateBlock kind='error' title='这张专辑没能加载' body={failureText(opened.failure)} action={{ label: '重试', run: () => void view.app.openAlbum(id) }} />
  {/if}
{/snippet}

{#if library}
  {#if opened?.status === 'failed'}
    {@render failed()}
  {:else if desktopLayout.current}
    <div class='pt-2'>
      <header class='flex gap-7'>
        {#if album}
          <Cover url={album.coverUrl} size={200} eager class='rounded-xl shadow-ambient' />
          <div class='min-w-0 flex flex-1 flex-col pt-1'>
            <h1 class='line-clamp-2 break-words text-headline text-neutral-900 font-600' lang={langOf(album.name)}>{album.name}</h1>
            {@render metaLine(false)}
          </div>
        {:else}
          <span class='bone size-[200px] flex-none rounded-xl' aria-hidden='true'></span>
          <div class='min-w-0 flex flex-1 flex-col pt-2' aria-hidden='true'>
            <span class='bone h-7 w-2/5 rounded-full'></span>
            <span class='bone mt-4 h-3.5 w-1/4 rounded-full'></span>
          </div>
        {/if}
      </header>
      {#if description}<AlbumDescription text={description} />{/if}
      <div class='mt-6'><SongList songs={content?.songs ?? null} source={{ kind: 'album', id }} loadingLabel='正在加载专辑' empty={EMPTY} numbered /></div>
    </div>
  {:else}
    <header class='px-4 pt-2 text-center'>
      {#if album}
        <Cover url={album.coverUrl} size={168} eager class='mx-auto rounded-xl shadow-ambient' />
        <h1 class='line-clamp-2 mt-4 break-words text-headline-sm text-neutral-900 font-600' lang={langOf(album.name)}>{album.name}</h1>
        {@render metaLine(true)}
      {:else}
        <span class='bone mx-auto size-[168px] rounded-xl' aria-hidden='true'></span>
        <span class='bone mx-auto mt-5 h-6 w-1/2 rounded-full' aria-hidden='true'></span>
        <span class='bone mx-auto mt-3 h-3 w-1/3 rounded-full' aria-hidden='true'></span>
      {/if}
    </header>
    {#if description}<AlbumDescription text={description} phone />{/if}
    <div class='pt-3'><SongList songs={content?.songs ?? null} source={{ kind: 'album', id }} loadingLabel='正在加载专辑' empty={EMPTY} phone numbered /></div>
  {/if}
{/if}
