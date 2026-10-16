<!--
  歌手页：圆形头像的头部（歌手名、“歌手 · 几首歌 · 几张专辑”）、热门歌曲、专辑网格（新的在前，后面还有时“显示更多专辑”）。
  桌面头像在左；手机是二级页面：返回栏、居中的头像头部、Auxio 式歌曲行、两列专辑。
  本机副本到了、换了一位歌手时打开（App 的 openArtist：这次登录还没拉过就拉，没拉成时再打开就是重试）。
  骨架换成内容时骨架淡出，头部、热门歌曲、专辑格子各自依次飘入（DESIGN.md Motion）；“显示更多专辑”加载进来的那些也依次飘入，没加载成的说明淡入，
  取完了按钮淡出。返回这一页时滚动位置回到原来的样子
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { getAppView } from '$lib/components/app-context.svelte'
  import { failureText } from '$lib/components/failure'
  import { desktopLayout } from '$lib/components/layout'
  import AlbumTile from '$lib/components/library/AlbumTile.svelte'
  import Cover from '$lib/components/library/Cover.svelte'
  import SongList from '$lib/components/library/SongList.svelte'
  import { FLIGHT_COVER_SIZE, formatCount, langOf, yearOf } from '$lib/components/library/view'
  import { fade, fadeAway, reveal, stagger } from '$lib/components/motion'
  import { scrollSnapshot } from '$lib/components/snapshot'
  import Button from '$lib/components/ui/Button.svelte'
  import StateBlock from '$lib/components/ui/StateBlock.svelte'
  import { CircleAlert, UserRound } from '@lucide/svelte'
  import { tick } from 'svelte'

  const view = getAppView()
  const library = $derived(view.state.library)
  const id = $derived(Number(page.params.id))
  const opened = $derived(library?.artistPage(id) ?? null)
  const content = $derived(opened?.status === 'shown' ? opened.content : null)
  const artist = $derived(content?.artist ?? null)
  const more = $derived(content?.moreAlbums ?? null)
  /** 页头头像代表这一页：从格子点进来时，格子的头像飞到这里（Cover 的 flight） */
  const here = $derived(resolve('/artists/[id]', { id: String(id) }))

  export const snapshot = scrollSnapshot(() => null, () => {})

  // App 还不知道这位歌手（第一次打开、换了一位、重新登录后）：打开它
  const unknown = $derived(library !== null && opened === null)
  $effect(() => {
    if (unknown)
      void view.app.openArtist(id)
  })

  const EMPTY = { title: '暂时没有热门歌曲', body: '网易云音乐里这位歌手还没有能显示的热门歌曲。' }

  let albumList = $state<HTMLUListElement>()
  /** 上一次“显示更多专辑”之前已经有几张：后加进来的从第几张开始依次飘入 */
  let appendedAt = $state(0)
  async function showMore() {
    const shown = content?.albums.length ?? 0
    appendedAt = shown
    await view.app.moreArtistAlbums(id)
    await tick()
    // 取完了，按钮跟着不见：焦点移到新出来的第一张，免得掉回页面最上面
    if (!more)
      albumList?.querySelectorAll('a')[shown]?.focus()
  }
</script>

<svelte:head><title>{artist?.name ?? '歌手'} · Campanula</title></svelte:head>

