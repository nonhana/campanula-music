<!--
  专辑页：桌面是 200px 封面头部（名字、“歌手 · 年份 · 几首”、一行简介）、白色面板里带曲序的歌曲行；手机是返回栏 + 居中封面头部（最下面两行简介）+ 歌曲行。
  头部交给 DetailHeader（#75）。告诉 App 听众在看这一张专辑（viewing），什么时候拉由 App 决定；播放全部旁边的“下载”把整张专辑排进下载队列（#39）。滚动位置随浏览历史恢复。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { CircleArrowDown } from '@lucide/svelte'

  import CollectButton from '#lib/components/library/CollectButton.svelte'
  import DetailHeader from '#lib/components/library/DetailHeader.svelte'
  import { selectionActions } from '#lib/components/library/selection-actions.svelte.js'
  import { getOverlays } from '#lib/components/overlay/overlay-context.js'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { failureText } from '#lib/components/shared/failure.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { reveal } from '#lib/components/shared/motion.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'
  import { formatCount, langOf, yearOf } from '#lib/components/shared/text.js'
  import { creditLink } from '#lib/components/songs/credit-link.js'
  import PlayAllButton from '#lib/components/songs/PlayAllButton.svelte'
  import SongList from '#lib/components/songs/SongList.svelte'
  import type { SongListView } from '#lib/components/songs/view.js'
  import Button from '#lib/components/ui/Button.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  import type { PageProps } from './$types'

  const { params }: PageProps = $props()
  const view = getAppView()
  const { downloadPicker } = getOverlays()
  const library = $derived(view.state.library)
  const id = $derived(params.id)
  const opened = $derived(library?.albumPage(id) ?? null)
  const content = $derived(opened?.status === 'shown'
    ? opened.content
    : null)
  const album = $derived(content?.album ?? null)
  const year = $derived(album && yearOf(album.publishedAt))
  const description = $derived(album?.description?.trim() || null)
  const phone = $derived(!desktopLayout.current)
  const here = $derived(resolve('/albums/[id=neteaseId]', { id }))

  scrollSnapshot('/albums/[id=neteaseId]', () => null, () => {})

  // 听众在看这一张专辑：什么时候拉、本机副本删掉后要不要重拉由 App 决定
  $effect(() => view.app.viewing({ kind: 'album', id }))

  const listView = $derived.by((): SongListView => {
    if (!content)
      return { kind: 'loading' }
    if (content.songs.length === 0)
      return { kind: 'empty', title: '这张专辑暂时没有歌' }
    return { kind: 'songs', songs: content.songs }
  })

  const actions = selectionActions()
  /** 专辑页能做的事（#82）：加入歌单（目标是新建和全部自建歌单）、下载记成这张专辑 */
  const select = $derived({
    actions: [
      actions.addToPlaylist(),
      actions.download(() => ({
        kind: 'album',
        id,
        name: album?.name ?? '',
      })),
    ],
  })
</script>

<svelte:head><title>{album?.name ?? '专辑'} · Campanula</title></svelte:head>

{#snippet artistLink(onPhone: boolean)}
  {#if album}
    {@const link = creditLink('artist', album.artist, page.url.pathname)}
    {#if link}
      <!-- 手机上点按范围上下各撑出 6px（32px 高），不撑高信息行：和骨架一样高，换成内容时不跳 -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- 地址由 credit-link.ts 用 resolve() 拼好 -->
      <a href={link.href}
         class={['rounded text-primary-900 font-500 underline-offset-3 mouse:hover:underline', onPhone && 'relative before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-empty']}
         lang={langOf(link.name)}
      >{link.name}</a>
    {:else}
      <span lang={langOf(album.artist.name ?? '')}>{album.artist.name ?? '未知歌手'}</span>
    {/if}
  {/if}
{/snippet}

{#if library}
  {#if opened?.status === 'failed'}
    <div in:reveal><StateBlock kind='error' title='这张专辑没能加载' body={failureText(opened.failure)} action={{
      label: '重试',
      run: () => void view.app.openAlbum(id),
    }} /></div>
  {:else}
    <DetailHeader
      ready={!!album}
      cover={{ url: album?.coverUrl ?? null }}
      title={album?.name ?? ''}
      flight={here}
      {description}
    >
      {#snippet meta(onPhone: boolean)}
        {#if album && content}
          {@render artistLink(onPhone)}
          {#if year}<span aria-hidden='true'>·</span><span class='tabular-nums'>{year}</span>{/if}
          <span aria-hidden='true'>·</span><span class='tabular-nums'>{formatCount(content.songs.length)} 首</span>
        {/if}
      {/snippet}
      {#snippet actions()}
        {#if album}
          <PlayAllButton songs={content?.songs ?? null} source={{ kind: 'album', id }} />
          <Button variant='download' icon={CircleArrowDown} disabled={!view.state.online || !content || content.songs.length === 0} onclick={(event: MouseEvent) => downloadPicker.open({
            kind: 'album',
            albumId: id,
            from: event.currentTarget as HTMLElement,
          })}>下载</Button>
          <CollectButton target={{ kind: 'album', id }} name={album.name} look='pill' />
        {/if}
      {/snippet}
    </DetailHeader>
    <div class={phone ? 'pt-1' : 'mt-6'}>
      <SongList list={listView} source={{ kind: 'album', id }} loadingLabel='正在加载专辑' {phone} virtual={false} staggerRows={false} numbered {select} />
    </div>
  {/if}
{/if}
