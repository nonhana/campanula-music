<!--
  歌手页：圆形头像的头部（歌手名、“几首歌 · 几张专辑”）、热门歌曲、专辑网格（新的在前，后面还有时“显示更多”）。
  桌面头像在左；手机是二级页面：返回栏、居中的头像头部、Auxio 式歌曲行、两列专辑。
  告诉 App 听众在看这一位歌手（viewing）：这次登录还没拉过就拉，没拉成时再打开（重试按钮）就是重试。
  骨架换成内容时骨架淡出，头部、热门歌曲、专辑格子各自依次飘入（DESIGN.md Motion）；“显示更多”加载进来的那些也依次飘入，没加载成的说明淡入，
  加载时按钮文字不变、转圈（没加载成时按钮是“重试”，重试时也还是“重试”），
  取完了按钮淡出。返回这一页时滚动位置回到原来的样子。头部播放热门歌曲旁边是收藏开关（桌面是“收藏 / 已收藏”胶囊，手机只留图标），点“已收藏”直接取消收藏、不确认
-->
<script lang='ts'>
  import type { PageProps } from './$types'
  import { resolve } from '$app/paths'
  import { UserRound } from '@lucide/svelte'
  import { tick } from 'svelte'
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import { failureText } from '#lib/components/failure.js'
  import { desktopLayout } from '#lib/components/layout.js'
  import AlbumTile from '#lib/components/library/AlbumTile.svelte'
  import CollectButton from '#lib/components/library/CollectButton.svelte'
  import Cover from '#lib/components/library/Cover.svelte'
  import PlayAllButton from '#lib/components/library/PlayAllButton.svelte'
  import SongList from '#lib/components/library/SongList.svelte'
  import { FLIGHT_COVER_SIZE, formatCount, langOf, yearOf } from '#lib/components/library/view.js'
  import { fadeAway, reveal, stagger } from '#lib/components/motion.js'
  import { pageHeading } from '#lib/components/shell/back-title.svelte.js'
  import { scrollSnapshot } from '#lib/components/snapshot.js'
  import ShowMore from '#lib/components/ui/ShowMore.svelte'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  const { params }: PageProps = $props()
  const view = getAppView()
  const library = $derived(view.state.library)
  const id = $derived(params.id)
  const opened = $derived(library?.artistPage(id) ?? null)
  const content = $derived(opened?.status === 'shown' ? opened.content : null)
  const artist = $derived(content?.artist ?? null)
  const more = $derived(content?.moreAlbums ?? null)
  /** 页头头像代表这一页：从格子点进来时，格子的头像飞到这里（Cover 的 flight） */
  const here = $derived(resolve('/artists/[id=neteaseId]', { id }))

  scrollSnapshot('/artists/[id=neteaseId]', () => null, () => {})

  // 听众在看这一位歌手：什么时候拉由 App 决定，换一位、本机状态变了不用页面再调一次
  $effect(() => view.app.viewing({ kind: 'artist', id }))

  const EMPTY = { title: '暂时没有热门歌曲' }

  let albumList = $state<HTMLUListElement>()
  /** 上一次“显示更多”之前已经有几张：后加进来的从第几张开始依次飘入 */
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
        <h1 class={['line-clamp-2 break-words text-neutral-900 font-600', phone ? 'mt-4 text-headline-sm' : 'text-headline']} lang={langOf(artist.name)} {@attach pageHeading(artist.name)}>{artist.name}</h1>
        <p class={['text-neutral-600 tabular-nums', phone ? 'mt-1.5 text-caption' : 'mt-2 text-label']}>
          {formatCount(artist.songCount)} 首歌 · {formatCount(artist.albumCount)} 张专辑
        </p>
        <div class={['flex items-center gap-2', phone ? 'mt-4 justify-center' : 'mt-6']}>
          <PlayAllButton songs={content?.hotSongs ?? null} source={{ kind: 'artist', id }} label='播放热门歌曲' />
          <CollectButton target={{ kind: 'artist', id }} name={artist.name} look='pill' />
        </div>
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
        <p class={['text-label text-neutral-600', phone ? 'px-4 pt-3' : 'mt-3']}>还没有专辑</p>
      {/if}
      <ul bind:this={albumList} class={['grid', phone ? 'grid-cols-2 gap-x-3 gap-y-5 px-4 pt-3' : 'mt-3 grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-6']} data-reveal-group>
        {#each content.albums as album, i (album.id)}
          <li class='min-w-0' in:stagger={{ order: i - appendedAt }}>
            <AlbumTile id={album.id} name={album.name} coverUrl={album.coverUrl} detail='' year={yearOf(album.publishedAt)} {phone} />
          </li>
        {/each}
      </ul>
      <ShowMore {more} onmore={() => void showMore()} failed='没能加载更多专辑' class={['pt-5', phone && 'justify-center px-4']} />
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