{#snippet header(phone: boolean)}
  {#if artist}
    <header class={phone ? 'px-4 pt-2 text-center' : 'flex items-center gap-8'} in:reveal>
      <Cover url={artist.avatarUrl} size={FLIGHT_COVER_SIZE} fluid={phone} eager flight={here} fallback={UserRound} class={['rounded-full shadow-ambient', phone && 'mx-auto max-w-[168px]']} />
      <div class='min-w-0 flex-1'>
        <h1 class={['line-clamp-2 break-words text-neutral-900 font-600', phone ? 'mt-4 text-headline-sm' : 'text-headline']} lang={langOf(artist.name)}>{artist.name}</h1>
        <p class={['text-neutral-600 tabular-nums', phone ? 'mt-1.5 text-caption' : 'mt-2 text-label']}>
          歌手 · {formatCount(artist.songCount)} 首歌 · {formatCount(artist.albumCount)} 张专辑
        </p>
      </div>
    </header>
  {:else}
    <div class={phone ? 'px-4 pt-2' : 'flex items-center gap-8'} aria-hidden='true' out:fadeAway>
      <span class={['bone flex-none rounded-full', phone ? 'mx-auto size-[168px]' : 'size-[200px]']}></span>
      <div class='min-w-0 flex-1'>
        <span class={['bone h-7 w-2/5 rounded-full', phone ? 'mx-auto mt-5' : '']}></span>
        <span class={['bone mt-4 h-3.5 w-1/4 rounded-full', phone && 'mx-auto']}></span>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet albums(phone: boolean)}
  {#if content}
    <section class={phone ? 'pt-6' : 'mt-10 pb-6'} aria-labelledby='artist-albums' in:reveal>
      <h2 id='artist-albums' class={['text-neutral-900 font-600', phone ? 'px-4 text-title-sm' : 'text-title']}>专辑</h2>
      {#if content.albums.length === 0 && !more}
        <p class={['text-label text-neutral-600', phone ? 'px-4 pt-3' : 'mt-3']}>网易云音乐里这位歌手还没有专辑。</p>
      {/if}
      <ul bind:this={albumList} class={['grid', phone ? 'grid-cols-2 gap-x-3 gap-y-5 px-4 pt-3' : 'mt-3 grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-6']} data-reveal-group>
        {#each content.albums as album, i (album.id)}
          {@const year = yearOf(album.publishedAt)}
          <li class='min-w-0' in:stagger={{ order: i - appendedAt }}>
            <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail={year === null ? '' : String(year)} {phone} />
          </li>
        {/each}
      </ul>
      {#if more}
        <div class={['flex flex-wrap items-center gap-3 pt-5', phone ? 'justify-center px-4' : '']} out:fade>
          {#if more.status === 'failed'}
            <p class='min-w-0 flex items-center gap-2 text-caption text-neutral-700' role='alert' in:fade>
              <CircleAlert size={16} class='flex-none text-error-700' aria-hidden='true' />
              <span>后面的专辑没能加载。{failureText(more.failure)}</span>
            </p>
          {/if}
          <Button
            variant='outline'
            aria-disabled={more.status === 'loading'}
            aria-busy={more.status === 'loading'}
            onclick={showMore}
          >
            {more.status === 'loading' ? '正在加载…' : more.status === 'failed' ? '重试' : '显示更多专辑'}
          </Button>
        </div>
      {/if}
    </section>
  {/if}
{/snippet}

{#if library}
  {#if opened?.status === 'failed'}
    <div in:reveal><StateBlock kind='error' title='这位歌手的页面没能加载' body={failureText(opened.failure)} action={{ label: '重试', run: () => void view.app.openArtist(id) }} /></div>
  {:else if desktopLayout.current}
    <div class='pt-2'>
      {@render header(false)}
      <section class='mt-10' aria-labelledby='artist-hot'>
        <h2 id='artist-hot' class='text-title text-neutral-900 font-600'>热门歌曲</h2>
        <div class='mt-3'><SongList songs={content?.hotSongs ?? null} source={{ kind: 'artist', id }} loadingLabel='正在加载热门歌曲' empty={EMPTY} /></div>
      </section>
      {@render albums(false)}
    </div>
  {:else}
    {@render header(true)}
    <section class='pt-6' aria-labelledby='artist-hot'>
      <h2 id='artist-hot' class='px-4 text-title-sm text-neutral-900 font-600'>热门歌曲</h2>
      <div class='pt-1'><SongList songs={content?.hotSongs ?? null} source={{ kind: 'artist', id }} loadingLabel='正在加载热门歌曲' empty={EMPTY} phone /></div>
    </section>
    {@render albums(true)}
  {/if}
{/if}
